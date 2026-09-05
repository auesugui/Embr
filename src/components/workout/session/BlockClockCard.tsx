// =============================================================================
// BlockClockCard — the inline clock for a timed block
// =============================================================================
// Inline rather than a full-screen overlay like rest: for EMOM and `for_time`
// the whole point is to keep logging while the clock runs, so it must never
// cover the rows. (An AMRAP is the exception, and it gets AmrapScrim instead —
// there is nothing to log mid-window but whole rounds.)

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/lib/blocks';
import { colors, radius, roles, spacing, textStyles } from '@/theme';

interface BlockClockCardProps {
  /** `AMRAP · 20 min`, `EMOM 12 × 1:00` — what this block is. */
  title: string;
  /** The number on the face: remaining for a window, elapsed counting up. */
  clock: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  /** True when this block owns the live clock (started and not reset). */
  isOurs: boolean;
  /** True for `for_time`, the only mode whose result is its own elapsed time. */
  countsUp: boolean;
  /** One line of plain instruction, chosen by mode and clock state. */
  hint: string;
  /** EMOM only: which interval, and how much of it is left. */
  intervalLabel?: string | null;
  intervalRemaining?: number | null;
  /** Rounds banked so far. Null hides the tally entirely. */
  roundsDone: number | null;
  onStart: () => void;
  onTogglePause: () => void;
  onReset: () => void;
  onFinish: () => void;
}

export function BlockClockCard({
  title,
  clock,
  running,
  paused,
  finished,
  isOurs,
  countsUp,
  hint,
  intervalLabel,
  intervalRemaining,
  roundsDone,
  onStart,
  onTogglePause,
  onReset,
  onFinish,
}: BlockClockCardProps) {
  return (
    <View style={styles.amrapCard}>
      <View style={styles.amrapHeader}>
        <Text style={styles.amrapLabel}>{title}</Text>
        <Text
          style={[
            styles.amrapClock,
            running && styles.amrapClockRunning,
            finished && styles.amrapClockDone,
          ]}
        >
          {formatClock(clock)}
        </Text>
      </View>

      {/* EMOM's own clock is the interval, not the total. The minute you are on
          is the number you act on. */}
      {intervalLabel && !finished && (
        <View style={styles.amrapHeader}>
          <Text style={styles.amrapHint}>{intervalLabel}</Text>
          <Text style={styles.intervalClock}>{formatClock(intervalRemaining ?? 0)}</Text>
        </View>
      )}

      <Text style={styles.amrapHint}>{hint}</Text>

      {/* A tally reading "0 rounds complete" before you have started is a fact
          about nothing. It arrives with the first round. */}
      {roundsDone !== null && (
        <Text style={styles.roundTally}>
          {roundsDone} {roundsDone === 1 ? 'round' : 'rounds'} complete
        </Text>
      )}

      <View style={styles.amrapControls}>
        {isOurs && !finished ? (
          <Pressable style={styles.amrapButton} onPress={onTogglePause}>
            <Text style={styles.amrapButtonText}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.amrapButton, styles.amrapButtonPrimary]} onPress={onStart}>
            <Text style={[styles.amrapButtonText, styles.amrapButtonTextPrimary]}>
              {finished ? 'Restart' : 'Start'}
            </Text>
          </Pressable>
        )}

        {/* Only a count-up block needs a finish button: its result IS the
            elapsed time, and nothing else can stop the clock. */}
        {countsUp && isOurs && !finished && (
          <Pressable style={[styles.amrapButton, styles.amrapButtonPrimary]} onPress={onFinish}>
            <Text style={[styles.amrapButtonText, styles.amrapButtonTextPrimary]}>Done</Text>
          </Pressable>
        )}

        {isOurs && !finished && (
          <Pressable style={styles.amrapButton} onPress={onReset}>
            <Text style={styles.amrapButtonText}>Reset</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amrapCard: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[3],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  amrapHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  amrapLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
  },
  amrapClock: {
    ...textStyles.number,
    fontSize: 28,
    color: roles.textPrimary,
  },
  amrapClockRunning: {
    color: roles.accent,
  },
  amrapClockDone: {
    color: roles.textMuted,
  },
  amrapHint: {
    ...textStyles.caption,
    color: roles.textMuted,
  },
  intervalClock: {
    ...textStyles.number,
    fontSize: 20,
    color: roles.accent,
  },
  roundTally: {
    ...textStyles.caption,
    color: roles.textSecondary,
  },
  amrapControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  amrapButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  amrapButtonPrimary: {
    backgroundColor: roles.accent,
  },
  amrapButtonText: {
    ...textStyles.button,
    color: roles.textPrimary,
  },
  amrapButtonTextPrimary: {
    color: colors.background.primary,
  },
});
