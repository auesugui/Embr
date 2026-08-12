// =============================================================================
// Embr Workout Summary Adapter
// =============================================================================
// Produces the shape the summary screen renders from a finished session.
//
// This used to be a thin wrapper over the FP engine — total, typed
// distribution, base/volume/PR breakdown, streak multiplier, Spirit. All of it
// is gone (ADR-0015). What the summary actually shows is duration, sets, reps,
// and the exercise list, and that needs no engine.

import type { Exercise } from '@/types';

export interface WorkoutSummary {
  exercises: Exercise[];
  duration: number;
  totalReps: number;
  totalSets: number;
}

export function calculateWorkoutSummary(exercises: Exercise[], duration: number): WorkoutSummary {
  const loggedSets = exercises.flatMap((e) => e.sets.filter((s) => s.logged));

  return {
    exercises,
    duration,
    totalReps: loggedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    totalSets: loggedSets.length,
  };
}
