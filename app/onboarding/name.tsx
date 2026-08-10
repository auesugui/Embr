// =============================================================================
// IronQuest Onboarding — Step 2: Name Your Pet
// =============================================================================
// Phase 2 (issue #33): 1–20 character name. Forwards {type, name} to the final
// template step via router params. "Continue" is disabled on empty/whitespace.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GAMIFICATION_ENABLED } from '@/config';
import { colors, radius, spacing, textStyles } from '@/theme';
import type { PetType } from '@/types';
import { haptics } from '@/utils/haptics';

const MAX_NAME = 20;

export default function OnboardingNameScreen() {
  // Game-layer route: unreachable from the tab bar in the tracker build, but a
  // deep link or a restored URL could still land here. Bounce to the tracker.
  if (!GAMIFICATION_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const params = useLocalSearchParams<{ type?: string }>();
  const [name, setName] = useState('');

  // Defensive: if the screen is reached directly without a type param, fall
  // back to the default rather than crashing.
  const selectedType: PetType = (params.type as PetType) ?? 'ferro';

  const trimmed = name.trim();
  const canContinue = trimmed.length >= 1 && trimmed.length <= MAX_NAME;

  const handleContinue = () => {
    if (!canContinue) return;
    haptics.selection();
    router.push({
      pathname: '/onboarding/template',
      params: { type: selectedType, name: trimmed },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>Name your companion</Text>
        <Text style={styles.subtitle}>
          This is who you're raising. You can change it later in The Den.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ember, Bolt, Verdant…"
            placeholderTextColor={colors.text.muted}
            maxLength={MAX_NAME}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Pet name"
            accessibilityHint={`Enter a name, up to ${MAX_NAME} characters`}
          />
          <Text style={styles.counter}>
            {name.length}/{MAX_NAME}
          </Text>
        </View>
      </View>

      <Pressable
        style={[styles.continueButton, !canContinue && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to choosing a starting template"
        accessibilityState={{ disabled: !canContinue }}
      >
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing[4],
  },
  body: {
    flex: 1,
  },
  title: {
    ...textStyles.h2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginBottom: spacing[6],
    lineHeight: 22,
  },
  inputWrap: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  input: {
    ...textStyles.h4,
    color: colors.text.primary,
    padding: 0,
    minHeight: 28,
  },
  counter: {
    ...textStyles.caption,
    color: colors.text.tertiary,
    marginTop: spacing[2],
    textAlign: 'right',
  },
  continueButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  continueText: {
    ...textStyles.buttonLarge,
    color: colors.background.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.6,
  },
});
