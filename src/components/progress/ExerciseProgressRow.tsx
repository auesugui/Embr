// =============================================================================
// ExerciseProgressRow — one exercise in the Progress list
// =============================================================================
// Hevy register: a name, one tabular line, the shape, and a chevron. Nothing
// here is a card — the rows share one card and are separated by a hairline, so
// a dozen exercises read as a list rather than a dozen objects.
//
// The line already prints one session, which carries its own unit, so the
// number and the label are right with no change (#85 step 2). Two things do
// change for a movement trained in both units: the shape is drawn from the
// LATEST unit only — before this it drew a line straight through the switch,
// with a drop from 195 to 85 in the middle of it — and a muted tail says the
// other unit exists. The tail is last on the line, so it is the first thing to
// truncate and the row keeps its height.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRight } from '@/components/icons';
import { Sparkline } from '@/components/progress/Sparkline';
import { type ExerciseProgress, latestSeries, summarizePoint } from '@/lib/exercise-progress';
import { otherWeightUnit } from '@/lib/weight-unit';
import { radius, roles, spacing, textStyles } from '@/theme';

export function ExerciseProgressRow({
  progress,
  showPR,
  last,
  onPress,
}: {
  progress: ExerciseProgress;
  /** A record was logged inside the badge window. See hasRecentPR. */
  showPR: boolean;
  /** The last row carries no separator. */
  last: boolean;
  onPress: () => void;
}) {
  const latest = progress.points[progress.points.length - 1];
  // The latest session in its own terms, and its own unit. A lift done
  // bodyweight last Tuesday reads "12 reps · Oct 23" rather than repeating
  // last month's weight.
  const summary = summarizePoint(latest, latest.metric, latest.unit);
  const series = latestSeries(progress);
  const split = progress.byUnit.length > 1;
  const tail = split ? ` · also in ${otherWeightUnit(series.unit)}` : '';

  return (
    <Pressable
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${progress.name}, ${summary}${tail}`}
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
        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {summary}
          {split && <Text style={styles.metaTail}>{tail}</Text>}
        </Text>
      </View>

      {/* The latest unit's comparable sessions only: a shape drawn across two
          metrics would be a line between a weight and a rep count, and one
          drawn across two units would be a line between two different facts.
          A single session still draws, on the baseline — a row with a tail and
          nothing beside it reads as a missing chart. */}
      <Sparkline values={series.comparable.map((point) => point.value)} drawSingle={split} />
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
  // `textMuted` is already the faintest text role, so the tail carries the
  // meta line's own colour rather than a new one. It reads as a tail because
  // it is last and it is words, not a number.
  metaTail: {
    color: roles.textMuted,
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
