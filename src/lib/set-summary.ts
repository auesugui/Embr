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

import type { LoggedSet, WeightUnit } from '@/types';

export interface SetSummary {
  /** Always present: the aggregate line. */
  headline: string;
  /** Only when the entries differ — the individual numbers, one line. */
  detail?: string;
}

/** How one logged entry reads on its own: `135 lb × 5` or `5 reps`. */
function describeEntry(set: LoggedSet, units: WeightUnit): string {
  const reps = set.reps ?? 0;
  if (!set.weight) return `${reps} reps`;
  return `${set.weight} ${units} × ${reps}`;
}

/** The compact form used inside the detail list: `135×5` or `5`. */
function compactEntry(set: LoggedSet): string {
  const reps = set.reps ?? 0;
  return set.weight ? `${set.weight}×${reps}` : `${reps}`;
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
  options: { units: WeightUnit; unitLabel: 'Set' | 'Round' }
): SetSummary | null {
  const logged = sets.filter((s) => s.logged);
  if (logged.length === 0) return null;

  const { units, unitLabel } = options;
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
    if (count === 1) return { headline: `${describeEntry(first, units)}${repPR}` };

    const per = first.weight
      ? `${first.weight} ${units} × ${first.reps ?? 0}`
      : `${first.reps ?? 0} reps`;
    return { headline: `${count} ${noun} × ${per} · ${totalReps} total${repPR}` };
  }

  return {
    headline: `${count} ${noun} · ${totalReps} reps${repPR}`,
    detail: logged.map(compactEntry).join(' · '),
  };
}
