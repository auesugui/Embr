// =============================================================================
// IronQuest Onboarding — Step 3: Pick Starting Template
// =============================================================================
// Phase 2 (issue #33): lists every built-in template from src/data/templates.ts.
// "Start training" finalizes onboarding: calls initializePet(type, name) and
// lands on the main tab navigator.
//
// NOTE (scope): template selection here is part of the first-run ritual and is
// intentionally visual-only — the Quest Board already lets users start a
// workout from any template, so this screen does not persist a "chosen"
// template. Wiring a default template is a separate concern (see Findings).

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GAMIFICATION_ENABLED } from '@/config';
import { WORKOUT_TEMPLATES } from '@/data';
import { usePetStore } from '@/stores';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { PetType } from '@/types';
import { haptics } from '@/utils/haptics';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Total exercise slots across the whole program (sum of per-day exercise rows).
const countExercises = (template: (typeof WORKOUT_TEMPLATES)[number]): number =>
  template.days.reduce((sum, day) => sum + day.exercises.length, 0);

export default function OnboardingTemplateScreen() {
  // Game-layer route: unreachable from the tab bar in the tracker build, but a
  // deep link or a restored URL could still land here. Bounce to the tracker.
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const params = useLocalSearchParams<{ type?: string; name?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initializePet = usePetStore((state) => state.initializePet);

  const selectedType: PetType = (params.type as PetType) ?? 'ferro';
  const petName = (params.name ?? '').trim() || 'Companion';

  const handleSelect = (id: string) => {
    setSelectedId(id);
    haptics.tap();
  };

  const handleStart = () => {
    if (!selectedId) return;
    initializePet(selectedType, petName);
    haptics.success();
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pick your starting template</Text>
      <Text style={styles.subtitle}>
        A program gives your training structure. You can browse and start any workout from the Quest
        Board — this just sets your starting point.
      </Text>

      <View style={styles.list}>
        {WORKOUT_TEMPLATES.map((tpl) => {
          const isSelected = selectedId === tpl.id;
          return (
            <Pressable
              key={tpl.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(tpl.id)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${tpl.name} template`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.templateName}>{tpl.name}</Text>
                <Text style={styles.exerciseCount}>{countExercises(tpl)} exercises</Text>
              </View>
              <Text style={styles.description}>{tpl.description}</Text>
              <Text style={styles.meta}>
                {tpl.daysPerWeek} days/week · ~{tpl.estimatedDuration} min ·{' '}
                {capitalize(tpl.difficulty)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.startButton, !selectedId && styles.buttonDisabled]}
        onPress={handleStart}
        disabled={!selectedId}
        accessibilityRole="button"
        accessibilityLabel="Start training and finish onboarding"
        accessibilityState={{ disabled: !selectedId }}
      >
        <Text style={styles.startText}>Start training</Text>
      </Pressable>
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
    paddingBottom: spacing[10],
  },
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[5],
    lineHeight: 22,
  },
  list: {
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.reward.fp,
    backgroundColor: colors.background.elevated,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing[1],
  },
  templateName: {
    ...textStyles.h4,
    color: colors.text.primary,
    flex: 1,
  },
  exerciseCount: {
    ...textStyles.caption,
    color: colors.reward.fp,
    fontWeight: '600',
  },
  description: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  meta: {
    ...textStyles.caption,
    color: colors.text.tertiary,
  },
  startButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  startText: {
    ...textStyles.buttonLarge,
    color: colors.background.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
});
