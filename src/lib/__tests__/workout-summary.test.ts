// =============================================================================
// Embr Workout Summary Adapter Tests
// =============================================================================
// The FP describes here (deload intent, base+volume, PR bonuses, streak
// multiplier, relative baseline scaling, Spirit) went with the FP engine
// (ADR-0015). What the adapter still does is count what happened, so that's
// what's still covered.

import type { Exercise, LoggedSet } from '@/types';
import { describe, expect, it } from '@jest/globals';
import { calculateWorkoutSummary } from '../workout-summary';

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
  });
});
