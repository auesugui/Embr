// =============================================================================
// Embr Weekly Goal — days trained per Monday-to-Sunday week, and the run of
// weeks that reached the goal
// =============================================================================
// Like the daily streak (src/lib/streak.ts), none of this is a running counter:
// it is recomputed from the saved workouts every time, so a workout typed in
// for a past week can repair a broken run.
//
// THE GOAL-IN-EFFECT RULE. Changing the goal must never change the status of a
// week that has already finished, so the setting is stored as a list of
// `{ week, days }` entries rather than one number:
//
//   - a week is measured against the latest entry whose week is at or before it
//   - a week earlier than every entry is measured against the default of 3
//   - a change made during a week REPLACES that week's entry, because the
//     current week has not finished yet and is the one the new number is for
//
// So lowering the goal does not retroactively award old weeks, and raising it
// does not take weeks away (decision Q2).

import type { WeeklyGoalEntry, WorkoutLog } from '@/types';

import { localDayKey } from './local-day';
import { daysLeftInWeek, localWeekKey, previousWeekKey, weekKeyForDay } from './local-week';

export const DEFAULT_WEEKLY_GOAL = 3;
export const MIN_WEEKLY_GOAL = 1;
export const MAX_WEEKLY_GOAL = 7;

/** A goal read back from storage could be anything; a week always needs 1 to 7. */
export const clampWeeklyGoal = (days: number): number =>
  Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(days)));

// -----------------------------------------------------------------------------
// The stored goal list
// -----------------------------------------------------------------------------

/** Entries from storage, keeping only usable ones, oldest week first. */
export function normalizeWeeklyGoals(value: unknown): WeeklyGoalEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is WeeklyGoalEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as WeeklyGoalEntry).week === 'string' &&
        Number.isFinite((entry as WeeklyGoalEntry).days)
    )
    .map((entry) => ({ week: entry.week, days: clampWeeklyGoal(entry.days) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** The goal `weekKey` is measured against. */
export function goalForWeek(goals: WeeklyGoalEntry[], weekKey: string): number {
  let goal = DEFAULT_WEEKLY_GOAL;
  // YYYY-MM-DD sorts chronologically as plain text, and the list is sorted.
  for (const entry of goals) {
    if (entry.week > weekKey) break;
    goal = entry.days;
  }
  return clampWeeklyGoal(goal);
}

/** `days` as the goal from `weekKey` on, replacing an entry already on that week. */
export function setGoalForWeek(
  goals: WeeklyGoalEntry[],
  weekKey: string,
  days: number
): WeeklyGoalEntry[] {
  const next = goals.filter((entry) => entry.week !== weekKey);
  next.push({ week: weekKey, days: clampWeeklyGoal(days) });
  return next.sort((a, b) => a.week.localeCompare(b.week));
}

// -----------------------------------------------------------------------------
// Days trained
// -----------------------------------------------------------------------------

/**
 * Distinct local days with at least one saved workout, grouped by week.
 *
 * Two workouts on one day count once — the goal is days trained, not sessions.
 * Imported and typed-in workouts are ordinary saved logs and count like any
 * other.
 */
export function trainedDaysByWeek(logs: WorkoutLog[]): Map<string, Set<string>> {
  const weeks = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const day = localDayKey(date);
    const week = weekKeyForDay(day);
    const days = weeks.get(week);
    if (days) days.add(day);
    else weeks.set(week, new Set([day]));
  }
  return weeks;
}

/**
 * The run of consecutive counted weeks. It ends at the current week when that
 * week already counts, otherwise at last week — a week still in progress is not
 * yet a miss, so it must not break the run.
 */
export function weeklyStreak(
  logs: WorkoutLog[],
  goals: WeeklyGoalEntry[],
  now: Date = new Date()
): number {
  const byWeek = trainedDaysByWeek(logs);
  const counts = (week: string) => (byWeek.get(week)?.size ?? 0) >= goalForWeek(goals, week);

  const current = localWeekKey(now);
  let week = counts(current) ? current : previousWeekKey(current);
  let run = 0;
  while (counts(week)) {
    run += 1;
    week = previousWeekKey(week);
  }
  return run;
}

// -----------------------------------------------------------------------------
// The hero's view of the week
// -----------------------------------------------------------------------------

export interface WeekProgress {
  /** Monday of the current week, as YYYY-MM-DD. */
  weekKey: string;
  /** Today, as YYYY-MM-DD. Equal to `weekKey` on a Monday. */
  todayKey: string;
  /** The goal this week is measured against, 1 to 7. */
  goal: number;
  /** Local day keys in this week that have a saved workout. */
  trainedDays: string[];
  /** Counted weeks in a row, this week included once its goal is met. */
  streak: number;
  /** False only for someone who has never saved a workout. */
  hasHistory: boolean;
  /** Days from today through Sunday, counting today. */
  daysLeft: number;
  /** Last week's days trained and the goal it was measured against. */
  lastWeek: { trainedDays: number; goal: number };
}

export function weekProgress(
  logs: WorkoutLog[],
  goals: WeeklyGoalEntry[],
  now: Date = new Date()
): WeekProgress {
  const byWeek = trainedDaysByWeek(logs);
  const weekKey = localWeekKey(now);
  const lastWeekKey = previousWeekKey(weekKey);

  return {
    weekKey,
    todayKey: localDayKey(now),
    goal: goalForWeek(goals, weekKey),
    trainedDays: [...(byWeek.get(weekKey) ?? [])].sort(),
    streak: weeklyStreak(logs, goals, now),
    hasHistory: byWeek.size > 0,
    daysLeft: daysLeftInWeek(now),
    lastWeek: {
      trainedDays: byWeek.get(lastWeekKey)?.size ?? 0,
      goal: goalForWeek(goals, lastWeekKey),
    },
  };
}

/** True once this week has reached its goal. */
export const goalMet = (progress: WeekProgress): boolean =>
  progress.trainedDays.length >= progress.goal;
