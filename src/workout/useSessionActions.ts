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
import { streakOnDay } from '@/lib/streak';
import { useSettingsStore, useWorkoutHistoryStore, useWorkoutStore } from '@/stores';
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
  | 'adjustRestTimer'
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
  /**
   * The weight to open a set on, already in the unit being logged in.
   *
   * The caller owns the unit, so nothing here has to know one: the pre-fill
   * never crosses units and never converts (#42, #85 step 2).
   */
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
  getLastWeight,
  setScrimDismissed,
  endSession,
  setCurrentExercise,
  resetRestTimer,
  pauseRestTimer,
  resumeRestTimer,
  adjustRestTimer,
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
    // The streak on the day of this workout, counting this workout. The summary
    // reads this snapshot for its milestones, so it has to be the streak after it.
    const streakDays = streakOnDay(
      useWorkoutHistoryStore.getState().logs,
      new Date().toISOString()
    );

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
      // Which workout this was, so the summary can compare it with the last
      // time you ran the same day rather than with your last session of
      // anything.
      templateId: workoutStoreState.templateId ?? undefined,
      dayKey: workoutStoreState.dayKey ?? undefined,
      workoutName: workoutStoreState.workoutName ?? undefined,
      // The unit these weights were typed in, read here rather than at render
      // so a session that was open while the setting changed records the unit
      // in effect at finish (#85).
      weightUnit: useSettingsStore.getState().units,
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

  const handleAdjustRest = (delta: number) => {
    haptics.selection();
    adjustRestTimer(delta);
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
      const weight = lastWeight && lastWeight > 0 ? lastWeight : undefined;
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
    handleAdjustRest,
    handleLogRound,
    handleStartBlock,
    handleToggleBlockPause,
    handleResetBlock,
    handleFinishBlock,
    handleExerciseTabPress,
  };
}
