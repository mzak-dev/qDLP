// The one remaining "page" for jobs: no more sidebar/library/job-detail
// split, no more per-kind routes — every job lives in one of two grid
// sections, and clicking a tile expands it in place (job-detail-bubble.tsx)
// instead of navigating anywhere.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Inbox } from "lucide-react";
import { JobTile } from "@/components/job-tile";
import { JobDetailBubble } from "@/components/job-detail-bubble";
import { applyOrder, saveOrder } from "@/lib/tile-order";
import { subscribeFileDrop } from "@/lib/drag-drop";
import { createConvert } from "@/lib/api";
import { isTypingOrInDialog } from "@/lib/keyboard";
import { isActive, type ConvertFormat, type Job } from "@/lib/types";
import { useJobsContext } from "@/lib/jobs-context";

const LAST_FORMAT_KEY = "qdlp:last-convert-format";

function Section({
  title,
  section,
  jobs,
  openId,
  onOpen,
  focusedId,
  onFocus,
}: {
  title: string;
  section: string;
  jobs: Job[];
  openId: string | null;
  onOpen: (id: string) => void;
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const ids = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const idsKey = ids.join(",");
  const [order, setOrder] = useState(() => applyOrder(section, ids));

  useEffect(() => {
    setOrder(applyOrder(section, ids));
    // ids and idsKey are the same list, just re-derived for a stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (jobs.length === 0) return null;
  const byId = new Map(jobs.map((j) => [j.id, j]));

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</h2>
      {/* ponytail: framer-motion's Reorder swaps along one declared axis by
          measuring bounding-box overlap on that axis only — it has no real
          notion of a wrapped multi-column grid. axis="x" makes same-row
          drags swap correctly (the common case); dragging across rows can
          still feel imprecise. Upgrade path if that matters: dnd-kit's
          sortable grid preset, which reorders off actual 2D collision. */}
      <Reorder.Group
        as="div"
        axis="x"
        values={order}
        onReorder={(next) => {
          setOrder(next);
          saveOrder(section, next);
        }}
        className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
      >
        {order.map((id) => {
          const job = byId.get(id);
          if (!job) return null;
          return (
            <JobTile
              key={id}
              job={job}
              open={job.id === openId}
              onOpen={() => onOpen(job.id)}
              focused={job.id === focusedId}
              onFocus={() => onFocus(job.id)}
            />
          );
        })}
      </Reorder.Group>
    </section>
  );
}

export default function JobGrid() {
  const { jobs, onCreated } = useJobsContext();
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const active = jobs.filter((j) => isActive(j.state));
  const done = jobs.filter((j) => !isActive(j.state));

  // ponytail: a flat In-Progress-then-Done sequence, not real 2D grid
  // navigation (up/down would need to know how many tiles fit per row,
  // which changes with window width) — Right/Down and Left/Up both just
  // step through this list. It also follows job order, not each section's
  // own drag-reordered order (Section's `order` state is local to it), so
  // keyboard traversal can drift from the dragged visual order. Upgrade
  // path for either: lift Section's order state up into here.
  const flatIds = [...active, ...done].map((j) => j.id);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingOrInDialog(e.target) || openId || flatIds.length === 0) return;
      const idx = focusedId ? flatIds.indexOf(focusedId) : -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedId(flatIds[Math.min(idx + 1, flatIds.length - 1)]);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedId(idx <= 0 ? flatIds[0] : flatIds[idx - 1]);
      } else if ((e.key === "Enter" || e.key === " ") && focusedId) {
        e.preventDefault();
        setOpenId(focusedId);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [flatIds, focusedId, openId]);

  // Keeps exactly one tile tab-reachable (roving tabindex) even before any
  // arrow-key/click interaction has happened.
  useEffect(() => {
    if (focusedId && flatIds.includes(focusedId)) return;
    setFocusedId(flatIds[0] ?? null);
    // flatIds is a new array identity every render; comparing its content
    // via the join'd key keeps this from looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatIds.join(","), focusedId]);

  useEffect(
    () =>
      subscribeFileDrop({
        onDragOver: () => setDragging(true),
        onDragLeave: () => setDragging(false),
        onDrop: (paths) => {
          setDragging(false);
          const format = (localStorage.getItem(LAST_FORMAT_KEY) as ConvertFormat | null) ?? "mp4";
          for (const path of paths) {
            void createConvert(path, format).then((jobId) => onCreated(jobId, path, path.split(/[\\/]/).pop() ?? path, "convert"));
          }
        },
      }),
    [onCreated],
  );

  const openJob = jobs.find((j) => j.id === openId);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {jobs.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
            <Inbox className="size-8" />
            <p className="text-sm">No jobs yet — start one above.</p>
          </div>
        ) : (
          <>
            <Section title="In Progress" section="in-progress" jobs={active} openId={openId} onOpen={setOpenId} focusedId={focusedId} onFocus={setFocusedId} />
            <Section title="Done" section="done" jobs={done} openId={openId} onOpen={setOpenId} focusedId={focusedId} onFocus={setFocusedId} />
          </>
        )}
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-primary bg-primary/5 pointer-events-none absolute inset-4 z-40 flex items-center justify-center rounded-xl border-2 border-dashed"
          >
            <p className="text-primary text-sm font-medium">Drop to convert</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not wrapped in AnimatePresence — see job-detail-bubble.tsx's own
          comment on `closing`: it got stuck here and never actually
          unmounted the bubble, so the fade-out is done manually instead. */}
      {openJob && <JobDetailBubble key={openJob.id} job={openJob} onClose={() => setOpenId(null)} />}
    </div>
  );
}
