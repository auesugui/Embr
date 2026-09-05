// =============================================================================
// IronQuest Workout Session Screen
// =============================================================================

import { AmrapScrim, type ScrimMovement } from '@/components/workout/AmrapScrim';
import { SetInputModal } from '@/components/workout/SetInputModal';
import {
  BlockClockCard,
  BlockHeading,
  CircuitRounds,
  RestOverlay,
  SessionEmpty,
  SessionFooter,
  SessionHeader,
  SetList,
} from '@/components/workout/session';
import { blockHintText, describeBlock, isOpenEnded } from '@/lib/blocks';
import { useSettingsStore, useWeightHistoryStore, useWorkoutStore } from '@/stores';
import { colors, spacing } from '@/theme';
import { haptics } from '@/utils/haptics';
import { deriveSessionView } from '@/workout/sessionView';
import { useSessionActions } from '@/workout/useSessionActions';
import { useSessionTimers } from '@/workout/useSessionTimers';
import { useSetLogging } from '@/workout/useSetLogging';
import { useWorkoutActions } from '@/workout/useWorkoutActions';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkoutSessionScreen() {
  const insets = useSafeAreaInsets();

  // Store state
  const active = useWorkoutStore((state) => state.active);
  const exercises = useWorkoutStore((state) => state.exercises);
  const currentExerciseIndex = useWorkoutStore((state) => state.currentExerciseIndex);
  const restTimer = useWorkoutStore((state) => state.restTimer);
  const blockTimer = useWorkoutStore((state) => state.blockTimer);
  const blockTimes = useWorkoutStore((state) => state.blockTimes);
  const blocks = useWorkoutStore((state) => state.blocks);

  // The store's actions, passed on by spread. Each hook below picks the ones
  // it needs out of the bag rather than the screen re-listing them.
  const actions = useWorkoutActions();

  // Weight history for auto-fill
  const getLastWeight = useWeightHistoryStore((state) => state.getLastWeight);

  /**
   * Whether the running-AMRAP scrim has been dismissed for the current window.
   *
   * Only "Log a partial round" sets it, and only once the window has closed —
   * that's the one moment the detailed rows underneath are the right surface.
   * Starting a block clears it, so the next window opens focused again.
   */
  const [scrimDismissed, setScrimDismissed] = useState(false);

  useSessionTimers({
    restTimer,
    blockTimer,
    tickRestTimer: actions.tickRestTimer,
    tickBlockTimer: actions.tickBlockTimer,
  });

  const totalReps = actions.getTotalReps();

  // Everything the screen renders from, derived in one place. See
  // src/workout/sessionView.ts — it is a pure projection of store state, so the
  // answers can be asserted directly rather than through a rendered screen.
  const view = deriveSessionView({
    exercises,
    blocks,
    currentExerciseIndex,
    blockTimer,
    blockTimes,
    completedSets: actions.getCompletedSets(),
    scrimDismissed,
  });
  const {
    currentExercise,
    currentBlock,
    currentTimed,
    entries,
    isCircuit,
    clockIsOurs,
    clockRunning,
    clockPaused,
    clockFinished,
    clockDisplay,
    counting,
    elapsed,
    interval,
    roundsDone,
    scrimVisible,
    canFinish,
    preStart,
    loggedRounds,
    openRoundIndex,
    singleTarget,
    quickReps,
    roundFullyPrescribed,
    groupIndex,
    isLastGroup,
    footerTabs,
    nextGroupLabel,
  } = view;

  // Reactive last-used weight for the current exercise — drives the chip-row
  // hint AND mirrors what the next quick-tap will log. Subscribing (rather
  // than calling getLastWeight in render) means a modal save instantly
  // re-renders the chips with the new weight.
  //
  // `currentExercise` is undefined for one render whenever the store empties
  // underneath a mounted screen — which is exactly what ending a session does.
  // Optional-chaining here is load-bearing: hooks can't sit below the
  // `!active || !currentExercise` guard, so an unguarded `.id` throws inside
  // the selector and takes the whole tree down before the guard can render.
  const currentWeight = useWeightHistoryStore((state) =>
    currentExercise ? (state.history[currentExercise.id]?.lastWeight ?? null) : null
  );
  // Pre-#42 history has no unit recorded — it was all logged in lb.
  const currentWeightUnit = useWeightHistoryStore((state) =>
    currentExercise ? (state.history[currentExercise.id]?.lastUnit ?? 'lb') : 'lb'
  );
  const units = useSettingsStore((state) => state.units);
  // Only auto-fill quick-taps when the remembered weight was logged in the
  // CURRENT unit — silently reusing "135" across a lb→kg switch would log a
  // wildly different real-world load. No conversion (issue #42).
  const weightUnitMatches = currentWeightUnit === units;

  const {
    setEdit,
    editingSet,
    editingExercise,
    suggestedWeight,
    handleQuickLog,
    openEditor,
    handleModalSave,
    handleModalClear,
    handleCloseModal,
  } = useSetLogging({
    exercises,
    memberIndexes: entries.map((e) => e.index),
    mode: currentBlock.mode,
    timed: currentTimed,
    units,
    weightUnitMatches,
    getLastWeight,
    ...actions,
  });

  // "End" means "throw this session away" — the opposite of "Finish". With any
  // logged sets still unclaimed, force a confirm so a mis-tap can't discard
  // real work (audit A1 / issue #20). Empty sessions end with no friction.
  const {
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
  } = useSessionActions({
    view,
    restPaused: restTimer.paused,
    weightUnitMatches,
    getLastWeight,
    setScrimDismissed,
    ...actions,
  });

  if (!active || !currentExercise) {
    return <SessionEmpty onBack={() => router.back()} />;
  }

  /**
   * Hides the working surface from assistive tech while the scrim covers it.
   *
   * The scrim is opaque, so sighted users see one screen — but without this a
   * screen reader walks straight through it into the very rows the scrim
   * exists to put away, and reports two conflicting sets of controls.
   */
  const behindScrim = scrimVisible
    ? ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        'aria-hidden': true,
      } as const)
    : {};

  const scrimMovements: ScrimMovement[] = entries.map(({ exercise, index }) => ({
    key: exercise?.id ?? String(index),
    reps: exercise?.targetReps ?? null,
    name: exercise?.name ?? 'Exercise',
  }));

  return (
    <View style={styles.container}>
      {/* The running AMRAP. Covers the working surface for exactly as long as
          the window is open — see AmrapScrim for why it's a cover rather than a
          thinned-out version of this screen. */}
      {scrimVisible && (
        <AmrapScrim
          title={describeBlock(currentBlock)}
          elapsed={elapsed}
          duration={currentBlock.durationSeconds}
          roundsDone={roundsDone}
          movements={scrimMovements}
          paused={clockPaused}
          finished={clockFinished}
          onRoundDone={roundFullyPrescribed ? handleLogRound : null}
          onFinish={isLastGroup ? handleFinishWorkout : handleNextExercise}
          finishLabel={isLastGroup ? 'Finish workout' : `Next: ${nextGroupLabel}`}
          onTogglePause={handleToggleBlockPause}
          onLogPartial={() => {
            haptics.tap();
            setScrimDismissed(true);
          }}
        />
      )}

      {restTimer.running && (
        <RestOverlay
          exerciseId={currentExercise.id.replace(/-\d+$/, '')}
          remaining={restTimer.remaining}
          duration={restTimer.duration}
          paused={restTimer.paused}
          onSkip={handleSkipRest}
          onTogglePause={handleTogglePause}
        />
      )}

      <View {...behindScrim}>
        <SessionHeader
          totalReps={totalReps}
          position={currentExerciseIndex + 1}
          total={exercises.length}
          canGoBack={currentExerciseIndex > 0}
          paddingTop={insets.top + spacing[2]}
          onPrevious={handlePreviousExercise}
          onEnd={handleEndSession}
        />
      </View>

      {/* Current Exercise */}
      <ScrollView
        {...behindScrim}
        style={styles.exerciseScroll}
        contentContainerStyle={styles.exerciseContent}
      >
        <View style={styles.exerciseCard}>
          <BlockHeading entries={entries} />

          {currentTimed && (
            <BlockClockCard
              title={describeBlock(currentBlock)}
              clock={clockDisplay}
              running={clockRunning}
              paused={clockPaused}
              finished={clockFinished}
              isOurs={clockIsOurs}
              countsUp={counting}
              hint={blockHintText({
                mode: currentBlock.mode,
                running: clockRunning,
                paused: clockPaused,
                finished: clockFinished,
                elapsed,
                rounds: currentBlock.rounds,
                intervalSeconds: currentBlock.intervalSeconds,
              })}
              intervalLabel={
                interval
                  ? `Minute ${Math.min(interval.index + 1, currentBlock.rounds)} of ${currentBlock.rounds}`
                  : null
              }
              intervalRemaining={interval?.remaining ?? null}
              roundsDone={isCircuit && !preStart ? roundsDone : null}
              onStart={handleStartBlock}
              onTogglePause={handleToggleBlockPause}
              onReset={handleResetBlock}
              onFinish={handleFinishBlock}
            />
          )}

          {/* Rounds — worked as a unit. See CircuitRounds. */}
          {isCircuit && !preStart && (
            <CircuitRounds
              entries={entries}
              loggedRounds={loggedRounds}
              openRoundIndex={openRoundIndex}
              roundFullyPrescribed={roundFullyPrescribed}
              units={units}
              onLogRound={handleLogRound}
              onQuickLog={handleQuickLog}
              onCustomInput={openEditor}
              onEditSet={openEditor}
            />
          )}

          {/* Sets — the single-movement view. */}
          {!isCircuit && !preStart && (
            <SetList
              exercise={currentExercise}
              exerciseIndex={currentExerciseIndex}
              timed={currentTimed}
              quickReps={quickReps}
              target={singleTarget}
              units={units}
              lastWeight={currentWeight}
              lastWeightUnit={currentWeightUnit}
              unitMatches={weightUnitMatches}
              canAddRound={isOpenEnded(currentBlock.mode)}
              onQuickLog={handleQuickLog}
              onCustomInput={openEditor}
              onEditSet={openEditor}
              onAddRound={() => {
                haptics.tap();
                actions.addSet(currentExerciseIndex);
              }}
            />
          )}
        </View>
      </ScrollView>

      <View {...behindScrim}>
        <SessionFooter
          paddingBottom={insets.bottom + spacing[2]}
          tabs={footerTabs}
          activeIndex={groupIndex}
          isLastGroup={isLastGroup}
          nextLabel={nextGroupLabel}
          canFinish={canFinish}
          emptyHint={
            currentTimed
              ? 'Start the clock to begin, or go back to leave.'
              : 'Log a set to begin, or go back to leave.'
          }
          onPrimary={isLastGroup ? handleFinishWorkout : handleNextExercise}
          onSelectTab={handleExerciseTabPress}
        />
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
  exerciseCard: {
    marginBottom: spacing[4],
  },
  exerciseContent: {
    padding: spacing[4],
  },
  exerciseScroll: {
    flex: 1,
  },
});
