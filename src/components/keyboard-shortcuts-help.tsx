// The "?" button in the title bar (and the "?" key itself) opens this —
// the one place all the shortcuts wired up across title-bar.tsx,
// job-grid.tsx, and job-detail-bubble.tsx are actually documented, each row
// paired with the same icon its own button/action uses elsewhere in the UI.

import { ArrowLeftRight, CornerDownLeft, Move, Plus, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isMac } from "@/lib/keyboard";

const MOD = isMac() ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { icon: Plus, label: "New Download", keys: [MOD, "N"] },
  { icon: ArrowLeftRight, label: "New Convert", keys: [MOD, "Shift", "N"] },
  { icon: SettingsIcon, label: "Settings", keys: [MOD, ","] },
  { icon: Move, label: "Move between tiles", keys: ["↑", "↓", "←", "→"] },
  { icon: CornerDownLeft, label: "Open selected tile", keys: ["Enter"] },
  { icon: Trash2, label: "Delete (in the open tile)", keys: [MOD, "Delete"] },
  { icon: X, label: "Close", keys: ["Esc"] },
];

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="divide-y">
          {SHORTCUTS.map(({ icon: Icon, label, keys }) => (
            <li key={label} className="flex items-center justify-between gap-4 py-2">
              <span className="flex items-center gap-2">
                <Icon className="text-muted-foreground size-4 shrink-0" />
                {label}
              </span>
              <span className="flex shrink-0 gap-1">
                {keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
