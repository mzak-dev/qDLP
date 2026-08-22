// The persistent shell: a job-list sidebar next to whatever route is
// active, not a header over full-page routes. The earlier version
// navigated away from the list entirely to show a job's detail — this
// keeps both on screen at once, matching the original app's layout.

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ListFilter, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewDownloadDialog } from "@/components/new-download-dialog";
import { NewConvertDialog } from "@/components/new-convert-dialog";
import { JobListItem } from "@/components/job-list-item";
import { TitleBar } from "@/components/title-bar";
import { startJobEventBus } from "@/lib/events";
import { deleteJob, getJob, getSetting, listJobs, retryJob } from "@/lib/api";
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
    (job: Job, ok: boolean, detail: string) => {
      // Re-fetch rather than spreading the stale in-memory job: the title
      // (and items/files) may only have become known server-side during
      // the run, and this locally-held object was captured before that.
      void getJob(job.id).then((fresh) => upsert(fresh ?? { ...job, state: ok ? "done" : "failed", error: ok ? null : detail }));
    },
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

  const filterActive = stateFilter !== "all" || kindFilter !== "all";
  const location = useLocation();
  const outlet = useOutlet(context);

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r">
          <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Library</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className={`size-6 ${filterActive ? "text-foreground" : "text-muted-foreground"}`}>
                  <ListFilter className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>State</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={stateFilter} onValueChange={(v) => setStateFilter(v as StateFilter)}>
                  {(["all", "active", "done", "failed"] as StateFilter[]).map((f) => (
                    <DropdownMenuRadioItem key={f} value={f} className="capitalize">
                      {f}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Kind</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
                  {(["all", "download", "convert"] as KindFilter[]).map((f) => (
                    <DropdownMenuRadioItem key={f} value={f} className="capitalize">
                      {f}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-1">
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

        <main className="relative flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute inset-0"
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
