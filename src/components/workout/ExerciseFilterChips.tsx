// =============================================================================
// ExerciseFilterChips — one row: Equipment, then the muscles
// =============================================================================
// One row rather than two. A second row costs a list row always, to save a tap
// sometimes. Muscle is what people reach for, so it gets the chips; equipment
// is set once a session, so it gets a button and a sheet. The button counts
// instead of listing, so its width is the same at one selection or four.
//
// The row is a sibling of the list, not its first child: what is filtering the
// results stays on screen while you scroll them.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChevronDown, X } from '@/components/icons';
import type { MuscleGroup } from '@/data';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function ExerciseFilterChips({
  muscles,
  muscle,
  equipmentCount,
  onPickMuscle,
  onOpenEquipment,
}: {
  muscles: MuscleGroup[];
  muscle: MuscleGroup | null;
  equipmentCount: number;
  /** Null when the active chip was tapped again, which clears it. */
  onPickMuscle: (muscle: MuscleGroup | null) => void;
  onOpenEquipment: () => void;
}) {
  const equipmentOn = equipmentCount > 0;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.chip, styles.equipment, equipmentOn && styles.chipOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: equipmentOn }}
        accessibilityLabel="Filter by equipment"
        onPress={() => {
          haptics.tap();
          onOpenEquipment();
        }}
      >
        <Text style={[styles.chipText, equipmentOn && styles.chipTextOn]}>
          {equipmentOn ? `Equipment ${equipmentCount}` : 'Equipment'}
        </Text>
        <ChevronDown size={14} color={equipmentOn ? roles.onAccent : roles.textSecondary} />
      </Pressable>

      <View style={styles.separator} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.muscles}
      >
        {muscles.map((item) => {
          const selected = item === muscle;
          return (
            <Pressable
              key={item}
              style={[styles.chip, selected && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={selected ? `Clear ${item} filter` : `Filter by ${item}`}
              hitSlop={6}
              onPress={() => {
                haptics.selection();
                onPickMuscle(selected ? null : item);
              }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label(item)}</Text>
              {/* The selected chip carries its own dismiss: clearing one
                  filter should not need a trip to a Clear all. */}
              {selected && <X size={13} color={roles.onAccent} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  separator: {
    width: 1,
    height: 18,
    backgroundColor: roles.border,
    marginHorizontal: spacing[2],
  },
  muscles: {
    flexDirection: 'row',
    gap: spacing[1.5],
    paddingRight: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: roles.surfaceSunken,
    borderRadius: radius.full,
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
  },
  equipment: {
    flexShrink: 0,
  },
  chipOn: {
    backgroundColor: roles.accent,
  },
  chipText: {
    ...textStyles.caption,
    fontSize: 13,
    color: roles.textSecondary,
    fontWeight: '600',
  },
  chipTextOn: {
    color: roles.onAccent,
  },
});
