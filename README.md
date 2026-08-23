# qDLP

A native Windows desktop app wrapping `yt-dlp` and `ffmpeg` — paste a URL, get a video; pick a file, convert it. Successor to [rustyDLP](https://github.com/mzak-dev/rustydlp), ported from a `gpui` native UI to Tauri + React so UI iteration doesn't require a Rust rebuild.

## Stack

- **Backend**: Rust ([Tauri](https://tauri.app) 2), `rusqlite` for persistence, plain `std::process::Command` for yt-dlp/ffmpeg (see [docs/adr/0001](docs/adr/0001-plain-command-not-tauri-plugin-shell.md))
- **Frontend**: React + TypeScript, [ShadCN](https://ui.shadcn.com), [Framer Motion](https://motion.dev), Tailwind v4
- **Domain vocabulary**: [CONTEXT.md](CONTEXT.md). Architectural decisions: [docs/adr/](docs/adr/)

## Development

```bash
npm install
npm run tauri -- dev
```

Requires the Rust toolchain and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows.

Backend tests: `cargo test --manifest-path src-tauri/Cargo.toml` (two are `#[ignore]`d — they hit the real network and a real yt-dlp binary; run with `-- --ignored`).

## Bundled binaries

`yt-dlp`, `ffmpeg`, and `ffprobe` ship via Tauri's `externalBin` from `src-tauri/binaries/<name>-x86_64-pc-windows-msvc.exe`. On first run, `seed.rs` copies them into `%LOCALAPPDATA%\qDLP\bin` — the writable location `yt-dlp -U` self-updates from without elevation. Populate `src-tauri/binaries/` before running `npm run tauri -- build`; it's gitignored.

## Building

```bash
npm run tauri -- build
```

Produces an NSIS installer under `src-tauri/target/release/bundle/nsis/`.

## CI/CD

`.github/workflows/rust.yml` runs on every push to `main` and every PR:

1. **test** — `tsc --noEmit`, `cargo clippy -D warnings`, `cargo test`
2. **build** — `npx tauri build`, uploaded as a workflow artifact
3. **release** _(push to `main` only)_ — tags and publishes a GitHub release with the installer attached

`src-tauri/Cargo.toml` is the single source of truth for the version. On a push to `main`, if that version wasn't changed by the push, CI bumps the patch number (`0.0.1`) automatically and commits it back before building — so releases never collide on a stale tag. Bump the version yourself (any segment) in a commit to opt out of the auto-bump for that push.
