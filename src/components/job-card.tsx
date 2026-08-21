// One row in the Library. `layoutId` on the card lets it morph into the
// detail route's header when clicked — the same element across a route
// change, not a fade-out/fade-in of two different ones.
//
// ponytail: a job left Running/Probing/Queued from a previous app session
// has no live event stream to reattach to (the process reference doesn't
// survive a restart — true of the original gpui app too). Those render as a
// static badge, not a progress bar. Delete is the only recourse; a "mark
// stuck jobs failed on startup" sweep would be the upgrade if this bites.

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JobProgress } from "@/components/job-progress";
import { isRetryable, type Job } from "@/lib/types";

const stateVariant: Record<Job["state"], "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  probing: "outline",
  running: "secondary",
  done: "default",
  failed: "destructive",
  cancelled: "outline",
};

export function JobCard({
  job,
  live,
  index = 0,
  onSettled,
  onRetry,
  onDelete,
}: {
  job: Job;
  live: boolean;
  /** Position in the currently-filtered list — staggers first-paint entrance only (Framer ignores `delay` on layout/exit transitions). */
  index?: number;
  onSettled: (ok: boolean, detail: string) => void;
  onRetry: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  return (
    <motion.div
      layoutId={`job-card-${job.id}`}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.04, 0.3) } }}
      exit={{ opacity: 0 }}
    >
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <Link to={`/job/${job.id}`} className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-medium">{job.title || job.url}</CardTitle>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {job.kind}
            </Badge>
            <Badge variant={stateVariant[job.state]}>{job.state}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isRetryable(job.state) && <DropdownMenuItem onClick={() => onRetry(job)}>Retry</DropdownMenuItem>}
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(job)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        {live && (job.state === "running" || job.state === "probing" || job.state === "queued") && (
          <CardContent>
            <JobProgress jobId={job.id} onSettled={onSettled} />
          </CardContent>
        )}
        {job.error && (
          <CardContent>
            <p className="text-destructive truncate text-xs">{job.error}</p>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
