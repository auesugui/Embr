// =============================================================================
// IronQuest Workout Loadout Screen
// =============================================================================
// Pre-session staging: pick a Session Intent (Normal / Deload in Phase 1),
// preview the exercise list, then begin the session.

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAMIFICATION_ENABLED } from '@/config';
import { FP_CONFIG } from '@/config/fp-values';
import {
  type TemplateDay,
  type WorkoutTemplateDefinition,
  getExerciseById,
  getTemplateById,
} from '@/data';
import { useTemplateStore, useWorkoutStore } from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { Exercise, SessionIntent } from '@/types';
import { haptics } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Phase 1 intents: Normal + Deload only.
// Tempo / Pause / Drop Set / Rest-Pause arrive in Phase 2.
// -----------------------------------------------------------------------------

interface IntentOption {
  value: SessionIntent;
  label: string;
  /** Gamified copy — mentions the FP each intent earns. */
  description: string;
  /** Tracker copy — same training meaning, no FP economy. */
  trackerDescription: string;
  enabled: boolean;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Standard training. Earns base + volume + PR bonuses.',
    trackerDescription: 'Standard training at your working weights.',
    enabled: true,
  },
  {
    value: 'deload',
    label: 'Deload',
    description: 'Recovery session. Flat 80 FP total, no volume scaling.',
    trackerDescription: 'Recovery session. Lighter loads, lower volume.',
    enabled: true,
  },
  {
    value: 'tempo',
    label: 'Tempo (Phase 2)',
    description: '3–4 sec slow eccentrics. +15 FP per exercise.',
    trackerDescription: '3–4 sec slow eccentrics.',
    enabled: false,
  },
  {
    value: 'pause',
    label: 'Pause Reps (Phase 2)',
    description: '1–3 sec hold at hardest point. +15 FP per exercise.',
    trackerDescription: '1–3 sec hold at the hardest point.',
    enabled: false,
  },
];

// -----------------------------------------------------------------------------
// Convert template exercises to workout Exercise[] (matches the original
// construction previously inlined in app/workout/template/[id].tsx).
// -----------------------------------------------------------------------------

function buildExercises(day: TemplateDay): Exercise[] {
  return day.exercises.map((templateEx, index) => {
    const def = getExerciseById(templateEx.exerciseId);
    return {
      id: `${templateEx.exerciseId}-${index}`,
      name: def?.name ?? 'Unknown Exercise',
      muscleGroups: def?.muscleGroups ?? [],
      sets: Array.from({ length: templateEx.sets }, () => ({
        reps: null,
        weight: null,
        logged: false,
        isPR: false,
        isRepPR: false,
      })),
      restSeconds: templateEx.restSeconds,
      completed: false,
    };
  });
}

