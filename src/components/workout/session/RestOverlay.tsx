// =============================================================================
// RestOverlay — the between-sets screen
// =============================================================================
// Rest is the one moment in a session with nothing to do, so it gets the whole
// screen: the ring, the count, and a diagram of the movement you are resting
// from. Tapping anywhere skips, because the most common thing you want from a
// rest timer is to not be in it any more.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseDemo } from '@/components/workout/ExerciseDemo';
import { RestTimerRing } from '@/components/workout/RestTimerRing';
import { formatClock } from '@/lib/blocks';
import { colors, radius, roles, spacing, textStyles } from '@/theme';

interface RestOverlayProps {
  /** Bare exercise id (no `-index` suffix) for the demo lookup. */
  exerciseId: string;
  remaining: number;
  duration: number;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
}

export function RestOverlay({
  exerciseId,
  remaining,
  duration,
  paused,
  onSkip,
  onTogglePause,
}: RestOverlayProps) {
  return (
    <Pressable style={styles.restOverlay} onPress={onSkip}>
      {/* Rest is the one moment in a session with time to look at a diagram,
          so here it's open by default rather than behind a toggle. */}
      <ExerciseDemo exerciseId={exerciseId} variant="overlay" />

      <Text style={styles.restLabel}>{paused ? 'Paused' : 'Rest'}</Text>
      <RestTimerRing remaining={remaining} total={duration} paused={paused} size={200}>
        <Text style={[styles.restTimer, remaining === 0 && styles.restTimerReady]}>
          {formatClock(remaining)}
        </Text>
      </RestTimerRing>

      {remaining === 0 ? (
        <Text style={styles.readyText}>Tap to continue</Text>
      ) : (
        <View style={styles.restControls}>
          <Pressable
            style={styles.restControlButton}
            onPress={(e) => {
              e.stopPropagation();
              onTogglePause();
            }}
          >
            <Text style={styles.restControlText}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable
            style={styles.restControlButton}
            onPress={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            <Text style={styles.restControlText}>Skip</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.tapHint}>Tap anywhere to skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  restOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary + 'E6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  restLabel: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
    // Clears the ring's top edge — at spacing[2] the label sat on the arc.
    marginBottom: spacing[4],
  },
  restTimer: {
    // Was colors.timer.resting — a cool blue from the old palette, and the
    // only blue left anywhere in the app. The ring carries the state now, so
    // the number just has to be readable.
    ...textStyles.hero,
    fontSize: 48,
    color: roles.textPrimary,
  },
  restTimerReady: {
    color: roles.accent,
  },
  readyText: {
    ...textStyles.body,
    color: colors.timer.ready,
    marginTop: spacing[4],
  },
  restControls: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[6],
  },
  restControlButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
  },
  restControlText: {
    ...textStyles.button,
    color: colors.text.primary,
  },
  tapHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[6],
  },
});
