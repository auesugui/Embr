// =============================================================================
// SummaryExercises — what you actually did, grouped by block
// =============================================================================
// Grouped so a circuit reads as one entry with its rounds and its clock, rather
// than three exercises that each did the same number of sets. The clock's
// recorded time is stated for a `for_time` block, since that IS its result.

import { RevealRow } from '@/components/celebration';
import { StyleSheet, Text, View } from 'react-native';

import {
  blockReps,
  completedRounds,
  describeBlock,
  formatClock,
  groupIntoBlocks,
  isTimed,
} from '@/lib/blocks';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { Exercise, WorkoutBlock } from '@/types';

interface SummaryExercisesProps {
  exercises: Exercise[];
  /** Absent on logs written before blocks existed — those were all sets. */
  blocks: WorkoutBlock[] | undefined;
  /** Recorded finish times for `for_time` blocks, keyed by block key. */
  blockTimes: Record<string, number> | undefined;
  /** Position in the screen's staggered reveal. */
  revealIndex: number;
}

export function SummaryExercises({
  exercises,
  blocks,
  blockTimes,
  revealIndex,
}: SummaryExercisesProps) {
  return (
    <RevealRow index={revealIndex} style={styles.exercisesCard}>
      <Text style={styles.exercisesTitle}>Exercises Completed</Text>

      {/* Grouped by block, so a circuit is one entry with its rounds and
              its clock stated once. Listing each movement separately repeated
              "AMRAP · 20 min" on every line for something done as one thing. */}
      {groupIntoBlocks(exercises, blocks).map(({ block, entries }) => {
        const rounds = completedRounds(entries);
        const reps = blockReps(entries);
        const anyPR = entries.some(({ exercise }) => exercise.sets.some((s) => s.isPR));
        const timed = isTimed(block.mode);
        const finish = block.id ? blockTimes?.[block.id] : undefined;

        // A lone exercise keeps exactly the line it always had.
        if (entries.length === 1 && !timed) {
          const [{ exercise }] = entries;
          const loggedSets = exercise.sets.filter((s) => s.logged);
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseSets}>
                  {`${loggedSets.length} ${loggedSets.length === 1 ? 'set' : 'sets'} · ${reps} reps`}
                </Text>
              </View>
              {anyPR && (
                <View style={styles.prTag}>
                  <Text style={styles.prTagText}>PR</Text>
                </View>
              )}
            </View>
          );
        }

        return (
          <View key={block.id ?? entries[0].exercise.id} style={styles.exerciseRow}>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>
                {entries.map(({ exercise }) => exercise.name).join(' · ')}
              </Text>
              <Text style={styles.exerciseSets}>
                {/* A count-up block already states its round count in the
                        tally, so repeating "2 rounds for time" after "2 rounds"
                        just says rounds twice. Its result is the time. */}
                {`${rounds} ${rounds === 1 ? 'round' : 'rounds'} · ${reps} reps · ${
                  block.mode === 'for_time'
                    ? finish !== undefined
                      ? `for time in ${formatClock(finish)}`
                      : 'for time'
                    : describeBlock(block)
                }`}
              </Text>
            </View>
            {anyPR && (
              <View style={styles.prTag}>
                <Text style={styles.prTagText}>PR</Text>
              </View>
            )}
          </View>
        );
      })}
    </RevealRow>
  );
}

const styles = StyleSheet.create({
  exercisesCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  exercisesTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  exerciseSets: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  prTag: {
    backgroundColor: colors.reward.pr + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  prTagText: {
    ...textStyles.caption,
    color: colors.reward.pr,
    fontWeight: '600',
  },
});
