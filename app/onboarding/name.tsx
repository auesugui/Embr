// =============================================================================
// Embr Onboarding — what should we call you
// =============================================================================
// The only thing Embr asks for before you can use it. There is no account, no
// email, and no sync (CLAUDE.md), so there is nothing else it has any business
// knowing. If a feature ever needs another detail, it asks for it then.
//
// This route does double duty. `/onboarding/name` is the first-run prompt,
// reached from `app/index.tsx` when `needsOnboarding` is true. The same screen
// with `?mode=edit` is how Profile lets you fix a typo — without it a name
// typed once on a phone keyboard would be permanent.
//
// Finch register (ADR-0013): this is an arriving screen, so it gets the display
// serif and room to breathe, not the dense tabular treatment the session uses.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config';
import { needsOnboarding, usePlayerStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';

/** Long enough for a real name, short enough not to break the profile header. */
const MAX_NAME_LENGTH = 24;

export default function OnboardingNameScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === 'edit';

  const profile = usePlayerStore((state) => state.profile);
  const updateProfile = usePlayerStore((state) => state.updateProfile);
  const insets = useSafeAreaInsets();

  // Seeded from the stored name only when editing. On first run the field
  // starts empty even for an install carrying the old default, because that
  // default was never a name anyone chose.
  const [name, setName] = useState(isEdit ? profile.name : '');

  // On web the input paints the browser's default blue focus ring, which is
  // the one colour in the app that isn't ours. `outlineStyle: 'none'` drops it;
  // the accent border replaces it so focus is still visible.
  const [focused, setFocused] = useState(false);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  // This route is reachable directly — a reload, a bookmark, a back button, or
  // the browser restoring the last URL. Someone who already has a name must not
  // be asked for it again just because they landed here, so the screen owns the
  // same gate `app/index.tsx` applies rather than trusting the way in. Edit mode
  // is exempt: arriving with a name set is the entire point of it.
  if (!isEdit && !needsOnboarding(profile)) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = () => {
    if (!canSubmit) return;
    // `createdAt` is intentionally untouched — see the store's initialState.
    updateProfile({ name: trimmed });
    if (isEdit && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + spacing[8] }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{isEdit ? 'Your name' : `Welcome to ${APP_NAME}`}</Text>
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>
            This is the only thing {APP_NAME} asks for. Everything you log stays on this device.
          </Text>
        </View>

        <TextInput
          style={[styles.input, focused && styles.inputFocused]}
          value={name}
          onChangeText={setName}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Your name"
          placeholderTextColor={roles.textMuted}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          accessibilityLabel="Your name"
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? 'Save your name' : 'Start using Embr'}
        >
          <Text style={styles.buttonText}>{isEdit ? 'Save' : 'Start training'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  header: {
    marginBottom: spacing[8],
  },
  eyebrow: {
    ...textStyles.caption,
    color: roles.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  title: {
    ...textStyles.h1,
    color: roles.textPrimary,
    marginBottom: spacing[3],
  },
  subtitle: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
  input: {
    ...textStyles.h3,
    color: roles.textPrimary,
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    // Web only; React Native ignores it. Typed loosely because the RN style
    // types don't declare DOM outline properties.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputFocused: {
    borderColor: roles.accent,
  },
  footer: {
    paddingHorizontal: spacing[5],
  },
  button: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...textStyles.body,
    color: roles.onAccent,
    fontWeight: '600',
  },
});
