// =============================================================================
// weight-unit — which unit a saved workout is in
// =============================================================================
// Step 1 (#85) stamps `weightUnit` on every new log. Everything that reads
// history across sessions has to agree on what a log without one means, and on
// what an unrecognised value in a restored backup means — `restoreBackup`
// passes the field through unchanged, so a hand-edited or future-version file
// can carry anything. `effectiveWeightUnit` is the ONLY place either question
// is answered: a second spelling is how half the screen ends up labelled from
// the log and the other half from the setting.
//
// Nothing here converts. Grouping is by unit alone, never by unit and date, so
// a lifter who switches back and forth has two groups and not four.

import { getClaimedLogs } from '@/lib/history-stats';
import type { WeightUnit, WorkoutLog } from '@/types';

/** Both units, lb first — the order the unit segment is drawn in. */
export const WEIGHT_UNITS: WeightUnit[] = ['lb', 'kg'];

/**
 * The unit a saved workout's weights are in.
 *
 * `setting` is the current Weight Units setting, and it answers for every log
 * written before #85 as well as for anything unrecognised. That is the one
 * place the setting still decides what history says (#85 step 2b covers
 * tagging the legacy logs once and for all).
 */
export function effectiveWeightUnit(log: WorkoutLog, setting: WeightUnit): WeightUnit {
  return log.weightUnit === 'lb' || log.weightUnit === 'kg' ? log.weightUnit : setting;
}

/** The one you are not looking at. */
export function otherWeightUnit(unit: WeightUnit): WeightUnit {
  return unit === 'lb' ? 'kg' : 'lb';
}

/**
 * True when saved history holds at least one session in each unit.
 *
 * This is the test for every surface that gains unit copy: one group means no
 * segment, no suffix, no note and no extra line anywhere, so a lifter who has
 * only ever used one unit sees exactly the screens they see today.
 */
export function historyHasBothUnits(logs: WorkoutLog[], setting: WeightUnit): boolean {
  let lb = false;
  let kg = false;
  for (const log of getClaimedLogs(logs)) {
    if (effectiveWeightUnit(log, setting) === 'lb') lb = true;
    else kg = true;
    if (lb && kg) return true;
  }
  return false;
}
