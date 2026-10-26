// =============================================================================
// ProgressEmpty — a card that says what is missing and how to fill it
// =============================================================================
// Used twice: a brand-new account with no sessions, and an exercise with one.
// Neither is a failure, so neither gets an error tone — the body names the one
// action that changes the state.

import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/icons';
import { radius, roles, spacing, textStyles } from '@/theme';

export function ProgressEmpty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <LineChart size={26} color={roles.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[4],
  },
  title: {
    ...textStyles.label,
    color: roles.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
});
