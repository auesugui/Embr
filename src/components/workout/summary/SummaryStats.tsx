// =============================================================================
// SummaryStats — duration, volume, sets and reps, two by two
// =============================================================================
// Lifted out of the summary screen unchanged when the PR block and the volume
// comparison landed beside it (#80). Two by two so the duration fits on one
// line.

import { StyleSheet, Text, View } from 'react-native';

import { RevealRow } from '@/components/celebration';
import { uniformMetric } from '@/lib/metric';
import { type WorkoutSummary, formatWeight } from '@/lib/workout-summary';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

interface SummaryStatsProps {
  summary: WorkoutSummary;
  units: WeightUnit;
  /** Position in the screen's staggered reveal. */
  revealIndex: number;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

export function SummaryStats({ summary, units, revealIndex }: SummaryStatsProps) {
  return (
    <RevealRow index={revealIndex} style={styles.statsCard}>
      <View style={styles.statRow}>
        <View style={[styles.statItem, styles.statItemLeft]}>
          <Text style={styles.statValue}>{formatDuration(summary.duration)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatWeight(summary.totalVolume, units)}</Text>
          <Text style={styles.statLabel}>Volume</Text>
        </View>
      </View>

      <View style={[styles.statRow, styles.statRowBottom]}>
        <View style={[styles.statItem, styles.statItemLeft]}>
          <Text style={styles.statValue}>{summary.totalSets}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statItem}>
          {/* A workout of nothing but holds counts seconds, not reps. A mixed
              one sums both and keeps the older label — one word cannot say
              "reps and seconds", and "Reps" is what the bulk of it is. */}
          <Text style={styles.statValue}>{summary.totalReps}</Text>
          <Text style={styles.statLabel}>
            {uniformMetric(summary.exercises) === 'time' ? 'Seconds' : 'Reps'}
          </Text>
        </View>
      </View>
    </RevealRow>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    marginBottom: spacing[4],
  },
  statRow: {
    flexDirection: 'row',
  },
  statRowBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  statItem: {
    flex: 1,
    padding: spacing[4],
  },
  statItemLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.ui.border,
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
});
