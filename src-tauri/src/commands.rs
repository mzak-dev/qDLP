//! The entire React-facing API.

use crate::domain::{classify, is_retryable, sibling_thumbnail, state_after_failure};
use crate::model::{File, Item, Job, JobKind, JobState, Preset, new_id};
use crate::runner::{self, CancelHandle, ConvertEvent, ConvertFormat};
use crate::store::Store;
use crate::ytdlp::{Event, YtdlpOptions};
use futures::StreamExt;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// One in-flight download or convert: its kill switch, whether cancel_job
/// was called (so the exit-triggered failure doesn't relabel a deliberate
/// cancel as Failed — domain::state_after_failure's whole reason to exist),
/// and the last log line, kept as the best available explanation if it
/// fails.
struct RunningJob {
    cancel: CancelHandle,
    cancelled: bool,
    last_log: String,
}

/// Domain state, owned by Rust per the settled state-ownership decision.
/// React never sees this directly — only what commands and the "job-event"/
/// "convert-event" pushes hand it.
pub struct AppState {
    running: Mutex<HashMap<String, RunningJob>>,
    // rusqlite calls run synchronously on whatever thread invokes them,
    // including the async command's tokio worker thread. Fine for a
    // single-user local DB at this size; if a write ever measurably stalls
    // the UI, move call sites to tauri::async_runtime::spawn_blocking.
    store: Mutex<Store>,
}

impl AppState {
    pub fn new(store: Store) -> Self {
        Self { running: Mutex::new(HashMap::new()), store: Mutex::new(store) }
    }
}

#[derive(Clone, serde::Serialize)]
struct JobEventPayload {
    job_id: String,
    event: Event,
}

#[derive(Clone, serde::Serialize)]
struct ConvertEventPayload {
    job_id: String,
    event: ConvertEvent,
}

fn default_options(download_dir: String) -> YtdlpOptions {
    // The same 1080p/mp4/embed-everything shape as Preset::seeds's
    // "Best (1080p mp4)" — the real preset picker is still a later phase.
    YtdlpOptions {
        download_dir,
        embed_thumbnail: true,
        embed_metadata: true,
        max_height: Some(1080),
        container: Some("mp4".into()),
        ..Default::default()
    }
}

/// Shared by create_download and retry_job: spawns yt-dlp for `job` (already
/// Running), tracks it, and forwards its events over "job-event" until it
/// settles, at which point the job row is saved with its final state.
fn launch_download(app: AppHandle, state: &State<'_, AppState>, mut job: Job, opts: YtdlpOptions) -> Result<String, String> {
    let exe = runner::ytdlp_path(None).map_err(|e| e.to_string())?;
    let download = runner::spawn_download(&exe, &job.url, &opts).map_err(|e| e.to_string())?;

    state.store.lock().unwrap().save_job(&job).map_err(|e| e.to_string())?;
    state.running.lock().unwrap().insert(
        job.id.clone(),
        RunningJob { cancel: download.cancel_handle(), cancelled: false, last_log: String::new() },
    );

    let mut events = download.events;
    let job_id = job.id.clone();
    let return_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.next().await {
            let payload = JobEventPayload { job_id: job_id.clone(), event: event.clone() };
            let _ = app.emit("job-event", payload);

            // Accumulated in memory only, per store.rs's own persistence
            // rule — flushed to the DB on the terminal save_job below, not
            // per event. The frontend already has these live from the
            // "job-event" push above; this is what makes them survive after
            // the job settles and the page is revisited or the app restarts.
            match &event {
                Event::Info(info) => {
                    job.items.push(Item {
                        id: new_id("itm"),
                        index: info.playlist_index.unwrap_or(job.items.len() as i64),
                        title: info.title.clone().unwrap_or_default(),
                        duration: info.duration,
                        thumb_path: info.thumbnail.clone(),
                        webpage_url: info.webpage_url.clone().unwrap_or_default(),
                        files: Vec::new(),
                    });
                    continue;
                }
                Event::File(path) => {
                    if let Some(item) = job.items.last_mut() {
                        if !item.files.iter().any(|f| &f.path == path) {
                            let bytes = std::fs::metadata(path).ok().map(|m| m.len() as i64);
                            item.files.push(File { id: new_id("fil"), path: path.clone(), kind: classify(path), format_id: None, bytes });
                            // after_move only reports the video itself; the
                            // cover --write-thumbnail left beside it has to
                            // be found by stem, same as the original app.
                            if let Some(thumb) = sibling_thumbnail(path) {
                                item.files.push(File {
                                    id: new_id("fil"),
                                    path: thumb,
                                    kind: crate::model::FileKind::Thumbnail,
                                    format_id: None,
                                    bytes: None,
                                });
                            }
                        }
                    }
                    continue;
                }
                _ => {}
            }

            let Event::Log(line) = &event else { continue };
            let app_state = app.state::<AppState>();

            if line == runner::EXIT_OK || line.starts_with(runner::EXIT_FAIL_PREFIX) {
                let Some(finished) = app_state.running.lock().unwrap().remove(&job_id) else { continue };
                job.state = if line == runner::EXIT_OK {
                    JobState::Done
                } else {
                    state_after_failure(if finished.cancelled { JobState::Cancelled } else { JobState::Running })
                };
                job.error =
                    (job.state != JobState::Done).then(|| if finished.last_log.is_empty() { line.clone() } else { finished.last_log });
                let _ = app_state.store.lock().unwrap().save_job(&job);
            } else if let Some(running) = app_state.running.lock().unwrap().get_mut(&job_id) {
                running.last_log = line.clone();
            }
        }
    });

    Ok(return_id)
}

