// =============================================================================
// Embr Streak — derived from saved workouts, not kept as a running counter
// =============================================================================
// A streak is a run of consecutive local calendar days with at least one saved
// workout. It is recomputed from the history whenever a workout is saved, so a
// workout typed in for last week can join two runs or extend an old one. A
// running counter cannot do that without replaying every day since.

import type { StreakData, WorkoutLog } from '@/types';

import { localDayKey, previousDayKey } from './local-day';

/** The local days that have at least one saved workout, as YYYY-MM-DD. */
function workoutDays(logs: WorkoutLog[]): Set<string> {
  const days = new Set<string>();
  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const date = new Date(log.timestamp);
    if (!Number.isNaN(date.getTime())) days.add(localDayKey(date));
  }
  return days;
}

/** Length of the run of consecutive days in `days` that ends on `last`. */
function runEndingOn(days: Set<string>, last: string): number {
  let length = 0;
  for (let day = last; days.has(day); day = previousDayKey(day)) length += 1;
  return length;
}

/** The longest run of consecutive days anywhere in `days`. */
function longestRun(days: Set<string>): number {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  // YYYY-MM-DD sorts chronologically as plain text.
  for (const day of [...days].sort()) {
    run = previous !== null && previousDayKey(day) === previous ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

/**
 * The streak as of `now`, from the saved workouts. A streak stays alive through
 * the end of the day after its last workout. `longest` never drops below the
 * stored record.
 */
export function deriveStreak(logs: WorkoutLog[], now: Date, storedLongest: number): StreakData {
  const days = workoutDays(logs);
  const sorted = [...days].sort();
  if (sorted.length === 0) return { current: 0, longest: storedLongest, lastWorkoutDate: null };

  const last = sorted[sorted.length - 1];
  const today = localDayKey(now);
  const alive = last === today || last === previousDayKey(today);
  return {
    current: alive ? runEndingOn(days, last) : 0,
    longest: Math.max(storedLongest, longestRun(days)),
    lastWorkoutDate: last,
  };
}

/**
 * The streak on the day of `timestamp`, counting a workout on that day. Used
 * for the streak snapshot on a typed-in workout dated in the past.
 */
export function streakOnDay(logs: WorkoutLog[], timestamp: string): number {
  const days = workoutDays(logs);
  const day = localDayKey(new Date(timestamp));
  days.add(day);
  return runEndingOn(days, day);
}
