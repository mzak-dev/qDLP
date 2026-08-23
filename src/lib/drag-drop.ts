// Real filesystem paths on drop, not the browser File API (which a webview
// sandboxes to a nameless Blob with no path) — see tauri-env.ts for why the
// isTauri() guard exists at all: this is a no-op in a plain browser tab.

import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "./tauri-env";

export interface FileDropListeners {
  onDragOver?: () => void;
  onDragLeave?: () => void;
  onDrop?: (paths: string[]) => void;
}

export function subscribeFileDrop(listeners: FileDropListeners): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | undefined;
  let cancelled = false;
  void getCurrentWebview()
    .onDragDropEvent((event) => {
      switch (event.payload.type) {
        case "enter":
        case "over":
          listeners.onDragOver?.();
          break;
        case "drop":
          listeners.onDrop?.(event.payload.paths);
          break;
        case "leave":
          listeners.onDragLeave?.();
          break;
      }
    })
    .then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}
