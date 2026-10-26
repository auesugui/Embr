// =============================================================================
// Last time — what you did the previous time you trained this movement
// =============================================================================
// One line above the set rows, so the number you are about to load the bar with
// is a comparison rather than a guess. Nothing new is persisted: the numbers are
// read back out of saved workouts, the same slice History and Progress read.
//
// WHICH WORKOUT. The most recent SAVED one, earlier than this session, that has
// a performed set of the movement. "Earlier" is measured against the session's
// own start rather than the current time, so the line does not change under you
// mid-session, and `isPerformedSet` decides what counts — a logged row with
// neither a weight nor a count is an empty row, not a set.
//
// HOW IT READS. The same collapse History uses (`set-summary.ts`): uniform work
// is one line, varied work keeps every number. A hold reads in seconds, and a
// weight is labelled with the current unit setting because a saved workout
// carries no unit of its own (#85 covers recording it).

import { isPerformedSet } from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { baseExerciseId, exerciseMetric, formatCompact } from '@/lib/metric';
import { compactEntry, describeEntry, sameWork } from '@/lib/set-summary';
import type { LoggedSet, Metric, WeightUnit, WorkoutLog } from '@/types';

export interface LastPerformed {
  /** Every performed set of the movement in that workout, in order. */
  sets: LoggedSet[];
  /** What those numbers measure, as that workout itself spells it. */
  metric: Metric;
}

/**
 * The performed sets of the most recent saved workout before `before` that has
 * this movement in it, or null the first time you train it.
 *
 * `before` is a required ms-epoch clock: a session screen that stays mounted
 * must not re-answer this against a moving "now".
 */
export function findLastPerformed(
  logs: WorkoutLog[],
  exerciseId: string,
  before: number
): LastPerformed | null {
  const base = baseExerciseId(exerciseId);

  // Newest first, so the first workout carrying the movement is the answer.
  for (const log of getClaimedLogs(logs)) {
    const at = Date.parse(log.timestamp);
    if (Number.isNaN(at) || at >= before) continue;

    const entries = log.exercises.filter((e) => !e.cardio && baseExerciseId(e.id) === base);
    // Repeated entries of one movement in one workout are one session of it —
    // the rule the Progress series already uses for the heavy/back-off pairs.
    const sets = entries.flatMap((e) => e.sets.filter(isPerformedSet));
    if (sets.length === 0) continue;

    return { sets, metric: exerciseMetric(entries[entries.length - 1]) };
  }

  return null;
}

/** The numbers alone: `3 × 10 @ 135 lb`, `45s, 60s`, `135×10 · 145×8`. */
function describeSets(sets: LoggedSet[], units: WeightUnit, metric: Metric): string {
  const first = sets[0];
  const counts = sets.map((s) => formatCompact(s.reps ?? 0, metric));

  if (sameWork(sets)) {
    // One set is already its own summary; multiplying by one reads worse.
    if (sets.length === 1) return describeEntry(first, units, metric);
    const load = first.weight ? ` @ ${first.weight} ${units}` : '';
    return `${sets.length} × ${counts[0]}${load}`;
  }

  // A weight that held across the sets is stated once. A weight that moved is
  // part of each number, which is History's own detail form.
  if (sets.every((s) => (s.weight ?? null) === (first.weight ?? null))) {
    return first.weight ? `${first.weight} ${units} × ${counts.join(', ')}` : counts.join(', ');
  }

  return sets.map((s) => compactEntry(s, metric)).join(' · ');
}

/**
 * The caption itself. Always a line, never an empty gap, so the quick-log
 * ladder sits at the same height on every exercise.
 */
export function lastTimeLine(args: {
  logs: WorkoutLog[];
  exerciseId: string;
  /** ms epoch the current session started. */
  before: number;
  units: WeightUnit;
}): string {
  const last = findLastPerformed(args.logs, args.exerciseId, args.before);
  if (!last) return 'First time';
  return `Last time: ${describeSets(last.sets, args.units, last.metric)}`;
}
