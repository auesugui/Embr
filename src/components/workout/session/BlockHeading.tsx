// =============================================================================
// BlockHeading — what you are about to do
// =============================================================================
// In a circuit the prescription IS the workout, so it sits at the top as a
// list rather than being spread across cards you have to tab between. A single
// movement gets its name, its muscles, and the form diagram behind a toggle —
// the 3-second rule means logging a set must never be behind a picture.

import { StyleSheet, Text, View } from 'react-native';

import { ExerciseDemo } from '@/components/workout/ExerciseDemo';
import { colors, roles, spacing, textStyles } from '@/theme';
import type { Exercise } from '@/types';

interface BlockHeadingProps {
  /** Every movement in the block. One entry means a single-movement block. */
  entries: Array<{ exercise: Exercise | undefined; index: number }>;
}

export function BlockHeading({ entries }: BlockHeadingProps) {
  const isCircuit = entries.length > 1;
  const single = entries[0]?.exercise;

  if (isCircuit) {
    return (
      <>
        <Text style={styles.exerciseName}>Circuit</Text>
        <View style={styles.prescription}>
          {entries.map(({ exercise, index }) => (
            <View key={exercise?.id ?? index} style={styles.prescriptionRow}>
              <Text style={styles.prescriptionReps}>{exercise?.targetReps ?? '—'}</Text>
              <Text style={styles.prescriptionName}>{exercise?.name}</Text>
            </View>
          ))}
        </View>
      </>
    );
  }

  if (!single) return null;

  return (
    <>
      <Text style={styles.exerciseName}>{single.name}</Text>
      <Text style={styles.exerciseMeta}>{single.muscleGroups.join(', ')}</Text>

      {/* Collapsed by default — opt in when you want the reminder. */}
      <ExerciseDemo exerciseId={single.id.replace(/-\d+$/, '')} />
    </>
  );
}

const styles = StyleSheet.create({
  exerciseName: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  exerciseMeta: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  prescription: {
    gap: spacing[1],
    marginBottom: spacing[4],
  },
  prescriptionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
  },
  prescriptionReps: {
    ...textStyles.number,
    fontSize: 18,
    color: roles.accent,
    minWidth: 44,
  },
  prescriptionName: {
    ...textStyles.body,
    color: roles.textPrimary,
  },
});
