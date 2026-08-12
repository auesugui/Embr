// =============================================================================
// Rest Timer Ring
// =============================================================================
// The rest timer is the one surface in the app you genuinely stare at. Mid-set,
// between sets, phone propped up — it holds your attention longer than any
// other screen, and until now it was a number that changed.
//
// A draining arc gives the number a shape: you can read "nearly done" from
// across a bench without parsing digits. Three things carry that:
//
//   - the arc drains smoothly rather than stepping once per second, so it reads
//     as time passing rather than a clock ticking;
//   - it's the accent throughout, so it's legible from full to empty. An
//     earlier version interpolated the color as it drained, which looked clever
//     and meant the arc was nearly invisible for the first half of every rest;
//   - at zero it settles once, instead of just stopping.
//
// Deliberately not: a pulsing loop, a spinner, or anything that keeps moving
// after it's done. You're trying to get back under the bar.

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { CELEBRATION } from '@/components/celebration/vocabulary';
import { useSettingsStore } from '@/stores/settingsStore';
import { roles } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RestTimerRingProps {
  /** Seconds left. */
  remaining: number;
  /** Seconds the timer started from — the denominator for the arc. */
  total: number;
  paused?: boolean;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export function RestTimerRing({
  remaining,
  total,
  paused = false,
  size = 240,
  strokeWidth = 8,
  children,
}: RestTimerRingProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // 1 = full time left, 0 = done.
  const target = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const progress = useSharedValue(target);
  const settle = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = target;
      return;
    }
    // Duration matches the tick interval so the arc drains continuously
    // between updates instead of jumping once a second. Linear on purpose —
    // eased time reads as wrong, because it *is* wrong.
    progress.value = withTiming(target, { duration: 1000, easing: Easing.linear });
  }, [target, progress, reducedMotion]);

  // One settle when the timer lands on zero. Not a loop.
  useEffect(() => {
    if (remaining !== 0 || reducedMotion) return;
    settle.value = 0.94;
    settle.value = withSpring(1, CELEBRATION.settle);
  }, [remaining, settle, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: settle.value }],
    opacity: paused ? 0.55 : 1,
  }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, containerStyle]}>
      {/* The whole canvas is rotated rather than the arc, so the drain starts
          at 12 o'clock. Rotating the <Circle> via originX/originY/rotation
          works on native but emits an invalid-DOM-property warning on web,
          where react-native-svg maps them onto transform-origin. */}
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, styles.canvas]}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={roles.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Drain. Rotated so it empties from 12 o'clock. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          stroke={roles.accent}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
