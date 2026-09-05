// =============================================================================
// ControlButton — an icon-only row control
// =============================================================================
// Move up, move down, remove. Icon-only because three of them sit in a row
// under every exercise and labels would double the row's height; each carries
// its label to screen readers instead.

import { Pressable, StyleSheet } from 'react-native';

import type { IconProps } from '@/components/icons';
import { colors, radius, roles } from '@/theme';
import type { ComponentType } from 'react';

export function ControlButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  icon: ComponentType<IconProps>;
  /** Screen-reader label. The button itself is icon-only. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  const color = disabled ? roles.textMuted : tone === 'danger' ? roles.error : roles.textPrimary;

  return (
    <Pressable
      style={[
        styles.controlButton,
        tone === 'danger' && styles.controlButtonDanger,
        disabled && styles.controlButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controlButton: {
    backgroundColor: colors.background.tertiary,
    width: 40,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDanger: {
    backgroundColor: colors.danger.DEFAULT + '24',
  },
  controlButtonDisabled: {
    opacity: 0.35,
  },
});
