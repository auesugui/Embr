// =============================================================================
// exercise-progress — the series behind the Progress tab (issue #77)
// =============================================================================
// The chart and the PR list are the payoff for logging, so the rules that
// decide what they draw are tested here rather than through a render. Every
// number on both screens comes out of these functions.

import type { Exercise, LoggedSet, WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import {
  buildExerciseProgress,
  chartAxis,
  findExerciseProgress,
  formatProgressDate,
  hasRecentPR,
  progressRecords,
  rangePoints,
  summarizePoint,
} from '../exercise-progress';

const NOW_MS = Date.parse('2026-10-23T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** `daysAgo` before the fixed clock, as an ISO timestamp. */
const at = (daysAgo: number): string => new Date(NOW_MS - daysAgo * DAY_MS).toISOString();

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 5,
  weight: 100,
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

const log = (timestamp: string, exercises: Exercise[], id = timestamp): WorkoutLog => ({
  id,
  timestamp,
  exercises,
  durationSeconds: 1800,
  streakDays: 1,
  sessionIntent: 'normal',
  claimedAt: timestamp,
});

// -----------------------------------------------------------------------------
// The series
// -----------------------------------------------------------------------------

describe('buildExerciseProgress — the series', () => {
  it('puts one point per session, oldest first, at the session heaviest set', () => {
    const logs = [
      log(at(0), [exercise({ sets: [set({ weight: 195, reps: 3 }), set({ weight: 185 })] })]),
      log(at(7), [exercise({ sets: [set({ weight: 175, reps: 5 })] })]),
    ];

    const [progress] = buildExerciseProgress(logs);
    expect(progress.metric).toBe('weight');
    expect(progress.points.map((p) => p.value)).toEqual([175, 195]);
    expect(progress.points[1].reps).toBe(3);
  });

  it('ignores sets that were never logged', () => {
    const logs = [
      log(at(0), [
        exercise({
          sets: [set({ weight: 135 }), set({ weight: 500, logged: false })],
        }),
      ]),
    ];

    expect(buildExerciseProgress(logs)[0].points[0].value).toBe(135);
  });

  it('drops a session whose logged sets carry no value at all', () => {
    const logs = [
      log(at(0), [exercise({ sets: [set({ weight: 185 })] })]),
      log(at(3), [exercise({ sets: [set({ weight: null, reps: null })] })], 'empty'),
    ];

    expect(buildExerciseProgress(logs)[0].points).toHaveLength(1);
  });

  it('keeps two sessions on the same calendar day as two points', () => {
    const logs = [
      log('2026-10-20T07:00:00.000Z', [exercise({ sets: [set({ weight: 150 })] })], 'am'),
      log('2026-10-20T19:00:00.000Z', [exercise({ sets: [set({ weight: 160 })] })], 'pm'),
    ];

    expect(buildExerciseProgress(logs)[0].points.map((p) => p.value)).toEqual([150, 160]);
  });

  it('groups a movement logged twice in one session under one exercise', () => {
    // A session exercise's id is the library id plus its position, so the same
    // movement in two slots must not become two exercises.
    const logs = [
      log(at(0), [
        exercise({ id: 'bench_press-0', sets: [set({ weight: 135 })] }),
        exercise({ id: 'bench_press-3', sets: [set({ weight: 185 })] }),
      ]),
    ];

    const progress = buildExerciseProgress(logs);
    expect(progress).toHaveLength(1);
    expect(progress[0].exerciseId).toBe('bench_press');
    expect(progress[0].points).toHaveLength(2);
  });

  it('breaks a weight tie by reps, so the row names the hardest set', () => {
    const logs = [
      log(at(0), [
        exercise({ sets: [set({ weight: 185, reps: 3 }), set({ weight: 185, reps: 6 })] }),
      ]),
    ];

    expect(buildExerciseProgress(logs)[0].points[0].reps).toBe(6);
  });

  it('excludes unclaimed sessions', () => {
    const unclaimed: WorkoutLog = { ...log(at(1), [exercise()]), claimedAt: null };
    expect(buildExerciseProgress([unclaimed])).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Which metric the series measures
// -----------------------------------------------------------------------------

describe('buildExerciseProgress — metric choice', () => {
  it('uses weight when any logged set of the exercise carried one', () => {
    const logs = [
      log(at(7), [exercise({ sets: [set({ weight: null, reps: 8 })] })], 'a'),
      log(at(0), [exercise({ sets: [set({ weight: 135, reps: 5 })] })], 'b'),
    ];

    const [progress] = buildExerciseProgress(logs);
    expect(progress.metric).toBe('weight');
    // The bodyweight session has no weight, so it is not a point on a weight series.
    expect(progress.points.map((p) => p.value)).toEqual([135]);
  });

  it('uses best reps for a movement that never carried a weight', () => {
    const logs = [
      log(
        at(7),
        [exercise({ id: 'pull_ups-0', name: 'Pull-Up', sets: [set({ weight: null, reps: 8 })] })],
        'a'
      ),
      log(
        at(0),
        [
          exercise({
            id: 'pull_ups-0',
            name: 'Pull-Up',
            sets: [set({ weight: null, reps: 10 }), set({ weight: null, reps: 12 })],
          }),
        ],
        'b'
      ),
    ];

    const [progress] = buildExerciseProgress(logs);
    expect(progress.metric).toBe('reps');
    expect(progress.points.map((p) => p.value)).toEqual([8, 12]);
    expect(summarizePoint(progress.points[1], 'reps', 'lb')).toBe(
      `12 reps · ${formatProgressDate(at(0))}`
    );
  });

  it('uses the longest hold in seconds for a hold, and formats it as a duration', () => {
    const logs = [
      log(at(0), [
        exercise({
          id: 'plank-0',
          name: 'Plank',
          metric: 'time',
          sets: [set({ weight: null, reps: 45 }), set({ weight: null, reps: 70 })],
        }),
      ]),
    ];

    const [progress] = buildExerciseProgress(logs);
    expect(progress.metric).toBe('time');
    expect(progress.points[0].value).toBe(70);
    expect(summarizePoint(progress.points[0], 'time', 'lb')).toBe(
      `1m 10s · ${formatProgressDate(at(0))}`
    );
  });

  it('reads the hold from the movement when the log predates the metric field', () => {
    // Logs written before `Exercise.metric` existed carry no metric of their
    // own; the library answers for them.
    const logs = [
      log(at(0), [
        exercise({ id: 'plank-1', name: 'Plank', sets: [set({ weight: null, reps: 60 })] }),
      ]),
    ];

    expect(buildExerciseProgress(logs)[0].metric).toBe('time');
  });

  it('leaves cardio entries out of the list entirely', () => {
    const logs = [
      log(at(0), [
        exercise({
          id: 'custom-bike',
          name: 'Bike',
          sets: [],
          cardio: { durationSeconds: 2700, distance: 12, distanceUnit: 'km' },
        }),
        exercise(),
      ]),
    ];

    expect(buildExerciseProgress(logs).map((p) => p.name)).toEqual(['Bench Press']);
  });
});

// -----------------------------------------------------------------------------
// The list
// -----------------------------------------------------------------------------

describe('buildExerciseProgress — list ordering and naming', () => {
  it('orders by last logged date, newest first', () => {
    const logs = [
      log(at(14), [exercise({ id: 'squat-0', name: 'Back Squat' })], 'a'),
      log(at(1), [exercise({ id: 'deadlift-0', name: 'Deadlift' })], 'b'),
      log(at(6), [exercise({ id: 'bench_press-0', name: 'Bench Press' })], 'c'),
    ];

    expect(buildExerciseProgress(logs).map((p) => p.name)).toEqual([
      'Deadlift',
      'Bench Press',
      'Back Squat',
    ]);
  });

  it('names the exercise the way the most recent log spells it', () => {
    const logs = [
      log(at(10), [exercise({ name: 'Bench' })], 'a'),
      log(at(0), [exercise({ name: 'Bench Press' })], 'b'),
    ];

    expect(buildExerciseProgress(logs)[0].name).toBe('Bench Press');
  });

  it('summarizes the row as weight × reps and the date', () => {
    const logs = [log(at(0), [exercise({ sets: [set({ weight: 275, reps: 5 })] })])];
    const [progress] = buildExerciseProgress(logs);

    expect(summarizePoint(progress.points[0], 'weight', 'lb')).toBe(
      `275 lb × 5 · ${formatProgressDate(at(0))}`
    );
  });

  it('finds one exercise by id, with or without the positional suffix', () => {
    const logs = [log(at(0), [exercise()])];

    expect(findExerciseProgress(logs, 'bench_press')?.name).toBe('Bench Press');
    expect(findExerciseProgress(logs, 'bench_press-2')?.name).toBe('Bench Press');
    expect(findExerciseProgress(logs, 'squat')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Ranges
// -----------------------------------------------------------------------------

describe('rangePoints', () => {
  const points = [
    { logId: 'a', timestamp: at(300), value: 150, reps: 5, hasPR: false },
    { logId: 'b', timestamp: at(120), value: 165, reps: 5, hasPR: false },
    { logId: 'c', timestamp: at(60), value: 175, reps: 5, hasPR: false },
    { logId: 'd', timestamp: at(10), value: 195, reps: 3, hasPR: false },
  ];

  it('keeps only the sessions inside the window', () => {
    expect(rangePoints(points, '8W', NOW_MS).map((p) => p.logId)).toEqual(['d']);
    expect(rangePoints(points, '3M', NOW_MS).map((p) => p.logId)).toEqual(['c', 'd']);
    expect(rangePoints(points, '6M', NOW_MS).map((p) => p.logId)).toEqual(['b', 'c', 'd']);
    expect(rangePoints(points, '1Y', NOW_MS).map((p) => p.logId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps everything on All', () => {
    expect(rangePoints(points, 'All', NOW_MS)).toHaveLength(4);
  });
});

// -----------------------------------------------------------------------------
// PRs
// -----------------------------------------------------------------------------

describe('progressRecords', () => {
  const point = (timestamp: string, value: number) => ({
    logId: timestamp,
    timestamp,
    value,
    reps: 5,
    hasPR: false,
  });

  it('records every new running maximum, newest first, with the value it beat', () => {
    const records = progressRecords([
      point(at(70), 165),
      point(at(60), 160),
      point(at(44), 175),
      point(at(44), 175),
      point(at(2), 195),
    ]);

    expect(records).toEqual([
      { timestamp: at(2), value: 195, previous: 175 },
      { timestamp: at(44), value: 175, previous: 165 },
      { timestamp: at(70), value: 165, previous: null },
    ]);
  });

  it('calls the earliest session the first record, never a beaten zero', () => {
    const records = progressRecords([point(at(5), 135)]);
    expect(records).toEqual([{ timestamp: at(5), value: 135, previous: null }]);
  });

  it('returns nothing for an exercise with no points', () => {
    expect(progressRecords([])).toEqual([]);
  });
});

describe('hasRecentPR', () => {
  const flagged = (daysAgo: number) => ({
    logId: `p${daysAgo}`,
    timestamp: at(daysAgo),
    value: 195,
    reps: 3,
    hasPR: true,
  });

  it('badges a PR logged inside the 14-day window', () => {
    expect(hasRecentPR([flagged(13)], NOW_MS)).toBe(true);
  });

  it('does not badge a PR logged outside it', () => {
    expect(hasRecentPR([flagged(15)], NOW_MS)).toBe(false);
  });

  it('does not badge a session with no flagged set', () => {
    expect(hasRecentPR([{ ...flagged(1), hasPR: false }], NOW_MS)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// The chart's y axis
// -----------------------------------------------------------------------------

describe('chartAxis', () => {
  it('rounds the band out to whole steps', () => {
    expect(chartAxis([165, 175, 185, 195])).toEqual([160, 180, 200]);
  });

  it('always contains the series, even when the round floor is too high', () => {
    // 177–192 picks a step of 10 and floors to 170, which tops out at 190 —
    // two pounds under the highest session. The step has to widen.
    const [low, , high] = chartAxis([177, 183, 186, 189, 192]);
    expect(low).toBeLessThanOrEqual(177);
    expect(high).toBeGreaterThanOrEqual(192);
  });

  it('contains the series for every window of a rising lift', () => {
    const series = [165, 168, 171, 174, 177, 177, 183, 186, 189, 192];
    for (let start = 0; start < series.length - 1; start++) {
      const window = series.slice(start);
      const [low, , high] = chartAxis(window);
      expect(low).toBeLessThanOrEqual(Math.min(...window));
      expect(high).toBeGreaterThanOrEqual(Math.max(...window));
    }
  });

  it('keeps small rep numbers on their own scale', () => {
    expect(chartAxis([8, 10, 12])).toEqual([8, 10, 12]);
  });

  it('centres a series that never changed, rather than pinning it to the floor', () => {
    const [low, mid, high] = chartAxis([45, 45, 45]);
    expect(mid).toBe(45);
    expect(low).toBeLessThan(45);
    expect(high).toBeGreaterThan(45);
  });
});
