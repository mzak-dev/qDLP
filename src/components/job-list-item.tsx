// One compact row in the sidebar — title + "N videos"/state subtitle, no
// card chrome. Live progress stays in the detail pane (see job-detail.tsx),
// not here, so a tick never re-renders the list.

import { useRef } from "react";
import { NavLink } from "react-router-dom";
import { useJobMorph } from "@/lib/job-morph";
import type { Job } from "@/lib/types";

function subtitle(job: Job): string {
  if (job.items.length > 0) return `${job.items.length} video${job.items.length === 1 ? "" : "s"}`;
  return job.state;
}

export function JobListItem({ job }: { job: Job }) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const { beginMorph } = useJobMorph();

  return (
    <NavLink
      to={`/job/${job.id}`}
      onClick={() => {
        if (titleRef.current) beginMorph(job.id, job.title || job.url, titleRef.current.getBoundingClientRect());
      }}
      className={({ isActive }) => `block rounded-md px-2.5 py-2 ${isActive ? "bg-secondary" : "hover:bg-secondary/50"}`}
    >
      <p ref={titleRef} className="truncate text-sm font-medium">
        {job.title || job.url}
      </p>
      <p className="text-muted-foreground mt-0.5 truncate text-xs capitalize">{subtitle(job)}</p>
    </NavLink>
  );
}
