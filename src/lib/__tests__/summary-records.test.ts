// =============================================================================
// summary-records — the "New PRs" block's rows (issue #80)
// =============================================================================
// The block makes a claim about your training, so every rule that decides
// whether a row appears — and what the two numbers in it are — is tested here
// rather than through a render.

import type { Exercise, LoggedSet, WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import { PR_COLLAPSE_AT, PR_ROWS_SHOWN, sessionRecords } from '../summary-records';

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

describe('sessionRecords', () => {
  it('lists each beaten record as the old value and the new one', () => {
    const earlier = log(at(7), [
      exercise({ sets: [set({ weight: 195 })] }),
      exercise({ id: 'overhead_press-1', name: 'Overhead Press', sets: [set({ weight: 115 })] }),
    ]);
    const today = log(at(0), [
      exercise({ sets: [set({ weight: 200 })] }),
      exercise({ id: 'overhead_press-1', name: 'Overhead Press', sets: [set({ weight: 120 })] }),
    ]);

    expect(sessionRecords([today, earlier], today)).toEqual([
      {
        exerciseId: 'bench_press',
        name: 'Bench Press',
        metric: 'weight',
        previous: 195,
        value: 200,
      },
      {
        exerciseId: 'overhead_press',
        name: 'Overhead Press',
        metric: 'weight',
        previous: 115,
        value: 120,
      },
    ]);
  });

  it('leaves out a first-ever record, which has nothing on the left of the arrow', () => {
    // The session still badges the set as a PR. The block only lists records
    // that beat a number you already had.
    const today = log(at(0), [exercise({ sets: [set({ weight: 165, isPR: true })] })]);

    expect(sessionRecords([today], today)).toEqual([]);
  });

  it('works before the workout is saved', () => {
    const earlier = log(at(7), [exercise({ sets: [set({ weight: 195 })] })]);
    const today: WorkoutLog = {
      ...log(at(0), [exercise({ sets: [set({ weight: 200 })] })]),
      claimedAt: null,
    };

    expect(sessionRecords([today, earlier], today).map((r) => r.value)).toEqual([200]);
  });

  it('leaves out a session that matched its earlier best without beating it', () => {
    const earlier = log(at(7), [exercise({ sets: [set({ weight: 200 })] })]);
    const today = log(at(0), [exercise({ sets: [set({ weight: 200 })] })]);

    expect(sessionRecords([today, earlier], today)).toEqual([]);
  });

  it('leaves out more reps at a weight already lifted, which the series does not measure', () => {
    // prStore flags that set a rep PR and the session badges it. The block is
    // one number space — the heaviest weight — and that number did not move.
    const earlier = log(at(7), [exercise({ sets: [set({ weight: 200, reps: 5 })] })]);
    const today = log(at(0), [exercise({ sets: [set({ weight: 200, reps: 8, isRepPR: true })] })]);

    expect(sessionRecords([today, earlier], today)).toEqual([]);
  });

  it('reads a hold in seconds', () => {
    const plank = (seconds: number) =>
      exercise({
        id: 'plank-3',
        name: 'Plank',
        metric: 'time',
        sets: [set({ weight: null, reps: seconds })],
      });
    const earlier = log(at(6), [plank(45)]);
    const today = log(at(0), [plank(60)]);

    expect(sessionRecords([today, earlier], today)).toEqual([
      { exerciseId: 'plank', name: 'Plank', metric: 'time', previous: 45, value: 60 },
    ]);
  });

  it('reads a bodyweight movement in reps', () => {
    const pullUp = (reps: number) =>
      exercise({
        id: 'pull_ups-0',
        name: 'Pull-up',
        sets: [set({ weight: null, reps })],
      });
    const earlier = log(at(5), [pullUp(11)]);
    const today = log(at(0), [pullUp(13)]);

    expect(sessionRecords([today, earlier], today)).toEqual([
      { exerciseId: 'pull_ups', name: 'Pull-up', metric: 'reps', previous: 11, value: 13 },
    ]);
  });

  it('keeps the rows in session order rather than by size of jump', () => {
    const movements = (weights: number[]) =>
      weights.map((weight, index) =>
        exercise({
          id: `lift_${index}-${index}`,
          name: `Lift ${index}`,
          sets: [set({ weight })],
        })
      );

    const earlier = log(at(4), movements([100, 100, 100]));
    // The middle movement made the biggest jump; it still reads second.
    const today = log(at(0), movements([105, 160, 110]));

    expect(sessionRecords([today, earlier], today).map((r) => r.name)).toEqual([
      'Lift 0',
      'Lift 1',
      'Lift 2',
    ]);
  });

  it('counts enough records for the block to collapse', () => {
    const movements = (weights: number[]) =>
      weights.map((weight, index) =>
        exercise({
          id: `lift_${index}-${index}`,
          name: `Lift ${index}`,
          sets: [set({ weight })],
        })
      );

    const base = [100, 100, 100, 100, 100, 100];
    const earlier = log(at(4), movements(base));
    const today = log(at(0), movements(base.map((w) => w + 5)));

    const records = sessionRecords([today, earlier], today);
    expect(records).toHaveLength(6);
    expect(records.length).toBeGreaterThanOrEqual(PR_COLLAPSE_AT);
    expect(records.slice(0, PR_ROWS_SHOWN).map((r) => r.name)).toEqual([
      'Lift 0',
      'Lift 1',
      'Lift 2',
    ]);
  });

  it('ignores an unsaved earlier session and a later one', () => {
    const abandoned: WorkoutLog = {
      ...log(at(7), [exercise({ sets: [set({ weight: 300 })] })], 'abandoned'),
      claimedAt: null,
    };
    const earlier = log(at(14), [exercise({ sets: [set({ weight: 195 })] })]);
    const today = log(at(0), [exercise({ sets: [set({ weight: 200 })] })]);

    expect(sessionRecords([today, abandoned, earlier], today)).toEqual([
      {
        exerciseId: 'bench_press',
        name: 'Bench Press',
        metric: 'weight',
        previous: 195,
        value: 200,
      },
    ]);
  });

  it('treats a movement logged twice in one session as one record', () => {
    // A heavy entry and a back-off entry are one session of the movement.
    const earlier = log(at(7), [exercise({ sets: [set({ weight: 195 })] })]);
    const today = log(at(0), [
      exercise({ sets: [set({ weight: 200 })] }),
      exercise({ id: 'bench_press-4', sets: [set({ weight: 150 })] }),
    ]);

    expect(sessionRecords([today, earlier], today)).toHaveLength(1);
  });
});
