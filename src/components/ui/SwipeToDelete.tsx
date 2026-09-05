// =============================================================================
// SwipeToDelete — swipe a card to bring a trash button into it
// =============================================================================
// Deleting a personal workout used to mean: tap the card, tap Edit, scroll to
// the bottom, tap Delete Custom Template. Four screens deep for the one
// operation you perform on a workout you no longer want.
//
// THE CARD DOESN'T MOVE. The usual iOS pattern slides the whole row left to
// expose an action sitting behind it, which means the thing you're looking at
// leaves its position and the list momentarily reads as broken alignment. Here
// the swipe travels *inside* the card: the card stays exactly where it is and a
// trash button slides in from under its right edge, clipped by the card's own
// bounds. The gesture reveals; the button deletes. Nothing else is armed —
// releasing a swipe never deletes anything by itself.
//
// The swipe is an ADDITION, not a replacement. The editor's delete button stays
// exactly where it is, because a hidden gesture is not an accessible
// affordance: no keyboard equivalent, no discoverability beyond the first time
// someone's thumb finds it. If this is ever the only way to delete something,
// that's a regression. (The trash button itself is always in the tree with a
// label, so screen readers reach it without performing a gesture.)
//
// Deliberately built on Gesture.Pan rather than RNGH's Swipeable so the motion
// comes from the app's own vocabulary — the same `settle` spring as a button
// press (see PressableScale) — instead of a second, foreign set of physics.

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { radius, roles, spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

/** Width of the trash button, and so how far the gesture travels. */
const ACTION_WIDTH = 64;

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
  /** True while a swipe owns the interaction, or while the button is out. */
  blocked: () => boolean;
}

interface SwipeToDeleteProps {
  /**
   * The card. Given as a function so it can read the swipe guard — a plain
   * child cannot, and a child that navigates on press MUST check it.
   */
  children: (guard: SwipeGuard) => ReactNode;
  /** Runs when the trash button is tapped. Confirmation belongs to the caller. */
  onDelete: () => void;
  /** Screen-reader label for the trash button. */
  accessibilityLabel: string;
  /** Row spacing. Owned here so the button's clip matches the card exactly. */
  marginBottom?: number;
}

export function SwipeToDelete({
  children,
  onDelete,
  accessibilityLabel,
  marginBottom = spacing[3],
}: SwipeToDeleteProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  /** Gesture travel, 0 (hidden) to -ACTION_WIDTH (button fully in). */
  const travel = useSharedValue(0);
  const isOpen = useSharedValue(false);

  /** Button-is-out state, for the tap-to-close overlay. */
  const [locked, setLocked] = useState(false);

  /**
   * Whether a swipe currently owns the interaction, read at press time.
   *
   * This is load-bearing, not defensive: on web the card is an RN Pressable,
   * and RN Web's press responder listens at the document, so it completes the
   * press on pointer-up no matter how far the pointer travelled or what the
   * subtree's `pointer-events` say. Measured: swiping a workout also STARTED
   * that workout on release. The pan and the press are separate systems that
   * cannot negotiate, so the card asks this before acting.
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
    // While the button is out the card keeps ignoring presses — the next tap
    // should put it away, not open the workout it's sitting on.
    if (stayOpen) return;
    setTimeout(() => {
      swiping.current = false;
    }, 250);
  }, []);

  const close = useCallback(() => {
    travel.value = reducedMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, CELEBRATION.settle);
    isOpen.value = false;
    setLocked(false);
    setTimeout(() => {
      swiping.current = false;
    }, 50);
  }, [travel, isOpen, reducedMotion]);

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
      // Rightward past closed does nothing: there is no action on that side.
      // The small overshoot allowance is what gives the button somewhere to
      // spring back from rather than stopping dead against its stop.
      travel.value = Math.min(0, Math.max(-ACTION_WIDTH * 1.15, base + e.translationX));
    })
    .onEnd((e) => {
      // A fast flick opens even if it never travelled past the threshold —
      // matching velocity beats matching distance for how a swipe feels.
      const flungOpen = e.velocityX < -600;
      const flungShut = e.velocityX > 600;
      const shouldOpen = flungShut ? false : flungOpen || travel.value < -OPEN_THRESHOLD;
      const to = shouldOpen ? -ACTION_WIDTH : 0;
      // Snap inline rather than through a shared helper: this runs on the UI
      // thread, and a JS-thread closure called from here is the classic way to
      // get a gesture that works in dev and drops frames in release.
      travel.value = reducedMotion
        ? withTiming(to, { duration: 120 })
        : withSpring(to, CELEBRATION.settle);
      isOpen.value = shouldOpen;
      runOnJS(endSwipe)(shouldOpen);
    });

  /**
   * The button rides the gesture; the card does not.
   *
   * It starts parked one full width to the right of the card's inner edge —
   * outside the clip — and arrives at 0. That's the whole trick: all the
   * movement people read as "the row opening" happens inside the card's own
   * bounds, so the card never leaves its place in the list.
   */
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ACTION_WIDTH + travel.value }],
    // Fades with travel so a half-open card reads as in-progress rather than as
    // a button that's already armed.
    opacity: interpolate(travel.value, [0, -ACTION_WIDTH * 0.5], [0, 1], 'clamp'),
  }));

  /**
   * The card dims as the button comes in.
   *
   * Not decoration. The button necessarily covers the card's right edge — the
   * stat values and the difficulty label — and without this, a half-covered
   * card reads as broken text rather than as a card in a mode. It's also
   * honest: presses are genuinely disabled while the button is out, and this
   * is what "temporarily inert" looks like everywhere else in the app.
   */
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(travel.value, [0, -ACTION_WIDTH], [1, 0.72], 'clamp'),
  }));

  const handleDelete = () => {
    haptics.warning();
    close();
    onDelete();
  };

  return (
    // Clips the button to the card's silhouette, which is what makes it read as
    // part of the card rather than something parked behind the row.
    <View style={[styles.clip, { marginBottom }]}>
      {/* touchAction is the difference between a swipeable card and a card you
          can't scroll past. GestureDetector defaults it to "none" on web, which
          hands every direction to the gesture: the page stops scrolling under
          your thumb, and because the scroll never claims the interaction, the
          press completes on release — so trying to scroll the list opened a
          workout. "pan-y" keeps vertical with the browser and leaves horizontal
          to us. */}
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View>
          <Animated.View style={contentStyle} pointerEvents={locked ? 'none' : 'auto'}>
            {children({ blocked: () => swiping.current || locked })}
          </Animated.View>

          {/* Only mounted while the button is out, so it never sits in front of
              a closed card and eats its press. Tapping it puts the button away
              — the standard way out of an opened row. Rendered before the
              button so it never covers it. */}
          {locked && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Hide delete button"
            />
          )}

          <Animated.View style={[styles.actionLayer, buttonStyle]}>
            <PressableScale
              style={styles.deleteButton}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
            >
              <Trash size={20} color={roles.onAccent} strokeWidth={2} />
            </PressableScale>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: 'relative',
    // Matches TemplateCard's radius so the button is cut by the same curve the
    // card is drawn with.
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  // Inset by the card's hairline border so the fill sits inside the stroke
  // rather than painting over it.
  actionLayer: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    right: 1,
    width: ACTION_WIDTH,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: roles.error,
    alignItems: 'center',
    justifyContent: 'center',
    // Square on the left where it meets the card's content, round on the right
    // where it meets the card's own corner.
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: radius.lg - 1,
    borderBottomRightRadius: radius.lg - 1,
  },
});
