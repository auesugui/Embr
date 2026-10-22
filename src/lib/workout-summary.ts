// =============================================================================
// Embr Workout Summary Adapter
// =============================================================================
// Produces the shape the summary screen renders from a finished session.
//
// This used to be a thin wrapper over the FP engine — total, typed
// distribution, base/volume/PR breakdown, streak multiplier, Spirit. All of it
// is gone (ADR-0015). What the summary actually shows is duration, sets, reps,
// volume, and the exercise list, and that needs no engine.

import { exerciseMetric } from '@/lib/metric';
import type { Exercise } from '@/types';

export interface WorkoutSummary {
  exercises: Exercise[];
  duration: number;
  totalReps: number;
  totalSets: number;
  /** Weight × reps over every logged set, in the weight as typed. */
  totalVolume: number;
}

/**
 * Weight × reps over the logged sets. A hold logs seconds in `reps`, so it
 * has no volume. The weight is taken as typed: a pair of 50 lb dumbbells
 * logged as 50 counts 50.
 */
export function exerciseVolume(exercise: Exercise): number {
  if (exerciseMetric(exercise) === 'time') return 0;
  return stripFloatNoise(
    exercise.sets
      .filter((s) => s.logged)
      .reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
  );
}

/** Volume across exercises: a whole workout or one block. */
export function totalVolume(exercises: Exercise[]): number {
  return stripFloatNoise(exercises.reduce((sum, e) => sum + exerciseVolume(e), 0));
}

/** Summing fractional loads leaves noise like 0.1 + 0.2 = 0.30000000000000004. */
function stripFloatNoise(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** The heaviest weight logged on this exercise, or 0 for bodyweight. */
export function topWeight(exercise: Exercise): number {
  return exercise.sets.filter((s) => s.logged).reduce((max, s) => Math.max(max, s.weight ?? 0), 0);
}

/** `22.5 kg`, `12,450 lb`. Prints the number as logged, decimals included. */
export function formatWeight(value: number, units: string): string {
  const [whole, fraction] = String(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}${fraction ? `.${fraction}` : ''} ${units}`;
}

export function calculateWorkoutSummary(exercises: Exercise[], duration: number): WorkoutSummary {
  const loggedSets = exercises.flatMap((e) => e.sets.filter((s) => s.logged));

  return {
    exercises,
    duration,
    totalReps: loggedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    totalSets: loggedSets.length,
    totalVolume: totalVolume(exercises),
  };
}
