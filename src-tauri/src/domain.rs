//! Pure `Job`/`File` logic with no UI or IO dependency.
//!
//! These functions lived inside gpui's `app.rs` in rustyDLP even though none
//! of them touch gpui — they were stranded there, not designed there. Moving
//! them here is a relocation, not a rewrite: bodies and tests are unchanged.
//! `filter_jobs`/`SidebarTab` did not come along — they encoded the old
//! Download/Convert/In-Progress tab bar, which the Library IA replaces with
//! frontend filter chips over `JobState`/`JobKind` on the full job list.

use crate::model::{FileKind, JobState};

/// Single definition of "still working". The sidebar filter and the detail
/// pane's Cancel button previously each had their own copy and had already
/// drifted — one counted Probing, the other didn't.
pub fn is_active(state: JobState) -> bool {
    matches!(state, JobState::Queued | JobState::Probing | JobState::Running)
}

/// Only a job that stopped short can be retried; Done has nothing to redo.
pub fn is_retryable(state: JobState) -> bool {
    matches!(state, JobState::Failed | JobState::Cancelled)
}

/// Killing the child makes yt-dlp exit non-zero, which the event pump reports
/// as a failure. A deliberate cancel must not be relabelled by its own kill.
pub fn state_after_failure(current: JobState) -> JobState {
    if current == JobState::Cancelled {
        JobState::Cancelled
    } else {
        JobState::Failed
    }
}

pub fn classify(path: &str) -> FileKind {
    let lower = path.to_lowercase();
    let ext = lower.rsplit('.').next().unwrap_or("");
    match ext {
        "srt" | "vtt" | "ass" => FileKind::Subtitle,
        "jpg" | "jpeg" | "png" | "webp" => FileKind::Thumbnail,
        "json" => FileKind::Info,
        "m4a" | "mp3" | "opus" | "ogg" | "flac" | "wav" => FileKind::Audio,
        _ => FileKind::Video,
    }
}

/// Finds the cover written by `--write-thumbnail` next to a media file.
/// webp first: that is yt-dlp's native output.
pub fn sibling_thumbnail(media_path: &str) -> Option<String> {
    let path = std::path::Path::new(media_path);
    let stem = path.file_stem()?;
    let dir = path.parent()?;
    for ext in ["webp", "jpg", "png", "jpeg"] {
        let candidate = dir.join(stem).with_extension(ext);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

pub fn file_name(path: &str) -> String {
    path.rsplit(['\\', '/']).next().unwrap_or(path).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `after_move` reports only the video file, so the cover has to be
    /// located by stem. webp must win: it is yt-dlp's native output.
    #[test]
    fn sibling_thumbnail_finds_the_cover_by_stem() {
        let dir = std::env::temp_dir().join(crate::model::new_id("thumb-test"));
        std::fs::create_dir_all(&dir).unwrap();

        let video = dir.join("Some Video [abc123].mp4");
        std::fs::write(&video, b"x").unwrap();
        let video_s = video.to_string_lossy().to_string();

        // No cover on disk yet.
        assert_eq!(sibling_thumbnail(&video_s), None);

        // A .jpg alone is found.
        let jpg = dir.join("Some Video [abc123].jpg");
        std::fs::write(&jpg, b"x").unwrap();
        assert_eq!(sibling_thumbnail(&video_s), Some(jpg.to_string_lossy().to_string()));

        // With both present, webp wins.
        let webp = dir.join("Some Video [abc123].webp");
        std::fs::write(&webp, b"x").unwrap();
        assert_eq!(sibling_thumbnail(&video_s), Some(webp.to_string_lossy().to_string()));

        // A different video in the same folder must not borrow this cover.
        let other = dir.join("Other.mp4");
        std::fs::write(&other, b"x").unwrap();
        assert_eq!(sibling_thumbnail(&other.to_string_lossy()), None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Cancelling kills the child, which makes yt-dlp exit non-zero, which the
    /// event pump delivers as a failure. Without this rule every cancelled job
    /// would immediately relabel itself "Failed" with a spurious error.
    #[test]
    fn cancelling_survives_the_failure_its_own_kill_causes() {
        assert_eq!(state_after_failure(JobState::Cancelled), JobState::Cancelled);
        assert_eq!(state_after_failure(JobState::Running), JobState::Failed);
        assert_eq!(state_after_failure(JobState::Queued), JobState::Failed);
    }
}
