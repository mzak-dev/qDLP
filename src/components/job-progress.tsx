// Leaf component: owns its own progress state, subscribed directly to the
// event bus. A tick re-renders this <span>+<Progress>, never the row that
// contains it — see lib/events.ts for why that split exists.
//
// Download and convert jobs share the same "progress"/"log" event shape at
// the type-tag level (see events.ts), but carry different data — a download
// tick has downloaded_bytes, a convert tick has out_time_secs. There's no
// tag to switch on for that, so this checks which field is actually present.

import { useEffect, useState } from "react";
import { onJobEvent } from "@/lib/events";
import { EXIT_FAIL_PREFIX, EXIT_OK, progressFraction, type ConvertProgress, type Progress } from "@/lib/types";
import { Progress as ProgressBar } from "@/components/ui/progress";

function isConvertProgress(p: Progress | ConvertProgress): p is ConvertProgress {
  return !("downloaded_bytes" in p);
}

export function JobProgress({
  jobId,
  onSettled,
}: {
  jobId: string;
  onSettled: (ok: boolean, detail: string) => void;
}) {
  const [progress, setProgress] = useState<Progress | ConvertProgress | null>(null);
  const [lastLine, setLastLine] = useState("starting…");

  useEffect(
    () =>
      onJobEvent(jobId, (event) => {
        if (event.type === "progress") {
          setProgress(event.data);
        } else if (event.type === "log") {
          if (event.data === EXIT_OK) onSettled(true, "Done");
          else if (event.data.startsWith(EXIT_FAIL_PREFIX)) onSettled(false, event.data);
          else setLastLine(event.data);
        }
      }),
    // onSettled is a stable useCallback from the parent; re-subscribing on
    // jobId change only is intentional so this stays a pure per-job leaf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobId],
  );

  if (progress && isConvertProgress(progress)) {
    const elapsed = progress.out_time_secs != null ? `${Math.round(progress.out_time_secs)}s encoded` : lastLine;
    return (
      <div className="space-y-1">
        <ProgressBar value={undefined} className="animate-pulse" />
        <p className="text-muted-foreground truncate text-xs">
          {elapsed}
          {progress.speed ? ` · ${progress.speed.toFixed(1)}x` : ""}
        </p>
      </div>
    );
  }

  const fraction = progress ? progressFraction(progress) : null;
  return (
    <div className="space-y-1">
      <ProgressBar value={fraction != null ? fraction * 100 : 0} />
      <p className="text-muted-foreground truncate text-xs">
        {fraction != null ? `${Math.round(fraction * 100)}%` : lastLine}
        {progress && !isConvertProgress(progress) && progress.speed ? ` · ${(progress.speed / 1_000_000).toFixed(1)} MB/s` : ""}
      </p>
    </div>
  );
}
