import { FileAudio, FileText, FileVideo, Image as ImageIcon, MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { openFile, revealFile } from "@/lib/api";
import type { FileKind, QFile } from "@/lib/types";

const ICONS: Record<FileKind, LucideIcon> = {
  video: FileVideo,
  audio: FileAudio,
  subtitle: FileText,
  thumbnail: ImageIcon,
  info: FileText,
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  const mb = bytes / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1000).toFixed(0)} KB`;
}

export function FileList({ files }: { files: QFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((f) => {
        const Icon = ICONS[f.kind];
        return (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2">
            <Icon className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm">{fileName(f.path)}</span>
            <span className="text-muted-foreground shrink-0 text-xs">{formatBytes(f.bytes)}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void openFile(f.path)}>Open</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void revealFile(f.path)}>Show in folder</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ul>
  );
}
