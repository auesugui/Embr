// =============================================================================
// summary-records — the records a finished session actually beat
// =============================================================================
// What the summary's "New PRs" block lists. One row per exercise where THIS
// session set a new best for the movement, stated as old value → new value in
// the movement's own terms.
//
// Derived from the same series the Progress tab reads (`buildExerciseProgress`)
// and the same running-maximum rule the exercise screen's record list reads
// (`progressRecords`). There is deliberately no second definition of "beat" in
// here: the two screens would drift apart the first time one of them changed.
//
// A FIRST-EVER RECORD IS NOT A ROW. The session badges a first set of a new
// movement as a PR, and that badge stays. But a first record has no earlier
// number on the left of the arrow, and a block listing every movement of a
// first workout is not news. `previous === null` is exactly that case.
//
// WHAT prStore FLAGS AND THIS DOES NOT. The session's badge also fires on more
// reps at a weight you have already lifted. The series is measured in one
// metric — weight for a weighted movement — so that session does not beat its
// earlier best and gets no row. The block is the old number and the new one in
// a single number space; a rep PR at an unchanged weight has no such pair.

import {
  type ProgressMetric,
  buildExerciseProgress,
  progressRecords,
} from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { baseExerciseId } from '@/lib/metric';
import type { WorkoutLog } from '@/types';

/** How many PRs the block lists before it collapses the rest. */
export const PR_ROWS_SHOWN = 3;

/** At this many records the block collapses to `PR_ROWS_SHOWN` and a count. */
export const PR_COLLAPSE_AT = 5;

export interface SessionRecord {
  /** Library id, with the session's positional suffix stripped. */
  exerciseId: string;
  name: string;
  /** What both numbers are measured in. */
  metric: ProgressMetric;
  /** The record this session beat. */
  previous: number;
  /** What this session did. */
  value: number;
}

/**
 * The records this session beat, in session order.
 *
 * Session order rather than biggest jump first: the rows then read down the
 * screen in the same order as the exercise list underneath, and ranking your
 * own PRs against each other invites the reading that the small ones did not
 * count.
 *
 * `log` does not have to be saved yet — the summary shows the block before the
 * Save button is pressed — so it is folded into the history as a claimed
 * session regardless of its own `claimedAt`.
 *
 * ONLY WHAT WAS TRUE THEN. The series is built from sessions strictly earlier
 * than this one plus this one, never from what came after. A later session is
 * not just a bigger number to ignore: the series metric is a property of the
 * whole history, so one later weighted session turns a bodyweight movement's
 * series into weights, and reopening an old summary would lose a reps record
 * it correctly showed at the time. A summary states what that session did.
 */
export function sessionRecords(logs: WorkoutLog[], log: WorkoutLog): SessionRecord[] {
  const at = Date.parse(log.timestamp);
  const earlier = getClaimedLogs(logs).filter(
    (l) => l.id !== log.id && (Number.isNaN(at) || Date.parse(l.timestamp) < at)
  );
  const series = buildExerciseProgress([
    ...earlier,
    { ...log, claimedAt: log.claimedAt ?? log.timestamp },
  ]);

  const order = new Map<string, number>();
  log.exercises.forEach((exercise, index) => {
    const id = baseExerciseId(exercise.id);
    if (!order.has(id)) order.set(id, index);
  });

  const records: Array<{ record: SessionRecord; order: number }> = [];

  for (const exercise of series) {
    const position = order.get(exercise.exerciseId);
    if (position === undefined) continue;

    const beaten = progressRecords(exercise.comparable).find((r) => r.logId === log.id);
    if (!beaten || beaten.previous === null) continue;

    records.push({
      order: position,
      record: {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        metric: exercise.metric,
        previous: beaten.previous,
        value: beaten.value,
      },
    });
  }

  return records.sort((a, b) => a.order - b.order).map(({ record }) => record);
}
