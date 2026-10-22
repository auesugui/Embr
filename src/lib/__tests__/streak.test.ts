// =============================================================================
// Embr Streak Tests
// =============================================================================
// The streak is derived from saved workouts on local calendar days. These pin
// the rules: runs, the one-day grace, back-dated joins, and time zones.

import type { WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import { localDayKey, previousDayKey } from '../local-day';
import { deriveStreak, streakOnDay } from '../streak';

// Local time on purpose. Fixtures sit on the calendar day they name.
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour);

const log = (date: Date, claimedAt: string | null = date.toISOString()): WorkoutLog => ({
  id: `workout_${date.getTime()}`,
  timestamp: date.toISOString(),
  exercises: [],
  durationSeconds: 600,
  streakDays: 0,
  sessionIntent: 'normal',
  claimedAt,
});

// Oct 22, 2026, mid-afternoon. "Today" in every case below.
const NOW = at(2026, 10, 22, 15);

describe('localDayKey', () => {
  it('reads the local calendar day with zero padding', () => {
    expect(localDayKey(at(2026, 1, 5, 9))).toBe('2026-01-05');
  });

  it('keeps a late evening on its own day', () => {
    expect(localDayKey(at(2026, 10, 20, 23))).toBe('2026-10-20');
  });
});

describe('previousDayKey', () => {
  it.each([
    ['2026-10-22', '2026-10-21'],
    ['2026-03-01', '2026-02-28'],
    ['2028-03-01', '2028-02-29'],
    ['2026-01-01', '2025-12-31'],
  ])('steps %s back to %s', (key, expected) => {
    expect(previousDayKey(key)).toBe(expected);
  });
});

describe('deriveStreak', () => {
  it('is zero with no workouts, and keeps the stored longest', () => {
    expect(deriveStreak([], NOW, 12)).toEqual({ current: 0, longest: 12, lastWorkoutDate: null });
  });

  it('counts consecutive days ending today', () => {
    const logs = [log(at(2026, 10, 22)), log(at(2026, 10, 21)), log(at(2026, 10, 20))];

    expect(deriveStreak(logs, NOW, 0)).toMatchObject({
      current: 3,
      longest: 3,
      lastWorkoutDate: '2026-10-22',
    });
  });

  it('stays alive through the day after the last workout', () => {
    const logs = [log(at(2026, 10, 21)), log(at(2026, 10, 20))];

    expect(deriveStreak(logs, NOW, 0).current).toBe(2);
  });

  it('lapses once a full day has passed with no workout', () => {
    const logs = [log(at(2026, 10, 20)), log(at(2026, 10, 19))];

    expect(deriveStreak(logs, NOW, 0)).toMatchObject({
      current: 0,
      lastWorkoutDate: '2026-10-20',
    });
  });

  it('counts two workouts on one day as one', () => {
    const logs = [log(at(2026, 10, 22, 7)), log(at(2026, 10, 22, 18))];

    expect(deriveStreak(logs, NOW, 0).current).toBe(1);
  });

  it('ignores workouts that were never saved', () => {
    const logs = [log(at(2026, 10, 22), null), log(at(2026, 10, 21))];

    expect(deriveStreak(logs, NOW, 0).current).toBe(1);
  });

  it('joins two runs when a back-dated workout fills the gap', () => {
    const before = [
      log(at(2026, 10, 22)),
      log(at(2026, 10, 21)),
      log(at(2026, 10, 19)),
      log(at(2026, 10, 18)),
    ];
    expect(deriveStreak(before, NOW, 0)).toMatchObject({ current: 2, longest: 2 });

    const after = [...before, log(at(2026, 10, 20))];
    expect(deriveStreak(after, NOW, 0)).toMatchObject({ current: 5, longest: 5 });
  });

  it('keeps the stored longest when today’s run is shorter', () => {
    expect(deriveStreak([log(at(2026, 10, 22))], NOW, 30).longest).toBe(30);
  });

  it('reads an evening workout and the next morning as consecutive days', () => {
    const logs = [log(at(2026, 10, 21, 7)), log(at(2026, 10, 22, 19))];

    expect(deriveStreak(logs, NOW, 0).current).toBe(2);
  });
});

describe('streakOnDay', () => {
  it('counts the run ending on the given day, that day included', () => {
    const logs = [log(at(2026, 10, 21)), log(at(2026, 10, 20)), log(at(2026, 10, 18))];

    expect(streakOnDay(logs, at(2026, 10, 22).toISOString())).toBe(3);
  });

  it('counts only the days up to that day, so later workouts do not change it', () => {
    const logs = [
      log(at(2026, 10, 22)),
      log(at(2026, 10, 21)),
      log(at(2026, 10, 19)),
      log(at(2026, 10, 18)),
    ];

    expect(streakOnDay(logs, at(2026, 10, 20).toISOString())).toBe(3);
  });

  it('is one for a day with no neighbours', () => {
    expect(streakOnDay([], at(2026, 10, 1).toISOString())).toBe(1);
  });
});
