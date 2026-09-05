// =============================================================================
// Embr Profile Tab
// =============================================================================

import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarTooLargeError, pickAvatarFile, processAvatar } from '@/lib/avatar';
import {
  BackupParseError,
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
} from '@/lib/backup';
import { downloadTextFile, isFileIOSupported, pickTextFile, reloadApp } from '@/lib/backup-file';
import { showAlert } from '@/utils/alert';

import { User } from '@/components/icons';
import { BackupSection } from '@/components/profile/BackupSection';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { APP_NAME } from '@/config';
import { usePlayerStore, useSettingsStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';

export default function ProfileScreen() {
  const profile = usePlayerStore((state) => state.profile);
  const updateProfile = usePlayerStore((state) => state.updateProfile);
  const achievements = usePlayerStore((state) => state.achievements);
  const haptics = useSettingsStore((state) => state.haptics);
  const units = useSettingsStore((state) => state.units);
  const themePref = useSettingsStore((state) => state.theme);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  // Single in-flight flag for both actions — they're mutually exclusive and a
  // double-tap mid-restore would race two writes into the same storage keys.
  const [busy, setBusy] = useState(false);

  // Photo picking is DOM work. Embr ships as a PWA (CLAUDE.md), so the web path
  // is the one that runs; on native this says so rather than failing silently or
  // pulling in a picker dependency for a target that does not ship.
  const handlePickAvatar = async () => {
    if (Platform.OS !== 'web') {
      showAlert({
        title: 'Not available here',
        message: 'Setting a photo works in the Embr web app.',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    try {
      const file = await pickAvatarFile();
      if (!file) return;

      const avatar = await processAvatar(file);
      updateProfile({ avatar });
    } catch (error) {
      showAlert({
        title: 'Could not use that photo',
        message:
          error instanceof AvatarTooLargeError
            ? error.message
            : 'That file could not be read as an image.',
        buttons: [{ text: 'OK' }],
      });
    }
  };

  const handleRemoveAvatar = () => {
    showAlert({
      title: 'Remove photo?',
      message: 'Your profile goes back to the default mark.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => updateProfile({ avatar: null }) },
      ],
    });
  };

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
        {/* This circle was RESERVED for the care-companion (ADR-0013). It now
            holds your photo instead, which supersedes that reservation for the
            profile only — the home hero zone is still held. Empty, it keeps the
            same Lucide mark it had, so nothing regressed for anyone who never
            sets one. */}
        <Pressable
          onPress={handlePickAvatar}
          onLongPress={profile.avatar ? handleRemoveAvatar : undefined}
          accessibilityRole="button"
          accessibilityLabel={profile.avatar ? 'Change profile photo' : 'Add a profile photo'}
          style={styles.avatarPlaceholder}
        >
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
          ) : (
            <User size={34} color={roles.textMuted} strokeWidth={1.5} />
          )}
        </Pressable>
        <Text style={styles.avatarHint}>
          {profile.avatar ? 'Tap to change · hold to remove' : 'Tap to add a photo'}
        </Text>
        {/* The name is only ever typed once, during onboarding, on a phone
            keyboard. Without an edit path a typo would be permanent, so the
            name itself is the affordance — it reopens the same screen in edit
            mode rather than duplicating the form here. */}
        <Pressable
          onPress={() => router.push('/onboarding/name?mode=edit')}
          accessibilityRole="button"
          accessibilityLabel={`Edit your name, currently ${profile.name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.profileName}>{profile.name}</Text>
        </Pressable>
        <Text style={styles.joinDate}>
          Training since {new Date(profile.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text style={styles.achievementCount}>{achievements.length} unlocked</Text>
      </View>

      <SettingsSection
        themePref={themePref}
        haptics={haptics}
        units={units}
        canReload={isFileIOSupported}
        onThemeChange={handleThemeChange}
        onToggleHaptics={() => updateSetting('haptics', !haptics)}
        onSetUnits={(u) => updateSetting('units', u)}
      />

      <BackupSection
        supported={isFileIOSupported}
        busy={busy}
        onExport={handleExport}
        onRestore={handleImport}
      />

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.versionText}>{APP_NAME} v1.0.0</Text>
        <Text style={styles.buildText}>Workout tracker</Text>
      </View>
    </ScrollView>
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
    marginBottom: spacing[2],
    // Clips the photo to the circle rather than letting it square off the card.
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.full,
  },
  avatarHint: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginBottom: spacing[2],
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
