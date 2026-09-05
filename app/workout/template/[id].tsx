// =============================================================================
// IronQuest Template Detail Screen
// =============================================================================

import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Copy, Pencil } from '@/components/icons';
import { DayExerciseList } from '@/components/workout/template/DayExerciseList';
import { type WorkoutTemplateDefinition, getTemplateById } from '@/data';
import { estimateDayMinutes, estimateTemplateMinutes } from '@/lib/duration';
import { useTemplateStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const personalTemplates = useTemplateStore((state) => state.templates);
  const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate);

  // Reactive resolution: built-ins first, then personal copies. Re-resolves
  // automatically once the store hydrates from AsyncStorage.
  const template = useMemo<WorkoutTemplateDefinition | null>(() => {
    if (!id) return null;
    return getTemplateById(id) ?? personalTemplates.find((t) => t.id === id) ?? null;
  }, [id, personalTemplates]);

  const navigation = useNavigation();

  // A2: drive the header title from the resolved template + selected day so it
  // reads as a human string ("Bench Press · Day 1") instead of the raw route
  // path. Falls back to the static layout title while the template resolves.
  // useLayoutEffect (not useEffect) so the title is set before paint and never
  // flashes the raw path. The root hydration gate guarantees this screen only
  // mounts after stores hydrate, so there's no SSR useLayoutEffect warning.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: template ? `${template.name} · Day ${selectedDayIndex + 1}` : 'Template',
    });
  }, [navigation, template, selectedDayIndex]);

  if (!template) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Template not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const selectedDay = template.days[selectedDayIndex];

  // A day with no exercises can't start a session — the session screen would
  // render an empty list with nothing to log. Only reachable since blank custom
  // templates exist; built-ins always ship exercises.
  const isEmptyDay = (selectedDay?.exercises.length ?? 0) === 0;

  const handleStartWorkout = () => {
    if (isEmptyDay) return;
    haptics.success();
    router.push({
      pathname: '/workout/loadout',
      params: { templateId: template.id, dayIndex: selectedDayIndex.toString() },
    });
  };

  const handleDaySelect = (index: number) => {
    haptics.selection();
    setSelectedDayIndex(index);
  };

  const handleDuplicate = () => {
    if (!template) return;
    const newId = duplicateTemplate(template.id);
    if (newId) {
      haptics.success();
      router.push(`/workout/template-edit/${newId}`);
    }
  };

  const handleEdit = () => {
    if (!template) return;
    haptics.tap();
    router.push(`/workout/template-edit/${template.id}`);
  };

  const isCustom = template.isCustom === true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        {isCustom && (
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>Custom Template</Text>
          </View>
        )}
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateDescription}>{template.description}</Text>

        <View style={styles.templateMeta}>
          <MetaChip label={`${template.daysPerWeek} days/week`} />
          <MetaChip label={`${estimateTemplateMinutes(template)} min`} />
          <MetaChip label={template.difficulty} />
        </View>

        {/* Customize actions */}
        <View style={styles.customActions}>
          {isCustom ? (
            <Pressable style={[styles.actionButton, styles.actionPrimary]} onPress={handleEdit}>
              <Pencil size={16} color={roles.onAccent} />
              <Text style={styles.actionPrimaryText}>Edit Template</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionButton, isCustom ? styles.actionSecondary : styles.actionPrimary]}
            onPress={handleDuplicate}
          >
            <Copy size={16} color={isCustom ? roles.textSecondary : roles.onAccent} />
            <Text style={isCustom ? styles.actionSecondaryText : styles.actionPrimaryText}>
              {isCustom ? 'Duplicate' : 'Copy & Customize'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Day Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Session</Text>
        <View style={styles.dayTabs}>
          {template.days.map((day, index) => (
            <Pressable
              key={day.id}
              style={[styles.dayTab, index === selectedDayIndex && styles.dayTabActive]}
              onPress={() => handleDaySelect(index)}
            >
              <Text
                style={[styles.dayTabText, index === selectedDayIndex && styles.dayTabTextActive]}
              >
                {day.shortName}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {selectedDay && <DayExerciseList day={selectedDay} />}

      {/* Start Button */}
      <View style={styles.startSection}>
        <Pressable
          style={[styles.startButton, isEmptyDay && styles.startButtonDisabled]}
          onPress={handleStartWorkout}
          disabled={isEmptyDay}
        >
          <Text style={styles.startButtonText}>Review {selectedDay?.shortName} & Start</Text>
        </Pressable>
        <Text style={styles.startHint}>
          {isEmptyDay
            ? 'Add an exercise before starting this workout.'
            : `${selectedDay?.exercises.length ?? 0} exercises • ~${selectedDay ? estimateDayMinutes(selectedDay) : 0} min`}
        </Text>
      </View>
    </ScrollView>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
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
  templateName: {
    ...textStyles.h1,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  templateDescription: {
    ...textStyles.body,
    color: colors.text.secondary,
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
  customActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    // Was colors.types.flux — the pet element color on a tracker action.
    backgroundColor: roles.accent,
  },
  actionPrimaryText: {
    ...textStyles.button,
    color: roles.onAccent,
    fontWeight: '600',
  },
  actionSecondary: {
    backgroundColor: roles.surfaceSunken,
  },
  actionSecondaryText: {
    ...textStyles.button,
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
  startSection: {
    marginTop: spacing[4],
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    ...textStyles.buttonLarge,
    color: colors.background.primary,
  },
  startHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: spacing[2],
  },
});
