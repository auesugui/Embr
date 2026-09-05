// =============================================================================
// metric — what a logged number measures
// =============================================================================
// The rule under test is one sentence: a plank's "45" is forty-five seconds,
// everything else's is a rep count. What matters is that the fallback path
// still gets it right for logs written before the field existed, because those
// are the only workouts that cannot be re-created.

import {
  baseExerciseId,
  exerciseMetric,
  formatCompact,
  formatPrescription,
  formatQuantity,
  formatSeconds,
  formatTotal,
  metricLabel,
  quickLadder,
  uniformMetric,
} from '@/lib/metric';
import type { Exercise, LoggedSet } from '@/types';

const set = (reps: number | null, logged = true): LoggedSet => ({
  reps,
  weight: null,
  logged,
  isPR: false,
  isRepPR: false,
});

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'plank-0',
  name: 'Plank',
  muscleGroups: ['core'],
  sets: [set(45)],
  restSeconds: 45,
  completed: false,
  ...over,
});

describe('baseExerciseId', () => {
  it('strips the positional suffix a session adds', () => {
    expect(baseExerciseId('plank-2')).toBe('plank');
    expect(baseExerciseId('barbell_bench_press-0')).toBe('barbell_bench_press');
  });

  it('leaves an unsuffixed id alone', () => {
    expect(baseExerciseId('plank')).toBe('plank');
  });
});

describe('exerciseMetric', () => {
  it('reads the metric off the exercise when it carries one', () => {
    expect(exerciseMetric(exercise({ id: 'anything-0', metric: 'time' }))).toBe('time');
  });

  it('falls back to the database for logs written before the field existed', () => {
    // No `metric` — this is the shape every stored plank currently has.
    expect(exerciseMetric(exercise())).toBe('time');
  });

  it('defaults to reps for a movement no longer in the database', () => {
    expect(exerciseMetric(exercise({ id: 'deleted_movement-0' }))).toBe('reps');
    expect(exerciseMetric(undefined)).toBe('reps');
  });

  it('reads counted movements as reps', () => {
    expect(exerciseMetric(exercise({ id: 'bodyweight_squat-1' }))).toBe('reps');
  });
});

describe('formatSeconds', () => {
  it('stays in seconds under a minute', () => {
    expect(formatSeconds(45)).toBe('45s');
  });

  it('drops the seconds on a whole minute', () => {
    expect(formatSeconds(120)).toBe('2m');
  });

  it('reads minutes and seconds past one minute', () => {
    expect(formatSeconds(90)).toBe('1m 30s');
  });

  it('never goes negative', () => {
    expect(formatSeconds(-5)).toBe('0s');
  });
});

describe('formatting one value', () => {
  it('names the units in a standalone value', () => {
    expect(formatQuantity(45, 'time')).toBe('45s');
    expect(formatQuantity(12, 'reps')).toBe('12 reps');
  });

  it('drops the noun in a dense list, but never the units of a hold', () => {
    expect(formatCompact(45, 'time')).toBe('45s');
    expect(formatCompact(12, 'reps')).toBe('12');
  });

  it('labels the input for what it asks', () => {
    expect(metricLabel('time')).toBe('Seconds');
    expect(metricLabel('reps')).toBe('Reps');
  });

  it('states a total in the units it was accumulated in', () => {
    expect(formatTotal(135, 'time')).toBe('2m 15s');
    expect(formatTotal(135, 'reps')).toBe('135 reps');
  });
});

describe('formatPrescription', () => {
  it('keeps a range a range', () => {
    expect(formatPrescription('30-60', 'time')).toBe('30-60s');
    expect(formatPrescription('8-12', 'reps')).toBe('8-12 reps');
  });

  it('leaves text with no number in it alone', () => {
    expect(formatPrescription('AMRAP', 'reps')).toBe('AMRAP');
    expect(formatPrescription('max', 'time')).toBe('max');
  });
});

describe('quickLadder', () => {
  it('offers durations people hold, not rep counts', () => {
    expect(quickLadder('time', null)).toEqual([20, 30, 45, 60]);
  });

  it('keeps the generic rep ladder unchanged', () => {
    expect(quickLadder('reps', null)).toEqual([5, 8, 10, 12]);
  });

  it('leads with the prescription when it is not already on the ladder', () => {
    expect(quickLadder('time', 90)).toEqual([90, 20, 30, 45]);
    expect(quickLadder('reps', 3)).toEqual([3, 5, 8, 10]);
  });

  it('does not duplicate a prescription the ladder already has', () => {
    expect(quickLadder('time', 30)).toEqual([20, 30, 45, 60]);
  });
});

describe('uniformMetric', () => {
  it('names the metric when everything logged shares one', () => {
    expect(uniformMetric([exercise(), exercise({ id: 'plank-1' })])).toBe('time');
  });

  it('returns null when a session mixes holds and counted work', () => {
    expect(uniformMetric([exercise(), exercise({ id: 'bodyweight_squat-1' })])).toBeNull();
  });

  it('ignores exercises with nothing logged — an unlogged plank names nothing', () => {
    const untouched = exercise({ id: 'plank-1', sets: [set(null, false)] });
    expect(uniformMetric([exercise({ id: 'bodyweight_squat-0' }), untouched])).toBe('reps');
  });

  it('returns null for a session with nothing logged at all', () => {
    expect(uniformMetric([exercise({ sets: [set(null, false)] })])).toBeNull();
  });
});
