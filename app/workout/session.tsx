// =============================================================================
// IronQuest Workout Session Screen
// =============================================================================

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft } from 'lucide-react-native';

import { PRFlash, Settle } from '@/components/celebration';
import { ExerciseDemo } from '@/components/workout/ExerciseDemo';
import { RestTimerRing } from '@/components/workout/RestTimerRing';
import { SetInputModal } from '@/components/workout/SetInputModal';
import {
  blockKey as blockKeyOf,
  blockMembers,
  completedRounds,
  countsUp,
  describeBlock,
  formatClock,
  groupIntoBlocks,
  isOpenEnded,
  isTimed,
  resolveBlock,
  targetRepCount,
  usesRestTimer,
} from '@/lib/blocks';
import {
  usePlayerStore,
  useSettingsStore,
  useWeightHistoryStore,
  useWorkoutHistoryStore,
  useWorkoutStore,
} from '@/stores';
import { blockElapsed, blockInterval, blockRemaining } from '@/stores/workoutStore';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { showAlert } from '@/utils/alert';
import { haptics } from '@/utils/haptics';
import { confirmEndSession } from '@/workout/endSessionGuard';

interface SetEditState {
  exerciseIndex: number;
  setIndex: number;
  visible: boolean;
}

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();

  // Store state
  const active = useWorkoutStore((state) => state.active);
  const exercises = useWorkoutStore((state) => state.exercises);
  const currentExerciseIndex = useWorkoutStore((state) => state.currentExerciseIndex);
  const restTimer = useWorkoutStore((state) => state.restTimer);
  const blockTimer = useWorkoutStore((state) => state.blockTimer);
  const blocks = useWorkoutStore((state) => state.blocks);

  // Store actions
  const logSet = useWorkoutStore((state) => state.logSet);
  const editSet = useWorkoutStore((state) => state.editSet);
  const clearSet = useWorkoutStore((state) => state.clearSet);
  const addSet = useWorkoutStore((state) => state.addSet);
  const openRound = useWorkoutStore((state) => state.openRound);
  const logRound = useWorkoutStore((state) => state.logRound);
  const startRestTimer = useWorkoutStore((state) => state.startRestTimer);
  const pauseRestTimer = useWorkoutStore((state) => state.pauseRestTimer);
  const resumeRestTimer = useWorkoutStore((state) => state.resumeRestTimer);
  const resetRestTimer = useWorkoutStore((state) => state.resetRestTimer);
  const tickRestTimer = useWorkoutStore((state) => state.tickRestTimer);
  const startBlockTimer = useWorkoutStore((state) => state.startBlockTimer);
  const pauseBlockTimer = useWorkoutStore((state) => state.pauseBlockTimer);
  const resumeBlockTimer = useWorkoutStore((state) => state.resumeBlockTimer);
  const resetBlockTimer = useWorkoutStore((state) => state.resetBlockTimer);
  const tickBlockTimer = useWorkoutStore((state) => state.tickBlockTimer);
  const finishBlockTimer = useWorkoutStore((state) => state.finishBlockTimer);
  const setCurrentExercise = useWorkoutStore((state) => state.setCurrentExercise);
  const endSession = useWorkoutStore((state) => state.endSession);
  const getCompletedSets = useWorkoutStore((state) => state.getCompletedSets);
  const getTotalReps = useWorkoutStore((state) => state.getTotalReps);

  // Weight history for auto-fill
  const getLastWeight = useWeightHistoryStore((state) => state.getLastWeight);

  // Local state
  const [setEdit, setSetEdit] = useState<SetEditState>({
    exerciseIndex: 0,
    setIndex: 0,
    visible: false,
  });

  // Rest timer interval
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restTimer.running && !restTimer.paused) {
      timerRef.current = setInterval(() => {
        tickRestTimer();
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [restTimer.running, restTimer.paused, tickRestTimer]);

  // The block clock ticks on its own interval so it keeps running while a rest
  // timer isn't (and vice versa). The store derives elapsed from a wall-clock
  // anchor, so a dropped tick can't slow the clock down.
  const blockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (blockTimer.running && !blockTimer.paused) {
      blockRef.current = setInterval(() => {
        tickBlockTimer();
      }, 1000);
    } else if (blockRef.current) {
      clearInterval(blockRef.current);
      blockRef.current = null;
    }

    return () => {
      if (blockRef.current) {
        clearInterval(blockRef.current);
      }
    };
  }, [blockTimer.running, blockTimer.paused, tickBlockTimer]);

  const currentExercise = exercises[currentExerciseIndex];
  const totalReps = getTotalReps();

  // ---------------------------------------------------------------------------
  // The block the current exercise belongs to
  // ---------------------------------------------------------------------------
  // A block may hold several movements, and a round spans all of them. So the
  // unit on screen is the BLOCK, not the exercise: "5 pull-ups, 10 push-ups, 15
  // squats" is one thing you work through, and showing one movement at a time
  // would hide the round you are actually in.

  const currentBlock = resolveBlock(currentExercise, blocks);
  const currentTimed = isTimed(currentBlock.mode);

  const entries = currentExercise?.blockId
    ? blockMembers(exercises, currentExercise.blockId)
    : [{ exercise: currentExercise, index: currentExerciseIndex }];
  const isCircuit = entries.length > 1;

  const currentKey = blockKeyOf(currentExercise, currentExerciseIndex);
  // The clock belongs to one block at a time — moving away leaves its window
  // running, but the controls only show on the block that owns it.
  const clockIsOurs = blockTimer.blockKey === currentKey;
  const clockRunning = clockIsOurs && blockTimer.running;
  const clockPaused = clockIsOurs && blockTimer.paused;
  const counting = countsUp(currentBlock.mode);

  const elapsed = clockIsOurs ? blockElapsed(blockTimer) : 0;
  const remaining = clockIsOurs ? blockRemaining(blockTimer) : currentBlock.durationSeconds;
  // A count-up block is finished when its time has been recorded, not when a
  // window closes — there is no window to close.
  const clockFinished =
    clockIsOurs &&
    (counting ? blockTimer.finishedElapsed !== null : !blockTimer.running && remaining === 0);
  const clockDisplay = counting ? elapsed : remaining;

  const interval = clockIsOurs && currentBlock.mode === 'emom' ? blockInterval(blockTimer) : null;
  const roundsDone = completedRounds(entries.filter((e) => e.exercise));

  // Rounds split into "banked" and "the one you are in". Banked rounds collapse
  // to a line each; only the open round needs its controls on screen. Twenty
  // rounds of Cindy is otherwise sixty rows to scroll past to reach the button.
  const deepest = Math.max(0, ...entries.map((e) => e.exercise?.sets.length ?? 0));
  // Only a round every member finished collapses to a line. A partial round
  // stays open below, showing what landed and what is outstanding — banking it
  // too would print the same round number twice.
  const loggedRounds = Array.from({ length: deepest }, (_, i) => i).filter((round) =>
    entries.every(({ exercise }) => exercise?.sets[round]?.logged)
  );
  const openRoundIndex =
    Array.from({ length: deepest }, (_, i) => i).find((round) =>
      entries.some(({ exercise }) => exercise?.sets[round] && !exercise.sets[round].logged)
    ) ?? null;

  // The single-movement quick ladder. A timed block leads with its own
  // prescription so the common tap is the prescribed one rather than whichever
  // generic number happens to sit closest.
  const singleTarget = currentTimed ? targetRepCount(currentExercise?.targetReps) : null;
  const GENERIC_REPS = [5, 8, 10, 12];
  const quickReps =
    singleTarget !== null && !GENERIC_REPS.includes(singleTarget)
      ? [singleTarget, ...GENERIC_REPS.slice(0, 3)]
      : GENERIC_REPS;

  // The one-tap path only exists when every movement has a number to log. A
  // circuit member whose reps read "max" has no prescription to fire.
  const roundFullyPrescribed =
    openRoundIndex !== null &&
    entries.every(({ exercise }) => targetRepCount(exercise?.targetReps) !== null);

  // Navigation moves by BLOCK, not by exercise. Stepping into the middle of a
  // circuit would show one movement of a round you are working through as a
  // whole, and "Next: Push-ups" is a lie when the push-ups are already on
  // screen.
  const groups = groupIntoBlocks(exercises, blocks);
  const groupIndex = Math.max(
    0,
    groups.findIndex((g) => g.entries.some((e) => e.index === currentExerciseIndex))
  );
  const isLastGroup = groupIndex >= groups.length - 1;
  const nextGroup = groups[groupIndex + 1];
  const nextGroupLabel =
    nextGroup && nextGroup.entries.length > 1
      ? 'Circuit'
      : (nextGroup?.entries[0]?.exercise?.name ?? '');

  // Reactive last-used weight for the current exercise — drives the chip-row
  // hint AND mirrors what the next quick-tap will log. Subscribing (rather
  // than calling getLastWeight in render) means a modal save instantly
  // re-renders the chips with the new weight.
  const currentWeight = useWeightHistoryStore(
    (state) => state.history[currentExercise.id]?.lastWeight ?? null
  );
  // Pre-#42 history has no unit recorded — it was all logged in lb.
  const currentWeightUnit = useWeightHistoryStore(
    (state) => state.history[currentExercise.id]?.lastUnit ?? 'lb'
  );
  const units = useSettingsStore((state) => state.units);
  const hasWeight = currentWeight !== null && currentWeight > 0;
  // Only auto-fill quick-taps when the remembered weight was logged in the
  // CURRENT unit — silently reusing "135" across a lb→kg switch would log a
  // wildly different real-world load. No conversion (issue #42).
  const weightUnitMatches = currentWeightUnit === units;

  // Quick log from preset buttons.
  //
  // The fast path must capture real weight, not null (audit A4 / issue #22).
  // We auto-fill from the exercise's last-used weight in weightHistoryStore —
  // the same store the modal path writes to — so quick-taps produce
  // volume/PR-real data without breaking the 3-second rule.
  //
  // Fallback is `undefined` (→ stored as `null`) when there's no history or
  // the stored value is non-positive. We deliberately do NOT fall back to 0:
  // logSet's `weight ?? null` would store 0, `saveWeight(id, 0)` would pollute
  // weightHistory so the next chip shows "@ 0 lb", and the summary's volume
  // calc treats null and 0 identically (`(weight ?? 0) * reps`). Null keeps
  // the set volume-neutral, history-clean, and PR-silent.
  const handleQuickLog = (exerciseIndex: number, setIndex: number, reps: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const lastWeight = getLastWeight(exercise.id);
    const quickWeight = lastWeight && lastWeight > 0 && weightUnitMatches ? lastWeight : undefined;

    haptics.success();
    logSet(exerciseIndex, setIndex, reps, quickWeight);
    afterLog(exerciseIndex, setIndex);
  };

  // What happens once a set lands.
  //
  // In a set scheme that's rest. In a timed block it's the opposite — the clock
  // is the whole constraint, so nothing may cover the rows, and the next round
  // opens instead of a rest overlay.
  //
  // The round opens for EVERY member at once, not just the one just logged.
  // Round index is what pairs the movements: if the squats could run ahead,
  // round 3 of the squats would sit beside round 2 of the pull-ups.
  const afterLog = (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    if (currentTimed) {
      // Only the open-ended modes grow. `for_time` and `emom` have a planned
      // round count and stop there.
      if (!isOpenEnded(currentBlock.mode)) return;

      // The next round opens when the round CLOSES — when the last movement of
      // it lands — not when any one movement is logged. Keying off row counts
      // instead fires on the first movement of the round and grows only that
      // one, leaving the circuit ragged.
      //
      // Read fresh state: the set that triggered this is not in the render
      // closure's copy of `exercises` yet.
      const fresh = useWorkoutStore.getState().exercises;
      const members = entries.map((e) => e.index);
      const roundClosed = members.every((i) => fresh[i]?.sets[setIndex]?.logged);

      if (roundClosed) openRound(members);
      return;
    }

    if (usesRestTimer(currentBlock.mode)) {
      startRestTimer(exercise.restSeconds);
    }
  };

  // Open modal for custom input. Takes the exercise index explicitly: inside a
  // circuit the row you tapped may belong to any member, not the current one.
  const handleOpenCustomInput = (exerciseIndex: number, setIndex: number) => {
    haptics.tap();
    setSetEdit({
      exerciseIndex,
      setIndex,
      visible: true,
    });
  };

  // Open modal to edit existing set
  const handleEditSet = (exerciseIndex: number, setIndex: number) => {
    haptics.tap();
    setSetEdit({
      exerciseIndex,
      setIndex,
      visible: true,
    });
  };

  // Save from modal (new set)
  const handleModalSave = (reps: number, weight?: number) => {
    // Read the set off the exercise being edited, not the current one — inside
    // a circuit those differ, and asking the wrong exercise would treat an edit
    // as a fresh log and re-open a round that is already open.
    const set = exercises[setEdit.exerciseIndex]?.sets[setEdit.setIndex];

    if (set?.logged) {
      // Editing existing set - don't restart timer
      editSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
    } else {
      // New set - log, then rest (sets) or open the next round (timed block)
      logSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
      afterLog(setEdit.exerciseIndex, setEdit.setIndex);
    }
  };

  // Clear set from modal
  const handleModalClear = () => {
    clearSet(setEdit.exerciseIndex, setEdit.setIndex);
  };

  // Close modal
  const handleCloseModal = () => {
    setSetEdit((prev) => ({ ...prev, visible: false }));
  };

  // "End" means "throw this session away" — the opposite of "Finish". With any
  // logged sets still unclaimed, force a confirm so a mis-tap can't discard
  // real work (audit A1 / issue #20). Empty sessions end with no friction.
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
    if (restTimer.paused) {
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

  // One line of plain instruction under the clock. Each mode is bounded by a
  // different thing, so each needs to say a different thing.
  const blockHint = (): string => {
    if (clockPaused) return 'Paused.';

    switch (currentBlock.mode) {
      case 'amrap_rounds':
        return clockFinished
          ? 'Time — finish the round you’re in, then move on.'
          : clockRunning
            ? 'One tap banks the whole round.'
            : 'As many rounds as possible in the window.';
      case 'amrap_reps':
        return clockFinished
          ? 'Time — finish the round you’re in, then move on.'
          : clockRunning
            ? 'Log each round as you finish it. No rest timer here.'
            : 'As many reps as possible in the window.';
      case 'for_time':
        return clockFinished
          ? `Finished in ${formatClock(elapsed)}.`
          : clockRunning
            ? 'Clock is up. Hit Done the moment the last round lands.'
            : `${currentBlock.rounds} rounds, as fast as you can.`;
      case 'emom':
        return clockFinished
          ? 'Done.'
          : clockRunning
            ? 'Work at the top of each minute. Rest whatever is left of it.'
            : `${currentBlock.rounds} intervals of ${formatClock(currentBlock.intervalSeconds)}.`;
      default:
        return '';
    }
  };

  // Get the set being edited
  const editingSet = exercises[setEdit.exerciseIndex]?.sets[setEdit.setIndex];

  // Get the exercise being edited to retrieve suggested weight from history
  const editingExercise = exercises[setEdit.exerciseIndex];
  const editingLastUnit = editingExercise
    ? (useWeightHistoryStore.getState().history[editingExercise.id]?.lastUnit ?? 'lb')
    : 'lb';
  const suggestedWeight =
    editingExercise && editingLastUnit === units ? getLastWeight(editingExercise.id) : null;

  if (!active || !currentExercise) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active workout</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Rest Timer Overlay */}
      {restTimer.running && (
        <Pressable style={styles.restOverlay} onPress={handleSkipRest}>
          {/* Rest is the one moment in a session with time to look at a diagram,
              so here it's open by default rather than behind a toggle. */}
          <ExerciseDemo exerciseId={currentExercise.id.replace(/-\d+$/, '')} variant="overlay" />

          <Text style={styles.restLabel}>{restTimer.paused ? 'Paused' : 'Rest'}</Text>
          <RestTimerRing
            remaining={restTimer.remaining}
            total={restTimer.duration}
            paused={restTimer.paused}
            size={200}
          >
            <Text style={[styles.restTimer, restTimer.remaining === 0 && styles.restTimerReady]}>
              {formatClock(restTimer.remaining)}
            </Text>
          </RestTimerRing>

          {restTimer.remaining === 0 ? (
            <Text style={styles.readyText}>Tap to continue</Text>
          ) : (
            <View style={styles.restControls}>
              <Pressable
                style={styles.restControlButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleTogglePause();
                }}
              >
                <Text style={styles.restControlText}>{restTimer.paused ? 'Resume' : 'Pause'}</Text>
              </Pressable>
              <Pressable
                style={styles.restControlButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleSkipRest();
                }}
              >
                <Text style={styles.restControlText}>Skip</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.tapHint}>Tap anywhere to skip</Text>
        </Pressable>
      )}

      {/* Session Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable
          onPress={handlePreviousExercise}
          disabled={currentExerciseIndex === 0}
          style={styles.navArrow}
          accessibilityRole="button"
          accessibilityLabel="Previous exercise"
        >
          {/* Was a literal '<' in a Text node — missed in the glyph sweep
              because it's written as a JSX expression, not a bare character. */}
          <ChevronLeft
            size={22}
            color={currentExerciseIndex === 0 ? roles.textMuted : roles.textSecondary}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.totalReps}>Total: {totalReps} reps</Text>
          <Text style={styles.exerciseCount}>
            {currentExerciseIndex + 1} / {exercises.length}
          </Text>
        </View>

        <Pressable onPress={handleEndSession}>
          <Text style={styles.endButton}>End</Text>
        </Pressable>
      </View>

      {/* Current Exercise */}
      <ScrollView style={styles.exerciseScroll} contentContainerStyle={styles.exerciseContent}>
        <View style={styles.exerciseCard}>
          {isCircuit ? (
            <>
              {/* In a circuit the prescription IS the workout, so it sits at
                  the top as a list rather than being spread across cards you
                  have to tab between. */}
              <Text style={styles.exerciseName}>Circuit</Text>
              <View style={styles.prescription}>
                {entries.map(({ exercise, index }) => (
                  <View key={exercise?.id ?? index} style={styles.prescriptionRow}>
                    <Text style={styles.prescriptionReps}>{exercise?.targetReps ?? '—'}</Text>
                    <Text style={styles.prescriptionName}>{exercise?.name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseMeta}>{currentExercise.muscleGroups.join(', ')}</Text>

              {/* Collapsed by default — the 3-second rule means logging a set
                  must never be behind a picture. Opt in when you want it. */}
              <ExerciseDemo exerciseId={currentExercise.id.replace(/-\d+$/, '')} />
            </>
          )}

          {/* The block clock. Inline rather than a full-screen overlay like
              rest: the whole point of a timed block is to keep logging while it
              runs, so it must never cover the rows. */}
          {currentTimed && (
            <View style={styles.amrapCard}>
              <View style={styles.amrapHeader}>
                <Text style={styles.amrapLabel}>{describeBlock(currentBlock)}</Text>
                <Text
                  style={[
                    styles.amrapClock,
                    clockRunning && styles.amrapClockRunning,
                    clockFinished && styles.amrapClockDone,
                  ]}
                >
                  {formatClock(clockDisplay)}
                </Text>
              </View>

              {/* EMOM's own clock is the interval, not the total. The minute
                  you are on is the number you act on. */}
              {interval && !clockFinished && (
                <View style={styles.amrapHeader}>
                  <Text style={styles.amrapHint}>
                    Minute {Math.min(interval.index + 1, currentBlock.rounds)} of{' '}
                    {currentBlock.rounds}
                  </Text>
                  <Text style={styles.intervalClock}>{formatClock(interval.remaining)}</Text>
                </View>
              )}

              <Text style={styles.amrapHint}>{blockHint()}</Text>

              {isCircuit && (
                <Text style={styles.roundTally}>
                  {roundsDone} {roundsDone === 1 ? 'round' : 'rounds'} complete
                </Text>
              )}

              <View style={styles.amrapControls}>
                {clockIsOurs && !clockFinished ? (
                  <Pressable style={styles.amrapButton} onPress={handleToggleBlockPause}>
                    <Text style={styles.amrapButtonText}>{clockPaused ? 'Resume' : 'Pause'}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.amrapButton, styles.amrapButtonPrimary]}
                    onPress={handleStartBlock}
                  >
                    <Text style={[styles.amrapButtonText, styles.amrapButtonTextPrimary]}>
                      {clockFinished ? 'Restart' : 'Start'}
                    </Text>
                  </Pressable>
                )}

                {/* Only a count-up block needs a finish button: its result IS
                    the elapsed time, and nothing else can stop the clock. */}
                {counting && clockIsOurs && !clockFinished && (
                  <Pressable
                    style={[styles.amrapButton, styles.amrapButtonPrimary]}
                    onPress={handleFinishBlock}
                  >
                    <Text style={[styles.amrapButtonText, styles.amrapButtonTextPrimary]}>
                      Done
                    </Text>
                  </Pressable>
                )}

                {clockIsOurs && !clockFinished && (
                  <Pressable style={styles.amrapButton} onPress={handleResetBlock}>
                    <Text style={styles.amrapButtonText}>Reset</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Rounds — the circuit view.

              A circuit is worked as a unit: five pull-ups, ten push-ups,
              fifteen squats, THEN you have finished a round. So the primary
              action is one button for the whole round. Logging it movement by
              movement was three taps for something done as one thing, and over
              twenty rounds of Cindy that is sixty taps against a running clock.

              Per-movement logging is still here, demoted, because a round that
              the clock cuts short is real and has to be recordable. */}
          {isCircuit && (
            <View style={styles.setsContainer}>
              {/* Rounds already banked. One line each — twenty rounds must not
                  become sixty rows of scroll. Tap a rep count to correct it. */}
              {loggedRounds.map((round) => (
                <View key={`done-${round}`} style={styles.roundDoneRow}>
                  <Text style={styles.roundDoneLabel}>Round {round + 1}</Text>
                  <View style={styles.roundDoneReps}>
                    {entries.map(({ exercise, index }) => {
                      const set = exercise?.sets[round];
                      if (!exercise || !set?.logged) return null;
                      return (
                        <Pressable
                          key={exercise.id}
                          onPress={() => handleEditSet(index, round)}
                          style={styles.roundDoneChip}
                        >
                          <Text style={styles.roundDoneChipText}>{set.reps}</Text>
                          {set.isPR && <Text style={styles.prBadge}>PR</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* The round in progress. */}
              {openRoundIndex !== null && (
                <Settle from={0.98}>
                  <View style={styles.roundGroup}>
                    <Text style={styles.roundHeading}>Round {openRoundIndex + 1}</Text>

                    {/* The one tap that matters. Logs every movement at its
                        prescription and opens the next round. */}
                    {roundFullyPrescribed && (
                      <Pressable style={styles.roundDoneButton} onPress={handleLogRound}>
                        <Text style={styles.roundDoneButtonText}>Round done</Text>
                        <Text style={styles.roundDoneButtonMeta}>
                          {entries
                            .map(({ exercise }) => targetRepCount(exercise?.targetReps))
                            .join(' · ')}
                        </Text>
                      </Pressable>
                    )}

                    {/* The partial path. Deliberately quiet: it is what you
                        reach for when the clock beat you, not the default. */}
                    <Text style={styles.partialLabel}>
                      {roundFullyPrescribed ? 'Or log one at a time' : 'Log each movement'}
                    </Text>

                    {entries.map(({ exercise, index }) => {
                      const set = exercise?.sets[openRoundIndex];
                      if (!exercise || !set) return null;
                      const target = targetRepCount(exercise.targetReps);

                      return (
                        <View key={exercise.id} style={styles.circuitRow}>
                          <Text style={styles.circuitName} numberOfLines={1}>
                            {exercise.name}
                          </Text>

                          {set.logged ? (
                            <Settle from={0.96}>
                              <PRFlash active={set.isPR} style={styles.prFlashWrapper}>
                                <Pressable
                                  style={styles.circuitLogged}
                                  onPress={() => handleEditSet(index, openRoundIndex)}
                                >
                                  <Text style={styles.loggedReps}>{set.reps}</Text>
                                  {set.weight ? (
                                    <Text style={styles.loggedWeight}>
                                      @ {set.weight} {units}
                                    </Text>
                                  ) : null}
                                  {set.isPR && <Text style={styles.prBadge}>PR!</Text>}
                                </Pressable>
                              </PRFlash>
                            </Settle>
                          ) : (
                            <View style={styles.circuitButtons}>
                              {target !== null && (
                                <Pressable
                                  style={styles.circuitTargetButton}
                                  onPress={() => handleQuickLog(index, openRoundIndex, target)}
                                >
                                  <Text style={styles.circuitTargetText}>{target}</Text>
                                </Pressable>
                              )}
                              <Pressable
                                style={styles.customButton}
                                onPress={() => handleOpenCustomInput(index, openRoundIndex)}
                              >
                                <Text style={styles.customButtonText}>...</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </Settle>
              )}
            </View>
          )}

          {/* Sets — the single-movement view. */}
          {!isCircuit && (
            <View style={styles.setsContainer}>
              {currentExercise.sets.map((set, index) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: set positions are stable and never reordered
                  key={index}
                  style={styles.setRow}
                >
                  <View style={styles.setRowHeader}>
                    <Text style={styles.setNumber}>
                      {currentTimed ? `Round ${index + 1}` : `Set ${index + 1}`}
                    </Text>
                    {!set.logged && (
                      <Text style={styles.weightHint}>
                        {hasWeight
                          ? weightUnitMatches
                            ? `@ ${currentWeight} ${currentWeightUnit} · tap ... to change`
                            : `last: ${currentWeight} ${currentWeightUnit} · tap ... to set ${units}`
                          : 'no weight · tap ... to set'}
                      </Text>
                    )}
                  </View>

                  {set.logged ? (
                    <Settle from={0.96}>
                      <PRFlash active={set.isPR} style={styles.prFlashWrapper}>
                        <Pressable
                          style={styles.loggedSet}
                          onPress={() => handleEditSet(currentExerciseIndex, index)}
                        >
                          <Text style={styles.loggedReps}>{set.reps} reps</Text>
                          {set.weight && (
                            <Text style={styles.loggedWeight}>
                              @ {set.weight} {units}
                            </Text>
                          )}
                          {set.isPR && <Text style={styles.prBadge}>PR!</Text>}
                          <Text style={styles.editHint}>tap to edit</Text>
                        </Pressable>
                      </PRFlash>
                    </Settle>
                  ) : (
                    <View style={styles.logButtons}>
                      {quickReps.map((reps) => {
                        // Inside a timed block the prescription leads and is
                        // highlighted — same one-tap rule as a circuit. A set
                        // scheme keeps the plain generic ladder it always had.
                        const isTarget = currentTimed && reps === singleTarget;
                        return (
                          <Pressable
                            key={reps}
                            style={[styles.logButton, isTarget && styles.logButtonTarget]}
                            onPress={() => handleQuickLog(currentExerciseIndex, index, reps)}
                          >
                            <Text
                              style={[styles.logButtonText, isTarget && styles.logButtonTextTarget]}
                            >
                              {reps}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        style={styles.customButton}
                        onPress={() => handleOpenCustomInput(currentExerciseIndex, index)}
                      >
                        <Text style={styles.customButtonText}>...</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

              {/* Rounds are open-ended. Logging the last row opens the next one
                automatically; this is the manual escape hatch (e.g. after
                clearing a row, or to queue one up before you start). */}
              {isOpenEnded(currentBlock.mode) && (
                <Pressable
                  style={styles.addRoundButton}
                  onPress={() => {
                    haptics.tap();
                    addSet(currentExerciseIndex);
                  }}
                >
                  <Text style={styles.addRoundText}>Add round</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navigation, { paddingBottom: insets.bottom + spacing[2] }]}>
        <Pressable
          style={[styles.navButton, isLastGroup && styles.finishButton]}
          onPress={isLastGroup ? handleFinishWorkout : handleNextExercise}
        >
          <Text style={[styles.navButtonText, isLastGroup && styles.navButtonTextFinish]}>
            {isLastGroup ? 'Finish Workout' : `Next: ${nextGroupLabel}`}
          </Text>
        </Pressable>

        {/* Block list. One tab per block, so a three-movement circuit is one
            destination rather than three that all show the same rounds. */}
        <ScrollView style={styles.exerciseList} horizontal showsHorizontalScrollIndicator={false}>
          {groups.map((group, index) => {
            const first = group.entries[0];
            if (!first?.exercise) return null;
            const label =
              group.entries.length > 1 ? 'Circuit' : (first.exercise.name ?? 'Exercise');

            return (
              <Pressable
                key={first.exercise.id}
                style={[
                  styles.exerciseTab,
                  index === groupIndex && styles.exerciseTabActive,
                  group.entries.every((e) => e.exercise?.completed) && styles.exerciseTabCompleted,
                ]}
                onPress={() => handleExerciseTabPress(first.index)}
              >
                <Text
                  style={[
                    styles.exerciseTabText,
                    index === groupIndex && styles.exerciseTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Set Input Modal */}
      <SetInputModal
        visible={setEdit.visible}
        onClose={handleCloseModal}
        onSave={handleModalSave}
        onClear={editingSet?.logged ? handleModalClear : undefined}
        initialReps={editingSet?.reps ?? 10}
        initialWeight={editingSet?.weight}
        suggestedWeight={suggestedWeight}
        setNumber={setEdit.setIndex + 1}
        // The exercise being EDITED, not the current one. Inside a circuit the
        // row you tapped can belong to any member, and labelling the sheet with
        // the block's first movement told you you were editing the wrong thing.
        exerciseName={editingExercise?.name ?? currentExercise.name}
        unitLabel={currentTimed ? 'Round' : 'Set'}
        isEditing={editingSet?.logged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  backButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  backButtonText: {
    ...textStyles.button,
    color: colors.text.primary,
  },
  restOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary + 'E6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  restLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
    // Clears the ring's top edge — at spacing[2] the label sat on the arc.
    marginBottom: spacing[4],
  },
  restTimer: {
    // Was colors.timer.resting — a cool blue from the old palette, and the
    // only blue left anywhere in the app. The ring carries the state now, so
    // the number just has to be readable.
    ...textStyles.hero,
    fontSize: 48,
    color: roles.textPrimary,
  },
  restTimerReady: {
    color: roles.accent,
  },
  readyText: {
    ...textStyles.body,
    color: colors.timer.ready,
    marginTop: spacing[4],
  },
  restControls: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[6],
  },
  restControlButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  restControlText: {
    ...textStyles.button,
    color: colors.text.primary,
  },
  tapHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[6],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  navArrow: {
    padding: spacing[2],
  },

  headerCenter: {
    alignItems: 'center',
  },
  totalReps: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  exerciseCount: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  endButton: {
    ...textStyles.button,
    color: colors.danger.DEFAULT,
    padding: spacing[2],
  },
  exerciseScroll: {
    flex: 1,
  },
  exerciseContent: {
    padding: spacing[4],
  },
  exerciseCard: {
    marginBottom: spacing[4],
  },
  exerciseName: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  exerciseMeta: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  amrapCard: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[3],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  amrapHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  amrapLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
  },
  amrapClock: {
    ...textStyles.number,
    fontSize: 28,
    color: roles.textPrimary,
  },
  amrapClockRunning: {
    color: roles.accent,
  },
  amrapClockDone: {
    color: roles.textMuted,
  },
  amrapHint: {
    ...textStyles.caption,
    color: roles.textMuted,
  },
  amrapControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  amrapButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  amrapButtonPrimary: {
    backgroundColor: roles.accent,
  },
  amrapButtonText: {
    ...textStyles.button,
    color: roles.textPrimary,
  },
  amrapButtonTextPrimary: {
    color: colors.background.primary,
  },
  intervalClock: {
    ...textStyles.number,
    fontSize: 20,
    color: roles.accent,
  },
  roundTally: {
    ...textStyles.caption,
    color: roles.textSecondary,
  },
  // The prescription block: dense and tabular, Hevy register. This is a
  // reference you glance at mid-round, not something to decorate.
  prescription: {
    gap: spacing[1],
    marginBottom: spacing[4],
  },
  prescriptionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
  },
  prescriptionReps: {
    ...textStyles.number,
    fontSize: 18,
    color: roles.accent,
    minWidth: 44,
  },
  prescriptionName: {
    ...textStyles.body,
    color: roles.textPrimary,
  },
  // A banked round: one line, tap a number to correct it.
  roundDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
  },
  roundDoneLabel: {
    ...textStyles.caption,
    color: roles.textSecondary,
  },
  roundDoneReps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  roundDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
  },
  roundDoneChipText: {
    ...textStyles.number,
    fontSize: 15,
    color: roles.textPrimary,
  },
  // The one tap that matters. Sized like it.
  roundDoneButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
  },
  roundDoneButtonText: {
    ...textStyles.button,
    fontSize: 17,
    color: colors.background.primary,
  },
  roundDoneButtonMeta: {
    ...textStyles.caption,
    color: colors.background.primary,
    opacity: 0.8,
  },
  partialLabel: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[1],
  },
  circuitTargetButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: roles.border,
  },
  circuitTargetText: {
    ...textStyles.number,
    fontSize: 15,
    color: roles.textPrimary,
  },
  roundGroup: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  roundHeading: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
  },
  circuitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  circuitName: {
    ...textStyles.body,
    color: roles.textPrimary,
    flex: 1,
  },
  circuitButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  circuitLogged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
  },
  logButtonTarget: {
    backgroundColor: roles.accent,
  },
  logButtonTextTarget: {
    color: colors.background.primary,
  },
  addRoundButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  addRoundText: {
    ...textStyles.button,
    color: roles.accentText,
  },
  setsContainer: {
    gap: spacing[3],
  },
  setRow: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  setRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  setNumber: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  weightHint: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  prFlashWrapper: {
    borderRadius: radius.md,
  },
  loggedSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  loggedReps: {
    // Was colors.semantic.success — the only green in the app, on the surface
    // you look at most. A logged set is the normal case, not a success state;
    // the Settle animation already marks that it landed.
    ...textStyles.numberSmall,
    color: roles.textPrimary,
  },
  loggedWeight: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  prBadge: {
    ...textStyles.label,
    color: colors.reward.pr,
    backgroundColor: colors.reward.pr + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  editHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginLeft: 'auto',
  },
  logButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  logButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  logButtonText: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
  },
  customButton: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  customButtonText: {
    ...textStyles.numberSmall,
    color: colors.text.secondary,
    letterSpacing: 2,
  },
  navigation: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    backgroundColor: colors.background.primary,
  },
  navButton: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  finishButton: {
    backgroundColor: colors.reward.fp,
  },
  navButtonText: {
    ...textStyles.buttonLarge,
    color: colors.text.primary,
  },
  navButtonTextFinish: {
    color: colors.background.primary,
  },
  exerciseList: {
    maxHeight: 50,
  },
  exerciseTab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginRight: spacing[2],
  },
  exerciseTabActive: {
    backgroundColor: colors.reward.fp,
  },
  exerciseTabCompleted: {
    opacity: 0.6,
  },
  exerciseTabText: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
  exerciseTabTextActive: {
    color: colors.background.primary,
    fontWeight: '600',
  },
});
