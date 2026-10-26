// =============================================================================
// Last time — the session screen's one-line reference (issue #81)
// =============================================================================
// Two rules are being pinned: WHICH saved workout the line reads, and how the
// numbers collapse. The second one has to match History, because reading two
// different collapses of the same sets on two screens is worse than reading
// neither.

import type { Exercise, LoggedSet, WorkoutLog } from '@/types';

import { findLastPerformed, lastTimeLine } from '../last-time';

const SESSION_START = Date.parse('2026-10-23T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** `daysAgo` before the session start, as an ISO timestamp. */
const at = (daysAgo: number): string => new Date(SESSION_START - daysAgo * DAY_MS).toISOString();

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 135,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...over,
});

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'bench_press-0',
  name: 'Bench Press',
  muscleGroups: ['chest'],
  sets: [set()],
  restSeconds: 90,
  completed: true,
  ...over,
});

const log = (
  timestamp: string,
  exercises: Exercise[],
  over: Partial<WorkoutLog> = {}
): WorkoutLog =>
  ({
    id: timestamp,
    timestamp,
    exercises,
    durationSeconds: 1800,
    streakDays: 1,
    sessionIntent: 'normal',
    claimedAt: timestamp,
    ...over,
  }) as WorkoutLog;

const line = (logs: WorkoutLog[], exerciseId = 'bench_press-0', setting: 'lb' | 'kg' = 'lb') =>
  lastTimeLine({ logs, exerciseId, before: SESSION_START, setting });

// -----------------------------------------------------------------------------
// Which workout it reads
// -----------------------------------------------------------------------------