/// Mirrors launch_download exactly — same child-tracking shape, same
/// cancel/settle logic — just over "convert-event" and ConvertEvent instead.
fn launch_convert(app: AppHandle, state: &State<'_, AppState>, mut job: Job, format: ConvertFormat) -> Result<String, String> {
    let ffmpeg = runner::ffmpeg_path(None).map_err(|e| e.to_string())?;
    let convert = runner::spawn_convert(&ffmpeg, std::path::Path::new(&job.url), format).map_err(|e| e.to_string())?;

    state.store.lock().unwrap().save_job(&job).map_err(|e| e.to_string())?;
    state.running.lock().unwrap().insert(
        job.id.clone(),
        RunningJob { cancel: convert.cancel_handle(), cancelled: false, last_log: String::new() },
    );

    let mut events = convert.events;
    let job_id = job.id.clone();
    let return_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.next().await {
            let payload = ConvertEventPayload { job_id: job_id.clone(), event: event.clone() };
            let _ = app.emit("convert-event", payload);

            let ConvertEvent::Log(line) = &event else { continue };
            let app_state = app.state::<AppState>();

            if line == runner::EXIT_OK || line.starts_with(runner::EXIT_FAIL_PREFIX) {
                let Some(finished) = app_state.running.lock().unwrap().remove(&job_id) else { continue };
                job.state = if line == runner::EXIT_OK {
                    JobState::Done
                } else {
                    state_after_failure(if finished.cancelled { JobState::Cancelled } else { JobState::Running })
                };
                job.error =
                    (job.state != JobState::Done).then(|| if finished.last_log.is_empty() { line.clone() } else { finished.last_log });
                let _ = app_state.store.lock().unwrap().save_job(&job);
            } else if let Some(running) = app_state.running.lock().unwrap().get_mut(&job_id) {
                running.last_log = line.clone();
            }
        }
    });

    Ok(return_id)
}

#[tauri::command]
pub async fn probe_url(url: String) -> Result<runner::Probe, String> {
    let exe = runner::ytdlp_path(None).map_err(|e| e.to_string())?;
    runner::probe(exe, url).await.map_err(|_| "probe thread died".to_string())?.map_err(|e| e.to_string())
}

