// =============================================================================
// BackupSection — export and restore, the only copy that leaves the device
// =============================================================================
// The app has no backend. Everything lives in this browser's localStorage,
// which iOS will evict on its own schedule, so this section is the difference
// between "my phone forgot my training" and "I have a file". It is deliberately
// the most prominent block on the screen for that reason (CLAUDE.md: "Export or
// it's gone").

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Download, Upload } from '@/components/icons';
import { radius, roles, spacing, textStyles } from '@/theme';

interface BackupSectionProps {
  /** File IO is unavailable on some web targets; the whole section hides. */
  supported: boolean;
  busy: boolean;
  onExport: () => void;
  onRestore: () => void;
}

export function BackupSection({ supported, busy, onExport, onRestore }: BackupSectionProps) {
  // File IO is unavailable on some web targets; the whole section hides there
  // rather than offering buttons that cannot work.
  if (!supported) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your Data</Text>
      <Text style={styles.sectionNote}>
        Everything lives on this device only. Export a backup regularly — if the browser clears its
        storage, an export is the only way back.
      </Text>

      <Pressable
        style={[styles.settingRow, busy && styles.settingRowBusy]}
        onPress={onExport}
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
        onPress={onRestore}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Restore from a backup file"
      >
        <Text style={styles.settingLabel}>Restore from backup</Text>
        <Upload size={18} color={roles.textMuted} />
      </Pressable>
    </View>
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
  settingSpacer: {
    height: spacing[2],
  },
});
