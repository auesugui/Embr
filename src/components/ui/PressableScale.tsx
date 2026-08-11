// =============================================================================
// PressableScale — the app's one press interaction
// =============================================================================
// Every button in Embr was a bare `Pressable` with no pressed state at all: tap
// it and nothing acknowledges the tap until the next screen arrives. That
// absence is a large part of what reads as unfinished, and it costs one
// component to fix.
//
// Deliberately small: a spring scale-down plus a slight dim, using the shared
// `settle` spring from the celebration vocabulary so a button press and a
// celebration land with the same physics. Motion is a language; this is the
// first word of it.
//
// Honors the reducedMotion setting — which then falls back to an opacity
// change, because "no feedback at all" is an accessibility regression, not an
// accessibility feature.

import { type ReactNode, useCallback } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CELEBRATION } from '@/components/celebration/vocabulary';
import { useSettingsStore } from '@/stores/settingsStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** How far it compresses. Large surfaces want less travel than small ones. */
  activeScale?: number;
}

export function PressableScale({
  children,
  style,
  activeScale = 0.97,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = reducedMotion ? 1 : withSpring(1, CELEBRATION.settle);
  }, [pressed, reducedMotion]);

  const onPressOut = useCallback(() => {
    pressed.value = reducedMotion
      ? withTiming(0, { duration: 90 })
      : withSpring(0, CELEBRATION.settle);
  }, [pressed, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [] : [{ scale: 1 - pressed.value * (1 - activeScale) }],
    opacity: 1 - pressed.value * 0.12,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, animatedStyle, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
