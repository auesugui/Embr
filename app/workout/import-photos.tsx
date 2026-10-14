// =============================================================================
// Review workouts — check what was read from the photos, then save
// =============================================================================
// Reached from History with the photos already chosen. Each photo is read on the
// device, and each card appears as soon as it is read. Nothing is saved until every
// card is clean: no flagged values, no missing date, no unreadable photo.
//
// Saving goes through the same merge as backup import, so a workout already in
// history is skipped rather than doubled.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReviewCardView } from '@/components/workout/photo-import/ReviewCardView';
import { cardToLog } from '@/lib/card-import/card-to-log';
import { readPhotos } from '@/lib/card-import/read-photos';
import type { Reading } from '@/lib/card-import/reconcile';
import { clearFlag, removeRow, saveProblems, setField } from '@/lib/card-import/review';
import { useCardImportStore, useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { radius, roles, spacing, textStyles } from '@/theme';
import { showAlert } from '@/utils/alert';

export default function ImportPhotosScreen() {
  const cards = useCardImportStore((s) => s.cards);
  const reading = useCardImportStore((s) => s.reading);
  const photoCount = useCardImportStore((s) => s.photos.length);
  const units = useSettingsStore((s) => s.units);
  const [saving, setSaving] = useState(false);

  // Starts reading once per batch. claimReading refuses a second start, so a
  // re-render or a re-mount cannot read the same photos twice.
  useEffect(() => {
    const runId = useCardImportStore.getState().claimReading();
    if (runId === null) return;
    const { photos } = useCardImportStore.getState();
    void readPhotos(photos, {
      isCurrent: () => useCardImportStore.getState().runId === runId,
      onCard: (card) => useCardImportStore.getState().addCard(runId, card),
      onDone: () => useCardImportStore.getState().setReading(runId, false),
    });
  }, []);

  const store = useCardImportStore.getState;
  const editCard = (key: string, update: (reading: Reading) => Reading) =>
    store().updateCard(key, (card) =>
      card.reading ? { ...card, reading: update(card.reading) } : card
    );

  const readings = cards.flatMap((card) => (card.reading ? [card.reading] : []));
  const allClear =
    !reading &&
    cards.length > 0 &&
    cards.every((card) => card.reading !== null && saveProblems(card.reading).length === 0);

  const leave = () => {
    useCardImportStore.getState().reset();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/history');
  };

  const handleSave = () => {
    if (!allClear || saving) return;
    setSaving(true);
    const importedAt = new Date().toISOString();
    const logs = readings.map((item) => cardToLog(item.card, { units, importedAt }));
    const added = useWorkoutHistoryStore.getState().mergeLogs(logs);
    const already = logs.length - added;
    showAlert({
      title: added === 1 ? 'Workout added' : 'Workouts added',
      message: `${added} added${already > 0 ? `, ${already} already in your history` : ''}.`,
      buttons: [{ text: 'OK', onPress: leave }],
    });
  };

  if (photoCount === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No photos chosen.</Text>
        <Pressable style={styles.button} onPress={leave} accessibilityRole="button">
          <Text style={styles.buttonText}>Back to history</Text>
        </Pressable>
      </View>
    );
  }

  const summary = reading
    ? `Reading photo ${cards.length + 1} of ${photoCount}…`
    : allClear
      ? `${cards.length} ${cards.length === 1 ? 'workout' : 'workouts'} ready to save.`
      : 'Check the highlighted values before saving.';

  const note = reading
    ? 'Still reading photos.'
    : cards.some((card) => card.reading === null)
      ? 'Remove the photo that could not be read.'
      : allClear
        ? ''
        : 'Resolve the highlighted values first.';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.summary}>{summary}</Text>

        {cards.map((card) =>
          card.reading ? (
            <ReviewCardView
              key={card.key}
              reading={card.reading}
              onEdit={(path, text) => editCard(card.key, (r) => setField(r, path, text))}
              onKeep={(path) => editCard(card.key, (r) => clearFlag(r, path))}
              onRemoveRow={(index) => editCard(card.key, (r) => removeRow(r, index))}
              onRemoveCard={() => store().removeCard(card.key)}
            />
          ) : (
            <View key={card.key} style={styles.failed}>
              <Text style={styles.failedName}>{card.fileName}</Text>
              <Text style={styles.failedBody}>{card.error}</Text>
              <Pressable
                onPress={() => store().removeCard(card.key)}
                accessibilityRole="button"
                style={styles.removeFailed}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.footer}>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={leave} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!allClear || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !allClear || saving }}
            style={[styles.button, (!allClear || saving) && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              Save {readings.length} {readings.length === 1 ? 'workout' : 'workouts'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: roles.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  summary: {
    ...textStyles.bodySmall,
    color: roles.textMuted,
    marginBottom: spacing[3],
  },
  failed: {
    backgroundColor: roles.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: roles.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  failedName: {
    ...textStyles.label,
    color: roles.textPrimary,
  },
  failedBody: {
    ...textStyles.bodySmall,
    color: roles.accentText,
    marginTop: spacing[1],
  },
  removeFailed: {
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  removeText: {
    ...textStyles.label,
    color: roles.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: roles.divider,
    backgroundColor: roles.surface,
    padding: spacing[4],
  },
  note: {
    ...textStyles.caption,
    color: roles.textMuted,
    marginBottom: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  cancel: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  cancelText: {
    ...textStyles.button,
    color: roles.textSecondary,
  },
  button: {
    backgroundColor: roles.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...textStyles.button,
    color: roles.onAccent,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    backgroundColor: roles.surface,
    padding: spacing[6],
  },
  emptyText: {
    ...textStyles.body,
    color: roles.textSecondary,
  },
});
