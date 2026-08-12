// =============================================================================
// IronQuest History Stats — Regression Tests (issue #18)
// =============================================================================
// Backs the three required regression assertions:
//   1. "This Week" stat updates when a claimed workout falls within 7 days
//   2. claimed workouts appear in history; unclaimed do NOT
//   3. history list is ordered reverse-chron (newest first)
//
// Testing the pure helpers (not the components) mirrors the repo's established
// pattern — every other test suite covers stores/engines/libs, not RN renders.
// The home "This Week" stat and the history list both read through these exact
// functions, so their behavior is the UI's behavior.

import type { Exercise, WorkoutLog } from '@/types';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { countClaimedInLast7Days, countClaimedSince, getClaimedLogs } from '../history-stats';

// Fixed reference clock: 2026-07-03T12:00:00Z. All relative timestamps are
// derived from this so the 7-day window is deterministic.
const NOW_MS = Date.parse('2026-07-03T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const stubExercise: Exercise = {
  id: 'ex-1',
  name: 'Bench Press',
  muscleGroups: ['chest'],
  sets: [{ reps: 10, weight: 100, logged: true, isPR: false, isRepPR: false }],
  restSeconds: 60,
  completed: true,
};

/** Build a log with full control over the fields the helpers care about. */
const makeLog = (overrides: Partial<WorkoutLog>): WorkoutLog => ({
  id: `log_${Math.random().toString(36).slice(2)}`,
  timestamp: new Date(NOW_MS).toISOString(),
  exercises: [stubExercise],
  durationSeconds: 600,
  streakDays: 1,
  sessionIntent: 'normal',
  // Unclaimed by default — tests opt into "claimed" explicitly.
  claimedAt: null,
  ...overrides,
});

