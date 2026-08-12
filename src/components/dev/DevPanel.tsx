// =============================================================================
// Embr Dev Panel — __DEV__-only state seeding screen
// =============================================================================
// Levers over the seedable stores (player / PRs / history) plus a full reset. Never ships: the route short-circuits to null outside __DEV__
// and the Profile entry row is gated the same way.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePlayerStore } from '@/stores/playerStore';
import { usePRStore } from '@/stores/prStore';
import { useWorkoutHistoryStore } from '@/stores/workoutHistoryStore';
import { colors, radius, spacing, textStyles } from '@/theme';
import { showAlert } from '@/utils/alert';
import { devResetAll, devSeedHistory, devSeedPRs, devSetStreak } from './devActions';

const STREAK_LEVELS = [0, 3, 7, 14, 30];

export function DevPanel() {
  const streak = usePlayerStore((s) => s.streak.current);
  const prCount = usePRStore((s) => s.totalPRCount);
  const logCount = useWorkoutHistoryStore((s) => s.logs.length);

  if (!__DEV__) return null;

  const confirmReset = () => {
    showAlert({
      title: 'Reset all data?',
      message: 'Wipes every store back to fresh install and returns to onboarding.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: devResetAll },
      ],
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        Dev-only levers. Every change persists to AsyncStorage and survives reload.
      </Text>

      {/* Player */}
      <Section title="Player">
        <Text style={styles.stateLine}>Current streak: {streak}</Text>
        <Text style={styles.rowLabel}>Streak</Text>
        <View style={styles.pillRow}>
          {STREAK_LEVELS.map((days) => (
            <Pill
              key={days}
              label={`${days}d`}
              active={streak === days}
              onPress={() => devSetStreak(days)}
            />
          ))}
        </View>
      </Section>

      {/* PRs */}
      <Section title="Personal Records">
        <Text style={styles.stateLine}>Current: {prCount} PRs recorded</Text>
        <View style={styles.pillRow}>
          <Pill label="Seed big lifts (lb)" onPress={() => devSeedPRs('lb')} />
          <Pill label="Seed big lifts (kg)" onPress={() => devSeedPRs('kg')} />
        </View>
      </Section>

      {/* History */}
      <Section title="Workout History">
        <Text style={styles.stateLine}>Current: {logCount} logs</Text>
        <View style={styles.pillRow}>
          <Pill label="Seed 5 claimed workouts" onPress={devSeedHistory} />
        </View>
      </Section>

      {/* Reset */}
      <Section title="Danger Zone">
        <Pressable
          style={styles.resetButton}
          onPress={confirmReset}
          accessibilityRole="button"
          accessibilityLabel="Reset all data"
        >
          <Text style={styles.resetButtonText}>Reset All Data</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  subtitle: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginBottom: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  stateLine: {
    ...textStyles.caption,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  rowLabel: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
  },
  pillActive: {
    backgroundColor: colors.reward.fp,
  },
  pillText: {
    ...textStyles.bodySmall,
    color: colors.text.primary,
  },
  pillTextActive: {
    color: colors.background.primary,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.semantic.error,
    alignItems: 'center',
  },
  resetButtonText: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
