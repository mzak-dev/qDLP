// The main pane when a job is selected: video/title/actions on the left,
// a "Details" + "Files" column on the right — mirrors rustyDLP's own detail
// layout. Sidebar (job list) is rendered by App.tsx and stays visible the
// whole time; this only ever fills the pane next to it.

import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftRight, Copy, ExternalLink, FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobProgress } from "@/components/job-progress";
import { FileList } from "@/components/file-list";
import { VideoPlayer } from "@/components/video-player";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { openFile, revealFile } from "@/lib/api";
import { isActive, isRetryable } from "@/lib/types";
import { useJobsContext } from "@/lib/jobs-context";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, liveIds, onSettled, onRetry, onDelete, onCreated } = useJobsContext();
  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">This job no longer exists.</p>
      </div>
    );
  }

  const firstVideo = job.items.flatMap((i) => i.files).find((f) => f.kind === "video");
  const isConvert = job.kind === "convert";

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {firstVideo ? (
          <VideoPlayer path={firstVideo.path} />
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

        {job.error && <p className="text-destructive mt-3 text-sm">{job.error}</p>}

        <h1 data-morph-target={job.id} className="mt-4 text-lg font-semibold break-words">
          {job.title || job.url}
        </h1>

        <div className="mt-3 flex flex-wrap gap-2">
          {firstVideo && (
            <Button size="sm" variant="outline" onClick={() => void openFile(firstVideo.path)}>
              <ExternalLink className="size-4" /> Open Externally
            </Button>
          )}
          {firstVideo && (
            <Button size="sm" variant="outline" onClick={() => void revealFile(firstVideo.path)}>
              <FolderOpen className="size-4" /> Show in folder
            </Button>
          )}
          {isRetryable(job.state) && (
            <Button size="sm" variant="outline" onClick={() => onRetry(job)}>
              <RotateCcw className="size-4" /> Retry
            </Button>
          )}
          {firstVideo && (
            <NewConvertDialog
              defaultSource={firstVideo.path}
              onCreated={(jobId, path) => onCreated(jobId, path, path.split(/[\\/]/).pop() ?? path, "convert")}
              trigger={
                <Button size="sm" variant="outline">
                  <ArrowLeftRight className="size-4" /> Convert
                </Button>
              }
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(job);
              navigate("/");
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="w-72 shrink-0 space-y-6 overflow-y-auto border-l p-6">
        <div>
          <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Details</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">State</dt>
              <dd>
                <Badge variant="secondary" className="capitalize">
                  {job.state}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{isConvert ? "Format" : "Preset"}</dt>
              <dd className="uppercase">{job.preset}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Videos</dt>
              <dd>{job.items.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{isConvert ? "Source file" : "Source"}</dt>
              <dd className="flex items-center gap-1 truncate">
                <span className="truncate" title={job.url}>
                  {job.url}
                </span>
                <button onClick={() => void navigator.clipboard.writeText(job.url)} aria-label="Copy source">
                  <Copy className="text-muted-foreground size-3 shrink-0" />
                </button>
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Files</h2>
          {job.items.length === 0 ? (
            <p className="text-muted-foreground text-xs">No files yet.</p>
          ) : (
            job.items.map((item) => <FileList key={item.id} files={item.files} />)
          )}
        </div>
      </div>
    </div>
  );
}
