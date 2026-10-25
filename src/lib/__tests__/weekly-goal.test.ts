// =============================================================================
// Weekly goal — days trained, goal in effect, and the run of counted weeks
// =============================================================================
// The group that matters is the goal-in-effect one: the whole reason the goal
// is stored as a list is that changing it must not re-score a week that has
// already finished (decision Q2).

import type { WeeklyGoalEntry, WorkoutLog } from '@/types';

import {
  DEFAULT_WEEKLY_GOAL,
  goalForWeek,
  goalMet,
  normalizeWeeklyGoals,
  setGoalForWeek,
  trainedDaysByWeek,
  weekProgress,
  weeklyStreak,
} from '../weekly-goal';

// Week of Mon 2026-10-19 … Sun 2026-10-25, with 2026-10-22 a Thursday.
const THURSDAY = new Date(2026, 9, 22, 9, 0);
const MONDAY = new Date(2026, 9, 19, 9, 0);

let nextId = 0;

/** A saved workout on a local date. `hour` lets a test sit on a day boundary. */
const log = (year: number, month: number, day: number, hour = 9): WorkoutLog =>
  ({
    id: `log-${nextId++}`,
    timestamp: new Date(year, month - 1, day, hour, 30).toISOString(),
    claimedAt: new Date(year, month - 1, day, hour, 45).toISOString(),
  }) as unknown as WorkoutLog;

const unsaved = (year: number, month: number, day: number): WorkoutLog =>
  ({ ...log(year, month, day), claimedAt: null }) as WorkoutLog;

const goals = (...entries: [string, number][]): WeeklyGoalEntry[] =>
  entries.map(([week, days]) => ({ week, days }));

describe('trainedDaysByWeek', () => {
  it('groups distinct local days under their week', () => {
    const weeks = trainedDaysByWeek([log(2026, 10, 19), log(2026, 10, 22), log(2026, 10, 26)]);

    expect([...(weeks.get('2026-10-19') ?? [])].sort()).toEqual(['2026-10-19', '2026-10-22']);
    expect([...(weeks.get('2026-10-26') ?? [])]).toEqual(['2026-10-26']);
  });

  it('counts two workouts on one day once', () => {
    const weeks = trainedDaysByWeek([log(2026, 10, 22, 7), log(2026, 10, 22, 18)]);
    expect(weeks.get('2026-10-19')?.size).toBe(1);
  });

  it('keeps a 23:30 workout on its own local day', () => {
    const weeks = trainedDaysByWeek([log(2026, 10, 25, 23)]);
    expect([...(weeks.get('2026-10-19') ?? [])]).toEqual(['2026-10-25']);
    expect(weeks.has('2026-10-26')).toBe(false);
  });

  it('ignores workouts that were never saved', () => {
    expect(trainedDaysByWeek([unsaved(2026, 10, 22)]).size).toBe(0);
  });
});

describe('goalForWeek', () => {
  it('is the default before any change was recorded', () => {
    expect(goalForWeek([], '2026-10-19')).toBe(DEFAULT_WEEKLY_GOAL);
    expect(goalForWeek(goals(['2026-10-19', 5]), '2026-10-12')).toBe(DEFAULT_WEEKLY_GOAL);
  });

  it('is the latest entry at or before the week', () => {
    const list = goals(['2026-09-28', 4], ['2026-10-19', 6]);
    expect(goalForWeek(list, '2026-10-12')).toBe(4);
    expect(goalForWeek(list, '2026-10-19')).toBe(6);
    expect(goalForWeek(list, '2026-11-02')).toBe(6);
  });

  it('clamps a value that storage should never have held', () => {
    expect(goalForWeek(goals(['2026-10-19', 0]), '2026-10-19')).toBe(1);
    expect(goalForWeek(goals(['2026-10-19', 99]), '2026-10-19')).toBe(7);
  });
});

describe('setGoalForWeek', () => {
  it('replaces the entry for a week already recorded', () => {
    const once = setGoalForWeek([], '2026-10-19', 5);
    const twice = setGoalForWeek(once, '2026-10-19', 2);

    expect(twice).toEqual([{ week: '2026-10-19', days: 2 }]);
  });

  it('appends a later change and keeps the list in order', () => {
    const list = setGoalForWeek(setGoalForWeek([], '2026-10-19', 5), '2026-10-05', 2);
    expect(list.map((e) => e.week)).toEqual(['2026-10-05', '2026-10-19']);
  });

  it('never changes the status of a week that already finished', () => {
    // Three days trained in the week of 2026-10-12, against a goal of 3.
    const logs = [log(2026, 10, 12), log(2026, 10, 14), log(2026, 10, 16)];
    const before = goals(['2026-10-12', 3]);
    const after = setGoalForWeek(before, '2026-10-19', 6);

    expect(goalForWeek(before, '2026-10-12')).toBe(3);
    expect(goalForWeek(after, '2026-10-12')).toBe(3);
    // Raising it for this week leaves last week counted, so the run survives.
    expect(weeklyStreak(logs, after, THURSDAY)).toBe(1);
  });
});

