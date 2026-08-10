// =============================================================================
// IronQuest Profile Tab
// =============================================================================

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_NAME, GAMIFICATION_ENABLED } from '@/config';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { colors, spacing, textStyles } from '@/theme';

export default function ProfileScreen() {
  const profile = usePlayerStore((state) => state.profile);
  const achievements = usePlayerStore((state) => state.achievements);
  const haptics = useSettingsStore((state) => state.haptics);
  const units = useSettingsStore((state) => state.units);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarEmoji}>🏋️</Text>
        </View>
        <Text style={styles.profileName}>{profile.name}</Text>
        <Text style={styles.joinDate}>
          Training since {new Date(profile.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text style={styles.achievementCount}>{achievements.length} unlocked</Text>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <SettingRow
          label="Haptic Feedback"
          value={haptics}
          onToggle={() => updateSetting('haptics', !haptics)}
        />

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
                onPress={() => updateSetting('units', u)}
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

      {/* Dev Panel entry — __DEV__ only, never rendered in production builds */}
      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer</Text>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push('/(tabs)/dev')}
            accessibilityRole="button"
            accessibilityLabel="Open dev panel"
          >
            <Text style={styles.settingLabel}>Dev Panel</Text>
            <Text style={styles.settingChevron}>›</Text>
          </Pressable>
        </View>
      )}

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.versionText}>{APP_NAME} v1.0.0</Text>
        <Text style={styles.buildText}>
          Build: {GAMIFICATION_ENABLED ? 'Phase 1' : 'Tracker only'}
        </Text>
      </View>
    </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  joinDate: {
    ...textStyles.body,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  achievementCount: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[4],
    borderRadius: 12,
  },
  settingLabel: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  settingChevron: {
    ...textStyles.body,
    color: colors.text.muted,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: colors.reward.fp,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text.primary,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  settingSpacer: {
    height: spacing[2],
  },
  unitPills: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  unitPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
  },
  unitPillActive: {
    backgroundColor: colors.reward.fp,
  },
  unitPillText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  unitPillTextActive: {
    color: colors.background.primary,
    fontWeight: '600',
  },
  versionText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  buildText: {
    ...textStyles.body,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
});
