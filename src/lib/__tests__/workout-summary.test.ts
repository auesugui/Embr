// =============================================================================
// Embr Workout Summary Adapter Tests
// =============================================================================
// The FP describes here (deload intent, base+volume, PR bonuses, streak
// multiplier, relative baseline scaling, Spirit) went with the FP engine
// (ADR-0015). What the adapter still does is count what happened, so that's
// what's still covered.

import type { Exercise, LoggedSet } from '@/types';
import { describe, expect, it } from '@jest/globals';
import {
  calculateWorkoutSummary,
  exerciseVolume,
  formatWeight,
  topWeight,
  totalVolume,
} from '../workout-summary';

const makeSet = (overrides: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 100,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...overrides,
});

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex-1',
  name: 'Test Exercise',
  muscleGroups: ['chest', 'triceps'],
  sets: [makeSet()],
  restSeconds: 60,
  completed: false,
  ...overrides,
});

describe('calculateWorkoutSummary — display aggregates', () => {
  it('counts totalReps and totalSets from logged sets only', () => {
    const exercises: Exercise[] = [
      makeExercise({
        sets: [makeSet({ reps: 10 }), makeSet({ reps: 12, logged: false }), makeSet({ reps: 8 })],
      }),
    ];

    const summary = calculateWorkoutSummary(exercises, 300);

    expect(summary.totalSets).toBe(2);
    expect(summary.totalReps).toBe(18);
  });

  it('passes duration and the exercise list through unchanged', () => {
    const exercises: Exercise[] = [makeExercise()];
    const summary = calculateWorkoutSummary(exercises, 2700);

    expect(summary.duration).toBe(2700);
    expect(summary.exercises).toBe(exercises);
  });

  it('reports zeroes for a session with nothing logged', () => {
    const exercises: Exercise[] = [makeExercise({ sets: [makeSet({ logged: false })] })];
    const summary = calculateWorkoutSummary(exercises, 120);

    expect(summary.totalSets).toBe(0);
    expect(summary.totalReps).toBe(0);
    expect(summary.totalVolume).toBe(0);
  });
});

describe('volume and top weight', () => {
  it('sums weight × reps over logged sets only', () => {
    const exercise = makeExercise({
      sets: [
        makeSet({ weight: 50, reps: 12 }),
        makeSet({ weight: 50, reps: 10, logged: false }),
        makeSet({ weight: 45, reps: 10 }),
      ],
    });

    expect(exerciseVolume(exercise)).toBe(1050);
    expect(topWeight(exercise)).toBe(50);
  });

  it('gives bodyweight sets no volume and no top weight', () => {
    const exercise = makeExercise({ sets: [makeSet({ weight: null, reps: 10 })] });

    expect(exerciseVolume(exercise)).toBe(0);
    expect(topWeight(exercise)).toBe(0);
  });

  it('gives a weighted hold no volume, since its reps are seconds', () => {
    const plank = makeExercise({ metric: 'time', sets: [makeSet({ weight: 25, reps: 60 })] });

    expect(exerciseVolume(plank)).toBe(0);
  });

  it('totals volume across exercises', () => {
    const summary = calculateWorkoutSummary(
      [
        makeExercise({ sets: [makeSet({ weight: 100, reps: 5 })] }),
        makeExercise({ id: 'ex-2', sets: [makeSet({ weight: 20, reps: 10 })] }),
      ],
      600
    );

    expect(summary.totalVolume).toBe(700);
  });

  it('formats weight with thousands separators and keeps fractional loads', () => {
    expect(formatWeight(12450, 'lb')).toBe('12,450 lb');
    expect(formatWeight(540, 'kg')).toBe('540 kg');
    expect(formatWeight(22.5, 'kg')).toBe('22.5 kg');
    expect(formatWeight(22.125, 'kg')).toBe('22.125 kg');
    expect(formatWeight(1234.567, 'lb')).toBe('1,234.567 lb');
    expect(formatWeight(22.1250001, 'kg')).toBe('22.1250001 kg');
  });

  it('strips float noise from fractional volume sums', () => {
    const exercise = makeExercise({
      sets: [makeSet({ weight: 0.1, reps: 1 }), makeSet({ weight: 0.2, reps: 1 })],
    });

    expect(exerciseVolume(exercise)).toBe(0.3);
  });

  it('strips float noise from volume summed across exercises, as a block row does', () => {
    const block = [
      makeExercise({ sets: [makeSet({ weight: 0.1, reps: 1 })] }),
      makeExercise({ id: 'ex-2', sets: [makeSet({ weight: 0.2, reps: 1 })] }),
    ];

    expect(totalVolume(block)).toBe(0.3);
    expect(calculateWorkoutSummary(block, 60).totalVolume).toBe(0.3);
  });
});
