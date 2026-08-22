// True inside the real Tauri shell, false in a plain browser tab. Lets
// api.ts fall back to fixture data so the UI can be previewed and iterated
// on in the Browser pane without relaunching the native app for every CSS
// change — the whole reason this project moved off gpui in the first
// place. Always true in the shipped app; this file has no effect there.
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
