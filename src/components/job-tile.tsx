// One grid tile: thumbnail (swaps to a short looping hover preview once a
// video file exists), status pill, title, and — for active jobs — the
// existing compact progress bar. The inner box carries layoutId={job.id},
// shared with job-detail-bubble.tsx, so opening a tile grows this exact
// box into the bubble/fullscreen view instead of a generic modal fade-in.
//
// layoutId lives on an inner motion.div, not the Reorder.Item itself:
// Reorder.Item already runs its own `layout` animation for drag-reordering,
// and framer-motion supports nesting an independent shared-layoutId
// animation inside a layout-animated parent, but not sharing one prop
// between both roles.

import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { Download, FileVideo2 } from "lucide-react";
import { JobContextMenu } from "@/components/job-context-menu";
import { JobProgress } from "@/components/job-progress";
import { Badge } from "@/components/ui/badge";
import { assetSrc } from "@/lib/media";
import { firstVideoFile, isActive, type Job } from "@/lib/types";
import { useJobsContext } from "@/lib/jobs-context";
import { youtubeThumbUrl } from "@/lib/youtube";

function statusLabel(job: Job): string {
  if (job.state === "failed" || job.state === "cancelled") return "Failed";
  if (isActive(job.state)) return "In Progress";
  return job.kind === "convert" ? "Converted" : "Downloaded";
}

export function JobTile({ job, open, onOpen }: { job: Job; open: boolean; onOpen: () => void }) {
  const { liveIds, onSettled } = useJobsContext();
  const [hovering, setHovering] = useState(false);
  const video = firstVideoFile(job);
  const failed = job.state === "failed" || job.state === "cancelled";

  // Prefer YouTube's own CDN over the locally downloaded file (see
  // youtube.ts for why the local one is often already gone), and the
  // generic icon only once neither of those actually loads.
  const thumbPath = job.items[0]?.thumb_path ?? null;
  const ytThumb = job.kind === "download" ? youtubeThumbUrl(job.items[0]?.webpage_url ?? job.url) : null;
  const candidates = [ytThumb, thumbPath ? assetSrc(thumbPath) : null].filter((src): src is string => !!src);
  // Resets naturally per job: JobTile is keyed by job.id in job-grid.tsx.
  const [srcIndex, setSrcIndex] = useState(0);
  const thumbSrc = candidates[srcIndex] ?? null;

  return (
    <Reorder.Item as="div" value={job.id} className="list-none">
      <JobContextMenu job={job}>
        <motion.div
          layoutId={job.id}
          onClick={onOpen}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{ opacity: open ? 0 : 1, pointerEvents: open ? "none" : "auto" }}
          className="group bg-card cursor-pointer overflow-hidden rounded-lg border"
        >
          <div className="bg-muted relative aspect-video overflow-hidden">
            {hovering && video ? (
              <video
                key={video.path}
                src={assetSrc(video.path)}
                muted
                autoPlay
                loop
                playsInline
                onTimeUpdate={(e) => {
                  if (e.currentTarget.currentTime > 4) e.currentTarget.currentTime = 0;
                }}
                className="size-full object-cover"
              />
            ) : thumbSrc ? (
              <img src={thumbSrc} alt="" onError={() => setSrcIndex((i) => i + 1)} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                {job.kind === "convert" ? (
                  <FileVideo2 className="text-muted-foreground size-8" />
                ) : (
                  <Download className="text-muted-foreground size-8" />
                )}
              </div>
            )}
            <Badge variant={failed ? "destructive" : "secondary"} className="absolute top-2 left-2">
              {statusLabel(job)}
            </Badge>
          </div>
          <div className="space-y-1.5 p-2.5">
            <p className="truncate text-sm font-medium">{job.title || job.url}</p>
            {isActive(job.state) && liveIds.has(job.id) && <JobProgress jobId={job.id} onSettled={(ok, detail) => onSettled(job, ok, detail)} />}
          </div>
        </motion.div>
      </JobContextMenu>
    </Reorder.Item>
  );
}
