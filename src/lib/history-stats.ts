// =============================================================================
// IronQuest Workout History — Derived Stats (pure helpers)
// =============================================================================
// Pure presentational selectors over WorkoutLog[] for the history screen and
// the home-screen Quick Stats. Kept here (not in app/) so the date math is
// unit-testable with injected clocks and never tangled into a component.
//
// These are NOT FP/engine calculations — they only filter, sort, and count
// already-claimed logs. The FP figures shown on the history screen come from
// `log.totalFP`, which was captured at claim time by the real engine (see
// src/lib/workout-summary.ts → calculateWorkoutSummary). Nothing here
// recomputes FP.

import type { WorkoutLog } from '@/types';

/** One week in milliseconds. */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Claimed logs, newest-first by workout date (`timestamp`).
 *
 * A log is "history" only once it has been saved (`claimedAt != null`);
 * unclaimed/abandoned sessions are intentionally excluded. Ordering is by the
 * workout's own timestamp — NOT by claim order or store insertion order — so a
 * log claimed later still lands in its true chronological slot.
 */
export function getClaimedLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return logs
    .filter((log) => log.claimedAt !== null)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/**
 * Count of claimed workouts whose `timestamp` falls in the last 7 days
 * (inclusive of `sinceMs`).
 *
 * `nowMs` defaults to the real wall clock — fine for the UI, which recomputes
 * on every store change / app foreground. Tests pass a fixed clock.
 */
export function countClaimedSince(
  logs: WorkoutLog[],
  sinceMs: number,
  nowMs: number = Date.now()
): number {
  // Guard against a future-dated log sneaking into a "last 7 days" window.
  const upperBound = nowMs + SEVEN_DAYS_MS;
  let count = 0;
  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const ts = Date.parse(log.timestamp);
    if (Number.isNaN(ts)) continue;
    if (ts >= sinceMs && ts < upperBound) count++;
  }
  return count;
}

/** Convenience: count of claimed workouts in the rolling 7-day window. */
export function countClaimedInLast7Days(logs: WorkoutLog[], nowMs: number = Date.now()): number {
  return countClaimedSince(logs, nowMs - SEVEN_DAYS_MS, nowMs);
}
