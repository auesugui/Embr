// =============================================================================
// RestOverlay — the between-sets screen
// =============================================================================
// Rest is the one moment in a session with nothing to do, so it gets the whole
// screen: the ring, the count, and a diagram of the movement you are resting
// from. Tapping anywhere skips, because the most common thing you want from a
// rest timer is to not be in it any more.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDemo } from '@/components/workout/ExerciseDemo';
import { RestTimerRing } from '@/components/workout/RestTimerRing';
import { formatClock } from '@/lib/blocks';
import { colors, radius, roles, spacing, textStyles, touchTarget } from '@/theme';

const OVERLAY_PADDING_TOP = spacing[4];

/** How much one tap of the adjust buttons is worth. */
const ADJUST_STEP = 15;

interface RestOverlayProps {
  /** Bare exercise id (no `-index` suffix) for the demo lookup. */
  exerciseId: string;
  remaining: number;
  duration: number;
  paused: boolean;
  onSkip: () => void;
  onTogglePause: () => void;
  /** Add or remove rest, in seconds. */
  onAdjust: (delta: number) => void;
}

/**
 * One of the two adjust buttons.
 *
 * It stops the press reaching the overlay, so adjusting the rest never skips
 * it — the same thing Pause and Skip already do. Below fifteen seconds the
 * minus button dims rather than becoming a second Skip: taking fifteen off
 * twelve lands on zero, which is what Skip is for.
 */
function AdjustButton({
  label,
  delta,
  off,
  onAdjust,
}: {
  label: string;
  delta: number;
  off: boolean;
  onAdjust: (delta: number) => void;
}) {
  return (
    <Pressable
      style={[styles.adjust, off && styles.adjustOff]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={`${delta > 0 ? 'Add' : 'Remove'} ${Math.abs(delta)} seconds of rest`}
      onPress={(e) => {
        e.stopPropagation();
        // Dimmed, not disabled: a disabled Pressable lets the press through to
        // the overlay on web, and skipping the rest is not what a dim button
        // should do.
        if (!off) onAdjust(delta);
      }}
    >
      <Text style={[styles.adjustText, off && styles.adjustTextOff]}>{label}</Text>
    </Pressable>
  );
}

export function RestOverlay({
  exerciseId,
  remaining,
  duration,
  paused,
  onSkip,
  onTogglePause,
  onAdjust,
}: RestOverlayProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + spacing[4];
  // The diagram gets whatever height the timer leaves. A fixed size ran it
  // under the header and pushed the controls off a short screen.
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [timerHeight, setTimerHeight] = useState(0);
  const demoSpace = overlayHeight - OVERLAY_PADDING_TOP - paddingBottom - timerHeight;

  return (
    <Pressable
      style={[styles.restOverlay, { paddingBottom }]}
      onPress={onSkip}
      onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}
    >
      {/* Rest is the one moment in a session with time to look at a diagram,
          so here it's open by default rather than behind a toggle. */}
      {overlayHeight > 0 && timerHeight > 0 && (
        <ExerciseDemo exerciseId={exerciseId} variant="overlay" maxHeight={demoSpace} />
      )}

      <View style={styles.timerBlock} onLayout={(e) => setTimerHeight(e.nativeEvent.layout.height)}>
        <Text style={styles.restLabel}>{paused ? 'Paused' : 'Rest'}</Text>

        {/* The adjust buttons flank the ring because they change the number
            inside it. At zero every control clears — the whole screen is one
            tap target there, and a live button inside it is a mis-tap. */}
        <View style={styles.ringRow}>
          {remaining > 0 && (
            <AdjustButton
              label="−15s"
              delta={-ADJUST_STEP}
              off={remaining < ADJUST_STEP}
              onAdjust={onAdjust}
            />
          )}
          <RestTimerRing remaining={remaining} total={duration} paused={paused} size={180}>
            <Text style={[styles.restTimer, remaining === 0 && styles.restTimerReady]}>
              {formatClock(remaining)}
            </Text>
          </RestTimerRing>
          {remaining > 0 && (
            <AdjustButton label="+15s" delta={ADJUST_STEP} off={false} onAdjust={onAdjust} />
          )}
        </View>

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
      </View>
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
    // Opaque: at 90% the session's buttons and chips read through the timer.
    backgroundColor: roles.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: OVERLAY_PADDING_TOP,
    zIndex: 10,
  },
  timerBlock: {
    alignItems: 'center',
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  adjust: {
    width: 58,
    minHeight: touchTarget.minimum,
    borderRadius: radius.md,
    backgroundColor: roles.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustOff: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: roles.border,
  },
  adjustText: {
    ...textStyles.buttonSmall,
    color: roles.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  adjustTextOff: {
    color: roles.textMuted,
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
    marginTop: spacing[4],
  },
});
