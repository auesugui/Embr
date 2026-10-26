// =============================================================================
// ExerciseProgressRow — one exercise in the Progress list
// =============================================================================
// Hevy register: a name, one tabular line, the shape, and a chevron. Nothing
// here is a card — the rows share one card and are separated by a hairline, so
// a dozen exercises read as a list rather than a dozen objects.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRight } from '@/components/icons';
import { Sparkline } from '@/components/progress/Sparkline';
import { type ExerciseProgress, summarizePoint } from '@/lib/exercise-progress';
import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

export function ExerciseProgressRow({
  progress,
  units,
  showPR,
  last,
  onPress,
}: {
  progress: ExerciseProgress;
  units: WeightUnit;
  /** A record was logged inside the badge window. See hasRecentPR. */
  showPR: boolean;
  /** The last row carries no separator. */
  last: boolean;
  onPress: () => void;
}) {
  const latest = progress.points[progress.points.length - 1];
  // The latest session in its own terms. A lift done bodyweight last Tuesday
  // reads "12 reps · Oct 23" rather than repeating last month's weight.
  const summary = summarizePoint(latest, latest.metric, units);

  return (
    <Pressable
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${progress.name}, ${summary}`}
      accessibilityHint="Opens this exercise's chart and records"
    >
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {progress.name}
          </Text>
          {showPR && (
            <View style={styles.prBadge}>
              <Text style={styles.prBadgeText}>PR</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta}>{summary}</Text>
      </View>

      {/* Only the comparable sessions: a shape drawn across two metrics would
          be a line between a weight and a rep count. */}
      <Sparkline values={progress.comparable.map((point) => point.value)} />
      <ChevronRight size={18} color={roles.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: roles.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  name: {
    ...textStyles.label,
    color: roles.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  prBadge: {
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 1,
  },
  prBadgeText: {
    ...textStyles.captionSmall,
    color: roles.accentText,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
