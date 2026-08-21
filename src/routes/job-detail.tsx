// /job/:id — replaces the old full-window overlay. A route gives it a
// shareable URL, working back/forward, and a clean layoutId morph target
// from the Library card.

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobProgress } from "@/components/job-progress";
import { FileList } from "@/components/file-list";
import { VideoPlayer } from "@/components/video-player";
import { deleteJob, getJob, retryJob, getSetting } from "@/lib/api";
import { isActive, isRetryable, type Job } from "@/lib/types";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refetch = useCallback(() => {
    if (!id) return;
    void getJob(id).then((j) => (j ? setJob(j) : setNotFound(true)));
  }, [id]);

  useEffect(refetch, [refetch]);

  async function onRetry() {
    if (!job) return;
    const dir = (await getSetting("download_dir")) ?? "";
    await retryJob(job.id, dir);
    refetch();
  }

  async function onDelete() {
    if (!job) return;
    await deleteJob(job.id);
    navigate("/");
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-muted-foreground text-sm">This job no longer exists.</p>
        <Button asChild variant="link" className="px-0">
          <Link to="/">Back to Library</Link>
        </Button>
      </div>
    );
  }
  if (!job) return null;

  const firstVideo = job.items.flatMap((i) => i.files).find((f) => f.kind === "video");

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/">
          <ArrowLeft className="mr-1 size-4" /> Library
        </Link>
      </Button>

      <motion.div layoutId={`job-card-${job.id}`} className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold break-words">{job.title || job.url}</h1>
          <p className="text-muted-foreground truncate text-xs">{job.url}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="uppercase">
            {job.kind}
          </Badge>
          <Badge>{job.state}</Badge>
        </div>
      </motion.div>

      {isActive(job.state) && (
        <div className="mb-6">
          <JobProgress jobId={job.id} onSettled={refetch} />
        </div>
      )}

      {job.error && <p className="text-destructive mb-6 text-sm">{job.error}</p>}

      {firstVideo && (
        <div className="mb-6">
          <VideoPlayer path={firstVideo.path} />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4">
        {job.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files yet.</p>
        ) : (
          job.items.map((item) => (
            <div key={item.id}>
              {job.items.length > 1 && <p className="mb-1 text-sm font-medium">{item.title}</p>}
              <FileList files={item.files} />
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        {isRetryable(job.state) && (
          <Button variant="outline" onClick={() => void onRetry()}>
            Retry
          </Button>
        )}
        <Button variant="outline" onClick={() => void onDelete()}>
          Delete
        </Button>
      </div>
    </div>
  );
}
