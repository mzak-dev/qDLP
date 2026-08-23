// The persistent shell: title bar + whatever route is active. No more
// sidebar — job-grid.tsx is the only real content route now (its own
// TopBar lives inside it), Settings is the other.

import { useCallback, useEffect, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TitleBar } from "@/components/title-bar";
import { startJobEventBus } from "@/lib/events";
import { deleteJob, getJob, getSetting, listJobs, retryJob } from "@/lib/api";
import type { Job, JobKind } from "@/lib/types";
import type { JobsContext } from "@/lib/jobs-context";

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());

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

  const context: JobsContext = { jobs, liveIds, onCreated, onSettled, onRetry: (j) => void onRetry(j), onDelete: (j) => void onDelete(j) };

  const location = useLocation();
  const outlet = useOutlet(context);

  return (
    <div className="flex h-screen flex-col">
      <TitleBar onCreated={onCreated} />

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
  );
}
