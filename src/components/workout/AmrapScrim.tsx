// =============================================================================
// AmrapScrim — the running view of an AMRAP
// =============================================================================
// A running AMRAP is not a screen you read. It is one number (the clock), one
// count (rounds), one list (what a round is), and one button you hit at the end
// of each round — with your heart rate at 170, holding the phone for a second
// between movements.
//
// The session screen it covers is a working surface: banked rounds, per-movement
// quick-log ladders, weight chips, rest controls, block tabs, Finish Workout.
// All of that is correct while you're programming or logging a lifting session,
// and all of it is noise mid-AMRAP. So rather than thin out that screen for one
// mode, this covers it for exactly as long as the clock runs.
//
// WHAT'S DELIBERATELY NOT HERE
//   - Per-movement logging. A round is the unit; partial rounds are offered
//     only when the window closes, which is the one time a partial is real.
//   - Reset / Restart. Destroying a running AMRAP is not a thing to put one tap
//     from "Round done".
//   - Block tabs, rest, weights. None of them apply while a window is open.
// Pause is the one extra, as a text link rather than a button, because people
// get interrupted and the alternative is losing the block.

import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui';
import { formatClock } from '@/lib/blocks';
import { radius, roles, spacing, textStyles } from '@/theme';

export interface ScrimMovement {
  key: string;
  /** The prescription for one round, e.g. `5`. Null when there's no target. */
  reps: string | null;
  name: string;
}

interface AmrapScrimProps {
  /** `AMRAP · 20 min` — what this block is. */
  title: string;
  /** Seconds since the clock started. */
  elapsed: number;
  /** The window's full length, for the `of 20:00` reference. */
  duration: number;
  roundsDone: number;
  /** One row per movement, so you know what a round is without leaving. */
  movements: ScrimMovement[];
  paused: boolean;
  /** The window has closed. Nothing more will be banked on the clock. */
  finished: boolean;
  /** Null when the round can't be one-tapped (a movement has no rep target). */
  onRoundDone: (() => void) | null;
  onFinish: () => void;
  /** Label for the finish action — the last block finishes the workout. */
  finishLabel: string;
  onTogglePause: () => void;
  /** Drops the scrim so the round you were mid-way through can be logged. */
  onLogPartial: () => void;
}

export function AmrapScrim({
  title,
  elapsed,
  duration,
  roundsDone,
  movements,
  paused,
  finished,
  onRoundDone,
  onFinish,
  finishLabel,
  onTogglePause,
  onLogPartial,
}: AmrapScrimProps) {
  // Once the window closes, finishing is the expected next move and banking
  // another round is the exception — so they swap weights rather than the
  // buttons moving, which would put "Finish" where your thumb learned "Round
  // done" was.
  const roundIsPrimary = !finished && onRoundDone !== null;

  return (
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>

        {/* Elapsed, not remaining. Asked for, and right: what you shout across
            a garage is "twelve minutes in", and the cap sits under it so the
            end of the window is still one glance away. */}
        <Text style={[styles.clock, paused && styles.clockPaused, finished && styles.clockDone]}>
          {formatClock(elapsed)}
        </Text>
        <Text style={styles.clockCap}>
          {finished ? "Time — that's the window" : `of ${formatClock(duration)}`}
        </Text>

        <View style={styles.tally}>
          <Text style={styles.tallyValue}>{roundsDone}</Text>
          <Text style={styles.tallyLabel}>
            {roundsDone === 1 ? 'round complete' : 'rounds complete'}
          </Text>
        </View>

        {/* What a round is. Present because forgetting the third movement
            mid-set is exactly what happens, and leaving to check it is what
            this screen exists to prevent. */}
        <View style={styles.movements}>
          {movements.map((m) => (
            <View key={m.key} style={styles.movementRow}>
              <Text style={styles.movementReps}>{m.reps ?? '—'}</Text>
              <Text style={styles.movementName} numberOfLines={1}>
                {m.name}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {onRoundDone && (
            <PressableScale
              style={roundIsPrimary ? styles.primaryButton : styles.secondaryButton}
              onPress={onRoundDone}
              accessibilityRole="button"
              accessibilityLabel="Log a completed round"
            >
              <Text style={roundIsPrimary ? styles.primaryText : styles.secondaryText}>
                Round done
              </Text>
            </PressableScale>
          )}

          <PressableScale
            style={roundIsPrimary ? styles.secondaryButton : styles.primaryButton}
            onPress={onFinish}
            accessibilityRole="button"
            accessibilityLabel={finishLabel}
          >
            <Text style={roundIsPrimary ? styles.secondaryText : styles.primaryText}>
              {finishLabel}
            </Text>
          </PressableScale>
        </View>

        {/* Quiet by design: a text link, not a third button competing with the
            two that matter. */}
        {finished ? (
          <PressableScale
            style={styles.linkButton}
            activeScale={0.99}
            onPress={onLogPartial}
            accessibilityRole="button"
            accessibilityLabel="Log the round you were part-way through"
          >
            <Text style={styles.linkText}>Log a partial round</Text>
          </PressableScale>
        ) : (
          <PressableScale
            style={styles.linkButton}
            activeScale={0.99}
            onPress={onTogglePause}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'Resume the clock' : 'Pause the clock'}
          >
            <Text style={styles.linkText}>{paused ? 'Resume' : 'Pause'}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque rather than translucent: a half-visible working screen behind a
  // running clock is the busyness this replaces, not a softer version of it.
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: roles.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    zIndex: 20,
  },
  sheet: {
    alignItems: 'center',
  },
  title: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  clock: {
    ...textStyles.hero,
    fontSize: 72,
    lineHeight: 80,
    color: roles.textPrimary,
  },
  clockPaused: {
    color: roles.textMuted,
  },
  clockDone: {
    color: roles.accent,
  },
  clockCap: {
    ...textStyles.body,
    color: roles.textMuted,
    marginBottom: spacing[6],
  },
  tally: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  tallyValue: {
    ...textStyles.numberLarge,
    color: roles.accent,
  },
  tallyLabel: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
  movements: {
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: roles.border,
    paddingVertical: spacing[3],
    marginBottom: spacing[6],
    gap: spacing[1],
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[3],
  },
  movementReps: {
    ...textStyles.numberSmall,
    color: roles.accentText,
    minWidth: 34,
    textAlign: 'right',
  },
  movementName: {
    ...textStyles.body,
    color: roles.textPrimary,
    flexShrink: 1,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing[3],
  },
  primaryButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  primaryText: {
    ...textStyles.buttonLarge,
    color: roles.onAccent,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  secondaryText: {
    ...textStyles.button,
    color: roles.textSecondary,
  },
  linkButton: {
    alignSelf: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  linkText: {
    ...textStyles.button,
    color: roles.accentText,
  },
});
