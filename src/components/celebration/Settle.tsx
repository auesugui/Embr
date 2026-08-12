// =============================================================================
// Settle — "this just landed"
// =============================================================================
// Springs its children in on mount using the shared `settle` physics. Used for
// the moment a set flips from empty to logged: the row appearing instantly is
// correct but reads as a redraw, not as your rep count being recorded.
//
// Deliberately mount-only. A set gets acknowledged once, when you log it — not
// every time the screen re-renders, and not while you're editing it.
//
// Distinct from PRFlash, which marks a *personal record*. This marks the
// ordinary case, which is most of them.

import { type ReactNode, useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useSettingsStore } from '@/stores/settingsStore';
import { CELEBRATION } from './vocabulary';

interface SettleProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Starting scale. Closer to 1 for large surfaces. */
  from?: number;
}

export function Settle({ children, style, from = 0.94 }: SettleProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const scale = useSharedValue(reducedMotion ? 1 : from);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withSpring(1, CELEBRATION.settle);
    opacity.value = withSpring(1, CELEBRATION.settle);
  }, [scale, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
