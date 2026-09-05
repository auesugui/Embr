// =============================================================================
// useSessionActions — everything the session screen can do
// =============================================================================
// The handlers, in one place, because they ARE the screen's behavior and the
// screen is otherwise layout. Grouped rather than split further: they share a
// small set of store actions and each is a few lines, so splitting by subject
// (rest / block / navigation) would trade one readable file for three files
// and a barrel.
//
// `scrimDismissed` lives here because starting a block clears it — the state
// and the action that resets it belong together.

import { router } from 'expo-router';

import { isOpenEnded, targetRepCount } from '@/lib/blocks';
import { usePlayerStore, useWorkoutHistoryStore, useWorkoutStore } from '@/stores';
import { showAlert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';
import { confirmEndSession } from '@/workout/endSessionGuard';
import type { SessionView } from '@/workout/sessionView';

type StoreActions = Pick<
  ReturnType<typeof useWorkoutStore.getState>,
  | 'endSession'
  | 'setCurrentExercise'
  | 'resetRestTimer'
  | 'pauseRestTimer'
  | 'resumeRestTimer'
  | 'startBlockTimer'
  | 'pauseBlockTimer'
  | 'resumeBlockTimer'
  | 'resetBlockTimer'
  | 'finishBlockTimer'
  | 'logRound'
  | 'getCompletedSets'
>;

interface UseSessionActionsArgs extends StoreActions {
  view: SessionView;
  /** The rest timer's paused state, for the overlay's one toggle. */
  restPaused: boolean;
  /** The remembered weight is in the unit being logged in (no conversion, #42). */
  weightUnitMatches: boolean;
  getLastWeight: (exerciseId: string) => number | null;
  /**
   * Clears the AMRAP scrim's dismissal when a block starts, so the next window
   * opens focused again.
   *
   * The state itself lives in the screen, not here: `deriveSessionView` reads
   * it, and the view is this hook's input — owning it here would make the two
   * depend on each other.
   */
  setScrimDismissed: (dismissed: boolean) => void;
}

export function useSessionActions({
  view,
  restPaused,
  weightUnitMatches,
  getLastWeight,
  setScrimDismissed,
  endSession,
  setCurrentExercise,
  resetRestTimer,
  pauseRestTimer,
  resumeRestTimer,
  startBlockTimer,
  pauseBlockTimer,
  resumeBlockTimer,
  resetBlockTimer,
  finishBlockTimer,
  logRound,
  getCompletedSets,
}: UseSessionActionsArgs) {
  const { groups, groupIndex, entries, openRoundIndex, currentBlock, currentKey, clockPaused } =
    view;

  const handleEndSession = () => {
    haptics.heavy();
    confirmEndSession({
      completedSets: getCompletedSets(),
      endSession,
      navigateBack: () => router.back(),
      showAlert,
    });
  };

  const handleFinishWorkout = () => {
    haptics.success();
    const workoutStoreState = useWorkoutStore.getState();
    const { intent, startedAt } = workoutStoreState;

    const duration = Math.floor((Date.now() - (startedAt || Date.now())) / 1000);
    // Streak multiplier + Spirit FP are sourced from the live streak store, not
    // hardcoded. This wiring is what un-deads the streak multiplier (1.0×–2.0×)
    // and the entire Spirit FP economy (issue #16 / audit C2).
    const streakDays = usePlayerStore.getState().streak.current;

    // Persist the workout record BEFORE navigating. The summary receives only
    // this id — never the full payload as URL params — so reloading the summary
    // URL can no longer re-create the award context. Idempotency is enforced
    // downstream by `claimRewards` checking `claimedAt` (issue #16 / audit C1).
    const workoutId = useWorkoutHistoryStore.getState().createLog({
      exercises: workoutStoreState.exercises,
      durationSeconds: duration,
      streakDays,
      sessionIntent: intent,
      // The clocks go with the exercises. Without them a finished circuit reads
      // back as three unrelated exercises with one set each.
      blocks: workoutStoreState.blocks,
      blockTimes: workoutStoreState.blockTimes,
    });

    router.replace({
      pathname: '/workout/summary',
      params: { workoutId },
    });
  };

  const handleNextExercise = () => {
    haptics.tap();
    const target = groups[groupIndex + 1]?.entries[0]?.index;
    if (target === undefined) return;
    setCurrentExercise(target);
    resetRestTimer();
  };

  const handlePreviousExercise = () => {
    haptics.tap();
    const target = groups[groupIndex - 1]?.entries[0]?.index;
    if (target === undefined) return;
    setCurrentExercise(target);
    resetRestTimer();
  };

  const handleSkipRest = () => {
    haptics.tap();
    resetRestTimer();
  };

  const handleTogglePause = () => {
    haptics.selection();
    if (restPaused) {
      resumeRestTimer();
    } else {
      pauseRestTimer();
    }
  };

  // The primary circuit action: bank the whole round in one tap.
  //
  // Weight is resolved per movement the same way a quick-tap does, so a loaded
  // circuit still records real volume rather than a bodyweight-shaped hole.
  const handleLogRound = () => {
    if (openRoundIndex === null) return;

    const rows = entries.flatMap(({ exercise, index }) => {
      const reps = targetRepCount(exercise?.targetReps);
      if (!exercise || reps === null) return [];
      // Skip anything already logged — re-logging would clobber an edit the
      // user made to this round.
      if (exercise.sets[openRoundIndex]?.logged) return [];

      const lastWeight = getLastWeight(exercise.id);
      const weight = lastWeight && lastWeight > 0 && weightUnitMatches ? lastWeight : undefined;
      return [{ exerciseIndex: index, setIndex: openRoundIndex, reps, weight }];
    });

    if (rows.length === 0) return;

    haptics.success();
    logRound(
      rows,
      entries.map((e) => e.index),
      // `for_time` and `emom` stop at their planned round count.
      isOpenEnded(currentBlock.mode)
    );
  };

  const handleStartBlock = () => {
    haptics.success();
    setScrimDismissed(false);
    startBlockTimer(currentKey, {
      mode: currentBlock.mode,
      // EMOM's total length is its interval plan, not a window someone typed.
      duration:
        currentBlock.mode === 'emom'
          ? currentBlock.rounds * currentBlock.intervalSeconds
          : currentBlock.durationSeconds,
      intervalSeconds: currentBlock.intervalSeconds,
    });
  };

  const handleToggleBlockPause = () => {
    haptics.selection();
    if (clockPaused) {
      resumeBlockTimer();
    } else {
      pauseBlockTimer();
    }
  };

  const handleResetBlock = () => {
    haptics.tap();
    resetBlockTimer();
  };

  const handleFinishBlock = () => {
    haptics.success();
    finishBlockTimer();
  };

  const handleExerciseTabPress = (index: number) => {
    haptics.tap();
    setCurrentExercise(index);
    resetRestTimer();
  };

  return {
    handleEndSession,
    handleFinishWorkout,
    handleNextExercise,
    handlePreviousExercise,
    handleSkipRest,
    handleTogglePause,
    handleLogRound,
    handleStartBlock,
    handleToggleBlockPause,
    handleResetBlock,
    handleFinishBlock,
    handleExerciseTabPress,
  };
}
