// =============================================================================
// IronQuest Template Editor — edit a personal (custom) template copy
// =============================================================================
// Reachable from the template detail screen's "Edit" action (personal copies
// only). All edits flow through useTemplateStore, which persists to
// AsyncStorage and recomputes FP distributions via the real engine. Built-in
// templates are never editable here — the editor only loads `isCustom` copies.

import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import {
  EditExerciseSheet,
  type EditTarget,
} from '@/components/workout/template-edit/EditExerciseSheet';
import { TemplateEditHeader } from '@/components/workout/template-edit/TemplateEditHeader';
import { TemplateExerciseRow } from '@/components/workout/template-edit/TemplateExerciseRow';
import { useTemplateStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

      <TemplateEditHeader
        name={nameDraft}
        onChangeName={setNameDraft}
        onCommitName={commitName}
        daysPerWeek={template.daysPerWeek}
        difficulty={template.difficulty}
        sessionCount={template.days.length}
      />

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
            {selectedDay.exercises.map((templateEx, index) => (
              <TemplateExerciseRow
                key={`${templateEx.exerciseId}-${index}`}
                templateEx={templateEx}
                index={index}
                count={selectedDay.exercises.length}
                blocks={selectedDay.blocks}
                // The clock is stated once, on the first member of a block.
                startsBlock={
                  templateEx.blockId !== undefined &&
                  selectedDay.exercises.findIndex((e) => e.blockId === templateEx.blockId) === index
                }
                onEdit={() => {
                  haptics.tap();
                  setEditTarget({ dayId: selectedDay.id, index });
                }}
                onMove={(from, to) => reorderExercises(template.id, selectedDay.id, from, to)}
                onRemove={() => removeExercise(template.id, selectedDay.id, index)}
              />
            ))}
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
