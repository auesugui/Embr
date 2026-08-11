// =============================================================================
// IronQuest Set Input Modal - Custom Reps & Weight Input
// =============================================================================

import { memo, useCallback, useEffect, useState } from 'react';
import {
  Button,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

interface SetInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reps: number, weight?: number) => void;
  onClear?: () => void;
  initialReps?: number;
  initialWeight?: number | null;
  suggestedWeight?: number | null; // Weight from history to auto-fill
  setNumber: number;
  exerciseName: string;
  isEditing?: boolean;
}

const REPS_INPUT_ID = 'reps-input';
const WEIGHT_INPUT_ID = 'weight-input';

// Plate-math quick weights per unit (issue #42). Values follow each unit's
// plate convention — they are NOT conversions of each other.
const QUICK_WEIGHTS = {
  lb: [45, 65, 95, 135, 185, 225],
  kg: [20, 40, 60, 80, 100, 140],
} as const;

const STEPPER_INCREMENTS = {
  lb: { small: 5, large: 10 },
  kg: { small: 2.5, large: 5 },
} as const;

// Memoized keyboard accessory to prevent flicker
const KeyboardAccessory = memo(({ inputId }: { inputId: string }) => (
  <InputAccessoryView nativeID={inputId}>
    <View style={styles.keyboardAccessory}>
      <Button title="Done" onPress={() => Keyboard.dismiss()} />
    </View>
  </InputAccessoryView>
));

KeyboardAccessory.displayName = 'KeyboardAccessory';

// Memoized stepper button to prevent unnecessary rerenders
const StepperButton = memo(
  ({
    label,
    onPress,
  }: {
    label: string;
    onPress: () => void;
  }) => (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  )
);

StepperButton.displayName = 'StepperButton';

// Memoized quick weight button
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

export function SetInputModal({
  visible,
  onClose,
  onSave,
  onClear,
  initialReps = 10,
  initialWeight = null,
  suggestedWeight = null,
  setNumber,
  exerciseName,
  isEditing = false,
}: SetInputModalProps) {
  const units = useSettingsStore((state) => state.units);
  const [reps, setReps] = useState(initialReps.toString());
  const [weight, setWeight] = useState(initialWeight?.toString() ?? '');
  const increments = STEPPER_INCREMENTS[units];

  useEffect(() => {
    if (visible) {
      setReps(initialReps.toString());
      // Prefer initialWeight (editing existing set) over suggestedWeight (new set)
      const weightToUse = initialWeight ?? suggestedWeight;
      setWeight(weightToUse?.toString() ?? '');
    }
  }, [visible, initialReps, initialWeight, suggestedWeight]);

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
    }
  }, [visible]);

  const handleSave = useCallback(() => {
    const repsValue = Number.parseInt(reps, 10);
    if (Number.isNaN(repsValue) || repsValue < 1) return;

    haptics.success();
    const weightValue = weight ? Number.parseFloat(weight) : undefined;
    onSave(repsValue, weightValue);
    Keyboard.dismiss();
    onClose();
  }, [reps, weight, onSave, onClose]);

  const handleClear = useCallback(() => {
    haptics.warning();
    Keyboard.dismiss();
    onClear?.();
    onClose();
  }, [onClear, onClose]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  // Stable increment/decrement functions
  const adjustReps = useCallback((amount: number) => {
    haptics.tap();
    setReps((prev) => {
      const current = Number.parseInt(prev, 10) || 0;
      return Math.max(1, current + amount).toString();
    });
  }, []);

  const adjustWeight = useCallback((amount: number) => {
    haptics.tap();
    setWeight((prev) => {
      const current = Number.parseFloat(prev) || 0;
      return Math.max(0, current + amount).toString();
    });
  }, []);

  const selectQuickWeight = useCallback((w: number) => {
    haptics.tap();
    setWeight(w.toString());
  }, []);

  const weightString = weight;
  const selectedWeight = weightString ? Number.parseInt(weightString, 10) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* The backdrop is a SIBLING of the sheet, not its parent. Wrapping the
          sheet in a Pressable breaks the reps/weight fields on web: the press
          handler fires after the TextInput takes focus and Keyboard.dismiss()
          blurs it, so the field can't be typed into. Keeping tap-to-close
          behind the sheet leaves the inputs with no press handler above them. */}
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close set input"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {isEditing ? 'Edit' : 'Log'} Set {setNumber}
              </Text>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>

            {/* Reps Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <View style={styles.inputRow}>
                <StepperButton label="-5" onPress={() => adjustReps(-5)} />
                <StepperButton label="-1" onPress={() => adjustReps(-1)} />
                <TextInput
                  style={styles.input}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  inputAccessoryViewID={REPS_INPUT_ID}
                />
                <StepperButton label="+1" onPress={() => adjustReps(1)} />
                <StepperButton label="+5" onPress={() => adjustReps(5)} />
              </View>
            </View>

            {/* Weight Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight ({units})</Text>
              <View style={styles.inputRow}>
                <StepperButton
                  label={`-${increments.large}`}
                  onPress={() => adjustWeight(-increments.large)}
                />
                <StepperButton
                  label={`-${increments.small}`}
                  onPress={() => adjustWeight(-increments.small)}
                />
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                  selectTextOnFocus
                  inputAccessoryViewID={WEIGHT_INPUT_ID}
                />
                <StepperButton
                  label={`+${increments.small}`}
                  onPress={() => adjustWeight(increments.small)}
                />
                <StepperButton
                  label={`+${increments.large}`}
                  onPress={() => adjustWeight(increments.large)}
                />
              </View>
            </View>

            {/* Quick Weight Buttons */}
            <View style={styles.quickButtonsContainer}>
              <Text style={styles.quickLabel}>Quick weight</Text>
              <View style={styles.quickButtons}>
                {QUICK_WEIGHTS[units].map((w) => (
                  <QuickWeightButton
                    key={w}
                    weight={w}
                    selected={selectedWeight === w}
                    onPress={() => selectQuickWeight(w)}
                  />
                ))}
              </View>
            </View>

            {/* Actions - Always visible at bottom */}
            <View style={styles.actions}>
              {isEditing && onClear && (
                <Pressable style={styles.clearButton} onPress={handleClear}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </Pressable>
              )}
              <Pressable style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>{isEditing ? 'Update' : 'Log Set'}</Text>
              </Pressable>
            </View>

            {/* iOS Input Accessory Views - rendered once, not recreated */}
            {Platform.OS === 'ios' && (
              <>
                <KeyboardAccessory inputId={REPS_INPUT_ID} />
                <KeyboardAccessory inputId={WEIGHT_INPUT_ID} />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[5],
    paddingBottom: spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.secondary,
    maxWidth: '80%',
  },
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
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...textStyles.button,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1.5,
    backgroundColor: colors.reward.fp,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...textStyles.button,
    color: colors.background.primary,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: colors.danger.DEFAULT + '20',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    ...textStyles.button,
    color: colors.danger.DEFAULT,
  },
  keyboardAccessory: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'flex-end',
  },
});
