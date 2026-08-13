// =============================================================================
// Session duration estimates
// =============================================================================
// `WorkoutTemplateDefinition.estimatedDuration` is one hand-written number per
// TEMPLATE. Two things are wrong with reading it as the length of a session:
//
//   1. It never changes. A blank personal template is born with a hardcoded 45
//      and keeps it however many exercises you add or remove. A 20-minute AMRAP
//      triad reported "3 exercises · ~45 min", which is what surfaced this.
//   2. It is per-template, but every place it is shown is per-DAY. Day 1 of a
//      6-day split and day 6 are not the same length.
//
// So the estimate is computed from what the day actually contains. A timed
// block is worth its clock ONCE — that is the whole point of a time cap, and
// summing its movements as if they were straight sets is exactly the bug.
//
// These are estimates for a card, not a prescription. They are deliberately
// simple and deliberately honest about being approximate.

import type { TemplateDay } from '@/data/templates';
import { groupIntoBlocks } from './blocks';

// -----------------------------------------------------------------------------
// Tuning constants
// -----------------------------------------------------------------------------
// Calibrated against the five built-in templates' hand-written numbers, which
// are the only ground truth available (see duration.test.ts — it asserts the
// computed values stay near them, so a future change to these constants can't
// silently drift the built-ins).

/** A rep takes about this long under load, including the eccentric. */
const SECONDS_PER_REP = 3;

/** Walking to the rack, loading plates, finding the bench. Per exercise. */
const SETUP_SECONDS_PER_EXERCISE = 60;

/** A set whose rep scheme we can't parse (`AMQRAP`, free text). */
const FALLBACK_SET_SECONDS = 30;

// -----------------------------------------------------------------------------
// Rep parsing
// -----------------------------------------------------------------------------

/**
 * Working time for ONE set, in seconds, from a template rep string.
 *
 * Handles the four shapes the built-ins and the editor produce:
 *   `8-12`      a range     -> midpoint reps, per set
 *   `30-60s`    a hold      -> midpoint seconds, already a duration
 *   `15 total`  a rep TOTAL -> that many reps spread across ALL sets
 *   `10`        a count     -> that many reps, per set
 * Anything else (`AMQRAP`) falls back rather than throwing — this runs against
 * restored backup files and hand-edited templates.
 *
 * `total` is the one that bites. Powerbuilding prescribes "5 sets, 15 total",
 * which is three reps a set, not fifteen. Reading it per-set overstates that
 * template by five times.
 */
export function setWorkSeconds(reps: string, sets = 1): number {
  const raw = (reps ?? '').trim().toLowerCase();
  if (!raw) return FALLBACK_SET_SECONDS;

  const numbers = raw.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return FALLBACK_SET_SECONDS;

  const values = numbers.map(Number);
  const midpoint = values.length >= 2 ? (values[0] + values[1]) / 2 : values[0];

  // A hold: `30-60s`, `45s`. The number IS the duration, not a rep count.
  if (/\ds$/.test(raw)) return midpoint;

  // A whole-exercise total, not a per-set prescription.
  if (raw.includes('total')) return (midpoint / Math.max(1, sets)) * SECONDS_PER_REP;

  return midpoint * SECONDS_PER_REP;
}

// -----------------------------------------------------------------------------
// Day estimate
// -----------------------------------------------------------------------------

/**
 * Estimated wall-clock seconds for one day of a template.
 *
 * Straight sets cost work + rest per set, plus one setup per exercise. A timed
 * block costs its clock, once, no matter how many movements are inside it —
 * twenty minutes of Cindy is twenty minutes whether it is three exercises or
 * eight.
 */
export function estimateDaySeconds(day: TemplateDay): number {
  const groups = groupIntoBlocks(day.exercises ?? [], day.blocks);

  return groups.reduce((total, { block, entries }) => {
    switch (block.mode) {
      // The window IS the answer. Counted once for the whole block.
      case 'amrap_reps':
      case 'amrap_rounds':
        return total + block.durationSeconds + SETUP_SECONDS_PER_EXERCISE;

      // Cadence times interval count.
      case 'emom':
        return total + block.intervalSeconds * block.rounds + SETUP_SECONDS_PER_EXERCISE;

      // A cap of 0 means uncapped, so fall back to the planned work: every
      // member, every round, no rest (for-time doesn't have programmed rest).
      case 'for_time': {
        if (block.durationSeconds > 0) {
          return total + block.durationSeconds + SETUP_SECONDS_PER_EXERCISE;
        }
        const perRound = entries.reduce(
          (sum, { exercise }) => sum + setWorkSeconds(exercise.reps, exercise.sets),
          0
        );
        return total + perRound * block.rounds + SETUP_SECONDS_PER_EXERCISE;
      }

      // Straight sets.
      default:
        return (
          total +
          entries.reduce((sum, { exercise }) => {
            const sets = Math.max(0, exercise.sets ?? 0);
            const work = setWorkSeconds(exercise.reps, sets);
            const rest = Math.max(0, exercise.restSeconds ?? 0);
            return sum + sets * (work + rest) + SETUP_SECONDS_PER_EXERCISE;
          }, 0)
        );
    }
  }, 0);
}

/** Estimated minutes for one day, rounded to the nearest 5 to stop it reading as precise. */
export function estimateDayMinutes(day: TemplateDay): number {
  return roundToFive(estimateDaySeconds(day) / 60);
}

/**
 * Estimated minutes for a TYPICAL session of a template — the mean across its
 * days. This is the program-level number on a template card, where one figure
 * has to stand for six different days.
 *
 * Days with nothing in them are skipped rather than averaged in as zero: a
 * blank day 2 shouldn't halve the advertised length of day 1.
 */
export function estimateTemplateMinutes(template: { days: TemplateDay[] }): number {
  const populated = (template.days ?? []).filter((d) => (d.exercises ?? []).length > 0);
  if (populated.length === 0) return 0;

  const totalSeconds = populated.reduce((sum, day) => sum + estimateDaySeconds(day), 0);
  return roundToFive(totalSeconds / populated.length / 60);
}

function roundToFive(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(5, Math.round(minutes / 5) * 5);
}
