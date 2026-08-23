import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "./tauri-env";

// WebView2 is Chromium: it plays MP4 (H.264/AAC) and WebM (VP9/Opus)
// natively. It does NOT play the MKV container, which ConvertFormat still
// offers as MkvH264Aac — same codecs as MP4, different (unsupported)
// container. HEVC and exotic audio codecs inside an otherwise-playable
// container aren't covered by this extension check either; onError on the
// <video> element is the actual fallback trigger for those.
const PLAYABLE_EXTENSIONS = new Set(["mp4", "m4v", "webm", "ogg", "mp3", "wav", "m4a", "opus"]);

function extensionOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

export function isLikelyPlayable(path: string): boolean {
  return PLAYABLE_EXTENSIONS.has(extensionOf(path));
}

/**
 * Local file path -> a src a <video>/<img> can load. convertFileSrc reads
 * window.__TAURI_INTERNALS__ unguarded and throws synchronously outside the
 * real shell, so this is a no-op passthrough there (see tauri-env.ts).
 */
export function assetSrc(path: string): string {
  return isTauri() ? convertFileSrc(path) : path;
}
