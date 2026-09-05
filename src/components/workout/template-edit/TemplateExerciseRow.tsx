// =============================================================================
// TemplateExerciseRow — one movement in the day being edited
// =============================================================================
// The row states its scheme, and — when it is the FIRST member of a block —
// the clock above it. Stating the clock once is what makes a three-movement
// circuit read as one thing rather than three exercises that happen to share
// a duration.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArrowDown, ArrowUp, ChevronRight, X } from '@/components/icons';
import type { TemplateExercise } from '@/data';
import { getExerciseById } from '@/data';
import { describeBlock, describeScheme, isTimed, resolveBlock } from '@/lib/blocks';
import { colors, roles, spacing, textStyles } from '@/theme';
import type { WorkoutBlock } from '@/types';
import { haptics } from '@/utils/haptics';
import { ControlButton } from './ControlButton';

interface TemplateExerciseRowProps {
  templateEx: TemplateExercise;
  index: number;
  /** Total rows in the day, so the move-down control knows when to disable. */
  count: number;
  /** The day's blocks, for resolving this row's clock. */
  blocks: WorkoutBlock[] | undefined;
  /** True when this row is the first member of its block. */
  startsBlock: boolean;
  onEdit: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

export function TemplateExerciseRow({
  templateEx,
  index,
  count,
  blocks,
  startsBlock,
  onEdit,
  onMove,
  onRemove,
}: TemplateExerciseRowProps) {
  const exercise = getExerciseById(templateEx.exerciseId);
  const rowBlock = resolveBlock(templateEx, blocks);

  return (
    <View>
      {startsBlock && <Text style={styles.blockHeading}>{describeBlock(rowBlock)}</Text>}
      <View
        style={[styles.exerciseRow, templateEx.blockId !== undefined && styles.exerciseRowInBlock]}
      >
        <Pressable style={styles.exerciseMain} onPress={onEdit}>
          <View style={styles.exerciseNumber}>
            <Text style={styles.exerciseNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{exercise?.name ?? 'Unknown Exercise'}</Text>
            <Text style={styles.exerciseDetails}>
              {isTimed(rowBlock.mode)
                ? describeScheme(templateEx, blocks)
                : `${describeScheme(templateEx, blocks)} · ${Math.round(
                    templateEx.restSeconds / 60
                  )}m rest`}
            </Text>
          </View>
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>Edit</Text>
            <ChevronRight size={14} color={roles.textMuted} />
          </View>
        </Pressable>

        <View style={styles.rowControls}>
          <ControlButton
            icon={ArrowUp}
            label="Move up"
            disabled={index === 0}
            onPress={() => {
              haptics.tap();
              onMove(index, index - 1);
            }}
          />
          <ControlButton
            icon={ArrowDown}
            label="Move down"
            disabled={index === count - 1}
            onPress={() => {
              haptics.tap();
              onMove(index, index + 1);
            }}
          />
          <ControlButton
            icon={X}
            label="Remove exercise"
            tone="danger"
            onPress={() => {
              haptics.warning();
              onRemove();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockHeading: {
    ...textStyles.label,
    color: roles.accentText,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
    marginTop: spacing[2],
  },
  exerciseRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
    padding: spacing[3],
  },
  exerciseRowInBlock: {
    borderLeftWidth: 2,
    borderLeftColor: roles.accent,
    marginLeft: spacing[2],
  },
  exerciseMain: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 2,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing[2],
  },
  editHintText: {
    ...textStyles.caption,
    color: roles.textMuted,
  },
  rowControls: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    paddingLeft: 40,
  },
});
