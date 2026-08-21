// The Library: every job, filterable by state/kind, with New Download and
// New Convert as actions rather than tabs. Replaces the old
// Download|Convert|In-Progress tab bar, which mixed two JobKind arms with a
// JobState filter as if they were peers — they weren't.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewDownloadDialog } from "@/components/new-download-dialog";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { JobCard } from "@/components/job-card";
import { deleteJob, getSetting, listJobs, retryJob } from "@/lib/api";
import { isActive, type Job, type JobKind } from "@/lib/types";

type StateFilter = "all" | "active" | "done" | "failed";
type KindFilter = "all" | JobKind;

function matches(job: Job, state: StateFilter, kind: KindFilter): boolean {
  if (kind !== "all" && job.kind !== kind) return false;
  if (state === "all") return true;
  if (state === "active") return isActive(job.state);
  if (state === "done") return job.state === "done";
  return job.state === "failed" || job.state === "cancelled";
}

export default function Library() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  useEffect(() => {
    void listJobs().then(setJobs);
  }, []);

  const upsert = useCallback((job: Job) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id);
      if (idx === -1) return [job, ...prev];
      const next = prev.slice();
      next[idx] = job;
      return next;
    });
  }, []);

  const onCreated = useCallback(
    (jobId: string, urlOrPath: string, title: string, kind: JobKind) => {
      setLiveIds((prev) => new Set(prev).add(jobId));
      upsert({ id: jobId, kind, url: urlOrPath, title, preset: "default", state: "running", error: null, created_at: Date.now() / 1000, items: [] });
    },
    [upsert],
  );

  const onSettled = useCallback(
    (job: Job, ok: boolean, detail: string) => {
      upsert({ ...job, state: ok ? "done" : "failed", error: ok ? null : detail });
    },
    [upsert],
  );

  async function onRetry(job: Job) {
    const dir = (await getSetting("download_dir")) ?? "";
    setLiveIds((prev) => new Set(prev).add(job.id));
    upsert({ ...job, state: "running", error: null });
    await retryJob(job.id, dir).catch((err) => upsert({ ...job, state: "failed", error: String(err) }));
  }

  async function onDelete(job: Job) {
    await deleteJob(job.id);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  }

  const filtered = jobs.filter((j) => matches(j, stateFilter, kindFilter));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Library</h1>
        <div className="flex gap-2">
          <NewConvertDialog onCreated={(id, path) => onCreated(id, path, path.split(/[\\/]/).pop() ?? path, "convert")} />
          <NewDownloadDialog onCreated={(id, url, title) => onCreated(id, url, title, "download")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "done", "failed"] as StateFilter[]).map((f) => (
          <Button key={f} size="sm" variant={stateFilter === f ? "default" : "outline"} onClick={() => setStateFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
        <span className="bg-border mx-1 h-4 w-px" />
        {(["all", "download", "convert"] as KindFilter[]).map((f) => (
          <Button key={f} size="sm" variant={kindFilter === f ? "default" : "outline"} onClick={() => setKindFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-24">
          <Inbox className="size-8" />
          <p className="text-sm">Nothing here yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {filtered.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                live={liveIds.has(job.id)}
                index={i}
                onSettled={(ok, detail) => onSettled(job, ok, detail)}
                onRetry={onRetry}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
