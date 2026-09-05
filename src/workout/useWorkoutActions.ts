// =============================================================================
// useWorkoutActions — the session's store actions, in one call
// =============================================================================
// Twenty-two individual selectors is the correct way to read Zustand actions —
// each subscribes to one stable function reference, so nothing re-renders when
// unrelated state moves — but twenty-two lines of it at the top of a screen
// buries the screen.
//
// Kept as individual selectors rather than one object selector on purpose: a
// single selector returning a fresh object would re-render on every store
// change unless shallow-compared, which is a subtlety worth not introducing
// for the sake of one line.

import { useWorkoutStore } from '@/stores';

export function useWorkoutActions() {
  return {
    logSet: useWorkoutStore((state) => state.logSet),
    editSet: useWorkoutStore((state) => state.editSet),
    clearSet: useWorkoutStore((state) => state.clearSet),
    addSet: useWorkoutStore((state) => state.addSet),
    openRound: useWorkoutStore((state) => state.openRound),
    logRound: useWorkoutStore((state) => state.logRound),
    startRestTimer: useWorkoutStore((state) => state.startRestTimer),
    pauseRestTimer: useWorkoutStore((state) => state.pauseRestTimer),
    resumeRestTimer: useWorkoutStore((state) => state.resumeRestTimer),
    resetRestTimer: useWorkoutStore((state) => state.resetRestTimer),
    tickRestTimer: useWorkoutStore((state) => state.tickRestTimer),
    startBlockTimer: useWorkoutStore((state) => state.startBlockTimer),
    pauseBlockTimer: useWorkoutStore((state) => state.pauseBlockTimer),
    resumeBlockTimer: useWorkoutStore((state) => state.resumeBlockTimer),
    resetBlockTimer: useWorkoutStore((state) => state.resetBlockTimer),
    tickBlockTimer: useWorkoutStore((state) => state.tickBlockTimer),
    finishBlockTimer: useWorkoutStore((state) => state.finishBlockTimer),
    setCurrentExercise: useWorkoutStore((state) => state.setCurrentExercise),
    endSession: useWorkoutStore((state) => state.endSession),
    getCompletedSets: useWorkoutStore((state) => state.getCompletedSets),
    getTotalReps: useWorkoutStore((state) => state.getTotalReps),
  };
}
