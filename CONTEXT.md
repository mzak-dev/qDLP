# qDLP

A native Windows desktop app that wraps `yt-dlp` and `ffmpeg`: paste a URL, get a video; pick a local file, convert it. Rust backend (Tauri), React frontend.

## Language

**Job**:
The aggregate root — one download or one conversion, start to finish. Has an id, a kind, a state, and the items it produced.
_Avoid_: Task, request

**JobKind**:
Which of the two things a Job is: `Download` (fetches a URL) or `Convert` (re-encodes a local file). Both share one state machine and one table, distinguished only by this field.
_Avoid_: Type, mode

**JobState**:
Where a Job is in its lifecycle: `Queued → Probing → Running → Done | Failed | Cancelled`. `Probing` only applies to downloads — a cheap metadata fetch before the real run starts.
_Avoid_: Status

**Item**:
One video within a Job. A single-video download produces one Item; a playlist produces many, in playlist order.
_Avoid_: Entry, video (a video is what an Item *represents*; the Item is the record of it)

**File**:
One output artifact belonging to an Item — the video itself, an embedded-or-sidecar thumbnail, a subtitle track, or the yt-dlp-written info JSON. Classified by **FileKind**.
_Avoid_: Output, artifact

**Preset**:
A named bundle of yt-dlp options, chosen when starting a download. Presets *are* the yt-dlp configuration — there is no separate global options layer, so what a download did is always explainable from the preset it names plus any per-run override.
_Avoid_: Profile, config

**Probe**:
The cheap, `--flat-playlist` metadata preview shown while a URL is being typed, before any Job exists. Distinguishes a single video from a playlist and gives an item count.
_Avoid_: Preview (Probe is the mechanism; the preview is what it produces)

**ConvertFormat**:
A fixed target container+codec pair for a Convert Job — `mp4`, `mkv`, `webm`, or `mp3`. Deliberately not a free-form codec picker: each variant bakes in a codec pair known to work together.
_Avoid_: Output format

**Library**:
The one screen listing every Job, filterable by JobState and JobKind. Replaces the earlier Download/Convert/In-Progress tab bar, which mixed two JobKind arms with a JobState filter as if they were peers — they weren't. "New Download" and "New Convert" are actions on the Library, not separate screens.
_Avoid_: Dashboard, home

**Domain state** / **View state**:
The split this app's architecture is built on. Domain state — Jobs, Items, Files, Presets, settings — lives only in Rust, persisted to SQLite. View state — which route is active, whether a dialog is open, form drafts — lives only in React. Neither side holds a copy of the other's state; React reads domain state through commands and "job-event"/"convert-event" pushes.
_Avoid_: App state (too broad — always say which side)
