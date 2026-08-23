// Client-only tile ordering for the grid's drag-to-reorder. The backend Job
// model has no order field (see docs/superpowers/specs/2026-08-23 spec) so
// this is a straight localStorage round-trip, one key per grid section.

const PREFIX = "qdlp:order:";

function read(section: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + section);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(section: string, ids: string[]) {
  localStorage.setItem(PREFIX + section, JSON.stringify(ids));
}

/**
 * Reconciles the stored order against the jobs actually present:
 * previously-ordered ids keep their dragged position, ids no longer present
 * are dropped, and ids never seen before are prepended in `currentIds`'
 * order (i.e. newest-first, since that's how the jobs array is built).
 */
export function applyOrder(section: string, currentIds: string[]): string[] {
  const stored = read(section);
  const known = stored.filter((id) => currentIds.includes(id));
  const fresh = currentIds.filter((id) => !stored.includes(id));
  return [...fresh, ...known];
}
