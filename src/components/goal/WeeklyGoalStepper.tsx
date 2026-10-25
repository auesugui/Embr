// =============================================================================
// WeeklyGoalStepper — minus / "N days" / plus
// =============================================================================
// One control, two homes: the Settings row and the first-workout prompt. The
// ends disable rather than wrap, because 7 → 1 on a stray tap is a setting you
// would not notice changing.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Minus, Plus } from '@/components/icons';
import { MAX_WEEKLY_GOAL, MIN_WEEKLY_GOAL } from '@/lib/weekly-goal';
import { radius, roles, spacing, textStyles } from '@/theme';

interface WeeklyGoalStepperProps {
  goal: number;
  onChange: (days: number) => void;
}

export function WeeklyGoalStepper({ goal, onChange }: WeeklyGoalStepperProps) {
  const atMin = goal <= MIN_WEEKLY_GOAL;
  const atMax = goal >= MAX_WEEKLY_GOAL;

  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.step}
        onPress={() => onChange(goal - 1)}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="Fewer days"
        accessibilityState={{ disabled: atMin }}
      >
        <Minus size={16} color={atMin ? roles.textMuted : roles.textSecondary} />
      </Pressable>

      <Text style={styles.value}>
        {goal} {goal === 1 ? 'day' : 'days'}
      </Text>

      <Pressable
        style={styles.step}
        onPress={() => onChange(goal + 1)}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="More days"
        accessibilityState={{ disabled: atMax }}
      >
        <Plus size={16} color={atMax ? roles.textMuted : roles.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  step: {
    width: 32,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: roles.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...textStyles.labelLarge,
    color: roles.textPrimary,
    fontWeight: '600',
    minWidth: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