export default function WorkoutLoadoutScreen() {
  const { templateId, dayIndex } = useLocalSearchParams<{
    templateId: string;
    dayIndex: string;
  }>();

  const personalTemplates = useTemplateStore((state) => state.templates);
  const [intent, setIntent] = useState<SessionIntent>('normal');

  const startSession = useWorkoutStore((state) => state.startSession);

  // Resolve built-ins first, then personal copies (so custom templates can
  // start a workout). Reactive — resolves once the template store hydrates.
  const template = useMemo<WorkoutTemplateDefinition | null>(() => {
    if (!templateId) return null;
    return (
      getTemplateById(templateId) ?? personalTemplates.find((t) => t.id === templateId) ?? null
    );
  }, [templateId, personalTemplates]);

  const day = useMemo(() => {
    if (!template) return null;
    const idx = dayIndex
      ? Math.min(Math.max(Number.parseInt(dayIndex, 10) || 0, 0), template.days.length - 1)
      : 0;
    return template.days[idx] ?? null;
  }, [template, dayIndex]);

  if (!template || !day) {
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

  const handleSelectIntent = (value: SessionIntent) => {
    const option = INTENT_OPTIONS.find((o) => o.value === value);
    if (!option?.enabled) return;
    haptics.selection();
    setIntent(value);
  };

  const handleBeginQuest = () => {
    haptics.success();
    const exercises = buildExercises(day);
    startSession(template.id, exercises, intent);
    router.replace('/workout/session');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.dayName}>{day.name}</Text>
        <Text style={styles.templateMeta}>
          {day.exercises.length} exercises · ~{template.estimatedDuration} min
        </Text>
      </View>

      {/* Exercise Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Preview</Text>
        <View style={styles.exerciseList}>
          {day.exercises.map((templateEx, index) => {
            const def = getExerciseById(templateEx.exerciseId);
            return (
              <View key={`${templateEx.exerciseId}-${index}`} style={styles.exerciseRow}>
                <View style={styles.exerciseNumber}>
                  <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{def?.name ?? 'Unknown'}</Text>
                  <Text style={styles.exerciseDetails}>
                    {templateEx.sets} sets × {templateEx.reps} reps
                  </Text>
                </View>
                <Text style={styles.restTime}>{Math.floor(templateEx.restSeconds / 60)}m</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Session Intent */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session Intent</Text>
        <Text style={styles.sectionHint}>
          Pick a default modifier for this session. Phase 1 ships Normal and Deload.
        </Text>
        <View style={styles.intentGrid}>
          {INTENT_OPTIONS.map((option) => {
            const selected = intent === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.intentCard,
                  selected && styles.intentCardActive,
                  !option.enabled && styles.intentCardDisabled,
                ]}
                onPress={() => handleSelectIntent(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !option.enabled }}
              >
                <View style={styles.intentHeader}>
                  <Text
                    style={[
                      styles.intentLabel,
                      selected && styles.intentLabelActive,
                      !option.enabled && styles.intentLabelDisabled,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected && <Text style={styles.intentSelectedDot}>●</Text>}
                </View>
                <Text
                  style={[
                    styles.intentDescription,
                    !option.enabled && styles.intentDescriptionDisabled,
                  ]}
                >
                  {GAMIFICATION_ENABLED ? option.description : option.trackerDescription}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* FP Forecast — game layer */}
      {GAMIFICATION_ENABLED && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FP Forecast</Text>
          <View style={styles.forecastCard}>
            <Text style={styles.forecastLabel}>Estimated base FP</Text>
            <Text style={styles.forecastValue}>
              {intent === 'deload' ? FP_CONFIG.base.deload : FP_CONFIG.base.completion}
              <Text style={styles.forecastUnit}> FP</Text>
            </Text>
            <Text style={styles.forecastNote}>
              {intent === 'deload'
                ? 'Flat per workout. No volume bonus, no PR bonus, no streak multiplier scaling per rep.'
                : 'Base per workout, plus volume (1 FP / 10 reps), PRs, and streak multiplier.'}
            </Text>
          </View>
        </View>
      )}

      {/* Start the session */}
      <View style={styles.startSection}>
        <Pressable style={styles.startButton} onPress={handleBeginQuest}>
          <Text style={styles.startButtonText}>
            {GAMIFICATION_ENABLED
              ? `Begin ${day.shortName} Quest`
              : `Start ${day.shortName} Workout`}
          </Text>
        </Pressable>
        <Text style={styles.startHint}>
          Intent: {INTENT_OPTIONS.find((o) => o.value === intent)?.label}
        </Text>
      </View>
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
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  dayName: {
    ...textStyles.h4,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  templateMeta: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  sectionHint: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing[3],
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
  intentGrid: {
    gap: spacing[2],
  },
  intentCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intentCardActive: {
    borderColor: colors.reward.fp,
    backgroundColor: colors.background.tertiary,
  },
  intentCardDisabled: {
    opacity: 0.4,
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  intentLabel: {
    ...textStyles.labelLarge,
    color: colors.text.primary,
  },
  intentLabelActive: {
    color: colors.reward.fp,
  },
  intentLabelDisabled: {
    color: colors.text.muted,
  },
  intentSelectedDot: {
    color: colors.reward.fp,
    fontSize: 12,
  },
  intentDescription: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  intentDescriptionDisabled: {
    color: colors.text.muted,
  },
  forecastCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  forecastLabel: {
    ...textStyles.label,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  },
  forecastValue: {
    ...textStyles.numberLarge,
    color: colors.reward.fp,
    marginBottom: spacing[2],
  },
  forecastUnit: {
    ...textStyles.body,
    color: colors.reward.fp,
  },
  forecastNote: {
    ...textStyles.caption,
    color: colors.text.muted,
  },
  startSection: {
    marginTop: spacing[2],
    alignItems: 'center',
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
