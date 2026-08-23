// The tile clicked in job-grid.tsx grows into this via a shared
// layoutId={job.id} (see job-tile.tsx) instead of navigating: a
// backdrop-dimmed bubble first, then "maximize" grows the *same* element to
// fill the viewport. Both exits (close from the bubble, back from
// fullscreen) collapse that one element back down into the tile it grew
// from — one shared element, one exit animation, regardless of stage.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, ExternalLink, FolderOpen, Maximize2, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobProgress } from "@/components/job-progress";
import { VideoPlayer } from "@/components/video-player";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { openFile, revealFile } from "@/lib/api";
import { isTypingOrInDialog, modKey } from "@/lib/keyboard";
import { firstVideoFile, isActive, isRetryable, type Job } from "@/lib/types";
import { useJobsContext } from "@/lib/jobs-context";

// How long the manual fade-out (below) runs before the parent actually
// unmounts this component — kept in one place so the timeout matches the
// transition duration it's covering for.
const CLOSE_MS = 150;

export function JobDetailBubble({ job, onClose }: { job: Job; onClose: () => void }) {
  const { liveIds, onSettled, onRetry, onDelete, onCreated } = useJobsContext();
  const [fullscreen, setFullscreen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  // ponytail: this component isn't wrapped in AnimatePresence (job-grid.tsx
  // renders it as a plain `{openJob && <JobDetailBubble/>}`) — AnimatePresence
  // here got stuck permanently mid-exit and never actually unmounted the
  // component, confirmed by inspecting React's own committed state (openId
  // was already null) while the DOM node lingered regardless of whether
  // layoutId was present. Root cause not fully tracked down (likely an
  // interaction between AnimatePresence and this fragment's multiple
  // motion.div children); a manual fade is simple and, unlike
  // AnimatePresence, doesn't depend on framer-motion's exit machinery
  // actually completing correctly.
  const [closing, setClosing] = useState(false);
  const video = firstVideoFile(job);

  function close() {
    setClosing(true);
    setTimeout(() => {
      setFullscreen(false);
      onClose();
    }, CLOSE_MS);
  }

  // Escape always closes outright (not "back out of fullscreen first") —
  // the more common modal convention, and the maximize/back buttons above
  // already cover the step-by-step path for anyone who wants that instead.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingOrInDialog(e.target)) return;
      if (e.key === "Escape") {
        close();
      } else if (modKey(e) && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        onDelete(job);
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  return (
    <>
      {/* absolute, not fixed: scoped to JobGrid's own `relative` root (the
          content area below the title bar), not the viewport — "maximize"
          fills that area only, so the title bar (settings, split button,
          window controls) stays visible and clickable above it. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: CLOSE_MS / 1000 }}
        onClick={close}
        className="absolute inset-0 z-40 bg-black/60"
      />
      <motion.div
        layoutId={job.id}
        animate={closing ? { opacity: 0 } : { opacity: 1 }}
        transition={closing ? { duration: CLOSE_MS / 1000 } : { type: "spring", bounce: 0.2, duration: 0.4 }}
        className={
          fullscreen
            ? "bg-background absolute inset-0 z-50 flex flex-col overflow-y-auto"
            : "bg-background absolute top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[55vw] min-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border shadow-2xl"
        }
      >
        <div className="flex items-center justify-between p-3">
          {fullscreen ? (
            <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setFullscreen(false)} aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            {!fullscreen && (
              <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setFullscreen(true)} aria-label="Maximize">
                <Maximize2 className="size-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="rounded-full" onClick={close} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* min-h-0 flex-1 on the video wrapper only actually constrains
            anything in fullscreen, where the outer motion.div has a
            definite height (absolute inset-0). In the bubble stage the
            outer box is content-sized (max-h only, no explicit height), so
            this has no effect there and the video keeps its existing
            width-driven aspect-video sizing. Without this, a full-viewport-
            width 16:9 video in fullscreen is taller than the viewport,
            pushing the title/buttons below the fold — which is exactly
            what looked "awful": you had to scroll a maximized view just to
            reach Delete. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 px-5">
            {video ? (
              <VideoPlayer path={video.path} />
            ) : (
              <div className="bg-muted flex h-64 items-center justify-center rounded-lg">
                {isActive(job.state) && liveIds.has(job.id) ? (
                  <div className="w-full max-w-sm px-6">
                    <JobProgress jobId={job.id} onSettled={(ok, detail) => onSettled(job, ok, detail)} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm capitalize">{job.state}</p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-3 px-5 pt-4 pb-5">
            <h2 className="text-lg font-semibold break-words">{job.title || job.url}</h2>
            {job.error && <p className="text-destructive text-sm">{job.error}</p>}

            <div className="flex flex-wrap gap-2">
              {video && (
                <Button size="sm" variant="outline" onClick={() => void openFile(video.path)}>
                  <ExternalLink className="size-4" /> Open Externally
                </Button>
              )}
              {video && (
                <Button size="sm" variant="outline" onClick={() => void revealFile(video.path)}>
                  <FolderOpen className="size-4" /> Show in folder
                </Button>
              )}
              {isRetryable(job.state) && (
                <Button size="sm" variant="outline" onClick={() => onRetry(job)}>
                  <RotateCcw className="size-4" /> Retry
                </Button>
              )}
              {job.kind === "download" && video && (
                <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                  <ArrowLeftRight className="size-4" /> Convert
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onDelete(job);
                  close();
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

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
