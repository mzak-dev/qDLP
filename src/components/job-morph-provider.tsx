// The sidebar never unmounts a job row when you select it (App.tsx keeps
// the whole list mounted next to whatever route is active), so there's no
// real shared element to hand off between "row" and "detail header" the way
// a page transition normally would. This fakes it: a ghost clone of the
// clicked row's title flies from the row's on-screen position to wherever
// job-detail.tsx's [data-morph-target] lands, then disappears — the real
// row and the real header never move or know this happened.
//
// Deliberately NOT a Framer Motion layoutId shared element: that assumes
// one of the two matching elements unmounts as the other mounts, which
// isn't true here (the row is always on screen). Doing it as its own
// overlay also means this never touches job-progress.tsx's render
// isolation — the row it flies from is not rendered any differently.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { JobMorphContext } from "@/lib/job-morph";

interface PendingMorph {
  jobId: string;
  label: string;
  rect: DOMRect;
}

// Tailwind text-sm/font-medium (the sidebar row's title, job-list-item.tsx)
// -> text-lg/font-semibold (job-detail.tsx's <h1>). Hardcoded because the
// ghost has to interpolate between two typographic scales that only exist
// as class names on the two real elements it's standing in for.
const SOURCE_FONT_SIZE = 14;
const SOURCE_FONT_WEIGHT = 500;
const DEST_FONT_SIZE = 18;
const DEST_FONT_WEIGHT = 600;

// job-detail.tsx's [data-morph-target] mounts within one React commit of
// navigation, but give it a few animation frames of slack rather than
// assuming frame 1 — if it never shows up (e.g. the target job vanished),
// give up quietly and let the ordinary pane crossfade carry the transition.
const MAX_SEARCH_FRAMES = 20;

export function JobMorphProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingMorph | null>(null);

  const beginMorph = useCallback((jobId: string, label: string, rect: DOMRect) => {
    setPending({ jobId, label, rect });
  }, []);

  return (
    <JobMorphContext.Provider value={{ beginMorph }}>
      {children}
      {pending && <JobMorphGhost key={pending.jobId} pending={pending} onDone={() => setPending(null)} />}
    </JobMorphContext.Provider>
  );
}

function JobMorphGhost({ pending, onDone }: { pending: PendingMorph; onDone: () => void }) {
  const [toRect, setToRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let frame = 0;
    let raf = requestAnimationFrame(function tryFind() {
      const el = document.querySelector<HTMLElement>(`[data-morph-target="${CSS.escape(pending.jobId)}"]`);
      if (el) {
        setToRect(el.getBoundingClientRect());
        return;
      }
      frame += 1;
      if (frame < MAX_SEARCH_FRAMES) raf = requestAnimationFrame(tryFind);
      else onDone();
    });
    return () => cancelAnimationFrame(raf);
    // onDone is a stable useCallback-free inline closure from the parent;
    // re-running this search loop on identity change would restart it
    // pointlessly. Only pending.jobId should ever restart the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.jobId]);

  const { rect } = pending;

  return (
    <motion.div
      className="pointer-events-none fixed z-50 truncate text-foreground"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, fontSize: SOURCE_FONT_SIZE, fontWeight: SOURCE_FONT_WEIGHT }}
      animate={
        toRect
          ? {
              top: toRect.top,
              left: toRect.left,
              width: toRect.width,
              height: toRect.height,
              fontSize: DEST_FONT_SIZE,
              fontWeight: DEST_FONT_WEIGHT,
              opacity: [1, 1, 0],
            }
          : undefined
      }
      transition={toRect ? { duration: 0.32, ease: [0.16, 1, 0.3, 1], opacity: { times: [0, 0.7, 1] } } : undefined}
      onAnimationComplete={toRect ? onDone : undefined}
    >
      {pending.label}
    </motion.div>
  );
}
