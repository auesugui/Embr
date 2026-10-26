// =============================================================================
// Embr Progress Tab
// =============================================================================
// Hevy register (ADR-0013): a working surface. Dense, tabular, undecorated —
// no serif, no hero, no spacing for its own sake. Everything on it is derived
// from logged history (src/lib/exercise-progress.ts); nothing new is stored.
//
// This is also where Workout History lives now. It used to be a row at the
// bottom of Home, which made Home both the screen you arrive at and the way
// into looking backwards. Progress is the one place you look backwards:
// sessions at the top, exercises below.

import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronRight } from '@/components/icons';
import { ExerciseProgressRow } from '@/components/progress/ExerciseProgressRow';
import { MuscleBalanceCard } from '@/components/progress/MuscleBalanceCard';
import { ProgressEmpty } from '@/components/progress/ProgressEmpty';
import { PressableScale } from '@/components/ui';
import { useLocalDay } from '@/hooks/useLocalDay';
import { buildExerciseProgress, formatProgressDate, hasRecentPR } from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { muscleBalance } from '@/lib/muscle-balance';
import { useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';

export default function ProgressScreen() {
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const units = useSettingsStore((s) => s.units);
  // The PR badge has a 14-day window and the muscle balance card counts this
  // local week, so this screen has to know when the day changed. A tab left
  // open past midnight would otherwise keep badging an exercise whose record
  // has aged out, and keep counting last week's sets.
  const today = useLocalDay();

  // Derived in render so a workout saved or imported while the tab is mounted
  // shows up immediately, the same way History does it.
  const claimed = getClaimedLogs(logs);
  const progress = buildExerciseProgress(logs);
  const balance = muscleBalance(logs, today);

  const sessionLine =
    claimed.length === 0
      ? 'No sessions yet'
      : `${claimed.length} session${claimed.length === 1 ? '' : 's'} · last on ${formatProgressDate(claimed[0].timestamp)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stays visible on a brand-new account, saying it is empty, so the tab
          explains itself before there is any data to show. */}
      <PressableScale
        style={styles.historyRow}
        activeScale={0.985}
        onPress={() => router.push('/(tabs)/history')}
        accessibilityRole="button"
        accessibilityLabel={`Workout History, ${sessionLine}`}
      >
        <View style={styles.historyText}>
          <Text style={styles.historyLabel}>Workout History</Text>
          <Text style={styles.historySub}>{sessionLine}</Text>
        </View>
        <ChevronRight size={20} color={roles.textMuted} />
      </PressableScale>

      {/* Under History, above Exercises: History stays the way into your
          sessions, and the card then reads as the summary of the list under
          it. Absent on a brand-new account, where the empty state below
          already explains the tab. */}
      {balance !== null && <MuscleBalanceCard balance={balance} />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exercises</Text>
        {progress.length > 0 && (
          <Text style={styles.sectionSubtitle}>Everything you have logged, most recent first.</Text>
        )}
      </View>

      {progress.length === 0 ? (
        <ProgressEmpty
          title="Nothing to chart yet"
          body="Finish a workout and every exercise in it shows up here with its own chart."
        />
      ) : (
        <View style={styles.list}>
          {progress.map((exercise, index) => (
            <ExerciseProgressRow
              key={exercise.exerciseId}
              progress={exercise}
              units={units}
              showPR={hasRecentPR(exercise.points, today)}
              last={index === progress.length - 1}
              onPress={() => router.push(`/exercise/${encodeURIComponent(exercise.exerciseId)}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  historyRow: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2.5],
  },
  historyText: {
    flex: 1,
    minWidth: 0,
  },
  historyLabel: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
  },
  historySub: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: 2,
  },
  section: {
    marginTop: spacing[0.5],
  },
  sectionTitle: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionSubtitle: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: 2,
  },
  list: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    paddingHorizontal: spacing[4],
  },
});
