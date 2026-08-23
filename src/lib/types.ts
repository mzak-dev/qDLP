// Hand-written mirror of src-tauri/src/{model,runner,ytdlp}.rs. Field names
// match the Rust structs' own field names (no camelCase rename on the Rust
// side), so this file is the map back to where each type actually lives.

export type JobKind = "download" | "convert";
export type JobState = "queued" | "probing" | "running" | "done" | "failed" | "cancelled";
export type FileKind = "video" | "audio" | "subtitle" | "thumbnail" | "info";

// -- model.rs -----------------------------------------------------------

export interface QFile {
  id: string;
  path: string;
  kind: FileKind;
  format_id: string | null;
  bytes: number | null;
}

export interface Item {
  id: string;
  index: number;
  title: string;
  duration: number | null;
  thumb_path: string | null;
  webpage_url: string;
  files: QFile[];
}

export interface Job {
  id: string;
  kind: JobKind;
  /** Download: the source URL. Convert: the source file path. */
  url: string;
  title: string;
  /** Download: the preset name. Convert: the ConvertFormat key (e.g. "mp4"). */
  preset: string;
  state: JobState;
  error: string | null;
  created_at: number;
  items: Item[];
}

// -- ytdlp.rs: YtdlpOptions ---------------------------------------------

// Serde's default externally-tagged representation: a unit variant is a bare
// string, not {"BestVideoAudio": null} — only the variants carrying data get
// wrapped in an object keyed by variant name.
export type FormatMode = "BestVideoAudio" | { AudioOnly: { codec: string } } | { Custom: string };

export interface YtdlpOptions {
  format: FormatMode;
  max_height: number | null;
  container: string | null;
  output_template: string;
  download_dir: string;
  subtitle_langs: string[];
  embed_subs: boolean;
  embed_thumbnail: boolean;
  embed_metadata: boolean;
  sponsorblock_remove: string | null;
  rate_limit: string | null;
  concurrent_fragments: number;
  cookies_from_browser: string | null;
  download_archive: boolean;
  retries: number;
  extra_args: string[];
}

export interface Preset {
  name: string;
  is_default: boolean;
  options: YtdlpOptions;
}

// -- runner.rs: probe -----------------------------------------------------

export interface Thumbnail {
  url: string | null;
}

export interface ProbeEntry {
  id: string | null;
  title: string | null;
  duration: number | null;
  url: string | null;
  thumbnails: Thumbnail[] | null;
}

export interface Probe {
  kind: string | null; // "video" | "playlist"
  id: string | null;
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
  webpage_url: string | null;
  uploader: string | null;
  playlist_count: number | null;
  entries: ProbeEntry[] | null;
}

export function probeIsPlaylist(p: Probe): boolean {
  return p.kind === "playlist";
}

/** Mirrors Probe::item_count exactly. */
export function probeItemCount(p: Probe): number {
  if (!probeIsPlaylist(p)) return 1;
  return p.entries?.length ?? p.playlist_count ?? 0;
}

// -- runner.rs: convert -----------------------------------------------------

export type ConvertFormat = "mp4" | "mkv" | "webm" | "mp3";

export const CONVERT_FORMATS: { value: ConvertFormat; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264/AAC)" },
  { value: "mkv", label: "MKV (H.264/AAC)" },
  { value: "webm", label: "WebM (VP9/Opus)" },
  { value: "mp3", label: "MP3 (audio only)" },
];

export interface ConvertProgress {
  out_time_secs: number | null;
  speed: number | null;
}

export type ConvertEvent =
  | { type: "progress"; data: ConvertProgress }
  | { type: "log"; data: string };

// -- ytdlp.rs: download events --------------------------------------------

export interface Progress {
  status: string | null;
  downloaded_bytes: number | null;
  total_bytes: number | null;
  total_bytes_estimate: number | null;
  speed: number | null;
  eta: number | null;
  filename: string | null;
  fragment_index: number | null;
  fragment_count: number | null;
}

export interface InfoLine {
  id: string | null;
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
  webpage_url: string | null;
  playlist_index: number | null;
}

export type JobEvent =
  | { type: "progress"; data: Progress }
  | { type: "info"; data: InfoLine }
  | { type: "file"; data: string }
  | { type: "log"; data: string };

/** The "job-event" push payload, one per yt-dlp stdout line, unthrottled. */
export interface JobEventPayload {
  job_id: string;
  event: JobEvent;
}

/** The "convert-event" push payload — same shape, ffmpeg-driven. */
export interface ConvertEventPayload {
  job_id: string;
  event: ConvertEvent;
}

// Terminal log lines appended by runner.rs's event pump. Mirror
// runner::EXIT_OK / runner::EXIT_FAIL_PREFIX exactly.
export const EXIT_OK = "RDLP_EXIT ok";
export const EXIT_FAIL_PREFIX = "RDLP_EXIT fail ";

/** 0..1, or null when the size is genuinely unknown. Mirrors Progress::fraction. */
export function progressFraction(p: Progress): number | null {
  if (p.downloaded_bytes == null) return null;
  const total =
    p.total_bytes && p.total_bytes > 0
      ? p.total_bytes
      : p.total_bytes_estimate && p.total_bytes_estimate > 0
        ? p.total_bytes_estimate
        : null;
  if (total == null) return null;
  return Math.min(1, Math.max(0, p.downloaded_bytes / total));
}

// -- domain.rs mirrors ------------------------------------------------------

export function isActive(state: JobState): boolean {
  return state === "queued" || state === "probing" || state === "running";
}

export function isRetryable(state: JobState): boolean {
  return state === "failed" || state === "cancelled";
}

/** The video file to preview/play for a job, if any of its items has one yet. */
export function firstVideoFile(job: Job): QFile | null {
  return job.items.flatMap((i) => i.files).find((f) => f.kind === "video") ?? null;
}
