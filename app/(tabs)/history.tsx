// =============================================================================
// IronQuest Workout History Screen
// =============================================================================
// Reverse-chronological list of CLAIMED workouts. A session only becomes
// "history" once its FP has been claimed (`claimedAt != null`); unclaimed /
// abandoned sessions are intentionally hidden — see getClaimedLogs.
//
// The FP figure shown is `log.totalFP`, captured at claim time by the real FP
// engine (src/lib/workout-summary → calculateSessionFP). This screen never
// recomputes FP — it only renders what was already awarded.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ClipboardList, Plus } from '@/components/icons';
import { WorkoutRow } from '@/components/workout/history/WorkoutRow';
import { isFileIOSupported } from '@/lib/backup-file';
import { pickPhotos } from '@/lib/card-import/pick-photos';
import { getClaimedLogs } from '@/lib/history-stats';
import { useCardImportStore, useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';

import { RevealRow } from '@/components/celebration';

export default function HistoryScreen() {
  const logs = useWorkoutHistoryStore((s) => s.logs);
  const hydrated = useWorkoutHistoryStore((s) => s.hydrated);
  const units = useSettingsStore((s) => s.units);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Claimed-only, newest-first. Derived in render so store updates reflect
  // immediately (e.g. claiming a workout adds it to the list right away).
  const claimed = getClaimedLogs(logs);

  const handleToggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  // Photos go to the review screen, which reads them on the device. Nothing is
  // saved until the person confirms it there.
  const handleAddFromPhotos = async () => {
    const photos = await pickPhotos();
    if (photos.length === 0) return;
    useCardImportStore.getState().setPhotos(photos);
    router.push('/workout/import-photos');
  };

  const addFromPhotos = isFileIOSupported ? (
    <Pressable
      style={styles.addButton}
      onPress={handleAddFromPhotos}
      accessibilityRole="button"
      accessibilityLabel="Add workouts from photos"
    >
      <Plus size={16} color={roles.accentText} />
      <Text style={styles.addButtonText}>Add from photos</Text>
    </Pressable>
  ) : null;

  // ---- Loading (store hydrating from AsyncStorage) ----
  if (!hydrated) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Loading history...</Text>
      </View>
    );
  }

  // ---- Empty state (no claimed workouts yet) ----
  if (claimed.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <ClipboardList size={32} color={roles.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No workouts logged yet</Text>
          <Text style={styles.emptyBody}>
            Finish and save a workout — it’ll show up here with the full breakdown.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyButtonText}>Start one from Workouts</Text>
          </Pressable>
          {addFromPhotos}
        </View>
      </View>
    );
  }

  // ---- History list ----
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {addFromPhotos}
      <Text style={styles.summaryLine}>
        {claimed.length} workout{claimed.length === 1 ? '' : 's'} logged
      </Text>

      {claimed.map((log, i) => (
        <RevealRow key={log.id} index={Math.min(i, 6)}>
          <WorkoutRow
            log={log}
            units={units}
            expanded={expandedId === log.id}
            onToggle={() => handleToggle(log.id)}
          />
        </RevealRow>
      ))}
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  stateText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },
  emptyCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[6],
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
  },
  emptyIcon: {
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  emptyBody: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  emptyButton: {
    backgroundColor: colors.reward.fp,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  emptyButtonText: {
    ...textStyles.button,
    color: colors.background.primary,
  },
  summaryLine: {
    ...textStyles.bodySmall,
    color: colors.text.muted,
    marginBottom: spacing[3],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    marginBottom: spacing[3],
    marginTop: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: roles.accent,
    borderRadius: radius.full,
  },
  addButtonText: {
    ...textStyles.label,
    color: roles.accentText,
  },
});
