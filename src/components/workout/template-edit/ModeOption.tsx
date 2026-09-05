// =============================================================================
// ModeOption — one choice in the scheme picker
// =============================================================================

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, roles, spacing, textStyles } from '@/theme';

export function ModeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeOption, selected && styles.modeOptionActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.modeOptionText, selected && styles.modeOptionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeOption: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    backgroundColor: roles.accentSubtle,
    borderColor: roles.accent,
  },
  modeOptionText: {
    ...textStyles.button,
    color: colors.text.secondary,
  },
  modeOptionTextActive: {
    color: roles.accentText,
    fontWeight: '600',
  },
});
