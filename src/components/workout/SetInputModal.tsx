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
  View,
} from 'react-native';

import { SetFields } from '@/components/workout/set-input/SetFields';
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
  /**
   * What one row is called. A timed block logs rounds, not sets, and the sheet
   * must not contradict the screen behind it.
   */
  unitLabel?: string;
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

// Memoized quick weight button

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
  unitLabel = 'Set',
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
                {isEditing ? 'Edit' : 'Log'} {unitLabel} {setNumber}
              </Text>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>

            <SetFields
              reps={reps}
              weight={weightString}
              units={units}
              quickWeights={QUICK_WEIGHTS[units]}
              increments={increments}
              repsInputId={REPS_INPUT_ID}
              weightInputId={WEIGHT_INPUT_ID}
              onReps={setReps}
              onWeight={setWeight}
              onStepReps={adjustReps}
              onStepWeight={adjustWeight}
              onPickWeight={selectQuickWeight}
            />

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
