// =============================================================================
// SettingsSection — appearance, haptics, units
// =============================================================================
// Three settings, and two of them have consequences worth stating on screen:
// changing the theme restarts the app (the palette is baked in at module scope
// — see theme-boot), and changing units does NOT convert existing history,
// because a 100 lb entry and a 100 kg entry are different facts (issue #42).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, roles, spacing, textStyles } from '@/theme';
import type { WeightUnit } from '@/types';

interface SettingsSectionProps {
  themePref: 'light' | 'dark' | 'system';
  haptics: boolean;
  units: WeightUnit;
  /** True when the app can restart itself, which changes what the note says. */
  canReload: boolean;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onToggleHaptics: () => void;
  onSetUnits: (unit: WeightUnit) => void;
}

export function SettingsSection({
  themePref,
  haptics,
  units,
  canReload,
  onThemeChange,
  onToggleHaptics,
  onSetUnits,
}: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Settings</Text>

      <SettingRow label="Haptic Feedback" value={haptics} onToggle={onToggleHaptics} />

      <View style={styles.settingSpacer} />

      {/* Appearance. The palette is baked into StyleSheet.create at module
            scope (see src/theme/theme-boot.ts), so switching it has to restart
            the app rather than re-render it — the row says so rather than
            leaving the user tapping a control that appears to do nothing. */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Appearance</Text>
        <View style={styles.unitPills}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.unitPill, themePref === t && styles.unitPillActive]}
              onPress={() => onThemeChange(t)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${t} appearance`}
              accessibilityState={{ selected: themePref === t }}
            >
              <Text style={[styles.unitPillText, themePref === t && styles.unitPillTextActive]}>
                {t === 'system' ? 'auto' : t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.settingNote}>
        {canReload
          ? 'Changing this restarts the app.'
          : 'Takes effect the next time the app starts.'}
      </Text>

      <View style={styles.settingSpacer} />

      {/* Unit toggle (issue #42). Existing history is never converted —
            entries keep the unit they were logged in. */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Weight Units</Text>
        <View style={styles.unitPills}>
          {(['lb', 'kg'] as const).map((u) => (
            <Pressable
              key={u}
              style={[styles.unitPill, units === u && styles.unitPillActive]}
              onPress={() => onSetUnits(u)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${u === 'lb' ? 'pounds' : 'kilograms'}`}
              accessibilityState={{ selected: units === u }}
            >
              <Text style={[styles.unitPillText, units === u && styles.unitPillTextActive]}>
                {u}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onToggle}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: roles.textPrimary,
    marginBottom: spacing[3],
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  settingLabel: {
    ...textStyles.body,
    color: roles.textPrimary,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: roles.surfaceSunken,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: roles.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: roles.surfaceRaised,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  settingSpacer: {
    height: spacing[2],
  },
  settingNote: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },
  unitPills: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  unitPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    backgroundColor: roles.surfaceSunken,
  },
  unitPillActive: {
    backgroundColor: roles.accent,
  },
  unitPillText: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
  unitPillTextActive: {
    color: roles.onAccent,
    fontWeight: '600',
  },
});
