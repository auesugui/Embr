// =============================================================================
// Metric — what the number you log actually measures
// =============================================================================
// Almost every movement is counted in reps. A few are held: a plank's "3 × 45"
// is forty-five SECONDS, and printing it as "45 reps" is not a display quirk —
// it is the app stating something false about the training you did.
//
// WHAT IS AND ISN'T STORED. The metric is a property of the MOVEMENT, so it
// lives on the exercise definition. The logged value stays a plain number in
// `LoggedSet.reps` — seconds for a hold, reps for everything else. That is
// deliberate: `Exercise[]` on a WorkoutLog is the only irreplaceable slice in
// storage (there is no backend), and adding a unit to every set would rewrite
// every stored workout and every exported backup to say what the movement
// already knows.
//
// Sessions do carry `Exercise.metric` so a log is self-describing — a movement
// renamed or removed from the database later still reads back correctly. Logs
// written before this existed have no such field, so `exerciseMetric` falls
// back to looking the movement up by id, which is what they meant anyway.

import { getExerciseById } from '@/data';
import type { Exercise, Metric } from '@/types';

export type { Metric };

/**
 * A session exercise's id carries a positional suffix (`plank-2`); the
 * database is keyed without it. Same convention as ExerciseDemo.
 */
export function baseExerciseId(id: string): string {
  return id.replace(/-\d+$/, '');
}

/** What one logged number on this movement measures. */
export function exerciseMetric(exercise: Pick<Exercise, 'id' | 'metric'> | undefined): Metric {
  if (!exercise) return 'reps';
  if (exercise.metric) return exercise.metric;
  // Pre-metric logs: ask the database what the movement is.
  return getExerciseById(baseExerciseId(exercise.id))?.metric ?? 'reps';
}

/** `45s`, `1m 30s`, `2m` — a held duration, in the units people say out loud. */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

/** One logged value, in its own units: `45s` or `12 reps`. */
export function formatQuantity(value: number, metric: Metric): string {
  return metric === 'time' ? formatSeconds(value) : `${value} reps`;
}

/** The bare number as it appears in a dense list: `45s` or `12`. */
export function formatCompact(value: number, metric: Metric): string {
  return metric === 'time' ? formatSeconds(value) : `${value}`;
}

/** What the input asks for. */
export function metricLabel(metric: Metric): string {
  return metric === 'time' ? 'Seconds' : 'Reps';
}

/** Plural noun for a total: `135 seconds` reads worse than `2m 15s`. */
export function formatTotal(value: number, metric: Metric): string {
  return metric === 'time' ? formatSeconds(value) : `${value} reps`;
}

/**
 * The quick-log ladder for a movement.
 *
 * Holds get seconds people actually hold for; reps get the generic ladder. The
 * prescription leads in both cases when it isn't already on the list, so the
 * common tap is the prescribed one.
 */
export function quickLadder(metric: Metric, target: number | null): number[] {
  const generic = metric === 'time' ? [20, 30, 45, 60] : [5, 8, 10, 12];
  if (target === null || generic.includes(target)) return generic;
  return [target, ...generic.slice(0, 3)];
}

/**
 * A prescription as written on the template (`'5'`, `'8-12'`, `'AMRAP'`), in
 * its own units: `8-12 reps`, `30-60s`.
 *
 * A range stays a range — the prescription is what the template says, and
 * collapsing `30-60` to a single number here would quietly rewrite the plan.
 * Text with no number in it (`'AMRAP'`, `'max'`) is already a complete phrase
 * and is returned untouched.
 */
export function formatPrescription(reps: string, metric: Metric): string {
  const trimmed = reps.trim();
  if (!/\d/.test(trimmed)) return trimmed;
  return metric === 'time' ? `${trimmed}s` : `${trimmed} reps`;
}

/**
 * The one metric a set of movements shares, or null when they disagree.
 *
 * A session-wide "Total: 145 reps" is a straight sum across everything logged,
 * so it can only name its units when everything logged measures the same
 * thing. A workout of squats and planks adds seconds to repetitions; the
 * honest thing there is to print the number and not claim what it counts.
 */
export function uniformMetric(
  exercises: Pick<Exercise, 'id' | 'metric' | 'sets'>[]
): Metric | null {
  const metrics = new Set(
    exercises.filter((e) => e.sets.some((s) => s.logged)).map((e) => exerciseMetric(e))
  );
  return metrics.size === 1 ? [...metrics][0] : null;
}
