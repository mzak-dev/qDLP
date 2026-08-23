# Unified job grid redesign

Status: approved
Date: 2026-08-23

## Problem

The current UI is a sidebar job-list + detail-pane layout (`App.tsx`, `routes/library.tsx`,
`routes/job-detail.tsx`, `components/job-list-item.tsx`). The user wants a media-library feel
instead: one grid of thumbnails, hover previews, drag-to-reorder, a shared-element detail
view, and a custom context menu — prioritizing fluid, continuous motion over conventional
navigation ("even if UX is worse").

## Non-goals

- No backend/Rust changes. `Job`/`Item`/`QFile` and the Tauri commands in `lib/api.ts` are
  unchanged; this is presentation-layer only.
- No per-kind pages (Downloads vs. Convert). One grid holds both `kind`s.
- No server-side persisted tile order — reordering is a client-only `localStorage` concern.

## Top bar

Below `TitleBar`, a single row replaces the old sidebar:

- **Settings gear** (far left, standalone icon button) — routes to `/settings` (unchanged
  content, unchanged route).
- **"+" split button** (far right) — primary click opens the existing `NewDownloadDialog`;
  a small caret opens a menu with one item, "New Convert", opening `NewConvertDialog`. Both
  dialogs are reused as-is (`trigger` prop already supports a custom trigger).

No Downloads/Convert tab switcher. No per-job list.

## Grid

Route `/` renders one grid, replacing `library.tsx` + `job-detail.tsx`. Two sections, in
fixed order, each with a heading — a section is omitted entirely when it has no jobs; if both
are empty, show the existing "no jobs yet" empty state:

1. **In Progress** — `isActive(job.state)` jobs (queued/probing/running), across both kinds.
2. **Done** — everything else (done/failed/cancelled), across both kinds.

Within a section: `grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`, gap-4, newest-first
unless the user has dragged a custom order (see Reordering).

## Tile (`job-tile.tsx`)

- 16:9 thumbnail: first item's `thumb_path` if present, else a kind icon placeholder
  (download vs. convert icon).
- **Hover preview**: only when the job has a `video` file already on disk (done jobs).
  On hover, swap the `<img>` for a muted, looping `<video>` (same path-resolution helper
  `video-player.tsx` uses) that plays from `t=0`, capped at ~4s then loops. In-progress tiles
  never show this — they have no finished file yet.
- **Status pill**: text depends on `kind`/`state`:
  - `download` + active → "In Progress"
  - `download` + done → "Downloaded"
  - `convert` + active → "In Progress"
  - `convert` + done → "Converted"
  - `failed`/`cancelled` → "Failed" (existing destructive badge styling)
- In-progress tiles show the existing compact `JobProgress` bar under the title instead of
  (or below) the pill.
- Title, truncated, below the thumbnail.

**Left click** → opens the detail bubble (see below).
**Right click** → custom context menu (new `ui/context-menu.tsx`, a shadcn-style wrapper over
Radix's context-menu primitive from the already-installed `radix-ui` package). Actions mirror
today's `job-detail.tsx` action set: Open Externally, Show in folder, Retry (if
`isRetryable(state)`), Convert (download jobs with a video file — opens `NewConvertDialog`
pre-filled), Delete.

## Reordering (`lib/tile-order.ts`)

Each section is a framer-motion `Reorder.Group` (built into the already-installed
`framer-motion`, no new dependency) of `Reorder.Item`s — drag physics and layout reflow are
free. The resulting id order is written to `localStorage` (one key per section, e.g.
`qdlp:order:in-progress`, `qdlp:order:done`). On load: known ids render in stored order;
ids in storage no longer present in `jobs` are dropped; jobs not yet in storage are prepended
(newest-first). A job moving from "In Progress" to "Done" on completion simply leaves the
first list and appends to the front of the second — no cross-section drag needed.

## Detail bubble (`job-detail-bubble.tsx`)

Clicking a tile does not navigate. A `layoutId={job.id}` shared element (framer-motion) grows
from the tile's on-screen rect to a centered bubble (~55% of viewport width/height) over a
dimmed backdrop:

- Content: video player (or the running-job progress view, reusing what `job-detail.tsx` has
  today) + title + the same action buttons as the context menu, laid out under the player.
- Top-right: two circular icon buttons — **maximize** and **close**.
- **Maximize**: the same `layoutId` element grows again to fill the viewport; the two circular
  buttons are replaced by a single back-arrow button, top-left.
- **Back** (fullscreen stage) or **close** (bubble stage) both collapse the same element back
  down into the originating tile's rect and unmount it, revealing the grid. One shared
  element, one exit animation regardless of which stage it's closed from.

This replaces `job-morph-provider.tsx`'s ghost-title-fly hack outright — that component only
made sense when a sidebar row and a detail header coexisted; neither exists in this shape, so
it (and `lib/job-morph.ts`) are deleted rather than kept unused.

## Convert drag-and-drop

Unchanged from the earlier round of this spec: dropping a file anywhere over the window (via
Tauri v2's `getCurrentWebview().onDragDropEvent`, which gives real filesystem paths — the
browser File API cannot in a webview) starts a convert job immediately with the last-used
format, landing in the grid's "In Progress" section. "Last-used" is a single `localStorage`
key (`qdlp:last-convert-format`) written every time `NewConvertDialog` submits; it defaults to
`"mp4"` when unset. `lib/drag-drop.ts` wraps the drop listener and is a
no-op outside Tauri, following the existing `tauri-env.ts` pattern. The dashed drop-zone
affordance only needs to render while a drag is in progress (highlight-on-dragover), since
there's no dedicated Convert page to frame permanently.

## Files

New: `components/top-bar.tsx`, `components/job-tile.tsx`, `components/job-grid.tsx`,
`components/job-detail-bubble.tsx`, `components/job-context-menu.tsx`,
`components/ui/context-menu.tsx`, `lib/tile-order.ts`, `lib/drag-drop.ts`.

Rewritten: `App.tsx` (top bar + grid instead of sidebar + outlet), `main.tsx` (routes become
`/` and `/settings` only).

Deleted: `routes/library.tsx`, `routes/job-detail.tsx`, `components/job-list-item.tsx`,
`components/job-morph-provider.tsx`, `lib/job-morph.ts`.

Unchanged: `lib/api.ts`, `lib/events.ts`, `lib/types.ts`, `new-download-dialog.tsx`,
`new-convert-dialog.tsx`, `file-list.tsx`, `video-player.tsx`, `job-progress.tsx` (reused
inside tiles and the bubble), `routes/settings.tsx`, all of `src-tauri`.

## Animation summary

Framer-motion stays the sole animation library (already installed; no anime.js) per the
existing spring-smoothed progress bar and job-list add/remove precedent:

- Grid entrance/reflow: `AnimatePresence` + `layout` on tiles.
- Reordering: `Reorder.Group`/`Reorder.Item`.
- Tile → bubble → fullscreen → tile: one `layoutId` shared element throughout.
- Hover preview: CSS/video, no motion library involvement.
- Split button, context menu, drop-zone highlight: small opacity/scale transitions consistent
  with the rest of the app's existing motion feel.
