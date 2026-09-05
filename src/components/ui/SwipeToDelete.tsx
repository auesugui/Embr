// =============================================================================
// SwipeToDelete — swipe a row left to reveal a destructive action
// =============================================================================
// Deleting a personal workout used to mean: tap the card, tap Edit, scroll to
// the bottom, tap Delete Custom Template. Four screens deep for the one
// operation you perform on a workout you no longer want.
//
// The swipe is an ADDITION, not a replacement. That editor button stays exactly
// where it is, because a hidden gesture is not an accessible affordance: it has
// no keyboard equivalent, no screen-reader path, and no discoverability beyond
// the peek hint the first render gives you. If this is ever the only way to
// delete something, that's a regression.
//
// Deliberately built on Gesture.Pan rather than RNGH's Swipeable so the motion
// comes from the app's own vocabulary — the same `settle` spring as a button
// press (see PressableScale) — instead of a second, foreign set of physics.

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CELEBRATION } from '@/components/celebration/vocabulary';
import { Trash } from '@/components/icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSettingsStore } from '@/stores/settingsStore';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

/** How far the row slides to fully expose the action. */
const ACTION_WIDTH = 96;

/** Past this much travel, letting go opens rather than springs back. */
const OPEN_THRESHOLD = ACTION_WIDTH * 0.45;

/**
 * Horizontal travel before the pan claims the gesture.
 *
 * This is what keeps the list scrollable: below this, a drag belongs to the
 * ScrollView, so a slightly-diagonal flick still scrolls the page instead of
 * peeling a card open under your thumb.
 */
const PAN_ACTIVATION_X = 12;

/** Handed to the child so its press handler can stand down mid-swipe. */
export interface SwipeGuard {
  /** True while a swipe owns the interaction, or while the row sits open. */
  blocked: () => boolean;
}

interface SwipeToDeleteProps {
  /**
   * The row. Given as a function so it can read the swipe guard — a plain
   * child cannot, and a child that navigates on press MUST check it.
   */
  children: (guard: SwipeGuard) => ReactNode;
  /** Runs after the action is tapped. Confirmation belongs to the caller. */
  onDelete: () => void;
  /** Screen-reader label for the revealed action. */
  accessibilityLabel: string;
  /** Row spacing, matched to the card it wraps so the action aligns with it. */
  marginBottom?: number;
}

export function SwipeToDelete({
  children,
  onDelete,
  accessibilityLabel,
  marginBottom = spacing[3],
}: SwipeToDeleteProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  /** Open state, for the tap-to-close overlay. */
  const [locked, setLocked] = useState(false);

  /**
   * Whether a swipe currently owns the interaction, read at press time.
   *
   * This is load-bearing, not defensive: on web the card is an RN Pressable,
   * and RN Web's press responder listens at the document, so it completes the
   * press on pointer-up no matter how far the pointer travelled or what the
   * subtree's `pointer-events` say. Measured: swiping a workout left also
   * STARTED that workout on release. The pan and the press are separate
   * systems that cannot negotiate, so the card asks this before acting.
   *
   * It's a ref, not state, because `runOnJS` hops threads asynchronously and
   * can land after the press has already fired — a re-render is too late.
   * Set the moment the pan activates (long before release) and cleared on a
   * short delay after it ends, so the flag is reliably up at pointer-up.
   *
   * A plain tap never trips it: the pan only activates past PAN_ACTIVATION_X,
   * so `onStart` never fires for a press.
   */
  const swiping = useRef(false);

  const beginSwipe = useCallback(() => {
    swiping.current = true;
    setLocked(true);
  }, []);

  const endSwipe = useCallback((stayOpen: boolean) => {
    setLocked(stayOpen);
    // An open row keeps swallowing presses — the next tap should close it, not
    // fire the card underneath a Delete button.
    if (stayOpen) return;
    setTimeout(() => {
      swiping.current = false;
    }, 250);
  }, []);

  const close = useCallback(() => {
    translateX.value = reducedMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, CELEBRATION.settle);
    isOpen.value = false;
    setLocked(false);
    setTimeout(() => {
      swiping.current = false;
    }, 50);
  }, [translateX, isOpen, reducedMotion]);

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVATION_X, PAN_ACTIVATION_X])
    // Claim nothing vertical — the home screen is a long scroll and that has to
    // keep working with a thumb anywhere on a card.
    .failOffsetY([-14, 14])
    .onStart(() => {
      runOnJS(beginSwipe)();
    })
    .onUpdate((e) => {
      const base = isOpen.value ? -ACTION_WIDTH : 0;
      // Rightward past closed does nothing: there is no action on that side, and
      // a row that drifts right just looks broken.
      translateX.value = Math.min(0, Math.max(-ACTION_WIDTH * 1.15, base + e.translationX));
    })
    .onEnd((e) => {
      // A fast flick opens even if it never travelled past the threshold —
      // matching velocity beats matching distance for how a swipe feels.
      const flungOpen = e.velocityX < -600;
      const flungShut = e.velocityX > 600;
      const shouldOpen = flungShut ? false : flungOpen || translateX.value < -OPEN_THRESHOLD;
      const to = shouldOpen ? -ACTION_WIDTH : 0;
      // Snap inline rather than through a shared helper: this runs on the UI
      // thread, and a JS-thread closure called from here is the classic way to
      // get a gesture that works in dev and drops frames in release.
      translateX.value = reducedMotion
        ? withTiming(to, { duration: 120 })
        : withSpring(to, CELEBRATION.settle);
      isOpen.value = shouldOpen;
      runOnJS(endSwipe)(shouldOpen);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // The action fades in with the travel so a half-open row reads as in-progress
  // rather than as a button that is already armed.
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -ACTION_WIDTH * 0.6], [0, 1], 'clamp'),
  }));

  const handleDelete = () => {
    haptics.warning();
    close();
    onDelete();
  };

  return (
    <View style={[styles.container, { marginBottom }]}>
      <Animated.View style={[styles.actionLayer, actionStyle]}>
        <PressableScale
          style={styles.deleteButton}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Trash size={18} color={roles.onAccent} strokeWidth={2} />
          <Text style={styles.deleteText}>Delete</Text>
        </PressableScale>
      </Animated.View>

      {/* touchAction is the difference between a swipeable card and a card you
          can't scroll past. GestureDetector defaults it to "none" on web, which
          hands every direction to the gesture: the page stops scrolling under
          your thumb, and because the scroll never claims the interaction, the
          press completes on release — so trying to scroll the list opened a
          workout. "pan-y" keeps vertical with the browser and leaves horizontal
          to us. */}
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={rowStyle}>
          <View pointerEvents={locked ? 'none' : 'auto'}>
            {children({ blocked: () => swiping.current || locked })}
          </View>

          {/* Only mounted while the row is locked, so it never sits in front of
              a closed card and eats its press. Tapping it closes the row —
              the standard way out of an opened list row. */}
          {locked && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close delete action"
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  // Explicit edges rather than absoluteFillObject + alignSelf: the latter left
  // the action sized to its content and pinned to the bottom of the card
  // instead of running its full height.
  actionLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: roles.error,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  deleteText: {
    ...textStyles.caption,
    color: roles.onAccent,
    fontWeight: '700',
  },
});

export { ACTION_WIDTH as SWIPE_ACTION_WIDTH };
