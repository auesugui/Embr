// =============================================================================
// summarizeSets — a workout's sets as one line instead of twenty
// =============================================================================
// History listed every logged set on its own row. For a lifting session that is
// four rows and each one earns its place. For nine rounds of Cindy it is
// twenty-seven rows that say "5 reps", "10 reps", "15 reps" over and over —
// the same fact printed nine times, and a history screen you have to scroll
// past a single workout to reach the one before it.
//
// So the rows collapse. What replaces them depends on whether they actually
// differed:
//
//   every entry the same   9 rounds × 5 reps · 45 total
//   entries differ         9 rounds · 42 reps
//                          5 · 5 · 4 · 3 · …
//
// The second line only appears when it carries information the first cannot.
// Uniform work needs no list — "9 × 5" already says every round. Varied work
// keeps its numbers, because on a lifting session the per-set weights ARE the
// record and aggregating them away would lose the training history this app
// exists to hold.
//
// Every number here goes through `metric`, so a plank's rows collapse to
// "3 sets × 45s · 2m 15s total" rather than claiming a hundred and thirty-five
// repetitions. See `src/lib/metric.ts`.

import { formatCompact, formatQuantity, formatTotal } from '@/lib/metric';
import type { LoggedSet, Metric, WeightUnit } from '@/types';

export interface SetSummary {
  /** Always present: the aggregate line. */
  headline: string;
  /** Only when the entries differ — the individual numbers, one line. */
  detail?: string;
}

/** How one logged entry reads on its own: `135 lb × 5`, `5 reps`, or `45s`. */
function describeEntry(set: LoggedSet, units: WeightUnit, metric: Metric): string {
  const reps = set.reps ?? 0;
  if (!set.weight) return formatQuantity(reps, metric);
  return `${set.weight} ${units} × ${formatCompact(reps, metric)}`;
}

/** The compact form used inside the detail list: `135×5`, `5`, or `45s`. */
function compactEntry(set: LoggedSet, metric: Metric): string {
  const reps = set.reps ?? 0;
  return set.weight ? `${set.weight}×${formatCompact(reps, metric)}` : formatCompact(reps, metric);
}

/**
 * Collapse a movement's logged sets into one line, plus a detail line when the
 * entries weren't all the same.
 *
 * Returns null when nothing was logged — the caller says so in its own words,
 * since "no sets" and "no rounds" are different sentences.
 */
export function summarizeSets(
  sets: LoggedSet[],
  options: { units: WeightUnit; unitLabel: 'Set' | 'Round'; metric?: Metric }
): SetSummary | null {
  const logged = sets.filter((s) => s.logged);
  if (logged.length === 0) return null;

  const { units, unitLabel, metric = 'reps' } = options;
  const count = logged.length;
  const totalReps = logged.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  const noun = `${unitLabel.toLowerCase()}${count === 1 ? '' : 's'}`;
  // A rep PR is a fact about the movement, not about which row it landed on,
  // so it survives the collapse.
  const repPR = logged.some((s) => s.isRepPR) ? ' · rep PR' : '';

  const first = logged[0];
  const uniform = logged.every(
    (s) => (s.reps ?? 0) === (first.reps ?? 0) && (s.weight ?? null) === (first.weight ?? null)
  );

  if (uniform) {
    // One entry is already its own summary; multiplying by one reads worse.
    if (count === 1) return { headline: `${describeEntry(first, units, metric)}${repPR}` };

    const per = first.weight
      ? `${first.weight} ${units} × ${formatCompact(first.reps ?? 0, metric)}`
      : formatQuantity(first.reps ?? 0, metric);
    // The total keeps the bare-number form it had for reps ("45 total") and
    // states its units for a hold, where "135 total" would be a lie.
    return {
      headline: `${count} ${noun} × ${per} · ${formatCompact(totalReps, metric)} total${repPR}`,
    };
  }

  return {
    headline: `${count} ${noun} · ${formatTotal(totalReps, metric)}${repPR}`,
    detail: logged.map((s) => compactEntry(s, metric)).join(' · '),
  };
}
