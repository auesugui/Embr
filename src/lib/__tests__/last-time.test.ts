// =============================================================================
// Last time — the session screen's one-line reference (issue #81)
// =============================================================================
// Two rules are being pinned: WHICH saved workout the line reads, and how the
// numbers collapse. The second one has to match History, because reading two
// different collapses of the same sets on two screens is worse than reading
// neither.

import type { Exercise, LoggedSet, WorkoutLog } from '@/types';

import { findLastPerformed, lastTimeLine, prefillWeight } from '../last-time';

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

  // The varied form is the one spelling with no unit inside it, so the numbers
  // would read as the setting's unit when they are not (#85 step 2).
  it('names the unit on a varied load logged in the other unit', () => {
    const logs = [
      log(
        at(9),
        [exercise({ sets: [set({ weight: 55, reps: 12 }), set({ weight: 60, reps: 10 })] })],
        { weightUnit: 'lb' }
      ),
    ];

    expect(line(logs, 'bench_press-0', 'kg')).toBe('Last time: 55×12 · 60×10 in lb');
  });

  it('leaves the varied form alone when the session is in the unit on screen', () => {
    const varied = [set({ weight: 55, reps: 12 }), set({ weight: 60, reps: 10 })];

    // Stamped with the setting, and carrying no unit at all: both read as the
    // unit every other number on the screen is already in.
    expect(
      line([log(at(9), [exercise({ sets: varied })], { weightUnit: 'kg' })], 'bench_press-0', 'kg')
    ).toBe('Last time: 55×12 · 60×10');
    expect(line([log(at(9), [exercise({ sets: varied })])], 'bench_press-0', 'kg')).toBe(
      'Last time: 55×12 · 60×10'
    );
  });

  it('names no unit on varied bodyweight work, which has no load', () => {
    const logs = [
      log(
        at(9),
        [
          exercise({
            id: 'pull_up-0',
            sets: [set({ weight: null, reps: 8 }), set({ weight: null, reps: 6 })],
          }),
        ],
        { weightUnit: 'lb' }
      ),
    ];

    expect(line(logs, 'pull_up-0', 'kg')).toBe('Last time: 8, 6');
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

// -----------------------------------------------------------------------------
// The pre-fill (issue #85 step 2)
// -----------------------------------------------------------------------------
// The weight cache answers first, but it keeps five entries per movement, so a
// run of sets in the other unit can push a real session out of it. The saved
// workouts do not expire, which is why they are read behind it.

describe('prefillWeight', () => {
  /** A remembered weight, written `daysAgo` before this session started. */
  const remembered = (weight: number, daysAgo = 3) => ({ weight, recordedAt: at(daysAgo) });

  const fill = (
    logs: WorkoutLog[],
    cached: { weight: number; recordedAt: string } | null = null,
    units: 'lb' | 'kg' = 'lb',
    exerciseId = 'bench_press-0'
  ) => prefillWeight({ cached, logs, exerciseId, before: SESSION_START, units });

  it('takes the remembered weight when the cache has one', () => {
    expect(fill([], remembered(135))).toBe(135);
  });

  it('prefers a saved session logged after the cache was last written', () => {
    // A workout added through History writes no cache entry, so the cache can
    // hold an older weight for a movement that has since been trained.
    const logs = [log(at(1), [exercise({ sets: [set({ weight: 100 })] })], { weightUnit: 'kg' })];

    expect(fill(logs, remembered(85, 9), 'kg')).toBe(100);
  });

  it('keeps the remembered weight when it is the newer of the two', () => {
    const logs = [log(at(9), [exercise({ sets: [set({ weight: 85 })] })], { weightUnit: 'kg' })];

    expect(fill(logs, remembered(100, 1), 'kg')).toBe(100);
  });

  it('keeps a weight written during this session, which is newer than any log', () => {
    // Set 1 of the session being logged right now: `recordedAt` is after the
    // session start, and every saved workout read here is before it.
    const logs = [log(at(1), [exercise({ sets: [set({ weight: 100 })] })], { weightUnit: 'kg' })];
    const justNow = { weight: 125, recordedAt: new Date(SESSION_START + 60_000).toISOString() };

    expect(fill(logs, justNow, 'kg')).toBe(125);
  });

  it('lets a saved session win over a remembered weight with no readable time', () => {
    const logs = [log(at(1), [exercise({ sets: [set({ weight: 100 })] })], { weightUnit: 'kg' })];

    expect(fill(logs, { weight: 85, recordedAt: 'not a date' }, 'kg')).toBe(100);
  });

  it('keeps an unreadable remembered weight when there is no session to rank it against', () => {
    expect(fill([], { weight: 85, recordedAt: 'not a date' }, 'kg')).toBe(85);
  });

  it('reads the last session in this unit when the cache has nothing', () => {
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 100 })] })], { weightUnit: 'kg' })];

    expect(fill(logs, null, 'kg')).toBe(100);
  });

  it('never hands back the other unit\u2019s number', () => {
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 275 })] })], { weightUnit: 'lb' })];

    expect(fill(logs, null, 'kg')).toBeNull();
  });

  it('reaches past a session in the other unit to the last one in this unit', () => {
    const logs = [
      log(at(1), [exercise({ sets: [set({ weight: 275 })] })], { id: 'lb', weightUnit: 'lb' }),
      log(at(5), [exercise({ sets: [set({ weight: 100 })] })], { id: 'kg', weightUnit: 'kg' }),
    ];

    expect(fill(logs, null, 'kg')).toBe(100);
  });

  it('reads a workout with no unit of its own as the setting', () => {
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 135 })] })])];

    expect(fill(logs, null, 'lb')).toBe(135);
    expect(fill(logs, null, 'kg')).toBe(135);
  });

  it('opens empty when nothing was ever logged in this unit', () => {
    expect(fill([], null, 'kg')).toBeNull();
  });

  it('opens on the weight a drop set finished on, as the cache would have', () => {
    const logs = [
      log(at(2), [
        exercise({ sets: [set({ weight: 185 }), set({ weight: 155 }), set({ weight: 135 })] }),
      ]),
    ];

    expect(fill(logs)).toBe(135);
  });

  it('opens empty on a session that carried no load at all', () => {
    const logs = [
      log(at(2), [exercise({ id: 'pull_up-0', sets: [set({ weight: null, reps: 8 })] })]),
    ];

    expect(fill(logs, null, 'lb', 'pull_up-0')).toBeNull();
  });

  it('ignores a session that has not been saved', () => {
    const logs = [log(at(2), [exercise({ sets: [set({ weight: 135 })] })], { claimedAt: null })];

    expect(fill(logs)).toBeNull();
  });
});