describe('normalizeWeeklyGoals', () => {
  it('reads an absent setting as no recorded change', () => {
    expect(normalizeWeeklyGoals(undefined)).toEqual([]);
    expect(normalizeWeeklyGoals(null)).toEqual([]);
  });

  it('drops malformed entries and sorts what is left', () => {
    expect(
      normalizeWeeklyGoals([
        { week: '2026-10-19', days: 4 },
        { week: 7, days: 4 },
        { days: 4 },
        { week: '2026-10-05', days: 9 },
      ])
    ).toEqual([
      { week: '2026-10-05', days: 7 },
      { week: '2026-10-19', days: 4 },
    ]);
  });
});

describe('weeklyStreak', () => {
  // Three weeks of three days each, ending with the week of 2026-10-12.
  const threeFullWeeks = [
    log(2026, 9, 28),
    log(2026, 9, 30),
    log(2026, 10, 2),
    log(2026, 10, 5),
    log(2026, 10, 7),
    log(2026, 10, 9),
    log(2026, 10, 12),
    log(2026, 10, 14),
    log(2026, 10, 16),
  ];

  it('is zero with no history', () => {
    expect(weeklyStreak([], [], THURSDAY)).toBe(0);
  });

  it('counts the run of weeks that reached their goal', () => {
    expect(weeklyStreak(threeFullWeeks, [], THURSDAY)).toBe(3);
  });

  it('does not break on a current week still in progress', () => {
    const logs = [...threeFullWeeks, log(2026, 10, 19)];
    expect(weeklyStreak(logs, [], THURSDAY)).toBe(3);
  });

  it('includes the current week once its goal is met', () => {
    const logs = [...threeFullWeeks, log(2026, 10, 19), log(2026, 10, 20), log(2026, 10, 21)];
    expect(weeklyStreak(logs, [], THURSDAY)).toBe(4);
  });

  // The same three weeks with one day missing from the middle one, so that
  // week falls short of 3 and the run stops at the week after it.
  const brokenMiddleWeek = [
    log(2026, 9, 28),
    log(2026, 9, 30),
    log(2026, 10, 2),
    log(2026, 10, 5),
    log(2026, 10, 9),
    log(2026, 10, 12),
    log(2026, 10, 14),
    log(2026, 10, 16),
  ];

  it('ends at the last counted week when an earlier one came up short', () => {
    expect(weeklyStreak(brokenMiddleWeek, [], THURSDAY)).toBe(1);
  });

  it('is repaired by a workout typed in for a past week', () => {
    // Typing in the missing day is an ordinary saved log; nothing replays.
    expect(weeklyStreak([...brokenMiddleWeek, log(2026, 10, 7)], [], THURSDAY)).toBe(3);
  });

  it('measures each week against the goal that was in effect for it', () => {
    // Four from 2026-10-12 on: the two older three-day weeks still count.
    const list = goals(['2026-10-12', 4]);
    expect(weeklyStreak(threeFullWeeks, list, THURSDAY)).toBe(0);
    expect(weeklyStreak(threeFullWeeks, goals(['2026-10-19', 4]), THURSDAY)).toBe(3);
  });
});

describe('weekProgress', () => {
  it('describes a mid-week state behind the goal', () => {
    const logs = [log(2026, 10, 19), log(2026, 10, 21)];
    const progress = weekProgress(logs, goals(['2026-10-19', 4]), THURSDAY);

    expect(progress).toMatchObject({
      weekKey: '2026-10-19',
      todayKey: '2026-10-22',
      goal: 4,
      trainedDays: ['2026-10-19', '2026-10-21'],
      streak: 0,
      hasHistory: true,
      daysLeft: 4,
    });
    expect(goalMet(progress)).toBe(false);
  });

  it('reports last week against the goal last week had', () => {
    const logs = [log(2026, 10, 12), log(2026, 10, 14)];
    const progress = weekProgress(logs, goals(['2026-10-05', 4]), MONDAY);

    expect(progress.lastWeek).toEqual({ trainedDays: 2, goal: 4 });
    expect(progress.trainedDays).toEqual([]);
  });

  it('marks the goal met and has no history for a new install', () => {
    expect(
      goalMet(weekProgress([log(2026, 10, 19), log(2026, 10, 21), log(2026, 10, 22)], [], THURSDAY))
    ).toBe(true);
    expect(weekProgress([], [], THURSDAY).hasHistory).toBe(false);
  });
});
