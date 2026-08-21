// Split out of App.tsx: a file that exports both a component and a hook
// defeats React Fast Refresh (full reload instead of HMR on every edit).

import { useOutletContext } from "react-router-dom";
import type { Job, JobKind } from "./types";

export interface JobsContext {
  jobs: Job[];
  liveIds: Set<string>;
  onCreated: (jobId: string, urlOrPath: string, title: string, kind: JobKind) => void;
  onSettled: (job: Job, ok: boolean, detail: string) => void;
  onRetry: (job: Job) => void;
  onDelete: (job: Job) => void;
}

export function useJobsContext() {
  return useOutletContext<JobsContext>();
}
