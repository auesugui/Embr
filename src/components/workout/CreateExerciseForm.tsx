// =============================================================================
// CreateExerciseForm — the exercise picker's New Exercise step
// =============================================================================
// Opened from the picker's Create row with the search text as the name. Saving
// adds the exercise to the user's library and hands its id back, so the picker
// adds it wherever it was opened from.

import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Equipment, MuscleGroup } from '@/data';
import { useCustomExerciseStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { Metric } from '@/types';
import { haptics } from '@/utils/haptics';

// The muscles most exercises train first. More… shows the rest.
const MAIN_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'core',
];
const MORE_MUSCLES: MuscleGroup[] = ['forearms', 'calves', 'traps'];
const EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'band',
];

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Chip({
  text,
  selected,
  onPress,
}: {
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="radio"
      aria-checked={selected}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
    </Pressable>
  );
}

export function CreateExerciseForm({
  initialName,
  onSaved,
}: {
  initialName: string;
  onSaved: (exerciseId: string) => void;
}) {
  const addExercise = useCustomExerciseStore((state) => state.addExercise);
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [metric, setMetric] = useState<Metric>('reps');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous, unlike state: a second tap before the save finishes must not
  // create the exercise twice.
  const savingRef = useRef(false);

  const choose =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      haptics.selection();
      setError(null);
      setter(value);
    };

  const muscles =
    showMore || (muscle && MORE_MUSCLES.includes(muscle))
      ? [...MAIN_MUSCLES, ...MORE_MUSCLES]
      : MAIN_MUSCLES;

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!muscle) return setError('Pick the main muscle.');
    if (!equipment) return setError('Pick the equipment.');

    savingRef.current = true;
    try {
      const result = await addExercise({ name, primaryMuscle: muscle, equipment, metric });
      if (!result.ok) {
        savingRef.current = false;
        setError(result.error);
        haptics.warning();
        return;
      }
      haptics.success();
      onSaved(result.exercise.id);
    } catch {
      savingRef.current = false;
      setError('Couldn’t save this exercise. Nothing was added, so you can try again.');
      haptics.warning();
    }
  };

  return (
    <>
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(text) => {
            setError(null);
            setName(text);
          }}
          placeholder="Exercise name"
          placeholderTextColor={colors.text.muted}
          autoCorrect={false}
          accessibilityLabel="Exercise name"
        />

        <Text style={styles.fieldLabel}>Main muscle</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {muscles.map((m) => (
            <Chip
              key={m}
              text={label(m)}
              selected={muscle === m}
              onPress={() => choose(setMuscle)(m)}
            />
          ))}
          {muscles === MAIN_MUSCLES && (
            <Pressable onPress={() => setShowMore(true)} style={styles.chip}>
              <Text style={styles.chipText}>More…</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.fieldLabel}>Equipment</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EQUIPMENT.map((e) => (
            <Chip
              key={e}
              text={label(e)}
              selected={equipment === e}
              onPress={() => choose(setEquipment)(e)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Logged as</Text>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {(['reps', 'time'] as const).map((m) => {
            const selected = metric === m;
            return (
              <Pressable
                key={m}
                onPress={() => choose(setMetric)(m)}
                style={[styles.segmentOption, selected && styles.chipSelected]}
                accessibilityRole="radio"
                aria-checked={selected}
              >
                <Text style={[styles.segmentText, selected && styles.chipTextSelected]}>
                  {m === 'reps' ? 'Reps' : 'Seconds'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.saveButton} onPress={handleSave} accessibilityRole="button">
        <Text style={styles.saveText}>Save and add</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    flexShrink: 1,
  },
  fieldLabel: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    ...textStyles.body,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  chipSelected: {
    backgroundColor: roles.accent,
    borderColor: roles.accent,
  },
  chipText: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: roles.onAccent,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  segmentText: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  error: {
    ...textStyles.caption,
    color: roles.error,
    marginTop: spacing[3],
  },
  saveButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  saveText: {
    ...textStyles.button,
    color: roles.onAccent,
  },
});
