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
import { amrapDuration, formatAmrapWindow, isAmrap } from '@/lib/amrap';
import { type WorkoutSummary, calculateWorkoutSummary } from '@/lib/workout-summary';
import {
  useBaselineStore,
  usePlayerStore,
  useWorkoutHistoryStore,
  useWorkoutStore,
} from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Flame } from 'lucide-react-native';

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

  // Post-save UI state: swaps the footer to a deliberate "Done" rather than
  // auto-exiting the screen that closes out a workout.
  const [justClaimed, setJustClaimed] = useState(false);

  const summary: WorkoutSummary | null = useMemo(() => {
    if (!log) return null;
    return calculateWorkoutSummary(log.exercises, log.durationSeconds);
  }, [log]);

  const handleFinish = () => {
    if (!summary || !log) return;

    // Idempotency boundary: the first save returns the log, every replay
    // returns null and we no-op. This is the URL-replay fix (issue #16).
    const claimed = useWorkoutHistoryStore.getState().saveWorkout(log.id);
    if (!claimed) return;

    haptics.success();

    // Update streak
    usePlayerStore.getState().updateStreak(true);

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

    // End the session; the log is already persisted in history. Stay on the
    // summary — the UX spec wants a deliberate next action, not an auto-exit.
    useWorkoutStore.getState().endSession();
    setJustClaimed(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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

        {/* Streak state + milestone celebration */}
        <RevealRow index={1} style={styles.streakCard}>
          <Flame size={18} color={roles.accent} strokeWidth={2} />
          <Text style={styles.streakText}>
            {log.streakDays} day streak
            {STREAK_MILESTONES.includes(log.streakDays) ? ' — milestone' : ''}
          </Text>
        </RevealRow>

        {/* Stats */}
        <RevealRow index={2} style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(summary.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{summary.totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{summary.totalReps}</Text>
            <Text style={styles.statLabel}>Reps</Text>
          </View>
        </RevealRow>

        {/* Exercise Summary */}
        <RevealRow index={3} style={styles.exercisesCard}>
          <Text style={styles.exercisesTitle}>Exercises Completed</Text>

          {summary.exercises.map((exercise) => {
            const loggedSets = exercise.sets.filter((s) => s.logged);
            const exerciseReps = loggedSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);

            return (
              <View key={exercise.id} style={styles.exerciseRow}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseSets}>
                    {isAmrap(exercise)
                      ? `${loggedSets.length} rounds · ${exerciseReps} reps · ${formatAmrapWindow(
                          amrapDuration(exercise)
                        )}`
                      : `${loggedSets.length} sets · ${exerciseReps} reps`}
                  </Text>
                </View>
                {exercise.sets.some((s) => s.isPR) && (
                  <View style={styles.prTag}>
                    <Text style={styles.prTagText}>PR</Text>
                  </View>
                )}
              </View>
            );
          })}
        </RevealRow>
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
  fpCard: {
    backgroundColor: colors.reward.fp + '20',
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: colors.reward.fp,
  },
  fpLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  fpValue: {
    ...textStyles.hero,
    color: colors.reward.fp,
  },
  fpUnit: {
    ...textStyles.body,
    color: colors.reward.fp,
  },
  breakdownCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  breakdownTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  breakdownLabel: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  breakdownValue: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  breakdownValueHighlight: {
    ...textStyles.body,
    color: colors.reward.fp,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.ui.border,
    marginHorizontal: spacing[2],
  },
  exercisesCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  exercisesTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  exerciseSets: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  prTag: {
    backgroundColor: colors.reward.pr + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  prTagText: {
    ...textStyles.caption,
    color: colors.reward.pr,
    fontWeight: '600',
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
  // `finishButton` carries no flex of its own. In the tracker build it's the
  // lone child of the post-claim row, so flex:1 keeps it full-width — matching
  // the pre-claim state instead of shrinking to the text.
  postClaimSolo: {
    flex: 1,
  },
  denButton: {
    flex: 2,
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  doneButtonText: {
    ...textStyles.buttonLarge,
    color: colors.text.primary,
  },
  radarCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  radarWrapper: {
    alignItems: 'center',
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
