// =============================================================================
// DayExerciseList — the movements in one session of a program
// =============================================================================
// Read-only: this is the "should I run this?" view, not the editor. The clock
// for a block is stated once, above its first member, so a circuit reads as one
// thing rather than three exercises that happen to share a duration.

import { StyleSheet, Text, View } from 'react-native';

import { getExerciseById } from '@/data';
import type { TemplateDay } from '@/data';
import { describeScheme, isTimed, resolveBlock } from '@/lib/blocks';
import { colors, radius, spacing, textStyles } from '@/theme';

export function DayExerciseList({ day }: { day: TemplateDay }) {
  return (
    <View style={styles.section}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayName}>{day.name}</Text>
      </View>

      {/* Exercise List */}
      <View style={styles.exerciseList}>
        {day.exercises.map((templateEx, index) => {
          const exercise = getExerciseById(templateEx.exerciseId);
          return (
            <View key={`${templateEx.exerciseId}-${index}`} style={styles.exerciseRow}>
              <View style={styles.exerciseNumber}>
                <Text style={styles.exerciseNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise?.name ?? 'Unknown'}</Text>
                <Text style={styles.exerciseDetails}>{describeScheme(templateEx, day.blocks)}</Text>
              </View>
              <Text style={styles.restTime}>
                {isTimed(resolveBlock(templateEx, day.blocks).mode)
                  ? 'no rest'
                  : `${Math.floor(templateEx.restSeconds / 60)}m`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing[6],
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  dayName: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  exerciseList: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  exerciseNumberText: {
    ...textStyles.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  exerciseDetails: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  restTime: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
});
