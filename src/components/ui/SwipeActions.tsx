// =============================================================================
// SwipeActions — swipe a card either way to bring an action into it
// =============================================================================
// Editing or deleting a personal workout used to mean: tap the card, tap Edit,
// then find the operation you wanted — and for delete, scroll to the bottom of
// the editor. Several screens deep for the two things you routinely do to a
// workout you already made.
//
// ONE DIRECTION, ONE ACTION. Swiping left brings in the left-edge strip;
// swiping right brings in the right-edge one. Never both: two buttons out at
// once are two identically-sized targets under a thumb, and the one you did
// not mean is the destructive one. Separating them by direction means reaching
// delete takes a deliberate, different gesture from reaching edit.
//
// THE CARD DOESN'T MOVE. The usual iOS pattern slides the whole row to expose
// an action sitting behind it, which means the thing you're looking at leaves
// its position and the list momentarily reads as broken alignment. Here the
// swipe travels *inside* the card: the card stays exactly where it is and a
// button slides in from under one of its edges, clipped by the card's own
// bounds. The gesture reveals; the button acts. Nothing is armed by the swipe
// — releasing one never edits or deletes anything by itself.
//
// The swipe is an ADDITION, not a replacement. The editor's own delete button
// stays exactly where it is, and the card still opens on tap, because a hidden
// gesture is not an accessible affordance: no keyboard equivalent, no
// discoverability beyond the first time someone's thumb finds it. If this is
// ever the only way to reach an operation, that's a regression. (The buttons
// themselves are always in the tree with labels, so screen readers reach them
// without performing a gesture.)
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
import {
  ACTION_WIDTH,
  type SwipeAction,
  SwipeActionButton,
} from '@/components/ui/SwipeActionButton';
import { useSettingsStore } from '@/stores/settingsStore';
import { radius, spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

/**
 * Fraction of the full reveal past which letting go opens rather than springs
 * back. Proportional rather than absolute so adding an action doesn't quietly
 * make the swipe harder to complete.
 */
const OPEN_FRACTION = 0.3;

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

interface SwipeActionsProps {
  /**
   * The card. Given as a function so it can read the swipe guard — a plain
   * child cannot, and a child that navigates on press MUST check it.
   */
  children: (guard: SwipeGuard) => ReactNode;
  /**
   * Buttons pinned to the card's LEFT edge, revealed by swiping LEFT.
   * Confirmation, if an action needs it, belongs to the caller.
   */
  leftActions?: SwipeAction[];
  /** Buttons pinned to the card's RIGHT edge, revealed by swiping RIGHT. */
  rightActions?: SwipeAction[];
  /** Row spacing. Owned here so the buttons' clip matches the card exactly. */
  marginBottom?: number;
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  marginBottom = spacing[3],
}: SwipeActionsProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  /**
   * How far a swipe travels to fully open one side.
   *
   * One side at a time, so this is whichever strip is wider — not their sum.
   */
  const revealWidth = ACTION_WIDTH * Math.max(leftActions.length, rightActions.length);

  const hasLeft = leftActions.length > 0;
  const hasRight = rightActions.length > 0;

  /**
   * Signed gesture travel: negative while swiping left, positive right, and
   * settling at -revealWidth, 0, or +revealWidth.
   */
  const travel = useSharedValue(0);

  /** Which side is open: -1 left, 0 neither, 1 right. */
  const openSide = useSharedValue(0);

  /** Buttons-are-out state, for the tap-to-close overlay. */
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
    // While the buttons are out the card keeps ignoring presses — the next tap
    // should put them away, not open the workout they're sitting on.
    if (stayOpen) return;
    setTimeout(() => {
      swiping.current = false;
    }, 250);
  }, []);

  const close = useCallback(() => {
    travel.value = reducedMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, CELEBRATION.settle);
    openSide.value = 0;
    setLocked(false);
    setTimeout(() => {
      swiping.current = false;
    }, 50);
  }, [travel, openSide, reducedMotion]);

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVATION_X, PAN_ACTIVATION_X])
    // Claim nothing vertical — the home screen is a long scroll and that has to
    // keep working with a thumb anywhere on a card.
    .failOffsetY([-14, 14])
    .onStart(() => {
      runOnJS(beginSwipe)();
    })
    .onUpdate((e) => {
      const base = openSide.value * revealWidth;
      // A direction with no actions behind it doesn't move. The small overshoot
      // allowance on the live sides is what gives the buttons somewhere to
      // spring back from rather than stopping dead against their stop.
      const min = hasLeft ? -revealWidth * 1.15 : 0;
      const max = hasRight ? revealWidth * 1.15 : 0;
      travel.value = Math.min(max, Math.max(min, base + e.translationX));
    })
    .onEnd((e) => {
      // A fast flick opens even if it never travelled past the threshold —
      // matching velocity beats matching distance for how a swipe feels. A
      // flick the OTHER way shuts, whichever side is showing.
      const flungLeft = e.velocityX < -600;
      const flungRight = e.velocityX > 600;
      const threshold = revealWidth * OPEN_FRACTION;
      const t = travel.value;

      let side = 0;
      if (t < 0 && !flungRight && (flungLeft || t < -threshold)) side = -1;
      else if (t > 0 && !flungLeft && (flungRight || t > threshold)) side = 1;

      const to = side * revealWidth;
      // Snap inline rather than through a shared helper: this runs on the UI
      // thread, and a JS-thread closure called from here is the classic way to
      // get a gesture that works in dev and drops frames in release.
      travel.value = reducedMotion
        ? withTiming(to, { duration: 120 })
        : withSpring(to, CELEBRATION.settle);
      openSide.value = side;
      runOnJS(endSwipe)(side !== 0);
    });

  /**
   * The buttons ride the gesture; the card does not.
   *
   * Each strip starts parked one full reveal OUTSIDE its own edge of the card
   * and arrives at 0 as its swipe runs. That's the whole trick: all the
   * movement people read as "the row opening" happens inside the card's own
   * bounds, so the card never leaves its place in the list.
   */
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -revealWidth - travel.value }],
    // Fades with travel so a half-open card reads as in-progress rather than as
    // a button that's already armed. Clamped to this side's direction, so the
    // other swipe never ghosts it in.
    opacity: interpolate(travel.value, [0, -revealWidth * 0.5], [0, 1], 'clamp'),
  }));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: revealWidth - travel.value }],
    opacity: interpolate(travel.value, [0, revealWidth * 0.5], [0, 1], 'clamp'),
  }));

  /**
   * The card dims as a button comes in.
   *
   * Not decoration. A button necessarily covers one end of the card — the
   * stat values and difficulty label on the right, the start of the name on
   * the left — and without this, a half-covered card reads as broken text
   * rather than as a card in a mode. It's also honest: presses are genuinely
   * disabled while a button is out, and this is what "temporarily inert" looks
   * like everywhere else in the app.
   */
  const contentStyle = useAnimatedStyle(() => ({
    // Light. One button covers a fraction of the card, so the earlier 0.72 —
    // calibrated for two — read as the card being switched off rather than as
    // its right or left end being temporarily behind something.
    opacity: interpolate(Math.abs(travel.value), [0, revealWidth], [1, 0.88], 'clamp'),
  }));

  const runAction = (action: SwipeAction) => {
    // A destructive action gets the warning haptic; a navigation is an ordinary
    // tap and should feel like one.
    if (action.tone === 'danger') haptics.warning();
    else haptics.tap();
    close();
    action.onPress();
  };

  return (
    // Clips the buttons to the card's silhouette, which is what makes them
    // read as part of the card rather than something parked behind the row.
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

          {/* Only mounted while the buttons are out, so it never sits in front
              of a closed card and eats its press. Tapping it puts them away —
              the standard way out of an opened row. Rendered before the buttons
              so it never covers them. */}
          {locked && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Hide actions"
            />
          )}

          {leftActions.length > 0 && (
            <Animated.View style={[styles.actionLayer, styles.leftLayer, leftStyle]}>
              {leftActions.map((action, index) => (
                <SwipeActionButton
                  key={action.key}
                  action={action}
                  onRun={runAction}
                  // Only the outermost button meets a corner of the card.
                  corner={index === 0 ? 'left' : 'none'}
                />
              ))}
            </Animated.View>
          )}

          {rightActions.length > 0 && (
            <Animated.View style={[styles.actionLayer, styles.rightLayer, rightStyle]}>
              {rightActions.map((action, index) => (
                <SwipeActionButton
                  key={action.key}
                  action={action}
                  onRun={runAction}
                  corner={index === rightActions.length - 1 ? 'right' : 'none'}
                />
              ))}
            </Animated.View>
          )}
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
    flexDirection: 'row',
  },
  leftLayer: {
    left: 1,
  },
  rightLayer: {
    right: 1,
  },
});
