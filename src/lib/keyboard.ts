// Shared guard for global keydown listeners (title-bar.tsx, job-grid.tsx):
// don't hijack a key while the user is typing in a field, or while a Radix
// Dialog (New Download/Convert) is open and handling its own keyboard
// interaction (a Select's arrow keys, an Input's every keystroke).
export function isTypingOrInDialog(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
  return !!target.closest('[role="dialog"]');
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
}

/** "Ctrl" on Windows/Linux, "⌘" on macOS — matches the modifier key actually used. */
export function modKey(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}
