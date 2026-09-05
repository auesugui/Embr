// =============================================================================
// useSetLogging — landing a set, and what happens next
// =============================================================================
// Two paths write a set: the quick ladder (one tap, weight auto-filled) and the
// modal (everything else). Both funnel through `afterLog`, which is where the
// difference between a set scheme and a timed block actually lives — rest, or
// the next round.
//
// It owns the edit-target state because that state exists only to drive the
// modal, and every handler that touches it is here.

import { useState } from 'react';

import { isOpenEnded, usesRestTimer } from '@/lib/blocks';
import { useWeightHistoryStore, useWorkoutStore } from '@/stores';
import type { BlockMode, Exercise, WeightUnit } from '@/types';
import { haptics } from '@/utils/haptics';

interface SetEditState {
  exerciseIndex: number;
  setIndex: number;
  visible: boolean;
}

interface UseSetLoggingArgs {
  exercises: Exercise[];
  /** Every member of the current block, so a round can open across all of them. */
  memberIndexes: number[];
  mode: BlockMode;
  timed: boolean;
  units: WeightUnit;
  /** The remembered weight is in the unit being logged in (no conversion, #42). */
  weightUnitMatches: boolean;
  getLastWeight: (exerciseId: string) => number | null;
  logSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  editSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  clearSet: (exerciseIndex: number, setIndex: number) => void;
  openRound: (memberIndexes: number[]) => void;
  startRestTimer: (seconds: number) => void;
}

export function useSetLogging({
  exercises,
  memberIndexes,
  mode,
  timed,
  units,
  weightUnitMatches,
  getLastWeight,
  logSet,
  editSet,
  clearSet,
  openRound,
  startRestTimer,
}: UseSetLoggingArgs) {
  const [setEdit, setSetEdit] = useState<SetEditState>({
    exerciseIndex: 0,
    setIndex: 0,
    visible: false,
  });

  /**
   * What happens once a set lands.
   *
   * In a set scheme that's rest. In a timed block it's the opposite — the clock
   * is the whole constraint, so nothing may cover the rows, and the next round
   * opens instead of a rest overlay.
   *
   * The round opens for EVERY member at once, not just the one just logged.
   * Round index is what pairs the movements: if the squats could run ahead,
   * round 3 of the squats would sit beside round 2 of the pull-ups.
   */
  const afterLog = (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    if (timed) {
      // Only the open-ended modes grow. `for_time` and `emom` have a planned
      // round count and stop there.
      if (!isOpenEnded(mode)) return;

      // The next round opens when the round CLOSES — when the last movement of
      // it lands — not when any one movement is logged. Keying off row counts
      // instead fires on the first movement of the round and grows only that
      // one, leaving the circuit ragged.
      //
      // Read fresh state: the set that triggered this is not in the render
      // closure's copy of `exercises` yet.
      const fresh = useWorkoutStore.getState().exercises;
      const roundClosed = memberIndexes.every((i) => fresh[i]?.sets[setIndex]?.logged);

      if (roundClosed) openRound(memberIndexes);
      return;
    }

    if (usesRestTimer(mode)) {
      startRestTimer(exercise.restSeconds);
    }
  };

  /**
   * Quick log from the preset buttons.
   *
   * The fast path must capture real weight, not null (audit A4 / issue #22).
   * We auto-fill from the exercise's last-used weight in weightHistoryStore —
   * the same store the modal path writes to — so quick-taps produce
   * volume/PR-real data without breaking the 3-second rule.
   *
   * Fallback is `undefined` (→ stored as `null`) when there's no history or
   * the stored value is non-positive. We deliberately do NOT fall back to 0:
   * logSet's `weight ?? null` would store 0, `saveWeight(id, 0)` would pollute
   * weightHistory so the next chip shows "@ 0 lb", and the summary's volume
   * calc treats null and 0 identically (`(weight ?? 0) * reps`). Null keeps
   * the set volume-neutral, history-clean, and PR-silent.
   */
  const handleQuickLog = (exerciseIndex: number, setIndex: number, reps: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const lastWeight = getLastWeight(exercise.id);
    const quickWeight = lastWeight && lastWeight > 0 && weightUnitMatches ? lastWeight : undefined;

    haptics.success();
    logSet(exerciseIndex, setIndex, reps, quickWeight);
    afterLog(exerciseIndex, setIndex);
  };

  // Both take the exercise index explicitly: inside a circuit the row you
  // tapped may belong to any member, not the current one.
  const openEditor = (exerciseIndex: number, setIndex: number) => {
    haptics.tap();
    setSetEdit({ exerciseIndex, setIndex, visible: true });
  };

  const handleModalSave = (reps: number, weight?: number) => {
    // Read the set off the exercise being edited, not the current one — inside
    // a circuit those differ, and asking the wrong exercise would treat an edit
    // as a fresh log and re-open a round that is already open.
    const set = exercises[setEdit.exerciseIndex]?.sets[setEdit.setIndex];

    if (set?.logged) {
      // Editing an existing set — don't restart the timer.
      editSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
    } else {
      logSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
      afterLog(setEdit.exerciseIndex, setEdit.setIndex);
    }
  };

  const handleModalClear = () => clearSet(setEdit.exerciseIndex, setEdit.setIndex);
  const handleCloseModal = () => setSetEdit((prev) => ({ ...prev, visible: false }));

  // The set and exercise the modal is pointed at.
  const editingSet = exercises[setEdit.exerciseIndex]?.sets[setEdit.setIndex];
  const editingExercise = exercises[setEdit.exerciseIndex];
  // Read imperatively rather than by subscribing: the unit only matters at the
  // moment the modal opens, and a subscription would re-render the whole
  // session on every unrelated weight write.
  const editingLastUnit: WeightUnit = editingExercise
    ? (useWeightHistoryStore.getState().history[editingExercise.id]?.lastUnit ?? 'lb')
    : 'lb';
  const suggestedWeight =
    editingExercise && editingLastUnit === units ? getLastWeight(editingExercise.id) : null;

  return {
    setEdit,
    editingSet,
    editingExercise,
    suggestedWeight,
    handleQuickLog,
    openEditor,
    handleModalSave,
    handleModalClear,
    handleCloseModal,
  };
}
