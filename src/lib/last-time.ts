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
// weight is labelled with the unit THAT WORKOUT was logged in (#85 step 2) —
// the caption reports a past session, so it prints what was recorded and
// converts nothing.
//
// The uniform forms carry the unit inside the line, so nothing is added to
// them. The varied form is History's detail spelling, `55×12 · 60×10`, which
// has no room for a unit on each number and never carried one. It gains one at
// the end ONLY when the session was logged in the other unit — that is the
// reading that is otherwise false, because every other number on the screen is
// in the setting. A lifter who has only ever used one unit reads the line it
// has always read.
//
// THE PRE-FILL reads the same history (`prefillWeight`), because the weight
// cache behind it is five entries deep and a unit switch can push a real
// session out of it.

import { isPerformedSet } from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { baseExerciseId, exerciseMetric, formatCompact } from '@/lib/metric';
import { compactEntry, describeEntry, sameWork } from '@/lib/set-summary';
import { effectiveWeightUnit } from '@/lib/weight-unit';
import type { LoggedSet, Metric, WeightUnit, WorkoutLog } from '@/types';

export interface LastPerformed {
  /** Every performed set of the movement in that workout, in order. */
  sets: LoggedSet[];
  /** What those numbers measure, as that workout itself spells it. */
  metric: Metric;
  /** The unit that workout's weights were logged in. */
  unit: WeightUnit;
}

/**
 * The performed sets of the most recent saved workout before `before` that has
 * this movement in it, or null the first time you train it.
 *
 * `before` is a required ms-epoch clock: a session screen that stays mounted
 * must not re-answer this against a moving "now". `setting` answers for a log
 * that carries no unit of its own.
 */
export function findLastPerformed(
  logs: WorkoutLog[],
  exerciseId: string,
  before: number,
  setting: WeightUnit,
  /** Skip sessions logged in the other unit. Absent means any unit. */
  inUnit?: WeightUnit
): LastPerformed | null {
  const base = baseExerciseId(exerciseId);

  // Newest first, so the first workout carrying the movement is the answer.
  for (const log of getClaimedLogs(logs)) {
    const at = Date.parse(log.timestamp);
    if (Number.isNaN(at) || at >= before) continue;
    if (inUnit !== undefined && effectiveWeightUnit(log, setting) !== inUnit) continue;

    const entries = log.exercises.filter((e) => !e.cardio && baseExerciseId(e.id) === base);
    // Repeated entries of one movement in one workout are one session of it —
    // the rule the Progress series already uses for the heavy/back-off pairs.
    const sets = entries.flatMap((e) => e.sets.filter(isPerformedSet));
    if (sets.length === 0) continue;

    return {
      sets,
      metric: exerciseMetric(entries[entries.length - 1]),
      unit: effectiveWeightUnit(log, setting),
    };
  }

  return null;
}

/** The numbers alone: `3 × 10 @ 135 lb`, `45s, 60s`, `135×10 · 145×8 in lb`. */
function describeSets(
  sets: LoggedSet[],
  units: WeightUnit,
  metric: Metric,
  /** Name the unit on the varied form. See the header. */
  nameUnit: boolean
): string {
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

  // Bodyweight work has no load for a unit to be about, so it never gains one.
  const loaded = sets.some((s) => (s.weight ?? 0) > 0);
  const tail = nameUnit && loaded ? ` in ${units}` : '';
  return `${sets.map((s) => compactEntry(s, metric)).join(' · ')}${tail}`;
}

/**
 * The weight a new set opens with: the last one you used IN `units`, or null.
 *
 * `cached` is weightHistoryStore's answer and is the usual one — it is written
 * on every logged set, so inside a session the second set opens on the first.
 * But it keeps five entries per movement, so five sets logged in the other
 * unit push a real session out of it, and then the field would open empty
 * although the session it should read is still saved. The workouts do not
 * expire, so they are the record when the cache has nothing.
 *
 * It never crosses units and never converts: filling 275 into a kg field loads
 * 275 kg onto a bar that held 275 lb. A session logged with no unit of its own
 * is in the setting, which is `units` here, so it answers for the pre-fill the
 * way it answers everywhere else.
 */
export function prefillWeight(args: {
  /** weightHistoryStore's remembered weight in this unit, or null. */
  cached: number | null;
  logs: WorkoutLog[];
  exerciseId: string;
  /** ms epoch the current session started. */
  before: number;
  /** The unit being logged in, which is the setting. */
  units: WeightUnit;
}): number | null {
  if (args.cached !== null && args.cached > 0) return args.cached;

  // The unit being logged in is the setting, so it answers twice: once for a
  // workout that carries no unit, and once as the unit being looked for.
  const last = findLastPerformed(args.logs, args.exerciseId, args.before, args.units, args.units);
  if (!last) return null;

  // The last set that carried a load, which is what the cache would have
  // remembered: a drop set opens on the weight you finished on, not the one
  // you started with.
  for (let index = last.sets.length - 1; index >= 0; index--) {
    const weight = last.sets[index].weight ?? 0;
    if (weight > 0) return weight;
  }
  return null;
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
  /** The current setting, for a workout that carries no unit of its own. */
  setting: WeightUnit;
}): string {
  const last = findLastPerformed(args.logs, args.exerciseId, args.before, args.setting);
  if (!last) return 'First time';
  // That workout's unit, not the setting: the line is what you did, and
  // relabelling 275 lb as 275 kg is a world record nobody set. The varied form
  // has no unit of its own, so it is told to name one when the session was
  // logged in the unit the screen is NOT in.
  return `Last time: ${describeSets(last.sets, last.unit, last.metric, last.unit !== args.setting)}`;
}
