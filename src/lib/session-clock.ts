// =============================================================================
// Session clock — how long you have been in the gym
// =============================================================================
// Wall-clock time from the first tap of Start, rest and backgrounded time
// included. Both halves are pure so the header can be asserted without a
// renderer, and both take the clock as an argument: a session screen stays
// mounted for an hour, and anything that reads `Date.now()` once at render is
// wrong for the rest of it.

import { formatClock } from './blocks';

/** Seconds since the session's anchor. Zero when there is no session. */
export function sessionElapsed(startedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * `24:18` under an hour, `1:12:04` from one hour.
 *
 * Separate from `formatClock` rather than replacing it: a block clock counts a
 * window, and a 90-minute cap reads as `90:00` there on purpose.
 */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 3600) return formatClock(total);

  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
