// =============================================================================
// useWeightPrefill — the weight a new set opens with
// =============================================================================
// One movement's answer for the chip-row hint, and a function for the others:
// inside a circuit a round is banked for every member at once, and the modal
// asks for whichever movement it is pointed at.
//
// The rule itself is `prefillWeight` (src/lib/last-time.ts) and is not spelled
// out again here. This hook is only the wiring: where the remembered weight
// comes from, where the saved workouts come from, and the clock they are read
// against.

import { useMemo } from 'react';

import { prefillWeight } from '@/lib/last-time';
import { useWeightHistoryStore, useWorkoutHistoryStore } from '@/stores';
import { lastWeightInUnit } from '@/stores/weightHistoryStore';
import type { WeightUnit } from '@/types';

export function useWeightPrefill({
  exerciseId,
  units,
  startedAt,
}: {
  /**
   * The movement on screen, or null for the render in which there is none.
   *
   * The session store empties underneath a mounted screen when a session ends,
   * and hooks cannot sit below the screen's guard, so this has to tolerate the
   * gap rather than dereference through it.
   */
  exerciseId: string | null;
  /** The unit being logged in. */
  units: WeightUnit;
  /** ms epoch the session started, or null before one has. */
  startedAt: number | null;
}) {
  // `logs` only changes when a workout is saved, which cannot happen while a
  // session is running, so subscribing costs no re-renders.
  const logs = useWorkoutHistoryStore((state) => state.logs);
  // Subscribed rather than read in render: a modal save has to re-render the
  // chips with the new weight immediately.
  const cached = useWeightHistoryStore((state) =>
    exerciseId ? lastWeightInUnit(state.history[exerciseId], units) : null
  );
  // The session's own start, so the answer cannot move under a screen that
  // stays mounted — the same anchor the Last time caption reads against.
  const before = startedAt ?? Number.POSITIVE_INFINITY;

  const current = useMemo(
    () => (exerciseId ? prefillWeight({ cached, logs, exerciseId, before, units }) : null),
    [cached, exerciseId, logs, before, units]
  );

  /** The same answer for any movement, read at the moment it is asked for. */
  const weightFor = (id: string) =>
    prefillWeight({
      cached: useWeightHistoryStore.getState().getLastWeightInUnit(id, units),
      logs,
      exerciseId: id,
      before,
      units,
    });

  return { current, weightFor };
}
