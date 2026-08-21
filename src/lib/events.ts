// A per-job pub-sub fed by exactly one Tauri event listener, so a progress
// tick reaches only the one leaf component that owns that job's progress
// bar — never the list that owns it. That isolation is the whole point of
// the walking skeleton: unthrottled events (~10/sec/job) plus Framer
// Motion's `layout` (which re-measures the DOM every render) is the specific
// combination the plan flagged as a perf risk if a tick re-rendered the row.

import { listen } from "@tauri-apps/api/event";
import type { ConvertEventPayload, JobEvent, JobEventPayload } from "./types";

// A download's JobEvent and a convert's ConvertEvent are structurally
// compatible where it matters ({type, data}); listeners just switch on
// `type`, so both channels can feed the exact same per-job map.
type Listener = (event: JobEvent) => void;

const listeners = new Map<string, Set<Listener>>();
let started = false;

export function startJobEventBus() {
  if (started) return;
  started = true;
  void listen<JobEventPayload>("job-event", ({ payload }) => {
    listeners.get(payload.job_id)?.forEach((fn) => fn(payload.event));
  });
  void listen<ConvertEventPayload>("convert-event", ({ payload }) => {
    listeners.get(payload.job_id)?.forEach((fn) => fn(payload.event as JobEvent));
  });
}

export function onJobEvent(jobId: string, fn: Listener): () => void {
  let set = listeners.get(jobId);
  if (!set) {
    set = new Set();
    listeners.set(jobId, set);
  }
  set.add(fn);
  return () => set!.delete(fn);
}
