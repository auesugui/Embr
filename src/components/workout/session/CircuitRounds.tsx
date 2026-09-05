// =============================================================================
// CircuitRounds — banked rounds, and the one you are in
// =============================================================================
// A circuit is worked as a unit: five pull-ups, ten push-ups, fifteen squats,
// THEN you have finished a round. So the primary action is one button for the
// whole round. Logging it movement by movement was three taps for something
// done as one thing, and over twenty rounds of Cindy that is sixty taps against
// a running clock.
//
// Per-movement logging is still here, demoted, because a round the clock cuts
// short is real and has to be recordable.
//
// Banked rounds collapse to a line each. Twenty rounds must not become sixty
// rows to scroll past to reach the button.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRFlash, Settle } from '@/components/celebration';
import { targetRepCount } from '@/lib/blocks';
import { exerciseMetric, formatCompact } from '@/lib/metric';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { Exercise, WeightUnit } from '@/types';

export interface CircuitEntry {
  exercise: Exercise | undefined;
  index: number;
}

interface CircuitRoundsProps {
  entries: CircuitEntry[];
  /** Round indices every member finished — these collapse to one line each. */
  loggedRounds: number[];
  /** The round in progress, or null when every round is complete. */
  openRoundIndex: number | null;
  /** Every movement has a rep target, so the whole round is one tap. */
  roundFullyPrescribed: boolean;
  units: WeightUnit;
  onLogRound: () => void;
  onQuickLog: (exerciseIndex: number, setIndex: number, reps: number) => void;
  onCustomInput: (exerciseIndex: number, setIndex: number) => void;
  onEditSet: (exerciseIndex: number, setIndex: number) => void;
}

export function CircuitRounds({
  entries,
  loggedRounds,
  openRoundIndex,
  roundFullyPrescribed,
  units,
  onLogRound,
  onQuickLog,
  onCustomInput,
  onEditSet,
}: CircuitRoundsProps) {
  return (
    <View style={styles.setsContainer}>
      {loggedRounds.map((round) => (
        <View key={`done-${round}`} style={styles.roundDoneRow}>
          <Text style={styles.roundDoneLabel}>Round {round + 1}</Text>
          <View style={styles.roundDoneReps}>
            {entries.map(({ exercise, index }) => {
              const set = exercise?.sets[round];
              if (!exercise || !set?.logged) return null;
              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => onEditSet(index, round)}
                  style={styles.roundDoneChip}
                >
                  <Text style={styles.roundDoneChipText}>
                    {formatCompact(set.reps ?? 0, exerciseMetric(exercise))}
                  </Text>
                  {set.isPR && <Text style={styles.prBadge}>PR</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {openRoundIndex !== null && (
        <Settle from={0.98}>
          <View style={styles.roundGroup}>
            <Text style={styles.roundHeading}>Round {openRoundIndex + 1}</Text>

            {/* The one tap that matters. Logs every movement at its
                prescription and opens the next round. */}
            {roundFullyPrescribed && (
              <Pressable style={styles.roundDoneButton} onPress={onLogRound}>
                <Text style={styles.roundDoneButtonText}>Round done</Text>
                <Text style={styles.roundDoneButtonMeta}>
                  {entries
                    .map(({ exercise }) =>
                      formatCompact(
                        targetRepCount(exercise?.targetReps) ?? 0,
                        exerciseMetric(exercise)
                      )
                    )
                    .join(' · ')}
                </Text>
              </Pressable>
            )}

            {/* The partial path. Deliberately quiet: it is what you reach for
                when the clock beat you, not the default. */}
            <Text style={styles.partialLabel}>
              {roundFullyPrescribed ? 'Or log one at a time' : 'Log each movement'}
            </Text>

            {entries.map(({ exercise, index }) => {
              const set = exercise?.sets[openRoundIndex];
              if (!exercise || !set) return null;
              const target = targetRepCount(exercise.targetReps);
              const metric = exerciseMetric(exercise);

              return (
                <View key={exercise.id} style={styles.circuitRow}>
                  <Text style={styles.circuitName} numberOfLines={1}>
                    {exercise.name}
                  </Text>

                  {set.logged ? (
                    <Settle from={0.96}>
                      <PRFlash active={set.isPR} style={styles.prFlashWrapper}>
                        <Pressable
                          style={styles.circuitLogged}
                          onPress={() => onEditSet(index, openRoundIndex)}
                        >
                          <Text style={styles.loggedReps}>
                            {formatCompact(set.reps ?? 0, metric)}
                          </Text>
                          {set.weight ? (
                            <Text style={styles.loggedWeight}>
                              @ {set.weight} {units}
                            </Text>
                          ) : null}
                          {set.isPR && <Text style={styles.prBadge}>PR!</Text>}
                        </Pressable>
                      </PRFlash>
                    </Settle>
                  ) : (
                    <View style={styles.circuitButtons}>
                      {target !== null && (
                        <Pressable
                          style={styles.circuitTargetButton}
                          onPress={() => onQuickLog(index, openRoundIndex, target)}
                        >
                          <Text style={styles.circuitTargetText}>
                            {formatCompact(target, metric)}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.customButton}
                        onPress={() => onCustomInput(index, openRoundIndex)}
                      >
                        <Text style={styles.customButtonText}>...</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Settle>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  setsContainer: {
    gap: spacing[3],
  },
  roundDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
  },
  roundDoneLabel: {
    ...textStyles.caption,
    color: roles.textSecondary,
  },
  roundDoneReps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  roundDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
  },
  roundDoneChipText: {
    ...textStyles.number,
    fontSize: 15,
    color: roles.textPrimary,
  },
  roundGroup: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  roundHeading: {
    ...textStyles.label,
    color: roles.textSecondary,
    letterSpacing: 0.5,
  },
  roundDoneButton: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
  },
  roundDoneButtonText: {
    ...textStyles.button,
    fontSize: 17,
    color: colors.background.primary,
  },
  roundDoneButtonMeta: {
    ...textStyles.caption,
    color: colors.background.primary,
    opacity: 0.8,
  },
  partialLabel: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[1],
  },
  circuitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  circuitName: {
    ...textStyles.body,
    color: roles.textPrimary,
    flex: 1,
  },
  circuitButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  circuitLogged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
  },
  circuitTargetButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: roles.border,
  },
  circuitTargetText: {
    ...textStyles.number,
    fontSize: 15,
    color: roles.textPrimary,
  },
  prFlashWrapper: {
    borderRadius: radius.md,
  },
  loggedReps: {
    // Was colors.semantic.success — the only green in the app, on the surface
    // you look at most. A logged set is the normal case, not a success state;
    // the Settle animation already marks that it landed.
    ...textStyles.numberSmall,
    color: roles.textPrimary,
  },
  loggedWeight: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  prBadge: {
    ...textStyles.label,
    color: colors.reward.pr,
    backgroundColor: colors.reward.pr + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  customButton: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  customButtonText: {
    ...textStyles.numberSmall,
    color: colors.text.secondary,
    letterSpacing: 2,
  },
});
