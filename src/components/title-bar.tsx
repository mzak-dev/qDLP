// Replaces the OS-drawn title bar (tauri.conf.json: windows[0].decorations
// = false) with our own, styled to match the rest of the app instead of
// standing out as native chrome bolted onto a custom UI.
//
// data-tauri-drag-region makes the bar itself draggable (and
// double-click-to-maximize, for free) — Tauri excludes real interactive
// elements like the buttons below from that behavior automatically, so
// nothing here needs pointer-event gymnastics to keep them clickable.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { isTauri } from "@/lib/tauri-env";

function currentWindow() {
  return isTauri() ? getCurrentWindow() : null;
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = currentWindow();
    if (!win) return;
    void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => void win.isMaximized().then(setMaximized));
    return () => void unlisten.then((f) => f());
  }, []);

  return (
    <div data-tauri-drag-region className="flex h-9 shrink-0 select-none items-center justify-between border-b pl-4">
      <span className="pointer-events-none text-sm font-semibold tracking-tight">qDLP</span>
      <div className="flex h-full">
        <button
          onClick={() => void currentWindow()?.minimize()}
          className="hover:bg-muted flex h-full w-11 items-center justify-center transition-colors"
          aria-label="Minimize"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => void currentWindow()?.toggleMaximize()}
          className="hover:bg-muted flex h-full w-11 items-center justify-center transition-colors"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />}
        </button>
        <button
          onClick={() => void currentWindow()?.close()}
          className="hover:bg-destructive hover:text-destructive-foreground flex h-full w-11 items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
