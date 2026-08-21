//! First-run (and first-launch-after-upgrade) copy of the bundled yt-dlp/
//! ffmpeg/ffprobe binaries into `%LOCALAPPDATA%\qDLP\bin`, where runner.rs's
//! own resolution order finds them and where `yt-dlp -U` can self-update
//! without elevation — the whole reason that directory is writable and not
//! Program Files.
//!
//! ponytail: version comparison is a plain string compare on yt-dlp's own
//! `--version` output (a `YYYY.MM.DD[.rev]` date string, which happens to
//! sort correctly as text in the common case). Good enough for the one
//! binary that self-updates; move to real date parsing if yt-dlp ever
//! changes its version format in a way that breaks the ordering.

use crate::runner::{bin_dir, exe_name};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Where Tauri's `bundle.externalBin` actually drops sidecar binaries at
/// install time: directly beside the app's own executable. Not the same as
/// runner::exe_relative_bin_dir()'s `<exe_dir>/bin` — that's a *different*,
/// portable-zip-style location runner.rs's own resolve() chain also checks.
fn bundled_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(Path::to_path_buf)
}

fn version_of(exe: &Path) -> Option<String> {
    if !exe.is_file() {
        return None;
    }
    let out = Command::new(exe).arg("--version").output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn copy_if_missing(bundled: &Path, dest: &Path) {
    if bundled.is_file() && !dest.is_file() {
        let _ = std::fs::copy(bundled, dest);
    }
}

/// Copies yt-dlp only if the bundled copy is missing locally or is a newer
/// version than what's already there — so a user's own `yt-dlp -U` is never
/// clobbered by an older bundled build, but a corrupted or stale local copy
/// does get repaired by reinstalling the app.
fn seed_ytdlp(bundled_dir: &Path, dest_dir: &Path) {
    let bundled = bundled_dir.join(exe_name("yt-dlp"));
    let dest = dest_dir.join(exe_name("yt-dlp"));
    if !bundled.is_file() {
        return;
    }
    let should_copy = match (version_of(&dest), version_of(&bundled)) {
        (None, _) => true,
        (Some(local), Some(bundled_v)) => bundled_v > local,
        (Some(_), None) => false,
    };
    if should_copy {
        let _ = std::fs::copy(&bundled, &dest);
    }
}

/// Runs once at startup, off the main thread's critical path is not
/// necessary here — it's a handful of file-existence checks and at most one
/// small copy. Never fatal: a failure just means runner.rs's own resolution
/// order falls through to PATH or reports its usual self-diagnosing error,
/// exactly as it would if this function didn't exist.
pub fn seed_binaries() {
    let Some(bundled) = bundled_dir() else { return };
    let dest = bin_dir();
    let _ = std::fs::create_dir_all(&dest);

    seed_ytdlp(&bundled, &dest);
    copy_if_missing(&bundled.join(exe_name("ffmpeg")), &dest.join(exe_name("ffmpeg")));
    copy_if_missing(&bundled.join(exe_name("ffprobe")), &dest.join(exe_name("ffprobe")));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_ytdlp_copies_when_local_is_missing() {
        let src_dir = std::env::temp_dir().join(crate::model::new_id("seed-src"));
        let dst_dir = std::env::temp_dir().join(crate::model::new_id("seed-dst"));
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::create_dir_all(&dst_dir).unwrap();

        std::fs::write(src_dir.join(exe_name("yt-dlp")), b"bundled").unwrap();
        seed_ytdlp(&src_dir, &dst_dir);
        assert!(dst_dir.join(exe_name("yt-dlp")).is_file());

        let _ = std::fs::remove_dir_all(&src_dir);
        let _ = std::fs::remove_dir_all(&dst_dir);
    }

    #[test]
    fn seed_ytdlp_does_nothing_when_bundled_copy_is_absent() {
        let src_dir = std::env::temp_dir().join(crate::model::new_id("seed-src"));
        let dst_dir = std::env::temp_dir().join(crate::model::new_id("seed-dst"));
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::create_dir_all(&dst_dir).unwrap();

        seed_ytdlp(&src_dir, &dst_dir);
        assert!(!dst_dir.join(exe_name("yt-dlp")).exists());

        let _ = std::fs::remove_dir_all(&src_dir);
        let _ = std::fs::remove_dir_all(&dst_dir);
    }

    #[test]
    fn copy_if_missing_never_overwrites_an_existing_destination() {
        let src_dir = std::env::temp_dir().join(crate::model::new_id("seed-src"));
        let dst_dir = std::env::temp_dir().join(crate::model::new_id("seed-dst"));
        std::fs::create_dir_all(&src_dir).unwrap();
        std::fs::create_dir_all(&dst_dir).unwrap();

        let name = exe_name("ffmpeg");
        std::fs::write(src_dir.join(&name), b"bundled").unwrap();
        std::fs::write(dst_dir.join(&name), b"already-here").unwrap();

        copy_if_missing(&src_dir.join(&name), &dst_dir.join(&name));
        assert_eq!(std::fs::read(dst_dir.join(&name)).unwrap(), b"already-here");

        let _ = std::fs::remove_dir_all(&src_dir);
        let _ = std::fs::remove_dir_all(&dst_dir);
    }
}