describe('history-stats', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // Silence the random/Date noise; tests are deterministic with explicit ms.
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ---------------------------------------------------------------------------
  // getClaimedLogs — claimed-only + reverse-chron (criteria 2 & 3)
  // ---------------------------------------------------------------------------

  describe('getClaimedLogs', () => {
    it('excludes unclaimed workouts (they are not history yet)', () => {
      const logs = [
        makeLog({ id: 'claimed', claimedAt: '2026-07-03T12:01:00Z' }),
        makeLog({ id: 'unclaimed', claimedAt: null }),
      ];

      const result = getClaimedLogs(logs);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claimed');
    });

    it('returns only claimed workouts when all are claimed', () => {
      const logs = [
        makeLog({ id: 'a', claimedAt: '2026-07-01T00:00:00Z' }),
        makeLog({ id: 'b', claimedAt: '2026-07-02T00:00:00Z' }),
      ];

      const result = getClaimedLogs(logs);

      expect(result).toHaveLength(2);
    });

    it('returns an empty array when no workouts are claimed', () => {
      const logs = [makeLog({ id: 'a', claimedAt: null }), makeLog({ id: 'b', claimedAt: null })];

      expect(getClaimedLogs(logs)).toEqual([]);
    });

    it('orders by workout timestamp, newest first (reverse-chron)', () => {
      // Deliberately insert in NON-chronological order and claim the oldest
      // most recently — ordering must follow timestamp, not insertion/claim.
      const logs = [
        makeLog({
          id: 'oldest',
          timestamp: new Date(NOW_MS - 5 * DAY_MS).toISOString(),
          claimedAt: new Date(NOW_MS - 1000).toISOString(), // claimed last
        }),
        makeLog({
          id: 'newest',
          timestamp: new Date(NOW_MS).toISOString(),
          claimedAt: new Date(NOW_MS - 10 * DAY_MS).toISOString(), // claimed first
        }),
        makeLog({
          id: 'middle',
          timestamp: new Date(NOW_MS - 2 * DAY_MS).toISOString(),
          claimedAt: new Date(NOW_MS - 500).toISOString(),
        }),
      ];

      const ids = getClaimedLogs(logs).map((l) => l.id);

      expect(ids).toEqual(['newest', 'middle', 'oldest']);
    });

    it('does not mutate the input array', () => {
      const logs = [
        makeLog({ id: 'a', claimedAt: 'x', timestamp: '2026-07-03T00:00:00Z' }),
        makeLog({ id: 'b', claimedAt: 'x', timestamp: '2026-07-01T00:00:00Z' }),
      ];
      const originalOrder = logs.map((l) => l.id);

      getClaimedLogs(logs);

      expect(logs.map((l) => l.id)).toEqual(originalOrder);
    });
  });

  // ---------------------------------------------------------------------------
  // countClaimedInLast7Days — "This Week" stat (criterion 1)
  // ---------------------------------------------------------------------------

  describe('countClaimedInLast7Days', () => {
    it('is 0 when there are no claimed workouts', () => {
      expect(countClaimedInLast7Days([], NOW_MS)).toBe(0);
      expect(countClaimedInLast7Days([makeLog({ claimedAt: null })], NOW_MS)).toBe(0);
    });

    it('counts a claimed workout finished inside the 7-day window', () => {
      const logs = [
        makeLog({
          claimedAt: '2026-07-03T00:00:00Z',
          timestamp: new Date(NOW_MS - 2 * DAY_MS).toISOString(),
        }),
      ];

      expect(countClaimedInLast7Days(logs, NOW_MS)).toBe(1);
    });

    it('updates when a second claimed workout enters the window', () => {
      // Day -2 claimed, day -3 unclaimed → 1 in window.
      const day2 = makeLog({
        id: 'recent',
        claimedAt: '2026-07-03T00:00:00Z',
        timestamp: new Date(NOW_MS - 2 * DAY_MS).toISOString(),
      });
      const day3Unclaimed = makeLog({
        id: 'recent-unclaimed',
        claimedAt: null,
        timestamp: new Date(NOW_MS - 3 * DAY_MS).toISOString(),
      });

      expect(countClaimedInLast7Days([day2, day3Unclaimed], NOW_MS)).toBe(1);

      // Now claim day3 → both count.
      const day3 = { ...day3Unclaimed, claimedAt: '2026-07-03T00:00:00Z' };
      expect(countClaimedInLast7Days([day2, day3], NOW_MS)).toBe(2);
    });

    it('excludes a claimed workout finished just outside the 7-day window', () => {
      const logs = [
        makeLog({
          id: 'eight-days-ago',
          claimedAt: '2026-06-30T00:00:00Z',
          timestamp: new Date(NOW_MS - 8 * DAY_MS).toISOString(),
        }),
      ];

      expect(countClaimedInLast7Days(logs, NOW_MS)).toBe(0);
    });

    it('includes a workout exactly on the 7-day boundary', () => {
      const logs = [
        makeLog({
          id: 'edge',
          claimedAt: 'x',
          timestamp: new Date(NOW_MS - 7 * DAY_MS).toISOString(),
        }),
      ];

      expect(countClaimedInLast7Days(logs, NOW_MS)).toBe(1);
    });

    it('ignores unclaimed workouts even when inside the window', () => {
      const logs = [
        makeLog({
          id: 'today-but-unclaimed',
          claimedAt: null,
          timestamp: new Date(NOW_MS).toISOString(),
        }),
      ];

      expect(countClaimedInLast7Days(logs, NOW_MS)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // countClaimedSince — explicit lower-bound variant
  // ---------------------------------------------------------------------------

  describe('countClaimedSince', () => {
    it('counts only claimed workouts at or after sinceMs', () => {
      const since = NOW_MS - 3 * DAY_MS;
      const logs = [
        makeLog({
          id: 'in',
          claimedAt: 'x',
          timestamp: new Date(NOW_MS - 1 * DAY_MS).toISOString(),
        }),
        makeLog({
          id: 'out',
          claimedAt: 'x',
          timestamp: new Date(NOW_MS - 10 * DAY_MS).toISOString(),
        }),
      ];

      expect(countClaimedSince(logs, since, NOW_MS)).toBe(1);
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });
});
