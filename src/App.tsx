// The persistent shell: a job-list sidebar next to whatever route is
// active, not a header over full-page routes. The earlier version
// navigated away from the list entirely to show a job's detail — this
// keeps both on screen at once, matching the original app's layout.

import { useCallback, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewDownloadDialog } from "@/components/new-download-dialog";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { JobListItem } from "@/components/job-list-item";
import { startJobEventBus } from "@/lib/events";
import { deleteJob, getSetting, listJobs, retryJob } from "@/lib/api";
import { isActive, type Job, type JobKind } from "@/lib/types";
import type { JobsContext } from "@/lib/jobs-context";

type StateFilter = "all" | "active" | "done" | "failed";
type KindFilter = "all" | JobKind;

function matches(job: Job, state: StateFilter, kind: KindFilter): boolean {
  if (kind !== "all" && job.kind !== kind) return false;
  if (state === "all") return true;
  if (state === "active") return isActive(job.state);
  if (state === "done") return job.state === "done";
  return job.state === "failed" || job.state === "cancelled";
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  useEffect(() => {
    startJobEventBus();
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
    (job: Job, ok: boolean, detail: string) => upsert({ ...job, state: ok ? "done" : "failed", error: ok ? null : detail }),
    [upsert],
  );

  const onRetry = useCallback(
    async (job: Job) => {
      const dir = (await getSetting("download_dir")) ?? "";
      setLiveIds((prev) => new Set(prev).add(job.id));
      upsert({ ...job, state: "running", error: null });
      await retryJob(job.id, dir).catch((err) => upsert({ ...job, state: "failed", error: String(err) }));
    },
    [upsert],
  );

  const onDelete = useCallback(async (job: Job) => {
    await deleteJob(job.id);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  }, []);

  const filtered = jobs.filter((j) => matches(j, stateFilter, kindFilter));
  const context: JobsContext = { jobs, liveIds, onCreated, onSettled, onRetry: (j) => void onRetry(j), onDelete: (j) => void onDelete(j) };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center border-b px-4 py-2.5">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          qDLP
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r">
          <div className="flex shrink-0 flex-wrap gap-1 px-2 pt-2">
            {(["all", "active", "done", "failed"] as StateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStateFilter(f)}
                className={`rounded px-1.5 py-0.5 text-xs capitalize ${stateFilter === f ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
            <span className="text-muted-foreground/40 px-0.5 text-xs">·</span>
            {(["all", "download", "convert"] as KindFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setKindFilter(f)}
                className={`rounded px-1.5 py-0.5 text-xs capitalize ${kindFilter === f ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {filtered.length === 0 && <p className="text-muted-foreground px-2 py-4 text-xs">No jobs yet.</p>}
            {filtered.map((job) => (
              <JobListItem key={job.id} job={job} />
            ))}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5 border-t p-2">
            <NewDownloadDialog onCreated={(id, url, title) => onCreated(id, url, title, "download")} />
            <NewConvertDialog onCreated={(id, path) => onCreated(id, path, path.split(/[\\/]/).pop() ?? path, "convert")} />
            <Button asChild variant="ghost" className="justify-start">
              <Link to="/settings">
                <SettingsIcon className="size-4" /> Settings
              </Link>
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
