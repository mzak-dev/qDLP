// Right-click menu for a grid tile — the same action set job-detail.tsx
// used to expose as buttons, now reachable without opening the tile first.

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, ExternalLink, FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { openFile, revealFile } from "@/lib/api";
import { firstVideoFile, isRetryable, type Job } from "@/lib/types";
import { useJobsContext } from "@/lib/jobs-context";

export function JobContextMenu({ job, children }: { job: Job; children: ReactNode }) {
  const { onRetry, onDelete, onCreated } = useJobsContext();
  const [convertOpen, setConvertOpen] = useState(false);
  const video = firstVideoFile(job);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          {video && (
            <ContextMenuItem onSelect={() => void openFile(video.path)}>
              <ExternalLink className="size-4" /> Open Externally
            </ContextMenuItem>
          )}
          {video && (
            <ContextMenuItem onSelect={() => void revealFile(video.path)}>
              <FolderOpen className="size-4" /> Show in folder
            </ContextMenuItem>
          )}
          {isRetryable(job.state) && (
            <ContextMenuItem onSelect={() => onRetry(job)}>
              <RotateCcw className="size-4" /> Retry
            </ContextMenuItem>
          )}
          {job.kind === "download" && video && (
            <ContextMenuItem onSelect={() => setConvertOpen(true)}>
              <ArrowLeftRight className="size-4" /> Convert
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => onDelete(job)}>
            <Trash2 className="size-4" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {video && (
        <NewConvertDialog
          trigger={null}
          open={convertOpen}
          onOpenChange={setConvertOpen}
          defaultSource={video.path}
          onCreated={(jobId, path) => onCreated(jobId, path, path.split(/[\\/]/).pop() ?? path, "convert")}
        />
      )}
    </>
  );
}
