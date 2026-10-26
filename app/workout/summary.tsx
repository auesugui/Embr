// =============================================================================
// IronQuest Workout Summary Screen
// =============================================================================
// Reads a workout by ID (never a full payload from URL params), renders the FP
// breakdown, and claims rewards exactly once. The idempotency guard lives in
// the history store's `claimRewards` (checks `claimedAt`); this screen only
// awards FP when that call returns a log. Reloading the summary URL restores
// the already-claimed log from storage, so a second "claim" is a no-op.

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RevealRow } from '@/components/celebration';
import { WeeklyGoalPrompt } from '@/components/goal';
import { Flame } from '@/components/icons';
import { SummaryExercises } from '@/components/workout/summary/SummaryExercises';
import { SummaryPRs } from '@/components/workout/summary/SummaryPRs';
import { SummaryStats } from '@/components/workout/summary/SummaryStats';
import { SummaryVolumeChange } from '@/components/workout/summary/SummaryVolumeChange';
import { useLocalDay } from '@/hooks';
import { volumeComparison, workoutLabel } from '@/lib/summary-comparison';
import { sessionRecords } from '@/lib/summary-records';
import { goalInEffect } from '@/lib/weekly-goal';
import { type WorkoutSummary, calculateWorkoutSummary } from '@/lib/workout-summary';
import {
  useBaselineStore,
  usePlayerStore,
  useSettingsStore,
  useTemplateStore,
  useWorkoutHistoryStore,
  useWorkoutStore,
} from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

// Streak milestones celebrated by the docs' streak system (fp-earning.md).
const STREAK_MILESTONES = [3, 7, 14, 30];

