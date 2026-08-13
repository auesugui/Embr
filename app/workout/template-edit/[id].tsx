// =============================================================================
// IronQuest Template Editor — edit a personal (custom) template copy
// =============================================================================
// Reachable from the template detail screen's "Edit" action (personal copies
// only). All edits flow through useTemplateStore, which persists to
// AsyncStorage and recomputes FP distributions via the real engine. Built-in
// templates are never editable here — the editor only loads `isCustom` copies.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { type ComponentType, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ArrowDown, ArrowUp, ChevronRight, type IconProps, RefreshCw, X } from '@/components/icons';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { getExerciseById } from '@/data';
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
  describeScheme,
  formatAmrapWindow,
  formatClock,
  hasRepTargets,
  isTimed,
  resolveBlock,
} from '@/lib/blocks';
import { useTemplateStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { BlockMode } from '@/types';
import { haptics } from '@/utils/haptics';

interface EditTarget {
  dayId: string;
  index: number;
}

export default function TemplateEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const template = useTemplateStore((state) =>
    id ? state.templates.find((t) => t.id === id) : undefined
  );
  const renameTemplate = useTemplateStore((state) => state.renameTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const addExercise = useTemplateStore((state) => state.addExercise);
  const removeExercise = useTemplateStore((state) => state.removeExercise);
  const swapExercise = useTemplateStore((state) => state.swapExercise);
  const reorderExercises = useTemplateStore((state) => state.reorderExercises);
  const updateSetRepScheme = useTemplateStore((state) => state.updateSetRepScheme);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [nameDraft, setNameDraft] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 'add' opens the picker for the current day; 'swap' replaces the edited row.
  const [pickerMode, setPickerMode] = useState<'add' | 'swap'>('add');
  // Remembered target for a swap so the edit sheet can close (avoiding stacked
  // modals) while the picker is open.
  const [swapTarget, setSwapTarget] = useState<EditTarget | null>(null);

  // Sync the name input whenever the store's template name changes (e.g. after
  // a rename commits, or when navigating to a different template). Typing only
  // touches local draft state, so this never clobbers in-progress edits.
  const templateName = template?.name;
  useEffect(() => {
    if (templateName !== undefined) setNameDraft(templateName);
  }, [templateName]);

  if (!template || !template.isCustom) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Template' }} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {template ? 'Built-in templates can’t be edited.' : 'Template not found.'}
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const safeDayIndex = Math.min(selectedDayIndex, template.days.length - 1);
  const selectedDay = template.days[safeDayIndex];

  const commitName = () => {
    if (nameDraft.trim() && nameDraft.trim() !== template.name) {
      renameTemplate(template.id, nameDraft);
    } else {
      setNameDraft(template.name);
    }
  };

  const handleAddExercise = () => {
    if (!selectedDay) return;
    setPickerMode('add');
    setPickerOpen(true);
  };

  const handleSwapFromSheet = () => {
    if (!editTarget) return;
    // Stash the target and close the edit sheet so the picker isn't occluded by
    // a stacked modal (RN web renders both modals, and the sheet would intercept
    // the picker's pointer events).
    setSwapTarget(editTarget);
    setEditTarget(null);
    setPickerMode('swap');
    setPickerOpen(true);
  };

  const handlePickerSelect = (exerciseId: string) => {
    if (!selectedDay) return;
    if (pickerMode === 'add') {
      addExercise(template.id, selectedDay.id, exerciseId);
      haptics.success();
    } else if (pickerMode === 'swap' && swapTarget) {
      swapExercise(template.id, swapTarget.dayId, swapTarget.index, exerciseId);
      setSwapTarget(null);
      haptics.success();
    }
  };

  const handleDeleteTemplate = () => {
    haptics.warning();
    deleteTemplate(template.id);
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit Template' }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.customBadge}>
          <Text style={styles.customBadgeText}>Custom</Text>
        </View>
        <TextInput
          style={styles.nameInput}
          value={nameDraft}
          onChangeText={setNameDraft}
          onBlur={commitName}
          onSubmitEditing={commitName}
          returnKeyType="done"
          placeholder="Template name"
          placeholderTextColor={colors.text.muted}
        />
        <View style={styles.templateMeta}>
          <MetaChip label={`${template.daysPerWeek} days/week`} />
          <MetaChip label={template.difficulty} />
          <MetaChip label={`${template.days.length} sessions`} />
        </View>
      </View>

      {/* Day tabs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Session</Text>
        <View style={styles.dayTabs}>
          {template.days.map((day, index) => (
            <Pressable
              key={day.id}
              style={[styles.dayTab, index === safeDayIndex && styles.dayTabActive]}
              onPress={() => {
                haptics.selection();
                setSelectedDayIndex(index);
              }}
            >
              <Text style={[styles.dayTabText, index === safeDayIndex && styles.dayTabTextActive]}>
                {day.shortName}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Day editor */}
      {selectedDay && (
        <View style={styles.section}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayName}>{selectedDay.name}</Text>
            <Text style={styles.dayCount}>{selectedDay.exercises.length} exercises</Text>
          </View>

          <View style={styles.exerciseList}>
            {selectedDay.exercises.map((templateEx, index) => {
              const exercise = getExerciseById(templateEx.exerciseId);
              const rowBlock = resolveBlock(templateEx, selectedDay.blocks);
              // The clock is stated once, on the first member, so a three-
              // movement circuit reads as one thing rather than three
              // exercises that happen to share a duration.
              const startsBlock =
                templateEx.blockId !== undefined &&
                selectedDay.exercises.findIndex((e) => e.blockId === templateEx.blockId) === index;

              return (
                <View key={`${templateEx.exerciseId}-${index}`}>
                  {startsBlock && (
                    <Text style={styles.blockHeading}>{describeBlock(rowBlock)}</Text>
                  )}
                  <View
                    style={[
                      styles.exerciseRow,
                      templateEx.blockId !== undefined && styles.exerciseRowInBlock,
                    ]}
                  >
                    <Pressable
                      style={styles.exerciseMain}
                      onPress={() => {
                        haptics.tap();
                        setEditTarget({ dayId: selectedDay.id, index });
                      }}
                    >
                      <View style={styles.exerciseNumber}>
                        <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>
                          {exercise?.name ?? 'Unknown Exercise'}
                        </Text>
                        <Text style={styles.exerciseDetails}>
                          {isTimed(rowBlock.mode)
                            ? describeScheme(templateEx, selectedDay.blocks)
                            : `${describeScheme(templateEx, selectedDay.blocks)} · ${Math.round(
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
                          reorderExercises(template.id, selectedDay.id, index, index - 1);
                        }}
                      />
                      <ControlButton
                        icon={ArrowDown}
                        label="Move down"
                        disabled={index === selectedDay.exercises.length - 1}
                        onPress={() => {
                          haptics.tap();
                          reorderExercises(template.id, selectedDay.id, index, index + 1);
                        }}
                      />
                      <ControlButton
                        icon={X}
                        label="Remove exercise"
                        tone="danger"
                        onPress={() => {
                          haptics.warning();
                          removeExercise(template.id, selectedDay.id, index);
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable style={styles.addButton} onPress={handleAddExercise}>
            <Text style={styles.addButtonText}>＋ Add Exercise</Text>
          </Pressable>
        </View>
      )}

      {/* Delete */}
      <View style={styles.dangerSection}>
        <Pressable style={styles.deleteButton} onPress={handleDeleteTemplate}>
          <Text style={styles.deleteButtonText}>Delete Custom Template</Text>
        </Pressable>
        <Text style={styles.dangerHint}>
          Deletes this personal copy. The original built-in template is unaffected.
        </Text>
      </View>

      {/* Edit sheet + picker */}
      <EditExerciseSheet
        target={editTarget}
        templateId={template.id}
        onClose={() => setEditTarget(null)}
        onSwap={handleSwapFromSheet}
        onRemove={(dayId, index) => {
          removeExercise(template.id, dayId, index);
          setEditTarget(null);
        }}
        updateSetRepScheme={updateSetRepScheme}
      />

      <ExercisePickerModal
        visible={pickerOpen}
        title={pickerMode === 'add' ? 'Add Exercise' : 'Swap Exercise'}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        excludeIds={
          pickerMode === 'add' && selectedDay ? selectedDay.exercises.map((e) => e.exerciseId) : []
        }
      />
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Edit Exercise Sheet (sets / reps / rest + swap + remove)
// -----------------------------------------------------------------------------

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

function EditExerciseSheet({
  target,
  templateId,
  onClose,
  onSwap,
  onRemove,
  updateSetRepScheme,
}: EditExerciseSheetProps) {
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
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={sheetStyles.keyboardView}
        >
          <Pressable
            style={sheetStyles.sheet}
            onPress={(e) => {
              e.stopPropagation();
            }}
          >
            <View style={sheetStyles.header}>
              <Text style={sheetStyles.title}>Edit Exercise</Text>
              <Text style={sheetStyles.exerciseName} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>

            <Pressable style={sheetStyles.swapButton} onPress={onSwap}>
              <RefreshCw size={15} color={roles.accentText} />
              <Text style={sheetStyles.swapButtonText}>Swap Exercise</Text>
            </Pressable>

            {/* How the block is bounded: a set count, or one of four clocks. */}
            <View style={sheetStyles.field}>
              <Text style={sheetStyles.fieldLabel}>Scheme</Text>
              <View style={sheetStyles.modeGrid}>
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
              <Text style={sheetStyles.fieldHint}>{blockModeHint(modeDraft)}</Text>
            </View>

            {/* Fold this movement into a circuit that already exists. This is
                what makes "5 pull-ups, 10 push-ups, 15 squats" one block
                instead of three separate clocks. */}
            {joinableBlocks.length > 0 && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>Add to a block</Text>
                {joinableBlocks.map((block) => (
                  <Pressable
                    key={block.id}
                    style={sheetStyles.joinButton}
                    onPress={() => handleJoin(block.id)}
                  >
                    <Text style={sheetStyles.joinButtonText}>
                      Join {describeBlock(resolveBlock({ blockId: block.id }, day.blocks))}
                    </Text>
                  </Pressable>
                ))}
                <Text style={sheetStyles.fieldHint}>
                  Joining moves this movement next to the others and puts them all under one clock.
                </Text>
              </View>
            )}

            {/* Time cap — the window for the AMRAP modes, an optional ceiling
                for a for-time block. EMOM sets its length from the interval
                plan instead, so it has no cap of its own. */}
            {timedDraft && modeDraft !== 'emom' && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>
                  {modeDraft === 'for_time' ? 'Time cap' : 'Window'}
                </Text>
                <View style={sheetStyles.stepperRow}>
                  <StepperButton
                    label="-1m"
                    onPress={() => setDurationDraft((d) => clampAmrapSeconds(d - 60))}
                  />
                  <Text style={sheetStyles.fieldValue}>{formatAmrapWindow(durationDraft)}</Text>
                  <StepperButton
                    label="+1m"
                    onPress={() => setDurationDraft((d) => clampAmrapSeconds(d + 60))}
                  />
                </View>
              </View>
            )}

            {/* EMOM cadence. */}
            {modeDraft === 'emom' && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>Interval</Text>
                <View style={sheetStyles.stepperRow}>
                  <StepperButton
                    label="-15s"
                    onPress={() => setIntervalDraft((d) => clampIntervalSeconds(d - 15))}
                  />
                  <Text style={sheetStyles.fieldValue}>{formatClock(intervalDraft)}</Text>
                  <StepperButton
                    label="+15s"
                    onPress={() => setIntervalDraft((d) => clampIntervalSeconds(d + 15))}
                  />
                </View>
              </View>
            )}

            {/* Round plan. Only the modes that know their round count up front
                have one — an AMRAP's round count is the result, not the plan. */}
            {(modeDraft === 'for_time' || modeDraft === 'emom') && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>
                  {modeDraft === 'emom' ? 'Intervals' : 'Rounds'}
                </Text>
                <View style={sheetStyles.stepperRow}>
                  <StepperButton
                    label="-"
                    onPress={() => setRoundsDraft((r) => clampRounds(r - 1))}
                  />
                  <Text style={sheetStyles.fieldValue}>{roundsDraft}</Text>
                  <StepperButton
                    label="+"
                    onPress={() => setRoundsDraft((r) => clampRounds(r + 1))}
                  />
                </View>
              </View>
            )}

            {/* Sets stepper. A timed block has no planned set count — the clock
                or the round plan ends it. */}
            {!timedDraft && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>Sets</Text>
                <View style={sheetStyles.stepperRow}>
                  <StepperButton
                    label="-"
                    onPress={() => setSetsDraft((s) => Math.max(1, s - 1))}
                  />
                  <Text style={sheetStyles.fieldValue}>{setsDraft}</Text>
                  <StepperButton
                    label="+"
                    onPress={() => setSetsDraft((s) => Math.min(20, s + 1))}
                  />
                </View>
              </View>
            )}

            {/* Reps. Survives into a timed block, because the reps per round
                are exactly what a circuit prescribes. */}
            {keepsReps && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>{timedDraft ? 'Reps per round' : 'Reps'}</Text>
                <TextInput
                  style={sheetStyles.repsInput}
                  value={repsDraft}
                  onChangeText={setRepsDraft}
                  placeholder={timedDraft ? '5' : '8-12'}
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Rest stepper. Hidden for a timed block: the session deliberately
                never starts a rest timer inside one, so offering a rest value
                here would promise something the session won't do. */}
            {!timedDraft && (
              <View style={sheetStyles.field}>
                <Text style={sheetStyles.fieldLabel}>Rest (seconds)</Text>
                <View style={sheetStyles.stepperRow}>
                  <StepperButton
                    label="-15"
                    onPress={() => setRestDraft((r) => Math.max(0, r - 15))}
                  />
                  <Text style={sheetStyles.fieldValue}>{restDraft}s</Text>
                  <StepperButton
                    label="+15"
                    onPress={() => setRestDraft((r) => Math.min(600, r + 15))}
                  />
                </View>
              </View>
            )}

            <View style={sheetStyles.actions}>
              <Pressable
                style={sheetStyles.removeButton}
                onPress={() => onRemove(target.dayId, target.index)}
              >
                <Text style={sheetStyles.removeButtonText}>Remove</Text>
              </Pressable>
              <Pressable style={sheetStyles.cancelButton} onPress={onClose}>
                <Text style={sheetStyles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={sheetStyles.saveButton} onPress={commit}>
                <Text style={sheetStyles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Small presentational helpers
// -----------------------------------------------------------------------------

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  icon: ComponentType<IconProps>;
  /** Screen-reader label. The button itself is icon-only. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  const color = disabled ? roles.textMuted : tone === 'danger' ? roles.error : roles.textPrimary;

  return (
    <Pressable
      style={[
        styles.controlButton,
        tone === 'danger' && styles.controlButtonDanger,
        disabled && styles.controlButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={16} color={color} />
    </Pressable>
  );
}

function ModeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[sheetStyles.modeOption, selected && sheetStyles.modeOptionActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[sheetStyles.modeOptionText, selected && sheetStyles.modeOptionTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={sheetStyles.stepperButton} onPress={onPress}>
      <Text style={sheetStyles.stepperText}>{label}</Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  backButtonText: {
    ...textStyles.button,
    color: colors.text.primary,
  },
  header: {
    marginBottom: spacing[6],
  },
  customBadge: {
    alignSelf: 'flex-start',
    backgroundColor: roles.accentSubtle,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[2],
  },
  customBadgeText: {
    ...textStyles.caption,
    color: roles.accentText,
    fontWeight: '700',
  },
  nameInput: {
    ...textStyles.h1,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  templateMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaChip: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  metaChipText: {
    ...textStyles.caption,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  dayTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  dayTab: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  dayTabActive: {
    backgroundColor: colors.reward.fp,
  },
  dayTabText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  dayTabTextActive: {
    color: colors.background.primary,
    fontWeight: '600',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing[3],
  },
  dayName: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  dayCount: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  exerciseList: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  // A block heading states the clock once, above its members.
  blockHeading: {
    ...textStyles.label,
    color: roles.accentText,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
    marginTop: spacing[2],
  },
  // Members are inset so the block reads as one unit you work through.
  exerciseRowInBlock: {
    borderLeftWidth: 2,
    borderLeftColor: roles.accent,
    marginLeft: spacing[2],
  },
  exerciseRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
    padding: spacing[3],
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
  controlButton: {
    backgroundColor: colors.background.tertiary,
    width: 40,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDanger: {
    backgroundColor: colors.danger.DEFAULT + '24',
  },
  controlButtonDisabled: {
    opacity: 0.35,
  },
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.ui.borderLight,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[3],
  },
  addButtonText: {
    ...textStyles.button,
    color: roles.accentText,
  },
  dangerSection: {
    marginTop: spacing[4],
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: colors.danger.DEFAULT + '20',
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderWidth: 1,
    borderColor: colors.danger.DEFAULT,
  },
  deleteButtonText: {
    ...textStyles.button,
    color: colors.danger.DEFAULT,
    fontWeight: '600',
  },
  dangerHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[2],
    textAlign: 'center',
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[5],
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  modeOption: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    backgroundColor: roles.accentSubtle,
    borderColor: roles.accent,
  },
  modeOptionText: {
    ...textStyles.button,
    color: colors.text.secondary,
  },
  modeOptionTextActive: {
    color: roles.accentText,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  fieldValue: {
    ...textStyles.number,
    color: colors.text.primary,
    fontSize: 22,
    minWidth: 80,
    textAlign: 'center',
  },
  stepperButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    minWidth: 56,
    alignItems: 'center',
  },
  stepperText: {
    ...textStyles.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  repsInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    ...textStyles.body,
    fontSize: 18,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  removeButton: {
    backgroundColor: colors.danger.DEFAULT + '20',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  removeButtonText: {
    ...textStyles.button,
    color: colors.danger.DEFAULT,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...textStyles.button,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.reward.fp,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...textStyles.button,
    color: colors.background.primary,
    fontWeight: '600',
  },
});
