// =============================================================================
// EditExerciseSheet — one exercise's scheme, block and place in the day
// =============================================================================
// The editor's one modal. It answers four questions about a row: what movement,
// how the work is bounded (sets, AMRAP, for time, EMOM), the numbers for that
// bounding, and whether it shares a clock with its neighbours.
//
// Drafts stay local until Save. A half-typed rep range is not a state the
// stored program should ever be in, so nothing here writes through on
// keystroke.

import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RefreshCw } from '@/components/icons';
import { getExerciseById } from '@/data';
import { useKeyboardInset } from '@/hooks';
import {
  AMRAP_REPS_LABEL,
  BLOCK_MODES,
  DEFAULT_AMRAP_SECONDS,
  allowsMultipleMembers,
  blockModeHint,
  blockModeLabel,
  clampAmrapSeconds,
  clampIntervalSeconds,
  clampRounds,
  describeBlock,
  hasRepTargets,
  isTimed,
  resolveBlock,
} from '@/lib/blocks';
import { exerciseMetric } from '@/lib/metric';
import { useTemplateStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { BlockMode } from '@/types';
import { haptics } from '@/utils/haptics';
import { ModeOption } from './ModeOption';
import { SchemeFields } from './SchemeFields';
import { SheetActions } from './SheetActions';

/** Which row of which day the sheet is pointed at. */
export interface EditTarget {
  dayId: string;
  index: number;
}

interface EditExerciseSheetProps {
  target: EditTarget | null;
  templateId: string;
  onClose: () => void;
  onSwap: () => void;
  onRemove: (dayId: string, index: number) => void;
  updateSetRepScheme: (
    templateId: string,
    dayId: string,
    exerciseIndex: number,
    patch: {
      sets?: number;
      reps?: string;
      restSeconds?: number;
    }
  ) => void;
}

export function EditExerciseSheet({
  target,
  templateId,
  onClose,
  onSwap,
  onRemove,
  updateSetRepScheme,
}: EditExerciseSheetProps) {
  // PWA: KeyboardAvoidingView does nothing in a browser. See useKeyboardInset.
  const keyboardInset = useKeyboardInset();
  const insets = useSafeAreaInsets();

  // Resolve the current exercise reactively from the store so swaps reflect.
  const day = useTemplateStore((state) => {
    if (!target) return undefined;
    return state.templates
      .find((t) => t.id === templateId)
      ?.days.find((d) => d.id === target.dayId);
  });
  const exercise = useMemo(() => {
    if (!target || !day) return undefined;
    return day.exercises[target.index];
  }, [target, day]);

  const setExerciseMode = useTemplateStore((state) => state.setExerciseMode);
  const updateBlock = useTemplateStore((state) => state.updateBlock);
  const joinBlock = useTemplateStore((state) => state.joinBlock);

  const [setsDraft, setSetsDraft] = useState(3);
  const [repsDraft, setRepsDraft] = useState('');
  const [restDraft, setRestDraft] = useState(90);
  const [modeDraft, setModeDraft] = useState<BlockMode>('sets');
  const [durationDraft, setDurationDraft] = useState(DEFAULT_AMRAP_SECONDS);
  const [intervalDraft, setIntervalDraft] = useState(60);
  const [roundsDraft, setRoundsDraft] = useState(5);

  // Initialize the drafts from the targeted exercise. Pulling primitive deps
  // means stepper/typing edits (which stay local) never re-trigger this, while
  // a swap or opening a different row does.
  const editedExerciseId = exercise?.exerciseId;
  const editedSets = exercise?.sets;
  const editedReps = exercise?.reps;
  const editedRest = exercise?.restSeconds;
  // Resolved rather than read raw, so a legacy `mode: 'amrap'` exercise opens
  // in the editor as what it is (`amrap_reps`) instead of falling back to sets.
  const resolved = useMemo(() => resolveBlock(exercise, day?.blocks), [exercise, day?.blocks]);
  const editedMode = resolved.mode;
  const editedDuration = resolved.durationSeconds;
  const editedInterval = resolved.intervalSeconds;
  const editedRounds = resolved.rounds;
  useEffect(() => {
    if (editedExerciseId !== undefined) {
      setSetsDraft(editedSets ?? 3);
      setRepsDraft(editedReps ?? '');
      setRestDraft(editedRest ?? 90);
      setModeDraft(editedMode);
      setDurationDraft(editedDuration || DEFAULT_AMRAP_SECONDS);
      setIntervalDraft(editedInterval);
      setRoundsDraft(editedRounds);
    }
  }, [
    editedExerciseId,
    editedSets,
    editedReps,
    editedRest,
    editedMode,
    editedDuration,
    editedInterval,
    editedRounds,
  ]);

  if (!target || !day || !exercise) return null;

  const exerciseName = getExerciseById(exercise.exerciseId)?.name ?? 'Unknown Exercise';

  const timedDraft = isTimed(modeDraft);
  // Only `amrap_reps` drops the rep target. A circuit member keeps one — "5
  // pull-ups" IS the prescription, and the clock bounds the rounds, not the reps.
  const keepsReps = hasRepTargets(modeDraft);

  // Blocks on this day that could take another movement, so an exercise can be
  // folded into a circuit that already exists rather than only starting one.
  const joinableBlocks = (day.blocks ?? []).filter(
    (b) => allowsMultipleMembers(b.mode) && b.id !== exercise.blockId
  );

  const commit = () => {
    const safeSets = Math.max(1, Math.min(20, Number.parseInt(String(setsDraft), 10) || 1));
    // `amrap_reps` has no rep target by definition — the label is the value, so
    // the scheme still reads correctly anywhere reps are rendered as text.
    const safeReps = keepsReps ? repsDraft.trim() || exercise.reps : AMRAP_REPS_LABEL;
    const safeRest = Math.max(0, Math.min(600, Number.parseInt(String(restDraft), 10) || 0));

    // Order matters: the mode change creates or removes the block, and the
    // clock patch has to land on a block that already exists.
    updateSetRepScheme(templateId, target.dayId, target.index, {
      sets: safeSets,
      reps: safeReps,
      restSeconds: safeRest,
    });
    setExerciseMode(templateId, target.dayId, target.index, modeDraft);

    if (timedDraft) {
      const blockId = useTemplateStore
        .getState()
        .getTemplate(templateId)
        ?.days.find((d) => d.id === target.dayId)?.exercises[target.index]?.blockId;

      if (blockId) {
        updateBlock(templateId, target.dayId, blockId, {
          durationSeconds: clampAmrapSeconds(durationDraft),
          intervalSeconds: clampIntervalSeconds(intervalDraft),
          rounds: clampRounds(roundsDraft),
        });
      }
    }

    haptics.success();
    onClose();
  };

  const handleJoin = (blockId: string) => {
    haptics.success();
    joinBlock(templateId, target.dayId, target.index, blockId);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { paddingBottom: keyboardInset }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            // With the keyboard up it already fills the bottom of the screen,
            // so the home-indicator inset would be padding against nothing.
            { paddingBottom: keyboardInset > 0 ? spacing[5] : insets.bottom + spacing[5] },
          ]}
          onPress={(e) => {
            e.stopPropagation();
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Edit Exercise</Text>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exerciseName}
            </Text>
          </View>

          {/* Header and actions stay pinned; everything between them scrolls.
              This sheet is taller than the room a keyboard leaves, so without
              somewhere to give it just overflows upward and Save goes off the
              top instead of under the keyboard — a different bug, not a fix. */}
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Pressable style={styles.swapButton} onPress={onSwap}>
              <RefreshCw size={15} color={roles.accentText} />
              <Text style={styles.swapButtonText}>Swap Exercise</Text>
            </Pressable>

            {/* How the block is bounded: a set count, or one of four clocks. */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Scheme</Text>
              <View style={styles.modeGrid}>
                {BLOCK_MODES.map((mode) => (
                  <ModeOption
                    key={mode}
                    label={blockModeLabel(mode)}
                    selected={modeDraft === mode}
                    onPress={() => {
                      haptics.selection();
                      setModeDraft(mode);
                      // A timed block runs continuously; a rest default carried
                      // over from a set scheme would fight its clock.
                      if (isTimed(mode)) setRestDraft(0);
                      // Coming back to a rep target the field may still literally
                      // say "AMRAP", which is not a rep target. Restore one.
                      if (hasRepTargets(mode)) {
                        setRepsDraft((r) =>
                          r.trim().toUpperCase() === AMRAP_REPS_LABEL ? '8-12' : r
                        );
                      }
                    }}
                  />
                ))}
              </View>
              <Text style={styles.fieldHint}>{blockModeHint(modeDraft)}</Text>
            </View>

            {/* Fold this movement into a circuit that already exists. This is
                what makes "5 pull-ups, 10 push-ups, 15 squats" one block
                instead of three separate clocks. */}
            {joinableBlocks.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Add to a block</Text>
                {joinableBlocks.map((block) => (
                  <Pressable
                    key={block.id}
                    style={styles.joinButton}
                    onPress={() => handleJoin(block.id)}
                  >
                    <Text style={styles.joinButtonText}>
                      Join {describeBlock(resolveBlock({ blockId: block.id }, day.blocks))}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.fieldHint}>
                  Joining moves this movement next to the others and puts them all under one clock.
                </Text>
              </View>
            )}

            <SchemeFields
              metric={exerciseMetric({ id: exercise.exerciseId })}
              mode={modeDraft}
              sets={setsDraft}
              reps={repsDraft}
              rest={restDraft}
              duration={durationDraft}
              interval={intervalDraft}
              rounds={roundsDraft}
              onSets={setSetsDraft}
              onReps={setRepsDraft}
              onRest={setRestDraft}
              onDuration={setDurationDraft}
              onInterval={setIntervalDraft}
              onRounds={setRoundsDraft}
            />
          </ScrollView>

          <SheetActions
            onRemove={() => onRemove(target.dayId, target.index)}
            onCancel={onClose}
            onSave={commit}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  body: {
    flexShrink: 1,
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[5],
    maxHeight: '92%',
    // RN defaults flexShrink to 0; without this the sheet keeps its full
    // content height and pushes its own top off the screen when the keyboard
    // leaves it less room than it wants.
    flexShrink: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  exerciseName: {
    ...textStyles.body,
    color: colors.text.secondary,
    maxWidth: '85%',
  },
  swapButton: {
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  swapButtonText: {
    ...textStyles.button,
    color: roles.accentText,
    fontWeight: '600',
  },
  field: {
    marginBottom: spacing[4],
  },
  fieldLabel: {
    ...textStyles.label,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  fieldHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[2],
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  joinButton: {
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  joinButtonText: {
    ...textStyles.button,
    color: roles.accentText,
  },
});
