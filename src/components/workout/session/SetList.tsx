// =============================================================================
// SetList — the single-movement logging surface
// =============================================================================
// One row per set: a quick ladder of rep counts, or the logged result once it
// lands. The ladder is the 3-second rule made concrete — the common case is one
// tap, and the modal behind "..." is for everything else.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRFlash, Settle } from '@/components/celebration';
import { exerciseMetric, formatCompact, formatQuantity } from '@/lib/metric';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { Exercise, WeightUnit } from '@/types';

interface SetListProps {
  exercise: Exercise;
  exerciseIndex: number;
  /** Rows read "Round N" inside a timed block, "Set N" otherwise. */
  timed: boolean;
  /** The ladder, prescription first inside a timed block. */
  quickReps: number[];
  /** The prescribed count, highlighted in the ladder. Null outside a block. */
  target: number | null;
  units: WeightUnit;
  /** Last weight used for this movement, for the unlogged-row hint. */
  lastWeight: number | null;
  lastWeightUnit: WeightUnit;
  /** Whether that remembered weight was logged in the current unit. */
  unitMatches: boolean;
  /** Open-ended block: rounds keep going, so offer a manual extra row. */
  canAddRound: boolean;
  onQuickLog: (exerciseIndex: number, setIndex: number, reps: number) => void;
  onCustomInput: (exerciseIndex: number, setIndex: number) => void;
  onEditSet: (exerciseIndex: number, setIndex: number) => void;
  onAddRound: () => void;
}

export function SetList({
  exercise,
  exerciseIndex,
  timed,
  quickReps,
  target,
  units,
  lastWeight,
  lastWeightUnit,
  unitMatches,
  canAddRound,
  onQuickLog,
  onCustomInput,
  onEditSet,
  onAddRound,
}: SetListProps) {
  const hasWeight = lastWeight !== null && lastWeight > 0;
  // A hold logs seconds, not reps. Everything in this list — the ladder, the
  // logged result — has to say so, or "45" reads as forty-five plank reps.
  const metric = exerciseMetric(exercise);

  return (
    <View style={styles.setsContainer}>
      {exercise.sets.map((set, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: set positions are stable and never reordered
          key={index}
          style={styles.setRow}
        >
          <View style={styles.setRowHeader}>
            <Text style={styles.setNumber}>
              {timed ? `Round ${index + 1}` : `Set ${index + 1}`}
            </Text>
            {!set.logged && (
              <Text style={styles.weightHint}>
                {hasWeight
                  ? unitMatches
                    ? `@ ${lastWeight} ${lastWeightUnit} · tap ... to change`
                    : `last: ${lastWeight} ${lastWeightUnit} · tap ... to set ${units}`
                  : 'no weight · tap ... to set'}
              </Text>
            )}
          </View>

          {set.logged ? (
            <Settle from={0.96}>
              <PRFlash active={set.isPR} style={styles.prFlashWrapper}>
                <Pressable style={styles.loggedSet} onPress={() => onEditSet(exerciseIndex, index)}>
                  <Text style={styles.loggedReps}>{formatQuantity(set.reps ?? 0, metric)}</Text>
                  {set.weight && (
                    <Text style={styles.loggedWeight}>
                      @ {set.weight} {units}
                    </Text>
                  )}
                  {set.isPR && <Text style={styles.prBadge}>PR!</Text>}
                  <Text style={styles.editHint}>tap to edit</Text>
                </Pressable>
              </PRFlash>
            </Settle>
          ) : (
            <View style={styles.logButtons}>
              {quickReps.map((reps) => {
                // The prescription leads and is highlighted wherever there is
                // one — same one-tap rule as a circuit. A plain set scheme of a
                // counted movement has none, and keeps its generic ladder.
                const isTarget = target !== null && reps === target;
                return (
                  <Pressable
                    key={reps}
                    style={[styles.logButton, isTarget && styles.logButtonTarget]}
                    onPress={() => onQuickLog(exerciseIndex, index, reps)}
                  >
                    <Text style={[styles.logButtonText, isTarget && styles.logButtonTextTarget]}>
                      {formatCompact(reps, metric)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={styles.customButton}
                onPress={() => onCustomInput(exerciseIndex, index)}
              >
                <Text style={styles.customButtonText}>...</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {/* Rounds are open-ended. Logging the last row opens the next one
          automatically; this is the manual escape hatch (e.g. after clearing a
          row, or to queue one up before you start). */}
      {canAddRound && (
        <Pressable style={styles.addRoundButton} onPress={onAddRound}>
          <Text style={styles.addRoundText}>Add round</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  setsContainer: {
    gap: spacing[3],
  },
  setRow: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  setRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  setNumber: {
    ...textStyles.label,
    color: colors.text.muted,
  },
  weightHint: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  prFlashWrapper: {
    borderRadius: radius.md,
  },
  loggedSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
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
  editHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginLeft: 'auto',
  },
  logButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  logButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  logButtonTarget: {
    backgroundColor: roles.accent,
  },
  logButtonText: {
    ...textStyles.numberSmall,
    color: colors.text.primary,
  },
  logButtonTextTarget: {
    color: colors.background.primary,
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
  addRoundButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  addRoundText: {
    ...textStyles.button,
    color: roles.accentText,
  },
});