export default function WorkoutSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const workoutId = typeof params.workoutId === 'string' ? params.workoutId : undefined;

  // Reactive lookup: undefined until the store hydrates (on reload) or if the
  // id is invalid. The found log reference is stable until claim mutates it.
  const log = useWorkoutHistoryStore((s) =>
    workoutId ? s.logs.find((l) => l.id === workoutId) : undefined
  );
  const hydrated = useWorkoutHistoryStore((s) => s.hydrated);
  // Logs store no unit, so like History this reads the current setting.
  const units = useSettingsStore((s) => s.units);

  // A workout finished at 23:58 is still on screen at 00:02, and the goal the
  // prompt offers belongs to whichever week it is now.
  const today = useLocalDay();
  const weeklyGoals = useSettingsStore((s) => s.weeklyGoals);
  const weeklyGoal = goalInEffect(weeklyGoals, today);

  // Post-save UI state: swaps the footer to a deliberate "Done" rather than
  // auto-exiting the screen that closes out a workout.
  const [justClaimed, setJustClaimed] = useState(false);

  // The weekly-goal ask (issue #78). Local, because the `seen` flag is written
  // the moment the card appears — the card itself has to outlive that write.
  const [goalPromptOpen, setGoalPromptOpen] = useState(false);

  const summary: WorkoutSummary | null = useMemo(() => {
    if (!log) return null;
    return calculateWorkoutSummary(log.exercises, log.durationSeconds);
  }, [log]);

  // Both new blocks read the saved history around this log, so they are
  // recomputed when it is claimed — which is also when the streak line moves.
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const personalTemplates = useTemplateStore((s) => s.templates);

  const records = useMemo(() => (log ? sessionRecords(logs, log) : []), [logs, log]);

  const comparison = useMemo(() => (log ? volumeComparison(logs, log) : null), [logs, log]);

  // Naming the reference is the point of the sentence, so a workout that can no
  // longer be named gets no sentence rather than an unattributed number.
  const comparedTo = useMemo(
    () => workoutLabel(log?.templateId, log?.dayKey, personalTemplates),
    [log?.templateId, log?.dayKey, personalTemplates]
  );

  const handleFinish = () => {
    if (!summary || !log) return;

    // Idempotency boundary: the first save returns the log, every replay
    // returns null and we no-op. This is the URL-replay fix (issue #16).
    const claimed = useWorkoutHistoryStore.getState().saveWorkout(log.id);
    if (!claimed) return;

    haptics.success();

    // The streak is derived from every saved workout, this one included.
    usePlayerStore.getState().syncStreak(useWorkoutHistoryStore.getState().logs);

    // Increment workout count
    usePlayerStore.getState().incrementWorkoutCount();

    // Record per-exercise strength baselines. Nothing reads these today — the
    // FP engine was their only consumer (ADR-0015) — but they're a rolling
    // record of what you've actually been lifting per movement, and that only
    // becomes answerable later if the data keeps accumulating now.
    const baselineStore = useBaselineStore.getState();
    for (const ex of summary.exercises) {
      const loggedSets = ex.sets.filter((s) => s.logged);
      if (loggedSets.length === 0) continue;
      const sessionMax = loggedSets.reduce(
        (max, s) => Math.max(max, (s.weight ?? 0) * (s.reps ?? 0)),
        0
      );
      if (sessionMax > 0) baselineStore.recordSession(ex.id, sessionMax);
    }

    // Ask for a weekly goal once, here, after the first workout anyone ever
    // saves — the one moment they have proved they will log something.
    const settings = useSettingsStore.getState();
    const savedCount = useWorkoutHistoryStore
      .getState()
      .logs.filter((l) => l.claimedAt !== null).length;
    if (savedCount === 1 && !settings.goalPromptSeen) {
      settings.updateSetting('goalPromptSeen', true);
      setGoalPromptOpen(true);
    }

    // End the session; the log is already persisted in history. Stay on the
    // summary — the UX spec wants a deliberate next action, not an auto-exit.
    useWorkoutStore.getState().endSession();
    setJustClaimed(true);
  };

  // Loading state while the history store rehydrates from storage (reload path).
  if (!hydrated) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading summary...</Text>
        </View>
      </View>
    );
  }

  // No log for this id (e.g. stale/invalid link) — nothing to claim, nothing
  // to re-award. This is the safe fallback for the replay exploit.
  if (!log || !summary) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Workout not found.</Text>
          <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.backButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const alreadyClaimed = log.claimedAt !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[6] },
        ]}
      >
        {/* Header. The summary is the one screen that should feel like an
            arrival, so its content enters rather than appearing — the same
            staggered reveal the FP breakdown already used, now available to the
            tracker build, which previously got no motion here at all. */}
        <RevealRow index={0}>
          <View style={styles.header}>
            <Text style={styles.celebration}>Workout complete</Text>
          </View>
        </RevealRow>

        {/* The one thing that is true of this session and no other, so it
            leads — above the streak, which is true of the week. */}
        <SummaryPRs records={records} units={units} revealIndex={1} />

        {/* Streak state + milestone celebration */}
        <RevealRow index={2} style={styles.streakCard}>
          <Flame size={18} color={roles.accent} strokeWidth={2} />
          <Text style={styles.streakText}>
            {log.streakDays} day streak
            {STREAK_MILESTONES.includes(log.streakDays) ? ' — milestone' : ''}
          </Text>
        </RevealRow>

        <SummaryStats summary={summary} units={units} revealIndex={3} />

        {/* Attached to the Volume figure it comments on. */}
        {comparison && comparedTo && (
          <SummaryVolumeChange
            comparison={comparison}
            label={comparedTo}
            units={units}
            revealIndex={4}
          />
        )}

        {/* Under the numbers they just earned, above the set-by-set detail:
            the ask lands once the session has been read, not before it. The ask
            goes after everything the session is reporting. */}
        {goalPromptOpen && (
          <RevealRow index={0}>
            <WeeklyGoalPrompt
              goal={weeklyGoal}
              onChange={(days) => useSettingsStore.getState().setWeeklyGoal(days)}
              onDismiss={() => setGoalPromptOpen(false)}
            />
          </RevealRow>
        )}

        <SummaryExercises
          exercises={summary.exercises}
          blocks={log.blocks}
          blockTimes={log.blockTimes}
          units={units}
          revealIndex={5}
        />
      </ScrollView>

      {/* Footer: save first, then a deliberate next action (UX spec — no
          auto-exit from the screen that closes out a workout) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
        {justClaimed ? (
          <View style={styles.postClaimRow}>
            <Pressable
              style={[styles.finishButton, styles.postClaimSolo]}
              onPress={() => router.replace('/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.finishButtonText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.finishButton, alreadyClaimed && styles.finishButtonClaimed]}
            onPress={handleFinish}
            disabled={alreadyClaimed}
          >
            <Text style={styles.finishButtonText}>
              {alreadyClaimed ? 'Workout Saved' : 'Save Workout'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
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
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  celebration: {
    // The one screen that should feel good rather than efficient — so it's the
    // one screen that gets the display face. Quieter than the 36px gold shout
    // it replaced; warmth comes from the typeface, not the volume.
    ...textStyles.displayLarge,
    color: roles.textPrimary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    backgroundColor: colors.background.primary,
  },
  finishButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  finishButtonClaimed: {
    backgroundColor: colors.background.tertiary,
  },
  postClaimRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  postClaimSolo: {
    flex: 1,
  },
  streakCard: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[4],
    marginBottom: spacing[4],
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakText: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
  },
  finishButtonText: {
    ...textStyles.buttonLarge,
    color: colors.background.primary,
  },
});
