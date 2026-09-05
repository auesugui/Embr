// =============================================================================
// StepperButton — one nudge of a numeric field
// =============================================================================
// Shared by every stepper in the editor so ±1 rep and ±15 seconds are the same
// control at the same size, and a thumb learns one target.

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, textStyles } from '@/theme';

export function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepperButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    minWidth: 56,
    alignItems: 'center',
  },
  stepperText: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
