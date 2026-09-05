// =============================================================================
// SheetActions — the edit sheet's three ways out
// =============================================================================
// Remove sits apart from Cancel and Save, in the danger color and at the far
// edge, because it is the one that destroys something and the other two are a
// pair.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, textStyles } from '@/theme';

interface SheetActionsProps {
  onRemove: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function SheetActions({ onRemove, onCancel, onSave }: SheetActionsProps) {
  return (
    <View style={styles.actions}>
      <Pressable style={styles.removeButton} onPress={onRemove}>
        <Text style={styles.removeButtonText}>Remove</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
      <Pressable style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  removeButton: {
    backgroundColor: colors.danger.DEFAULT + '20',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  removeButtonText: {
    ...textStyles.button,
    color: colors.danger.DEFAULT,
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
    flex: 1,
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
});
