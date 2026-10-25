// =============================================================================
// WeeklyGoalPrompt — the one ask, on the summary after the first saved workout
// =============================================================================
// Asked here rather than in onboarding because by this point the person has
// proved they will log something. One tap accepts the default; "Pick a number"
// swaps in the same stepper Settings uses. It is shown once either way.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui';
import { radius, roles, spacing, textStyles } from '@/theme';

import { WeeklyGoalStepper } from './WeeklyGoalStepper';

interface WeeklyGoalPromptProps {
  goal: number;
  onChange: (days: number) => void;
  onDismiss: () => void;
}

export function WeeklyGoalPrompt({ goal, onChange, onDismiss }: WeeklyGoalPromptProps) {
  const [picking, setPicking] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Three days a week?</Text>
      <Text style={styles.body}>
        Embr counts your week against a goal. Three is a good place to start, and you can change it
        any time in Profile.
      </Text>

      {picking ? (
        <View style={styles.pick}>
          <WeeklyGoalStepper goal={goal} onChange={onChange} />
          <PressableScale style={styles.primary} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.primaryText}>Done</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.actions}>
          <PressableScale style={styles.primary} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.primaryText}>Sounds right</Text>
          </PressableScale>
          <Pressable
            style={styles.secondary}
            onPress={() => setPicking(true)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Pick a number</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: roles.border,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  title: {
    ...textStyles.display,
    color: roles.textPrimary,
    fontSize: 19,
    lineHeight: 24,
    textAlign: 'center',
  },
  body: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    textAlign: 'center',
    marginTop: spacing[1.5],
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pick: {
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  primary: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  primaryText: {
    ...textStyles.button,
    color: roles.onAccent,
    fontWeight: '700',
  },
  secondary: {
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  secondaryText: {
    ...textStyles.button,
    color: roles.accentText,
  },
});
