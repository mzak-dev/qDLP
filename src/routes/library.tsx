// Index route: shown in the main pane when no job is selected. The actual
// job list lives in the sidebar (App.tsx) and stays visible regardless.

import { Inbox } from "lucide-react";
import { useJobsContext } from "@/lib/jobs-context";

export default function Library() {
  const { jobs } = useJobsContext();
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
      <Inbox className="size-8" />
      <p className="text-sm">{jobs.length === 0 ? "No downloads yet — start one from the sidebar." : "Select a job to see its details."}</p>
    </div>
  );
}
