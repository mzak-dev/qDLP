// Right-click menu for a grid tile — the same action set job-detail.tsx
// used to expose as buttons, now reachable without opening the tile first.

import { useState, type ReactNode } from "react";
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
          {video && <ContextMenuItem onSelect={() => void openFile(video.path)}>Open Externally</ContextMenuItem>}
          {video && <ContextMenuItem onSelect={() => void revealFile(video.path)}>Show in folder</ContextMenuItem>}
          {isRetryable(job.state) && <ContextMenuItem onSelect={() => onRetry(job)}>Retry</ContextMenuItem>}
          {job.kind === "download" && video && <ContextMenuItem onSelect={() => setConvertOpen(true)}>Convert</ContextMenuItem>}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => onDelete(job)}>
            Delete
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
