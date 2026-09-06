// =============================================================================
// SwipeActionButton — one button in a card's revealed action strip
// =============================================================================
// Full-bleed: these live inside the card's clip (see SwipeActions), so a
// button that stopped short of the edges would read as a chip floating on the
// card rather than as part of it. Square by default — only the button at the
// outer end of a strip meets a corner of the card, and it takes that corner's
// radius so the strip is cut by the same curve the card is drawn with.
//
// LABELLED, NOT ICON-ONLY. A trash can is unambiguous on its own, but which
// DIRECTION reaches which action is not: an icon can't teach you that swiping
// the other way is the destructive one. A word under the glyph does it on the
// first reveal, which is the only exposure most people get.
//
// ONLY THE DESTRUCTIVE ONE IS COLORED. Delete takes the error fill; everything
// else takes `neutralFill`, a warm mid-gray. Two earlier passes bracketed this
// badly and are worth recording: `surfaceInverse` made the SAFE action the
// heaviest block on a screen whose whole register is warmth and breathing
// room, and `surfaceSunken` sat so close to the page behind the card that the
// button read as a gap in the row rather than as part of it. A filled control
// has to clear BOTH the card it sits in and the page behind it.

import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { IconProps } from '@/components/icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { radius, roles, spacing, textStyles } from '@/theme';

/**
 * Width of one button, and so how far the swipe has to travel.
 *
 * Sized to seat the longest label ("Delete") without crowding it, and to stay
 * comfortably above the 44pt minimum touch target.
 */
export const ACTION_WIDTH = 76;

/** One button in a revealed strip. */
export interface SwipeAction {
  /** Stable key, and what the haptic keys off. */
  key: string;
  icon: (props: IconProps) => ReactNode;
  /** The word under the glyph. One word — there are 76px to say it in. */
  label: string;
  /**
   * Screen-reader label. Longer than the visible one because it names what is
   * being acted on: "Delete" alone, read out of a list, says nothing about
   * which workout.
   */
  accessibilityLabel: string;
  onPress: () => void;
  /**
   * `danger` paints the button in the error color. Reserved for operations
   * that destroy something — using it for emphasis would spend the one signal
   * the app has for "this one is different". Everything else is `neutral`.
   */
  tone?: 'neutral' | 'danger';
}

export function SwipeActionButton({
  action,
  onRun,
  corner,
}: {
  action: SwipeAction;
  onRun: (action: SwipeAction) => void;
  /** Which card corner this button meets, if any. */
  corner: 'left' | 'right' | 'none';
}) {
  const Icon = action.icon;
  const danger = action.tone === 'danger';
  const tint = danger ? roles.onAccent : roles.onNeutralFill;
  const base = [styles.button, danger ? styles.danger : styles.neutral];

  return (
    <PressableScale
      style={
        corner === 'left'
          ? [...base, styles.cornerLeft]
          : corner === 'right'
            ? [...base, styles.cornerRight]
            : base
      }
      onPress={() => onRun(action)}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
    >
      <Icon size={20} color={tint} strokeWidth={2} />
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {action.label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: ACTION_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderRadius: 0,
  },
  label: {
    ...textStyles.captionSmall,
  },
  neutral: {
    backgroundColor: roles.neutralFill,
  },
  danger: {
    backgroundColor: roles.error,
  },
  // Radius is one less than the card's so the fill sits inside its hairline
  // border rather than painting over the stroke.
  cornerLeft: {
    borderTopLeftRadius: radius.lg - 1,
    borderBottomLeftRadius: radius.lg - 1,
  },
  cornerRight: {
    borderTopRightRadius: radius.lg - 1,
    borderBottomRightRadius: radius.lg - 1,
  },
});
