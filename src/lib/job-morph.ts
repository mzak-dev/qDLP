// Split out of job-morph-provider.tsx: a file that exports both a component
// and a hook/context defeats React Fast Refresh (full reload instead of HMR
// on every edit) — same convention as jobs-context.ts and theme.ts.

import { createContext, useContext } from "react";

export interface JobMorphContextValue {
  /** Called from the sidebar row's click handler, before navigation lands. */
  beginMorph: (jobId: string, label: string, fromRect: DOMRect) => void;
}

export const JobMorphContext = createContext<JobMorphContextValue | null>(null);

export function useJobMorph(): JobMorphContextValue {
  const ctx = useContext(JobMorphContext);
  if (!ctx) throw new Error("useJobMorph must be used within JobMorphProvider");
  return ctx;
}
