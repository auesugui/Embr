// =============================================================================
// exercise-progress — the series behind the Progress tab (issue #77)
// =============================================================================
// The chart and the PR list are the payoff for logging, so the rules that
// decide what they draw are tested here rather than through a render. Every
// number on both screens comes out of these functions.

import type { Exercise, LoggedSet, WeightUnit, WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import type {
  ExerciseProgress,
  ProgressMetric,
  ProgressRange,
  UnitSeries,
} from '../exercise-progress';
import {
  buildExerciseProgress,
  chartAxis,
  describeOneSession,
  describeOtherUnit,
  describePRCallout,
  describeSessionCount,
  findExerciseProgress,
  formatProgressDate,
  hasRecentPR,
  isLiveSeries,
  latestSeries,
  progressRecords,
  rangePoints,
  seriesForUnit,
  smallestRange,
  summarizePoint,
} from '../exercise-progress';

const NOW_MS = Date.parse('2026-10-23T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** `daysAgo` before the fixed clock, as an ISO timestamp. */
const at = (daysAgo: number): string => new Date(NOW_MS - daysAgo * DAY_MS).toISOString();

/** The metric the bare point fixtures below are in. */
const weight: ProgressMetric = 'weight';

/** The unit the bare point fixtures below are logged in. */
const lb: WeightUnit = 'lb';

/** The fixed clock the window helpers are measured against. */
const NOW = new Date(NOW_MS);

/** The same moment one local calendar day later. */
const tomorrow = (from: Date): Date =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 9);

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

/**
 * The series, with the setting that answers for logs carrying no unit.
 *
 * Every fixture in this file is one unit unless it says otherwise, so the
 * setting is lb throughout and `latestSeries` is the whole series.
 */
const build = (logs: WorkoutLog[], setting: WeightUnit = 'lb') =>
  buildExerciseProgress(logs, setting);

// -----------------------------------------------------------------------------
// The series
// -----------------------------------------------------------------------------

describe('buildExerciseProgress — the series', () => {
  it('puts one point per session, oldest first, at the session heaviest set', () => {
    const logs = [
      log(at(0), [exercise({ sets: [set({ weight: 195, reps: 3 }), set({ weight: 185 })] })]),
      log(at(7), [exercise({ sets: [set({ weight: 175, reps: 5 })] })]),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('weight');
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

    expect(build(logs)[0].points[0].value).toBe(135);
  });

  it('drops a session whose logged sets carry no value at all', () => {
    const logs = [
      log(at(0), [exercise({ sets: [set({ weight: 185 })] })]),
      log(at(3), [exercise({ sets: [set({ weight: null, reps: null })] })], 'empty'),
    ];

    expect(build(logs)[0].points).toHaveLength(1);
  });

  it('keeps two sessions on the same calendar day as two points', () => {
    const logs = [
      log('2026-10-20T07:00:00.000Z', [exercise({ sets: [set({ weight: 150 })] })], 'am'),
      log('2026-10-20T19:00:00.000Z', [exercise({ sets: [set({ weight: 160 })] })], 'pm'),
    ];

    expect(build(logs)[0].points.map((p) => p.value)).toEqual([150, 160]);
  });

  it('merges a movement logged twice in one session into one point', () => {
    // The Powerbuilding templates carry the same movement twice — a heavy entry
    // and a back-off entry. That is one session of it, at the heavier value.
    const logs = [
      log(at(0), [
        exercise({ id: 'db_floor_press-0', sets: [set({ weight: 185, reps: 5 })] }),
        exercise({ id: 'db_floor_press-3', sets: [set({ weight: 135, reps: 12 })] }),
      ]),
    ];

    const progress = build(logs);
    expect(progress).toHaveLength(1);
    expect(progress[0].exerciseId).toBe('db_floor_press');
    expect(progress[0].points).toHaveLength(1);
    expect(progress[0].points[0].value).toBe(185);
    expect(progress[0].points[0].reps).toBe(5);
  });

  it('counts a repeated movement as one session, not two', () => {
    // Two logs, the movement twice in each. Four entries, two sessions — which
    // is what the chart's two-point rule and "N sessions logged" count.
    const twice = () => [
      exercise({ id: 'db_rdl-0', sets: [set({ weight: 120 })] }),
      exercise({ id: 'db_rdl-4', sets: [set({ weight: 90 })] }),
    ];
    const progress = build([log(at(7), twice(), 'a'), log(at(0), twice(), 'b')]);

    expect(progress[0].points).toHaveLength(2);
    expect(latestSeries(progress[0]).comparable).toHaveLength(2);
  });

  it('breaks a weight tie by reps, so the row names the hardest set', () => {
    const logs = [
      log(at(0), [
        exercise({ sets: [set({ weight: 185, reps: 3 }), set({ weight: 185, reps: 6 })] }),
      ]),
    ];

    expect(build(logs)[0].points[0].reps).toBe(6);
  });

  it('excludes unclaimed sessions', () => {
    const unclaimed: WorkoutLog = { ...log(at(1), [exercise()]), claimedAt: null };
    expect(build([unclaimed])).toEqual([]);
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

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('weight');
    // Both sessions happened, so both count. Only the weighted one is on the
    // series, because reps are never compared with weights.
    expect(progress.points.map((p) => p.metric)).toEqual(['reps', 'weight']);
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([135]);
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

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('reps');
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

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('time');
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

    expect(latestSeries(build(logs)[0]).metric).toBe('time');
  });

  // ---------------------------------------------------------------------------
  // A movement logged both ways. Every session counts; only the comparable ones
  // are plotted. See the module header.
  // ---------------------------------------------------------------------------

  it('keeps a bodyweight session of a weighted movement as a session', () => {
    const logs = [
      log(at(20), [exercise({ sets: [set({ weight: 135, reps: 8 })] })], 'a'),
      log(at(10), [exercise({ sets: [set({ weight: 155, reps: 5 })] })], 'b'),
      log(at(0), [exercise({ sets: [set({ weight: null, reps: 12 })] })], 'c'),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('weight');
    // Three sessions logged, two of them on the chart.
    expect(progress.points).toHaveLength(3);
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([135, 155]);
    // The last logged date is the bodyweight one — it is still a session.
    expect(progress.points[2].timestamp).toBe(at(0));
    expect(progress.points[2].metric).toBe('reps');
  });

  it('shows the latest session in its own terms when it left the series metric', () => {
    const logs = [
      log(at(10), [exercise({ sets: [set({ weight: 155, reps: 5 })] })], 'a'),
      log(at(0), [exercise({ sets: [set({ weight: null, reps: 12 })] })], 'b'),
    ];

    const [progress] = build(logs);
    const latest = progress.points[progress.points.length - 1];
    expect(summarizePoint(latest, latest.metric, 'lb')).toBe(
      `12 reps · ${formatProgressDate(at(0))}`
    );
  });

  it('switches to weight once a bodyweight movement starts carrying one', () => {
    const logs = [
      log(
        at(20),
        [exercise({ id: 'pull_ups-0', name: 'Pull-Up', sets: [set({ weight: null, reps: 10 })] })],
        'a'
      ),
      log(
        at(10),
        [exercise({ id: 'pull_ups-0', name: 'Pull-Up', sets: [set({ weight: 25, reps: 6 })] })],
        'b'
      ),
      log(
        at(0),
        [exercise({ id: 'pull_ups-0', name: 'Pull-Up', sets: [set({ weight: 35, reps: 5 })] })],
        'c'
      ),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('weight');
    expect(progress.points).toHaveLength(3);
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([25, 35]);
  });

  it('orders by the true latest session, including one outside the series metric', () => {
    const logs = [
      log(
        at(12),
        [exercise({ id: 'squat-0', name: 'Back Squat', sets: [set({ weight: 225 })] })],
        'a'
      ),
      log(at(8), [exercise({ id: 'bench_press-0', sets: [set({ weight: 185 })] })], 'b'),
      // Back Squat again, bodyweight. It is the newest session of anything.
      log(
        at(1),
        [exercise({ id: 'squat-0', name: 'Back Squat', sets: [set({ weight: null, reps: 20 })] })],
        'c'
      ),
    ];

    expect(build(logs).map((p) => p.name)).toEqual(['Back Squat', 'Bench Press']);
  });

  it('leaves the chart with one point when only one session is comparable', () => {
    // Two sessions, so "one session so far" would be wrong — but the chart
    // still cannot draw a line, because the other session is in reps.
    const logs = [
      log(at(10), [exercise({ sets: [set({ weight: 155, reps: 5 })] })], 'a'),
      log(at(0), [exercise({ sets: [set({ weight: null, reps: 12 })] })], 'b'),
    ];

    const [progress] = build(logs);
    expect(progress.points.length).toBeGreaterThanOrEqual(2);
    expect(latestSeries(progress).comparable).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // A hold recorded as a weight. `isPerformedSet` decides the session, not the
  // series value, so a weighted plank with no seconds does not disappear.
  // ---------------------------------------------------------------------------

  const plank = (sets: LoggedSet[]) =>
    exercise({ id: 'plank-0', name: 'Plank', metric: 'time', sets });

  it('counts a weight-only hold session, and leaves it off the seconds series', () => {
    const logs = [
      log(at(14), [plank([set({ weight: null, reps: 45 })])], 'a'),
      log(at(7), [plank([set({ weight: null, reps: 60 })])], 'b'),
      log(at(0), [plank([set({ weight: 45, reps: null })])], 'c'),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('time');
    expect(progress.points).toHaveLength(3);
    expect(progress.points[2].metric).toBe('weight');
    // Only the two sessions with seconds on them can be plotted against each other.
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([45, 60]);
  });

  it('still plots a hold that was weighted AND held for seconds', () => {
    const logs = [
      log(at(7), [plank([set({ weight: 25, reps: 40 })])], 'a'),
      log(at(0), [plank([set({ weight: 25, reps: 55 })])], 'b'),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('time');
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([40, 55]);
  });

  it('lets a weight-only hold session set the row date and the list order', () => {
    const logs = [
      log(at(14), [plank([set({ weight: null, reps: 45 })])], 'a'),
      log(at(5), [exercise({ sets: [set({ weight: 185, reps: 5 })] })], 'b'),
      log(at(1), [plank([set({ weight: 45, reps: null })])], 'c'),
    ];

    const progress = build(logs);
    expect(progress.map((p) => p.name)).toEqual(['Plank', 'Bench Press']);

    const latest = progress[0].points[progress[0].points.length - 1];
    expect(latest.timestamp).toBe(at(1));
    // Its own terms: a weight with no seconds to multiply it by.
    expect(summarizePoint(latest, latest.metric, 'lb')).toBe(
      `45 lb · ${formatProgressDate(at(1))}`
    );
  });

  it('lists a hold whose only session was weight-only, with nothing to chart', () => {
    const logs = [log(at(2), [plank([set({ weight: 45, reps: null })])])];

    const [progress] = build(logs);
    expect(progress.name).toBe('Plank');
    expect(progress.points).toHaveLength(1);
    // A hold is charted in seconds, and this session has none.
    expect(latestSeries(progress).metric).toBe('time');
    expect(latestSeries(progress).comparable).toEqual([]);
  });

  it('never charts a hold in weights, however many weight-only sessions it has', () => {
    // The defect: two weight-only sessions passed the two-point threshold and
    // the movement was charted as a lift, inventing weight PRs for a plank.
    const logs = [
      log(at(9), [plank([set({ weight: 35, reps: null, isPR: true })])], 'a'),
      log(at(2), [plank([set({ weight: 45, reps: null, isPR: true })])], 'b'),
    ];

    const [progress] = build(logs);
    expect(latestSeries(progress).metric).toBe('time');
    // Both sessions count — for the date, the order and the session count.
    expect(progress.points).toHaveLength(2);
    expect(progress.points[1].timestamp).toBe(at(2));
    // Nothing to plot and no records, so no sparkline and no PR callout.
    expect(latestSeries(progress).comparable).toEqual([]);
    expect(progressRecords(latestSeries(progress).comparable)).toEqual([]);
    // The row still names the latest session in its own terms.
    const latest = progress.points[1];
    expect(summarizePoint(latest, latest.metric, 'lb')).toBe(
      `45 lb · ${formatProgressDate(at(2))}`
    );
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

    expect(build(logs).map((p) => p.name)).toEqual(['Bench Press']);
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

    expect(build(logs).map((p) => p.name)).toEqual(['Deadlift', 'Bench Press', 'Back Squat']);
  });

  it('names the exercise the way the most recent log spells it', () => {
    const logs = [
      log(at(10), [exercise({ name: 'Bench' })], 'a'),
      log(at(0), [exercise({ name: 'Bench Press' })], 'b'),
    ];

    expect(build(logs)[0].name).toBe('Bench Press');
  });

  it('summarizes the row as weight × reps and the date', () => {
    const logs = [log(at(0), [exercise({ sets: [set({ weight: 275, reps: 5 })] })])];
    const [progress] = build(logs);

    expect(summarizePoint(progress.points[0], 'weight', 'lb')).toBe(
      `275 lb × 5 · ${formatProgressDate(at(0))}`
    );
  });

  it('finds one exercise by id, with or without the positional suffix', () => {
    const logs = [log(at(0), [exercise()])];

    expect(findExerciseProgress(logs, 'bench_press', 'lb')?.name).toBe('Bench Press');
    expect(findExerciseProgress(logs, 'bench_press-2', 'lb')?.name).toBe('Bench Press');
    expect(findExerciseProgress(logs, 'squat', 'lb')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Ranges
// -----------------------------------------------------------------------------

describe('rangePoints', () => {
  const points = [
    { logId: 'a', timestamp: at(300), metric: weight, value: 150, reps: 5, hasPR: false, unit: lb },
    { logId: 'b', timestamp: at(120), metric: weight, value: 165, reps: 5, hasPR: false, unit: lb },
    { logId: 'c', timestamp: at(60), metric: weight, value: 175, reps: 5, hasPR: false, unit: lb },
    { logId: 'd', timestamp: at(10), metric: weight, value: 195, reps: 3, hasPR: false, unit: lb },
  ];

  it('keeps only the sessions inside the window', () => {
    expect(rangePoints(points, '8W', NOW).map((p) => p.logId)).toEqual(['d']);
    expect(rangePoints(points, '3M', NOW).map((p) => p.logId)).toEqual(['c', 'd']);
    expect(rangePoints(points, '6M', NOW).map((p) => p.logId)).toEqual(['b', 'c', 'd']);
    expect(rangePoints(points, '1Y', NOW).map((p) => p.logId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps everything on All', () => {
    expect(rangePoints(points, 'All', NOW)).toHaveLength(4);
  });

  // The windows are calendar days ending with today, so today is the first of
  // the 56, and the 56th day back is the oldest one still shown.
  it('includes the oldest day of the window and excludes the day before it', () => {
    const edge = [
      {
        logId: 'in',
        timestamp: at(55),
        metric: weight,
        value: 100,
        reps: 5,
        hasPR: false,
        unit: lb,
      },
      {
        logId: 'out',
        timestamp: at(56),
        metric: weight,
        value: 100,
        reps: 5,
        hasPR: false,
        unit: lb,
      },
    ];

    expect(rangePoints(edge, '8W', NOW).map((p) => p.logId)).toEqual(['in']);
  });

  it('holds each window at its own boundary day', () => {
    const edges: Array<[ProgressRange, number]> = [
      ['8W', 56],
      ['3M', 91],
      ['6M', 182],
      ['1Y', 365],
    ];

    for (const [range, days] of edges) {
      const pair = [
        {
          logId: 'in',
          timestamp: at(days - 1),
          metric: weight,
          value: 100,
          reps: 5,
          hasPR: false,
          unit: lb,
        },
        {
          logId: 'out',
          timestamp: at(days),
          metric: weight,
          value: 100,
          reps: 5,
          hasPR: false,
          unit: lb,
        },
      ];
      expect(rangePoints(pair, range, NOW).map((p) => p.logId)).toEqual(['in']);
    }
  });

  // The screens re-render at local midnight (useLocalDay), and the window has
  // to move with it rather than with the time of day a set was logged.
  it('drops a session when the day turns over, with no change to the points', () => {
    const edge = [
      {
        logId: 'edge',
        timestamp: at(55),
        metric: weight,
        value: 100,
        reps: 5,
        hasPR: false,
        unit: lb,
      },
    ];

    expect(rangePoints(edge, '8W', NOW)).toHaveLength(1);
    expect(rangePoints(edge, '8W', tomorrow(NOW))).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// PRs
// -----------------------------------------------------------------------------

describe('progressRecords', () => {
  const point = (timestamp: string, value: number) => ({
    logId: timestamp,
    timestamp,
    metric: weight,
    value,
    reps: 5,
    hasPR: false,
    unit: lb,
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
      { logId: at(2), timestamp: at(2), value: 195, previous: 175 },
      { logId: at(44), timestamp: at(44), value: 175, previous: 165 },
      { logId: at(70), timestamp: at(70), value: 165, previous: null },
    ]);
  });

  it('calls the earliest session the first record, never a beaten zero', () => {
    const records = progressRecords([point(at(5), 135)]);
    expect(records).toEqual([{ logId: at(5), timestamp: at(5), value: 135, previous: null }]);
  });

  it('returns nothing for an exercise with no points', () => {
    expect(progressRecords([])).toEqual([]);
  });
});

describe('hasRecentPR', () => {
  const flagged = (daysAgo: number) => ({
    logId: `p${daysAgo}`,
    timestamp: at(daysAgo),
    metric: weight,
    value: 195,
    reps: 3,
    hasPR: true,
    unit: lb,
  });

  it('badges a PR logged inside the 14-day window', () => {
    expect(hasRecentPR([flagged(13)], NOW)).toBe(true);
  });

  it('does not badge a PR logged outside it', () => {
    expect(hasRecentPR([flagged(15)], NOW)).toBe(false);
  });

  it('does not badge a session with no flagged set', () => {
    expect(hasRecentPR([{ ...flagged(1), hasPR: false, unit: lb }], NOW)).toBe(false);
  });

  // The window is 14 calendar days with today as the first, so the PR from 13
  // days ago is the oldest one badged and the one from 14 days ago is not.
  it('holds the badge at its boundary day', () => {
    expect(hasRecentPR([flagged(13)], NOW)).toBe(true);
    expect(hasRecentPR([flagged(14)], NOW)).toBe(false);
  });

  // The defect this guards: a PWA left open across midnight kept the badge,
  // because the only clock read was the one taken when the screen first
  // rendered. The history does not change here — only the day does.
  it('expires the badge at midnight without the history changing', () => {
    const points = [flagged(13)];

    expect(hasRecentPR(points, NOW)).toBe(true);
    expect(hasRecentPR(points, tomorrow(NOW))).toBe(false);
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

// -----------------------------------------------------------------------------
// Two units (issue #85 step 2)
// -----------------------------------------------------------------------------
// The grouping is by unit alone, and the thing that has to hold is that a
// lifter with one unit sees exactly one group — the segment, the suffixes and
// the extra copy all key off `byUnit.length`.

describe('buildExerciseProgress — unit grouping', () => {
  /** The same log, stamped with the unit it was logged in. */
  const inUnit = (
    timestamp: string,
    exercises: Exercise[],
    weightUnit: WeightUnit,
    id = timestamp
  ): WorkoutLog => ({ ...log(timestamp, exercises, id), weightUnit });

  const switched = () => [
    inUnit(at(40), [exercise({ sets: [set({ weight: 185, reps: 3 })] })], 'lb', 'a'),
    inUnit(at(30), [exercise({ sets: [set({ weight: 195, reps: 3 })] })], 'lb', 'b'),
    inUnit(at(10), [exercise({ sets: [set({ weight: 85, reps: 3 })] })], 'kg', 'c'),
    inUnit(at(2), [exercise({ sets: [set({ weight: 90, reps: 3 })] })], 'kg', 'd'),
  ];

  it('stamps every point with the unit its session was logged in', () => {
    const [progress] = build(switched());
    expect(progress.points.map((p) => p.unit)).toEqual(['lb', 'lb', 'kg', 'kg']);
  });

  it('gives one group to a lifter who has only ever used one unit', () => {
    const [progress] = build([log(at(5), [exercise()]), log(at(0), [exercise()], 'b')]);

    expect(progress.byUnit).toHaveLength(1);
    expect(progress.byUnit[0].unit).toBe('lb');
    expect(progress.byUnit[0].points).toHaveLength(2);
  });

  it('splits the sessions into one series per unit, lb first', () => {
    const [progress] = build(switched());

    expect(progress.byUnit.map((side) => side.unit)).toEqual(['lb', 'kg']);
    expect(progress.byUnit[0].points.map((p) => p.value)).toEqual([185, 195]);
    expect(progress.byUnit[1].points.map((p) => p.value)).toEqual([85, 90]);
  });

  it('groups by unit alone, so switching back and forth stays two groups', () => {
    const [progress] = build([
      inUnit(at(40), [exercise()], 'lb', 'a'),
      inUnit(at(30), [exercise()], 'kg', 'b'),
      inUnit(at(20), [exercise()], 'lb', 'c'),
      inUnit(at(10), [exercise()], 'kg', 'd'),
    ]);

    expect(progress.byUnit).toHaveLength(2);
    expect(progress.byUnit[0].points).toHaveLength(2);
  });

  it('moves the logs that carry no unit with the setting', () => {
    const logs = [
      log(at(40), [exercise({ sets: [set({ weight: 185 })] })], 'legacy'),
      inUnit(at(2), [exercise({ sets: [set({ weight: 90 })] })], 'kg', 'new'),
    ];

    // On lb the legacy session is lb and the new one kg: two sides.
    expect(build(logs, 'lb')[0].byUnit.map((side) => side.unit)).toEqual(['lb', 'kg']);
    // On kg both read as kg, so there is nothing to separate and no segment.
    expect(build(logs, 'kg')[0].byUnit.map((side) => side.unit)).toEqual(['kg']);
  });

  it('opens on the unit of the most recent session, not on the setting', () => {
    const [progress] = build(switched(), 'lb');

    expect(latestSeries(progress).unit).toBe('kg');
    expect(seriesForUnit(progress, 'lb')?.points).toHaveLength(2);
    expect(seriesForUnit(progress, 'kg')?.points).toHaveLength(2);
  });

  it('gives a side with one session its own series rather than dropping it', () => {
    const [progress] = build([
      inUnit(at(40), [exercise({ sets: [set({ weight: 185 })] })], 'lb', 'a'),
      inUnit(at(30), [exercise({ sets: [set({ weight: 195 })] })], 'lb', 'b'),
      inUnit(at(2), [exercise({ sets: [set({ weight: 52.5 })] })], 'kg', 'c'),
    ]);

    expect(latestSeries(progress).points).toHaveLength(1);
    expect(latestSeries(progress).comparable.map((p) => p.value)).toEqual([52.5]);
  });

  it('chooses each side’s metric from its own sessions', () => {
    const [progress] = build([
      inUnit(at(40), [exercise({ sets: [set({ weight: null, reps: 8 })] })], 'lb', 'a'),
      inUnit(at(2), [exercise({ sets: [set({ weight: 90, reps: 3 })] })], 'kg', 'b'),
    ]);

    expect(seriesForUnit(progress, 'lb')?.metric).toBe('reps');
    expect(seriesForUnit(progress, 'kg')?.metric).toBe('weight');
  });

  it('never measures one unit’s record against the other’s', () => {
    const [progress] = build(switched());
    const kg = progressRecords(latestSeries(progress).comparable);
    const lb = progressRecords(seriesForUnit(progress, 'lb')?.comparable ?? []);

    // The first kg session is a first record, not 195 → 85.
    expect(kg.map((r) => [r.value, r.previous])).toEqual([
      [90, 85],
      [85, null],
    ]);
    expect(lb.map((r) => [r.value, r.previous])).toEqual([
      [195, 185],
      [185, null],
    ]);
  });

  it('counts every session for the PR badge, whatever unit it was in', () => {
    const flagged = exercise({ sets: [set({ weight: 90, isPR: true })] });
    const [progress] = build([
      inUnit(at(40), [exercise({ sets: [set({ weight: 195 })] })], 'lb', 'a'),
      inUnit(at(1), [flagged], 'kg', 'b'),
    ]);

    expect(hasRecentPR(progress.points, NOW)).toBe(true);
  });
});

describe('smallestRange', () => {
  const pointsAt = (...daysAgo: number[]) =>
    daysAgo.map((days) => ({
      logId: `p${days}`,
      timestamp: at(days),
      metric: weight,
      value: 100,
      reps: 5,
      hasPR: false,
      unit: lb,
    }));

  it('takes the narrowest window that still holds every session', () => {
    expect(smallestRange(pointsAt(11, 2), NOW)).toBe('8W');
    expect(smallestRange(pointsAt(70, 2), NOW)).toBe('3M');
    expect(smallestRange(pointsAt(150, 2), NOW)).toBe('6M');
    expect(smallestRange(pointsAt(300, 2), NOW)).toBe('1Y');
  });

  it('falls back to All when no fixed window reaches the oldest session', () => {
    expect(smallestRange(pointsAt(500, 2), NOW)).toBe('All');
  });
});

// -----------------------------------------------------------------------------
// The copy that only exists when both units do
// -----------------------------------------------------------------------------

describe('two-unit copy', () => {
  const inUnit = (
    timestamp: string,
    weight_: number,
    weightUnit: WeightUnit,
    id = timestamp
  ): WorkoutLog => ({
    ...log(timestamp, [exercise({ sets: [set({ weight: weight_, reps: 3 })] })], id),
    weightUnit,
  });

  const split = (kgSessions = 2) => {
    const logs = [
      inUnit(at(40), 185, 'lb', 'a'),
      inUnit(at(30), 195, 'lb', 'b'),
      inUnit(at(10), 85, 'kg', 'c'),
    ];
    if (kgSessions > 1) logs.push(inUnit(at(2), 90, 'kg', 'd'));
    const [progress] = build(logs);
    return progress;
  };

  const sides = (progress: ExerciseProgress) => ({
    lb: seriesForUnit(progress, 'lb') as UnitSeries,
    kg: seriesForUnit(progress, 'kg') as UnitSeries,
  });

  it('names the unit in the session count only when a second unit exists', () => {
    const { kg } = sides(split());
    const [one] = build([log(at(5), [exercise()]), log(at(0), [exercise()], 'b')]);

    expect(describeSessionCount(kg, true)).toBe('2 sessions in kg');
    expect(describeSessionCount(latestSeries(one), false)).toBe('2 sessions logged');
  });

  it('counts one session in the singular', () => {
    const { kg } = sides(split(1));
    expect(describeSessionCount(kg, true)).toBe('1 session in kg');
  });

  it('points the live side at the other tab, and says where the closed one ends', () => {
    const { lb, kg } = sides(split());

    expect(describeOtherUnit(kg, lb)).toBe('Your 2 lb sessions are on the lb tab.');
    expect(describeOtherUnit(lb, kg)).toBe(
      `Ends ${formatProgressDate(at(30))}, the last session logged in lb.`
    );
  });

  it('says nothing about another unit when there is only one', () => {
    const [one] = build([log(at(0), [exercise()])]);
    expect(describeOtherUnit(latestSeries(one), null)).toBeNull();
  });

  it('reads the live side as the one holding the most recent session', () => {
    const { lb, kg } = sides(split());

    expect(isLiveSeries(kg, lb)).toBe(true);
    expect(isLiveSeries(lb, kg)).toBe(false);
    expect(isLiveSeries(lb, null)).toBe(true);
  });

  it('names the unit in the one-session card, and keeps today’s copy without one', () => {
    const { lb, kg } = sides(split(1));
    const [one] = build([log(at(0), [exercise()])]);

    expect(describeOneSession(kg, lb)).toEqual({
      title: 'One session in kg',
      body: 'A line needs two points. Your 2 lb sessions are on the lb tab.',
    });
    expect(describeOneSession(latestSeries(one), null)).toEqual({
      title: 'One session so far',
      body: 'A line needs two points. Log this one again and the chart starts here.',
    });
  });

  it('says one session in the singular on the other side too', () => {
    const [progress] = build([inUnit(at(10), 185, 'lb', 'a'), inUnit(at(2), 85, 'kg', 'b')]);
    const { lb, kg } = sides(progress);

    expect(describeOneSession(kg, lb).body).toBe(
      'A line needs two points. Your 1 lb session is on the lb tab.'
    );
  });

  it('calls the live record current and the closed one last', () => {
    const { lb, kg } = sides(split());
    const [one] = build([log(at(0), [exercise()])]);

    expect(describePRCallout(kg, lb)).toBe('Current PR in kg');
    expect(describePRCallout(lb, kg)).toBe('Last PR in lb');
    expect(describePRCallout(latestSeries(one), null)).toBe('Current PR');
  });
});