/// Starts a download and returns its job id immediately; progress arrives
/// over "job-event". No preset system yet — this takes the same defaults
/// `Preset::seeds` uses for "Best (1080p mp4)".
#[tauri::command]
pub async fn create_download(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    download_dir: String,
) -> Result<String, String> {
    let mut job = Job::new(&url, "default");
    job.title = url.clone();
    job.state = JobState::Running;
    launch_download(app, &state, job, default_options(download_dir))
}

#[tauri::command]
pub async fn create_convert(app: AppHandle, state: State<'_, AppState>, source_path: String, format: ConvertFormat) -> Result<String, String> {
    let mut job = Job::new_convert(&source_path, format.as_str());
    job.title = runner::convert_output_path(std::path::Path::new(&source_path), format)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| source_path.clone());
    job.state = JobState::Running;
    launch_convert(app, &state, job, format)
}

/// Only Failed/Cancelled jobs qualify (domain::is_retryable). Re-runs under
/// the *same* job id so the Library row continues rather than duplicating.
/// download_dir is required even for a convert retry's signature simplicity,
/// but only used for the Download branch — convert jobs write beside their
/// own source file and don't need one.
#[tauri::command]
pub async fn retry_job(app: AppHandle, state: State<'_, AppState>, job_id: String, download_dir: String) -> Result<(), String> {
    let mut job = state
        .store
        .lock()
        .unwrap()
        .load_jobs()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|j| j.id == job_id)
        .ok_or_else(|| format!("no job {job_id}"))?;

    if !is_retryable(job.state) {
        return Err(format!("job {job_id} is not retryable (state: {})", job.state.as_str()));
    }
    job.state = JobState::Running;
    job.error = None;

    match job.kind {
        JobKind::Download => launch_download(app, &state, job, default_options(download_dir)),
        JobKind::Convert => {
            let format = ConvertFormat::parse(&job.preset.clone());
            launch_convert(app, &state, job, format)
        }
    }
    .map(|_| ())
}

#[tauri::command]
pub fn cancel_job(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    match running.get_mut(&job_id) {
        Some(job) => {
            job.cancelled = true;
            job.cancel.cancel();
            Ok(())
        }
        None => Err(format!("no running job {job_id}")),
    }
}

#[tauri::command]
pub fn list_jobs(state: State<'_, AppState>) -> Result<Vec<Job>, String> {
    state.store.lock().unwrap().load_jobs().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_job(state: State<'_, AppState>, job_id: String) -> Result<Option<Job>, String> {
    let jobs = state.store.lock().unwrap().load_jobs().map_err(|e| e.to_string())?;
    Ok(jobs.into_iter().find(|j| j.id == job_id))
}

#[tauri::command]
pub fn delete_job(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    state.store.lock().unwrap().delete_job(&job_id).map_err(|e| e.to_string())
}

// -- presets -----------------------------------------------------------

#[tauri::command]
pub fn list_presets(state: State<'_, AppState>) -> Result<Vec<Preset>, String> {
    state.store.lock().unwrap().load_presets().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_preset(state: State<'_, AppState>, preset: Preset) -> Result<(), String> {
    state.store.lock().unwrap().save_preset(&preset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_preset(state: State<'_, AppState>, name: String) -> Result<(), String> {
    state.store.lock().unwrap().delete_preset(&name).map_err(|e| e.to_string())
}

// -- settings ------------------------------------------------------------

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.store.lock().unwrap().get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.store.lock().unwrap().set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_ytdlp() -> Result<String, String> {
    let exe = runner::ytdlp_path(None).map_err(|e| e.to_string())?;
    runner::update_ytdlp(exe).await.map_err(|_| "update thread died".to_string())?.map_err(|e| e.to_string())
}

// -- shell integration -----------------------------------------------------

#[tauri::command]
pub fn open_file(path: String) {
    runner::open_path(&path);
}

#[tauri::command]
pub fn reveal_file(path: String) {
    runner::reveal_path(&path);
}

#[tauri::command]
pub fn open_bin_dir() {
    runner::open_bin_dir();
}
