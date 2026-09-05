// =============================================================================
// SetFields — the reps and weight inputs
// =============================================================================
// Steppers flank a typed value on both fields, because both ways of entering a
// number are the fast one depending on where you start: ±1 from 10 beats
// typing, typing 137 beats twenty taps. The quick-weight row underneath is
// plate math, per unit — those values are conventions, not conversions of each
// other (issue #42).

import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { metricLabel } from '@/lib/metric';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { Metric, WeightUnit } from '@/types';

/**
 * Stepper deltas for the counted field. A hold moves in the units people
 * actually adjust a hold by — ±1 second is a rounding error on a plank.
 */
const QUANTITY_STEPS: Record<Metric, { small: number; large: number }> = {
  reps: { small: 1, large: 5 },
  time: { small: 5, large: 15 },
};

interface SetFieldsProps {
  reps: string;
  /** What the counted field measures. Absent means reps. */
  metric?: Metric;
  weight: string;
  units: WeightUnit;
  /** Plate-math presets for the current unit. */
  quickWeights: readonly number[];
  /** Stepper increments for the current unit. */
  increments: { small: number; large: number };
  repsInputId: string;
  weightInputId: string;
  onReps: (next: string) => void;
  onWeight: (next: string) => void;
  onStepReps: (delta: number) => void;
  onStepWeight: (delta: number) => void;
  /** Taps a plate-math preset straight into the field. */
  onPickWeight: (weight: number) => void;
}

export function SetFields({
  reps,
  metric = 'reps',
  weight,
  units,
  quickWeights,
  increments,
  repsInputId,
  weightInputId,
  onReps,
  onWeight,
  onStepReps,
  onStepWeight,
  onPickWeight,
}: SetFieldsProps) {
  const selectedWeight = weight ? Number.parseInt(weight, 10) : null;
  const steps = QUANTITY_STEPS[metric];
  return (
    <>
      {/* The counted field: reps, or seconds for a held movement. */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{metricLabel(metric)}</Text>
        <View style={styles.inputRow}>
          <StepperButton label={`-${steps.large}`} onPress={() => onStepReps(-steps.large)} />
          <StepperButton label={`-${steps.small}`} onPress={() => onStepReps(-steps.small)} />
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={onReps}
            keyboardType="number-pad"
            selectTextOnFocus
            inputAccessoryViewID={repsInputId}
          />
          <StepperButton label={`+${steps.small}`} onPress={() => onStepReps(steps.small)} />
          <StepperButton label={`+${steps.large}`} onPress={() => onStepReps(steps.large)} />
        </View>
      </View>

      {/* Weight Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Weight ({units})</Text>
        <View style={styles.inputRow}>
          <StepperButton
            label={`-${increments.large}`}
            onPress={() => onStepWeight(-increments.large)}
          />
          <StepperButton
            label={`-${increments.small}`}
            onPress={() => onStepWeight(-increments.small)}
          />
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={onWeight}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.text.muted}
            selectTextOnFocus
            inputAccessoryViewID={weightInputId}
          />
          <StepperButton
            label={`+${increments.small}`}
            onPress={() => onStepWeight(increments.small)}
          />
          <StepperButton
            label={`+${increments.large}`}
            onPress={() => onStepWeight(increments.large)}
          />
        </View>
      </View>

      {/* Quick Weight Buttons */}
      <View style={styles.quickButtonsContainer}>
        <Text style={styles.quickLabel}>Quick weight</Text>
        <View style={styles.quickButtons}>
          {quickWeights.map((w) => (
            <QuickWeightButton
              key={w}
              weight={w}
              selected={selectedWeight === w}
              onPress={() => onPickWeight(w)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

const QuickWeightButton = memo(
  ({
    weight,
    selected,
    onPress,
  }: {
    weight: number;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable style={[styles.quickButton, selected && styles.quickButtonActive]} onPress={onPress}>
      <Text style={[styles.quickButtonText, selected && styles.quickButtonTextActive]}>
        {weight}
      </Text>
    </Pressable>
  )
);

QuickWeightButton.displayName = 'QuickWeightButton';

/** One nudge of a numeric field. Shared by both inputs so ±1 and ±10 match. */
function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    ...textStyles.label,
    color: colors.text.muted,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  stepperButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    minWidth: 44,
    alignItems: 'center',
  },
  stepperText: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    textAlign: 'center',
    ...textStyles.number,
    color: colors.text.primary,
    minWidth: 80,
    fontSize: 24,
  },
  quickButtonsContainer: {
    marginBottom: spacing[4],
  },
  quickLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  quickButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    minWidth: 48,
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: colors.reward.fp + '30',
    borderWidth: 1,
    borderColor: colors.reward.fp,
  },
  quickButtonText: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
  quickButtonTextActive: {
    color: colors.reward.fp,
    fontWeight: '600',
  },
});
