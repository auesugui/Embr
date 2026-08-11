// =============================================================================
// IronQuest Profile Tab
// =============================================================================

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BackupParseError,
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
} from '@/lib/backup';
import { downloadTextFile, isFileIOSupported, pickTextFile, reloadApp } from '@/lib/backup-file';
import { showAlert } from '@/utils/alert';

import { APP_NAME } from '@/config';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';
import { ChevronRight, Download, Upload, User } from 'lucide-react-native';

export default function ProfileScreen() {
  const profile = usePlayerStore((state) => state.profile);
  const achievements = usePlayerStore((state) => state.achievements);
  const haptics = useSettingsStore((state) => state.haptics);
  const units = useSettingsStore((state) => state.units);
  const themePref = useSettingsStore((state) => state.theme);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  // Single in-flight flag for both actions — they're mutually exclusive and a
  // double-tap mid-restore would race two writes into the same storage keys.
  const [busy, setBusy] = useState(false);

  // Persist first, then restart. The write is fire-and-forget inside the store,
  // so the reload is deferred a tick — reloading synchronously can beat the
  // AsyncStorage write and silently discard the choice.
  const handleThemeChange = (next: 'light' | 'dark' | 'system') => {
    if (next === themePref) return;
    updateSetting('theme', next);
    if (isFileIOSupported) {
      setTimeout(() => reloadApp(), 60);
    }
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const backup = await createBackup();
      downloadTextFile(backupFilename(APP_NAME), JSON.stringify(backup, null, 2));
    } catch {
      showAlert({
        title: 'Export failed',
        message: "Couldn't read your local data. Try again.",
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const text = await pickTextFile();
      if (text === null) return; // picker dismissed

      const backup = parseBackup(text);
      const restored = await restoreBackup(backup);
      if (restored === 0) {
        showAlert({
          title: 'Nothing to restore',
          message: 'That backup had no recognizable data in it.',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      // Restore overwrites everything, so confirm AFTER the write and reload —
      // the hydrated stores are stale the moment storage changes underneath.
      showAlert({
        title: 'Backup restored',
        message: `Restored ${restored} data ${restored === 1 ? 'section' : 'sections'}. The app will reload.`,
        buttons: [{ text: 'Reload', onPress: reloadApp }],
      });
    } catch (error) {
      showAlert({
        title: 'Restore failed',
        message:
          error instanceof BackupParseError ? error.message : "Couldn't read that backup file.",
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        {/* RESERVED (ADR-0013): this circle is where the care-companion goes if
            it ever gets built. It's deliberately still a placeholder — a Lucide
            glyph rather than drawn art — so nothing has to be undone later. The
            80px emoji weightlifter that used to live here was the single
            loudest "childlike" signal in the app. */}
        <View style={styles.avatarPlaceholder}>
          <User size={34} color={roles.textMuted} strokeWidth={1.5} />
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
                onPress={() => handleThemeChange(t)}
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
          {isFileIOSupported
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

      {/* Backup — the app stores everything locally and nowhere else. On the
          web build that's localStorage, which the browser can evict, so an
          export is the only thing standing between a storage sweep and losing
          every logged workout. */}
      {isFileIOSupported && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          <Text style={styles.sectionNote}>
            Everything lives on this device only. Export a backup regularly — if the browser clears
            its storage, an export is the only way back.
          </Text>

          <Pressable
            style={[styles.settingRow, busy && styles.settingRowBusy]}
            onPress={handleExport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Export a backup file"
          >
            <Text style={styles.settingLabel}>Export backup</Text>
            <Download size={18} color={roles.textMuted} />
          </Pressable>

          <View style={styles.settingSpacer} />

          <Pressable
            style={[styles.settingRow, busy && styles.settingRowBusy]}
            onPress={handleImport}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore from a backup file"
          >
            <Text style={styles.settingLabel}>Restore from backup</Text>
            <Upload size={18} color={roles.textMuted} />
          </Pressable>
        </View>
      )}

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
            <ChevronRight size={18} color={roles.textMuted} />
          </Pressable>
        </View>
      )}

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.versionText}>{APP_NAME} v1.0.0</Text>
        <Text style={styles.buildText}>Workout tracker</Text>
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
    backgroundColor: roles.surface,
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
    borderRadius: radius.full,
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  profileName: {
    ...textStyles.h3,
    color: roles.textPrimary,
  },
  joinDate: {
    ...textStyles.body,
    color: roles.textSecondary,
    marginTop: spacing[1],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: roles.textPrimary,
    marginBottom: spacing[3],
  },
  achievementCount: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
  sectionNote: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    marginBottom: spacing[3],
  },
  settingRowBusy: {
    opacity: 0.5,
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
  versionText: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
  buildText: {
    ...textStyles.body,
    color: roles.textMuted,
    marginTop: spacing[1],
  },
});
