// =============================================================================
// ExercisePickerResults — the picker's rows, or why there are none
// =============================================================================
// An empty list is not one state: the chips can be too narrow, the typed name
// can be new, or the typed name can exist and be hidden by the chips.
// `describeEmptyPicker` decides which answer this is; this file renders it.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronRight } from '@/components/icons';
import type { ExerciseDefinition } from '@/data';
import type { EmptyPicker } from '@/lib/exercise-filter';
import { radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

function ExerciseRow({
  exercise,
  isOwn,
  onSelect,
}: {
  exercise: ExerciseDefinition;
  isOwn: boolean;
  onSelect: (id: string) => void;
}) {
  const handle = () => {
    haptics.selection();
    onSelect(exercise.id);
  };
  return (
    <Pressable style={styles.row} onPress={handle}>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          {isOwn && <Text style={styles.ownBadge}>YOURS</Text>}
        </View>
        <Text style={styles.rowMeta}>
          {exercise.primaryMuscle} · {exercise.equipment.join('/')}
        </Text>
      </View>
      <ChevronRight size={18} color={roles.textMuted} style={styles.rowChevron} />
    </Pressable>
  );
}

const MemoRow = memo(ExerciseRow);

export function ExercisePickerResults({
  results,
  ownIds,
  empty,
  underCreate,
  onSelect,
  onClearChips,
}: {
  results: ExerciseDefinition[];
  ownIds: Set<string>;
  /** Null while there are rows to show. */
  empty: EmptyPicker | null;
  /** The create offer is above this, which is answer enough on its own. */
  underCreate: boolean;
  onSelect: (id: string) => void;
  onClearChips: () => void;
}) {
  if (empty !== null) {
    return (
      <View style={[styles.empty, underCreate && styles.emptyUnderCreate]}>
        <Text style={underCreate ? styles.emptyHint : styles.emptyLine}>{empty.line}</Text>
        {!underCreate && empty.hint !== null && <Text style={styles.emptyHint}>{empty.hint}</Text>}
        {/* Chips only. Search text is the user's typing and is never thrown
            away by a button they did not aim at it. */}
        {empty.canClear && (
          <Pressable style={styles.clearButton} onPress={onClearChips} accessibilityRole="button">
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      {results.map((exercise) => (
        <MemoRow
          key={exercise.id}
          exercise={exercise}
          isOwn={ownIds.has(exercise.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: roles.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowName: {
    ...textStyles.body,
    color: roles.textPrimary,
  },
  ownBadge: {
    ...textStyles.caption,
    fontSize: 11,
    fontWeight: '700',
    color: roles.accentText,
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    overflow: 'hidden',
  },
  rowMeta: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rowChevron: {
    marginLeft: spacing[3],
  },
  empty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[6],
    paddingHorizontal: spacing[2],
  },
  emptyUnderCreate: {
    paddingTop: spacing[4],
  },
  emptyLine: {
    ...textStyles.body,
    color: roles.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...textStyles.caption,
    color: roles.textMuted,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: spacing[1],
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.full,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
  },
  clearButtonText: {
    ...textStyles.button,
    color: roles.accentText,
  },
});
