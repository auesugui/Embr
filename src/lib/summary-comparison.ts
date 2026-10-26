// =============================================================================
// summary-comparison — this session's volume against the last time you ran it
// =============================================================================
// The one sentence under the summary's stats card. It compares total session
// volume with the most recent EARLIER saved session of the same workout — the
// same template and the same day within it, so Push A is only ever compared
// with Push A. Not the last session overall: on a push/pull/legs split that
// would subtract a deadlift day from a bench day and the number would mean
// nothing.
//
// Volume is the figure already printed above the line (`totalVolume`, holds
// excluded), so the two numbers can never disagree.
//
// A LOG WITHOUT THE FIELDS CANNOT BE MATCHED. Logs written before #80 carry no
// template id or day key, and they get no comparison rather than one guessed
// from the exercise list — which would find Push A for most people and quietly
// compare the wrong two sessions for anyone who edits their templates.
//
// Logs carry no weight unit, so the delta is labelled with the current setting,
// exactly as the Volume figure and every other weight in the app already is. It
// converts nothing (#85 covers recording the unit).

import { type WorkoutTemplateDefinition, getTemplateById } from '@/data';
import { formatProgressDate } from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { formatWeight, totalVolume } from '@/lib/workout-summary';
import type { WeightUnit, WorkoutLog } from '@/types';

export interface VolumeComparison {
  /** Where this session's volume landed against the earlier one. */
  direction: 'up' | 'down' | 'same';
  /** The size of the change, never signed. Zero when `same`. */
  delta: number;
  /** The session being compared against. */
  previousTimestamp: string;
}

/** Two logs are the same workout when both halves of the identity match. */
function sameWorkout(log: WorkoutLog, other: WorkoutLog): boolean {
  return (
    log.templateId !== undefined &&
    log.dayKey !== undefined &&
    other.templateId === log.templateId &&
    other.dayKey === log.dayKey
  );
}

/**
 * The most recent earlier saved session of the same workout that carried
 * volume, or null when there is none.
 *
 * Earlier by the workout's own timestamp, so a session typed in for a past date
 * lands where it belongs. A session with no volume at all is skipped rather
 * than compared against — "down 7,410 lb from a day of planks" is arithmetic,
 * not information.
 */
export function previousSession(logs: WorkoutLog[], log: WorkoutLog): WorkoutLog | null {
  const at = Date.parse(log.timestamp);
  if (Number.isNaN(at)) return null;

  // getClaimedLogs is newest-first, so the first match is the most recent one.
  return (
    getClaimedLogs(logs).find(
      (other) =>
        other.id !== log.id &&
        sameWorkout(log, other) &&
        Date.parse(other.timestamp) < at &&
        totalVolume(other.exercises) > 0
    ) ?? null
  );
}

/**
 * How this session's volume compares, or null when there is nothing to say.
 *
 * Null covers a first session, a workout never run before, a session that moved
 * no weight, and every log written before the workout identity was recorded.
 */
export function volumeComparison(logs: WorkoutLog[], log: WorkoutLog): VolumeComparison | null {
  const volume = totalVolume(log.exercises);
  if (volume <= 0) return null;

  const previous = previousSession(logs, log);
  if (!previous) return null;

  const before = totalVolume(previous.exercises);
  const delta = Math.round((volume - before) * 1e6) / 1e6;

  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    delta: Math.abs(delta),
    previousTimestamp: previous.timestamp,
  };
}

/**
 * What the comparison calls the workout, or null when it cannot name it.
 *
 * The day's name for a program, because "your last Push A" is what the person
 * ran. The template's own name for a one-day workout, where the day name is a
 * placeholder ("Day 1") and the template name is the thing they built. A
 * template that is no longer installed cannot be named, and an unnamed
 * comparison would read as "against your last workout" — so the sentence is
 * left out instead.
 */
export function workoutLabel(
  templateId: string | undefined,
  dayKey: string | undefined,
  personalTemplates: WorkoutTemplateDefinition[]
): string | null {
  if (!templateId || !dayKey) return null;

  const template =
    getTemplateById(templateId) ?? personalTemplates.find((t) => t.id === templateId);
  if (!template) return null;

  const day = template.days.find((d) => d.id === dayKey);
  if (!day) return null;

  return template.days.length > 1 ? day.name : template.name;
}

/** `Up 480 lb from your last Push A, Oct 20.` */
export function comparisonSentence(
  comparison: VolumeComparison,
  label: string,
  units: WeightUnit
): string {
  const reference = `your last ${label}, ${formatProgressDate(comparison.previousTimestamp)}`;
  if (comparison.direction === 'same') return `The same volume as ${reference}.`;
  const direction = comparison.direction === 'up' ? 'Up' : 'Down';
  return `${direction} ${formatWeight(comparison.delta, units)} from ${reference}.`;
}
