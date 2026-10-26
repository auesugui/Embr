// =============================================================================
// SessionHeader — block position, running total, elapsed time, and the way out
// =============================================================================
// Four things, one row: where you are in the workout, what you have done so
// far, how long you have been at it, and End. "End" is destructive (it throws
// the session away), which is why it reads in the danger color and sits as far
// from the back arrow as the row allows.
//
// The clock goes beside the back arrow rather than next to End, because putting
// a number against End crowds the one control you must not mis-tap. It is not
// in the centre either: Total and position are a two-line stack already, and a
// third line makes the header taller on every screen.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronLeft } from '@/components/icons';
import { formatTotal } from '@/lib/metric';
import { formatElapsed } from '@/lib/session-clock';
import { colors, roles, spacing, textStyles } from '@/theme';
import type { Metric } from '@/types';

interface SessionHeaderProps {
  totalReps: number;
  /**
   * Seconds since the session started, rest and backgrounded time included.
   * Pausing a rest timer does not pause it.
   */
  elapsed: number;
  /**
   * What the running total counts, or null when the session mixes reps and
   * holds — a sum across both names neither, so it goes out unlabelled.
   */
  totalMetric: Metric | null;
  /** 1-based position of the current exercise. */
  position: number;
  total: number;
  canGoBack: boolean;
  paddingTop: number;
  onPrevious: () => void;
  onEnd: () => void;
}

export function SessionHeader({
  totalReps,
  elapsed,
  totalMetric,
  position,
  total,
  canGoBack,
  paddingTop,
  onPrevious,
  onEnd,
}: SessionHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop }]}>
      <View style={styles.headerLeft}>
        <Pressable
          onPress={onPrevious}
          disabled={!canGoBack}
          style={styles.navArrow}
          accessibilityRole="button"
          accessibilityLabel="Previous exercise"
        >
          {/* Was a literal '<' in a Text node — missed in the glyph sweep
              because it's written as a JSX expression, not a bare character. */}
          <ChevronLeft size={22} color={canGoBack ? roles.textSecondary : roles.textMuted} />
        </Pressable>

        {/* Reads as a readout, not a control: muted, tabular, no border or fill. */}
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
      </View>

      <View style={styles.headerCenter}>
        <Text style={styles.totalReps}>
          Total: {totalMetric ? formatTotal(totalReps, totalMetric) : totalReps}
        </Text>
        <Text style={styles.exerciseCount}>
          {position} / {total}
        </Text>
      </View>

      <Pressable onPress={onEnd}>
        <Text style={styles.endButton}>End</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navArrow: {
    padding: spacing[2],
  },
  elapsed: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontVariant: ['tabular-nums'],
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
});
