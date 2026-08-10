// =============================================================================
// IronQuest Workout Session Screen
// =============================================================================

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRFlash } from '@/components/celebration';
import { ExerciseDemo } from '@/components/workout/ExerciseDemo';
import { SetInputModal } from '@/components/workout/SetInputModal';
import {
  usePlayerStore,
  useSettingsStore,
  useWeightHistoryStore,
  useWorkoutHistoryStore,
  useWorkoutStore,
} from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
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

  // Store actions
  const logSet = useWorkoutStore((state) => state.logSet);
  const editSet = useWorkoutStore((state) => state.editSet);
  const clearSet = useWorkoutStore((state) => state.clearSet);
  const startRestTimer = useWorkoutStore((state) => state.startRestTimer);
  const pauseRestTimer = useWorkoutStore((state) => state.pauseRestTimer);
  const resumeRestTimer = useWorkoutStore((state) => state.resumeRestTimer);
  const resetRestTimer = useWorkoutStore((state) => state.resetRestTimer);
  const tickRestTimer = useWorkoutStore((state) => state.tickRestTimer);
  const nextExercise = useWorkoutStore((state) => state.nextExercise);
  const previousExercise = useWorkoutStore((state) => state.previousExercise);
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

  const currentExercise = exercises[currentExerciseIndex];
  const totalReps = getTotalReps();

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
  const handleQuickLog = (setIndex: number, reps: number) => {
    if (!currentExercise) return;

    const lastWeight = getLastWeight(currentExercise.id);
    const quickWeight = lastWeight && lastWeight > 0 && weightUnitMatches ? lastWeight : undefined;

    haptics.success();
    logSet(currentExerciseIndex, setIndex, reps, quickWeight);
    startRestTimer(currentExercise.restSeconds);
  };

  // Open modal for custom input
  const handleOpenCustomInput = (setIndex: number) => {
    haptics.tap();
    setSetEdit({
      exerciseIndex: currentExerciseIndex,
      setIndex,
      visible: true,
    });
  };

  // Open modal to edit existing set
  const handleEditSet = (setIndex: number) => {
    haptics.tap();
    setSetEdit({
      exerciseIndex: currentExerciseIndex,
      setIndex,
      visible: true,
    });
  };

  // Save from modal (new set)
  const handleModalSave = (reps: number, weight?: number) => {
    const set = currentExercise?.sets[setEdit.setIndex];

    if (set?.logged) {
      // Editing existing set - don't restart timer
      editSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
    } else {
      // New set - log and start timer
      logSet(setEdit.exerciseIndex, setEdit.setIndex, reps, weight);
      startRestTimer(currentExercise?.restSeconds ?? 90);
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
    });

    router.replace({
      pathname: '/workout/summary',
      params: { workoutId },
    });
  };

  const handleNextExercise = () => {
    haptics.tap();
    if (currentExerciseIndex < exercises.length - 1) {
      nextExercise();
      resetRestTimer();
    }
  };

  const handlePreviousExercise = () => {
    haptics.tap();
    if (currentExerciseIndex > 0) {
      previousExercise();
      resetRestTimer();
    }
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

  const handleExerciseTabPress = (index: number) => {
    haptics.tap();
    setCurrentExercise(index);
    resetRestTimer();
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <Text style={[styles.restTimer, restTimer.remaining === 0 && styles.restTimerReady]}>
            {formatTime(restTimer.remaining)}
          </Text>

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
        >
          <Text
            style={[styles.navArrowText, currentExerciseIndex === 0 && styles.navArrowDisabled]}
          >
            {'<'}
          </Text>
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
          <Text style={styles.exerciseName}>{currentExercise.name}</Text>
          <Text style={styles.exerciseMeta}>{currentExercise.muscleGroups.join(', ')}</Text>

          {/* Collapsed by default — the 3-second rule means logging a set must
              never be behind a picture. Opt in when you want the reminder. */}
          <ExerciseDemo exerciseId={currentExercise.id.replace(/-\d+$/, '')} />

          {/* Sets */}
          <View style={styles.setsContainer}>
            {currentExercise.sets.map((set, index) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: set positions are stable and never reordered
                key={index}
                style={styles.setRow}
              >
                <View style={styles.setRowHeader}>
                  <Text style={styles.setNumber}>Set {index + 1}</Text>
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
                  <PRFlash active={set.isPR} style={styles.prFlashWrapper}>
                    <Pressable style={styles.loggedSet} onPress={() => handleEditSet(index)}>
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
                ) : (
                  <View style={styles.logButtons}>
                    {[5, 8, 10, 12].map((reps) => (
                      <Pressable
                        key={reps}
                        style={styles.logButton}
                        onPress={() => handleQuickLog(index, reps)}
                      >
                        <Text style={styles.logButtonText}>{reps}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={styles.customButton}
                      onPress={() => handleOpenCustomInput(index)}
                    >
                      <Text style={styles.customButtonText}>...</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={[styles.navigation, { paddingBottom: insets.bottom + spacing[2] }]}>
        <Pressable
          style={[
            styles.navButton,
            currentExerciseIndex >= exercises.length - 1 && styles.finishButton,
          ]}
          onPress={
            currentExerciseIndex >= exercises.length - 1 ? handleFinishWorkout : handleNextExercise
          }
        >
          <Text
            style={[
              styles.navButtonText,
              currentExerciseIndex >= exercises.length - 1 && styles.navButtonTextFinish,
            ]}
          >
            {currentExerciseIndex < exercises.length - 1
              ? `Next: ${exercises[currentExerciseIndex + 1]?.name}`
              : 'Finish Workout'}
          </Text>
        </Pressable>

        {/* Exercise List */}
        <ScrollView style={styles.exerciseList} horizontal showsHorizontalScrollIndicator={false}>
          {exercises.map((exercise, index) => (
            <Pressable
              key={exercise.id}
              style={[
                styles.exerciseTab,
                index === currentExerciseIndex && styles.exerciseTabActive,
                exercise.completed && styles.exerciseTabCompleted,
              ]}
              onPress={() => handleExerciseTabPress(index)}
            >
              <Text
                style={[
                  styles.exerciseTabText,
                  index === currentExerciseIndex && styles.exerciseTabTextActive,
                ]}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>
            </Pressable>
          ))}
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
        exerciseName={currentExercise.name}
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
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  restTimer: {
    ...textStyles.hero,
    color: colors.timer.resting,
  },
  restTimerReady: {
    color: colors.timer.ready,
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
  navArrowText: {
    ...textStyles.h3,
    color: colors.text.secondary,
  },
  navArrowDisabled: {
    color: colors.text.muted,
    opacity: 0.5,
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
    ...textStyles.numberSmall,
    color: colors.semantic.success,
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