describe('findLastPerformed', () => {
  it('reads the most recent earlier workout carrying the movement', () => {
    const logs = [
      log(at(2), [exercise({ sets: [set({ weight: 185 })] })]),
      log(at(9), [exercise({ sets: [set({ weight: 175 })] })]),
    ];

    expect(findLastPerformed(logs, 'bench_press-0', SESSION_START, 'lb')?.sets[0].weight).toBe(185);
  });

  it('ignores a workout saved after the session started', () => {
    // A session that stays open past midnight must not start reading itself,
    // or a workout saved on another device, as "last time".
    const logs = [
      log(new Date(SESSION_START + DAY_MS).toISOString(), [
        exercise({ sets: [set({ weight: 999 })] }),
      ]),
      log(at(3), [exercise({ sets: [set({ weight: 185 })] })]),
    ];

    expect(findLastPerformed(logs, 'bench_press-0', SESSION_START, 'lb')?.sets[0].weight).toBe(185);
  });

  it('skips a workout that was never saved', () => {
    const logs = [
      log(at(1), [exercise({ sets: [set({ weight: 999 })] })], { claimedAt: null }),
      log(at(5), [exercise({ sets: [set({ weight: 185 })] })]),
    ];

    expect(findLastPerformed(logs, 'bench_press-0', SESSION_START, 'lb')?.sets[0].weight).toBe(185);
  });

  it('skips rows with neither a weight nor a count', () => {
    const empty = set({ reps: 0, weight: null });
    const logs = [
      log(at(1), [exercise({ sets: [empty, empty] })]),
      log(at(6), [exercise({ sets: [set({ weight: 185 })] })]),
    ];

    expect(findLastPerformed(logs, 'bench_press-0', SESSION_START, 'lb')?.sets[0].weight).toBe(185);
  });

  it('matches on the base id, whatever position the movement sat in', () => {
    const logs = [log(at(2), [exercise({ id: 'bench_press-4' })])];

    expect(findLastPerformed(logs, 'bench_press-1', SESSION_START, 'lb')?.sets).toHaveLength(1);
  });

  it('merges repeated entries of one movement in one workout', () => {
    // The Powerbuilding days carry a heavy entry and a back-off entry. That is
    // one session of the movement, not two.
    const logs = [
      log(at(2), [
        exercise({ id: 'bench_press-0', sets: [set({ weight: 225, reps: 5 })] }),
        exercise({ id: 'bench_press-3', sets: [set({ weight: 135, reps: 12 })] }),
      ]),
    ];

    expect(findLastPerformed(logs, 'bench_press-0', SESSION_START, 'lb')?.sets).toHaveLength(2);
  });

  it('is null the first time you train a movement', () => {
    expect(findLastPerformed([], 'bench_press-0', SESSION_START, 'lb')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// How it reads
// -----------------------------------------------------------------------------

describe('lastTimeLine', () => {
  it('says "First time" rather than leaving a gap', () => {
    expect(line([])).toBe('First time');
  });

  it('collapses uniform weighted sets', () => {
    const logs = [log(at(4), [exercise({ sets: [set(), set(), set()] })])];

    expect(line(logs)).toBe('Last time: 3 × 10 @ 135 lb');
  });

  it('prints one set on its own terms rather than multiplying by one', () => {
    const logs = [log(at(4), [exercise({ sets: [set()] })])];

    expect(line(logs)).toBe('Last time: 135 lb × 10');
  });

  it('prints bodyweight work as reps alone', () => {
    const logs = [
      log(at(6), [
        exercise({
          id: 'pull_up-0',
          sets: [set({ weight: null, reps: 8 }), set({ weight: null, reps: 8 })],
        }),
      ]),
    ];

    expect(line(logs, 'pull_up-0')).toBe('Last time: 2 × 8');
  });

  it('keeps every number when the reps varied at one weight', () => {
    const logs = [log(at(1), [exercise({ sets: [set(), set(), set({ reps: 8 })] })])];

    expect(line(logs)).toBe('Last time: 135 lb × 10, 10, 8');
  });

  it('falls back to History detail form when the weight moved too', () => {
    const logs = [
      log(at(9), [
        exercise({
          sets: [set({ weight: 55, reps: 12 }), set({ weight: 60, reps: 10 })],
        }),
      ]),
    ];

    expect(line(logs)).toBe('Last time: 55×12 · 60×10');
  });

  it('reads a hold in seconds, never as reps', () => {
    const logs = [
      log(at(3), [
        exercise({
          id: 'plank-0',
          metric: 'time',
          sets: [set({ weight: null, reps: 45 }), set({ weight: null, reps: 60 })],
        }),
      ]),
    ];

    // A whole minute reads as "1m" here because it reads as "1m" in the ladder,
    // the logged row and History — one spelling of a duration, not two.
    expect(line(logs, 'plank-0')).toBe('Last time: 45s, 1m');
  });

  it('collapses a uniform hold the same way', () => {
    const logs = [
      log(at(3), [
        exercise({
          id: 'plank-0',
          metric: 'time',
          sets: [set({ weight: null, reps: 45 }), set({ weight: null, reps: 45 })],
        }),
      ]),
    ];

    expect(line(logs, 'plank-0')).toBe('Last time: 2 × 45s');
  });

  it('labels the weight with the setting when the workout carries no unit', () => {
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 60 }), set({ weight: 60 })] })])];

    expect(line(logs, 'bench_press-0', 'kg')).toBe('Last time: 2 × 10 @ 60 kg');
  });

  it('labels the weight with the unit the workout was logged in (#85 step 2)', () => {
    // The caption reports a past session, so it prints what was recorded and
    // converts nothing. Relabelling 60 lb as 60 kg because the setting moved
    // is the one reading that is simply false.
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 60 })] })], { weightUnit: 'lb' })];

    expect(line(logs, 'bench_press-0', 'kg')).toBe('Last time: 60 lb × 10');
  });

  it('reads an unrecognised unit in a restored backup as absent', () => {
    // restoreBackup passes the field through unchanged, so a hand-edited or
    // future-version file can carry anything. It falls back to the setting.
    const logs = [
      log(at(2), [exercise({ sets: [set({ weight: 60 })] })], {
        weightUnit: 'stone' as unknown as 'lb',
      }),
    ];

    expect(line(logs, 'bench_press-0', 'kg')).toBe('Last time: 60 kg × 10');
  });

  it('leaves out a cardio entry, which has no sets to read', () => {
    const logs = [
      log(at(1), [
        {
          ...exercise({ id: 'custom-bike', sets: [] }),
          cardio: { durationSeconds: 2700, distance: 12, distanceUnit: 'km', rpe: 5 },
        } as Exercise,
      ]),
    ];

    expect(line(logs, 'custom-bike')).toBe('First time');
  });
});
