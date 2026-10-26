// =============================================================================
// ExercisePickerRecents — the picker's one-tap row
// =============================================================================
// Directly under the search field, so the most likely pick is one tap from the
// sheet opening. Absent rather than empty when there is nothing to show, and
// hidden the moment a chip or a search narrows the list: a row that ignores
// your filter is a second answer competing with the right one.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseDefinition } from '@/data';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

export function ExercisePickerRecents({
  exercises,
  onSelect,
}: {
  exercises: ExerciseDefinition[];
  onSelect: (exerciseId: string) => void;
}) {
  if (exercises.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Recent</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`Add ${exercise.name}`}
            onPress={() => {
              haptics.selection();
              onSelect(exercise.id);
            }}
          >
            {/* Long names wrap rather than truncating: "Bulgarian Split…" is
                not a target you tap confidently in three seconds. */}
            <Text style={styles.name}>{exercise.name}</Text>
            <Text style={styles.muscle}>{exercise.primaryMuscle}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[1.5],
    marginBottom: spacing[2],
  },
  label: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  card: {
    width: 108,
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2.5],
    gap: 3,
  },
  name: {
    ...textStyles.caption,
    fontSize: 12.5,
    fontWeight: '600',
    color: roles.textPrimary,
  },
  muscle: {
    ...textStyles.caption,
    fontSize: 11,
    color: roles.textMuted,
    textTransform: 'capitalize',
  },
});
