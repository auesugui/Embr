// =============================================================================
// SwipeActionButton — one button in a card's revealed action strip
// =============================================================================
// Icon-only and full-bleed: these live inside the card's clip (see
// SwipeActions), so a button that stopped short of the edges would read as a
// chip floating on the card rather than as part of it.
//
// Square by default. Only the button at the outer end of a strip meets a
// corner of the card, and it takes that corner's radius so the strip is cut by
// the same curve the card is drawn with.

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { IconProps } from '@/components/icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { radius, roles } from '@/theme';

/** Width of one button, and so how far the swipe has to travel. */
export const ACTION_WIDTH = 64;

/** One button in a revealed strip. */
export interface SwipeAction {
  /** Stable key, and what the haptic keys off. */
  key: string;
  icon: (props: IconProps) => ReactNode;
  /** Screen-reader label. These buttons are icon-only. */
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
      <Icon size={20} color={danger ? roles.onAccent : roles.textInverse} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: ACTION_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  // Inverse rather than a raised surface: a button the same color as the card
  // it slides out of reads as more card, not as something to press. Inverting
  // gives a chip that is unmistakably a control in both palettes without
  // spending the accent, which the destructive button sits next to.
  neutral: {
    backgroundColor: roles.surfaceInverse,
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
