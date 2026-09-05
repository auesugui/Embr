// =============================================================================
// IntensityPicker — the one modifier you set before starting
// =============================================================================
// Phase 1 ships Normal and Deload. Tempo and Pause Reps are drawn but disabled
// rather than hidden: the point of showing them is that the axis exists — a
// session has an intent, and these are the ones coming.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Check } from '@/components/icons';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import type { SessionIntent } from '@/types';

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

export function IntensityPicker({
  intent,
  onSelect,
}: {
  intent: SessionIntent;
  onSelect: (value: SessionIntent) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Intensity</Text>
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
              onPress={() => onSelect(option.value)}
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
                {selected && <Check size={16} color={roles.accent} strokeWidth={2.5} />}
              </View>
              <Text
                style={[
                  styles.intentDescription,
                  !option.enabled && styles.intentDescriptionDisabled,
                ]}
              >
                {option.trackerDescription}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The label for an intent, for the hint under the Start button. */
export function intentLabel(intent: SessionIntent): string {
  return INTENT_OPTIONS.find((o) => o.value === intent)?.label ?? '';
}

/** Whether an intent can be chosen. The Phase 2 modes are drawn but off. */
export function isIntentEnabled(intent: SessionIntent): boolean {
  return INTENT_OPTIONS.find((o) => o.value === intent)?.enabled ?? false;
}

const styles = StyleSheet.create({
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
  intentDescription: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  intentDescriptionDisabled: {
    color: colors.text.muted,
  },
});
