// =============================================================================
// EquipmentFilterSheet — what the Equipment button opens
// =============================================================================
// Six checkboxes, multi-select, OR within equipment. Selections apply as they
// are tapped and the Done button carries the resulting count, so the sheet
// answers "is this worth it" without being closed first.
//
// It is a SIBLING of the picker sheet, laid over it, never its parent: the
// picker's search field stops taking focus on web the moment a press handler
// sits above it. See the note in ExercisePickerModal.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Check } from '@/components/icons';
import type { Equipment } from '@/data';
import { FILTER_EQUIPMENT, showCountLabel } from '@/lib/exercise-filter';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

export function EquipmentFilterSheet({
  selected,
  count,
  bottomInset,
  onToggle,
  onClear,
  onDone,
}: {
  selected: Equipment[];
  /** Exercises the picker would show with these selections. */
  count: number;
  bottomInset: number;
  onToggle: (equipment: Equipment) => void;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset + spacing[4] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipment</Text>
        <Pressable hitSlop={12} onPress={onDone} accessibilityRole="button">
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {FILTER_EQUIPMENT.map((item) => {
          const on = selected.includes(item);
          return (
            <Pressable
              key={item}
              style={[styles.item, on && styles.itemOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item}
              onPress={() => {
                haptics.selection();
                onToggle(item);
              }}
            >
              <View style={[styles.box, on && styles.boxOn]}>
                {on && <Check size={12} color={roles.onAccent} strokeWidth={3} />}
              </View>
              <Text style={styles.itemText}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable hitSlop={8} onPress={onClear} accessibilityRole="button">
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
        <Pressable style={styles.apply} onPress={onDone} accessibilityRole="button">
          <Text style={styles.applyText}>{showCountLabel(count)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: roles.surface,
    borderTopWidth: 1,
    borderTopColor: roles.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[2.5],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...textStyles.h3,
    color: roles.textPrimary,
  },
  done: {
    ...textStyles.button,
    color: roles.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  item: {
    // Two per row, whatever the sheet's width.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  itemOn: {
    borderColor: roles.accent,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: roles.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: roles.accent,
    borderColor: roles.accent,
  },
  itemText: {
    ...textStyles.body,
    color: roles.textPrimary,
    textTransform: 'capitalize',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  clear: {
    ...textStyles.button,
    color: roles.textSecondary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
  },
  apply: {
    flex: 1,
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  applyText: {
    ...textStyles.button,
    color: roles.onAccent,
    fontWeight: '700',
  },
});
