// Replaces the OS-drawn title bar (tauri.conf.json: windows[0].decorations
// = false) with our own, styled to match the rest of the app instead of
// standing out as native chrome bolted onto a custom UI.
//
// The grid's own controls (Settings gear, the New Download/Convert split
// button) live in this same row rather than a separate bar underneath —
// there's no per-job sidebar footer anymore for them to sit in, and a
// second full-width row under a 9-36px title bar reads as redundant chrome.
// They're hidden on /settings: that route has its own back button already
// (routes/settings.tsx), and "New Download" has nothing to do with it.
//
// data-tauri-drag-region makes the bar itself draggable (and
// double-click-to-maximize, for free) — Tauri excludes real interactive
// elements like the buttons below from that behavior automatically, so
// nothing here needs pointer-event gymnastics to keep them clickable.
//
// The attribute does NOT cascade to descendants the way a CSS property
// would: Tauri's drag handler only fires when the exact clicked element
// carries data-tauri-drag-region. A plain wrapper div around the grid
// controls (no attribute of its own) silently eats every click in its
// bounding box — including its own empty padding — so the two spacer divs
// below are explicitly tagged rather than relying on being "empty".

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChevronDown, Copy, HelpCircle, Minus, Plus, Settings as SettingsIcon, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewDownloadDialog } from "@/components/new-download-dialog";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { isTauri } from "@/lib/tauri-env";
import { isTypingOrInDialog, modKey } from "@/lib/keyboard";
import type { JobKind } from "@/lib/types";

function currentWindow() {
  return isTauri() ? getCurrentWindow() : null;
}

export function TitleBar({ onCreated }: { onCreated?: (jobId: string, urlOrPath: string, title: string, kind: JobKind) => void }) {
  const [maximized, setMaximized] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const showGridControls = useLocation().pathname === "/" && onCreated;
  const navigate = useNavigate();

  useEffect(() => {
    const win = currentWindow();
    if (!win) return;
    void win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => void win.isMaximized().then(setMaximized));
    return () => void unlisten.then((f) => f());
  }, []);

  // Global app shortcuts: New Download/Convert only make sense (and only
  // have a dialog mounted) on the grid, Settings and Help work from
  // anywhere. See keyboard-shortcuts-help.tsx for the user-facing list.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingOrInDialog(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (modKey(e) && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (modKey(e) && e.key.toLowerCase() === "n" && showGridControls) {
        e.preventDefault();
        if (e.shiftKey) setConvertOpen(true);
        else setDownloadOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate, showGridControls]);

  return (
    <div data-tauri-drag-region className="flex h-11 shrink-0 select-none items-center border-b pl-4">
      <span className="pointer-events-none text-sm font-semibold tracking-tight">qDLP</span>

      <div data-tauri-drag-region className="h-full flex-1" />

      {showGridControls && (
        <div className="flex items-center gap-2">
          <Button asChild size="icon-sm" variant="ghost" aria-label="Settings">
            <Link to="/settings">
              <SettingsIcon className="size-4" />
            </Link>
          </Button>

          <div className="flex">
            <Button size="sm" className="rounded-r-none" onClick={() => setDownloadOpen(true)}>
              <Plus className="size-4" /> New Download
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="border-primary-foreground/20 rounded-l-none border-l px-1.5" aria-label="More create options">
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setConvertOpen(true)}>New Convert</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <NewDownloadDialog trigger={null} open={downloadOpen} onOpenChange={setDownloadOpen} onCreated={(id, url, title) => onCreated!(id, url, title, "download")} />
          <NewConvertDialog
            trigger={null}
            open={convertOpen}
            onOpenChange={setConvertOpen}
            onCreated={(id, path) => onCreated!(id, path, path.split(/[\\/]/).pop() ?? path, "convert")}
          />
        </div>
      )}

      <Button size="icon-sm" variant="ghost" aria-label="Keyboard shortcuts" onClick={() => setHelpOpen(true)}>
        <HelpCircle className="size-4" />
      </Button>

      <div data-tauri-drag-region className="h-full w-3" />

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

      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
