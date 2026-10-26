// =============================================================================
// Review workout — check a card, then copy its movements into the day being built
// =============================================================================
// Reached from the workout builder with one photo chosen. The card is read on the
// device. Each movement is then matched to an exercise in the library, and only a clear
// match is made for you. The rest are chosen or skipped here. Nothing is copied until
// every movement is settled and every value a copy uses is clean.
//
// A copy keeps each movement's name, sets and reps. A template holds no weights, so the
// weight read from the card is shown for reference only.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { ReviewCardView } from '@/components/workout/photo-import/ReviewCardView';
import type { MovementMatch } from '@/components/workout/photo-import/ReviewRow';
import { getExerciseById } from '@/data';
import { autoMatch } from '@/lib/card-import/match-exercise';
import type { ParsedRow } from '@/lib/card-import/parse-card';
import { readReps } from '@/lib/card-import/parse-card';
import { readPhotos } from '@/lib/card-import/read-photos';
import type { Reading } from '@/lib/card-import/reconcile';
import { clearFlag, removeRow, saveProblems, setField } from '@/lib/card-import/review';
import { useCardImportStore, useTemplateStore } from '@/stores';
import { BLANK_TEMPLATE_NAME, type ImportedExercise } from '@/stores/templateStore';
import { radius, roles, spacing, textStyles } from '@/theme';

/** What a movement becomes: a library exercise, or nothing (skipped). */
type Choice = { exerciseId: string } | 'skip';

export default function ImportPhotosScreen() {
  const { templateId = '', dayId = '' } = useLocalSearchParams<{
    templateId?: string;
    dayId?: string;
  }>();
  const template = useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  const day = template?.days.find((d) => d.id === dayId);
  const importExercises = useTemplateStore((s) => s.importExercises);
  const renameTemplate = useTemplateStore((s) => s.renameTemplate);

  const cards = useCardImportStore((s) => s.cards);
  const reading = useCardImportStore((s) => s.reading);
  const photoCount = useCardImportStore((s) => s.photos.length);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [choosingRowId, setChoosingRowId] = useState<string | null>(null);

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
  const editCard = (key: string, update: (current: Reading) => Reading) =>
    store().updateCard(key, (card) =>
      card.reading ? { ...card, reading: update(card.reading) } : card
    );

  // One workout goes into one day, so only a single card is copied.
  const onlyCard = cards.length === 1 ? cards[0].reading : null;
  const rows = onlyCard?.card.rows ?? [];
  // Movements the day already has are not copied again.
  const inDay = new Set(day?.exercises.map((ex) => ex.exerciseId) ?? []);

  // The library exercise a movement becomes: the person's choice if they made one,
  // otherwise the clear match, otherwise none.
  const resolve = (row: ParsedRow): { exerciseId: string | undefined; skipped: boolean } => {
    const choice = choices[row.id];
    if (choice === 'skip') return { exerciseId: undefined, skipped: true };
    if (choice) return { exerciseId: choice.exerciseId, skipped: false };
    return { exerciseId: autoMatch(row.name), skipped: false };
  };

  const matchFor = (row: ParsedRow): MovementMatch => {
    const { exerciseId, skipped } = resolve(row);
    if (skipped) return { kind: 'skipped' };
    if (!exerciseId) return { kind: 'unmatched' };
    const exerciseName = getExerciseById(exerciseId)?.name ?? exerciseId;
    return inDay.has(exerciseId)
      ? { kind: 'present', exerciseName }
      : { kind: 'matched', exerciseName };
  };

  const toggleSkip = (rowId: string) =>
    setChoices((current) =>
      current[rowId] === 'skip'
        ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== rowId))
        : { ...current, [rowId]: 'skip' as const }
    );

  const unsettled = rows.filter((row) => {
    const { exerciseId, skipped } = resolve(row);
    return !skipped && !exerciseId;
  }).length;

  const additions: ImportedExercise[] = [];
  const queued = new Set<string>();
  for (const row of rows) {
    const { exerciseId, skipped } = resolve(row);
    if (skipped || !exerciseId || inDay.has(exerciseId) || queued.has(exerciseId)) continue;
    // A movement still missing a value it would be copied with is not copied at all.
    // saveProblems holds the whole card back until the person types it in.
    const reps = readReps(row.reps);
    if (row.sets === null || reps === null) continue;
    queued.add(exerciseId);
    // Copied as the rep scheme a template holds: "3 to 12" typed is stored "3-12".
    additions.push({ exerciseId, sets: row.sets, reps });
  }

  const problems = onlyCard ? saveProblems(onlyCard) : [];
  const allClear =
    !reading &&
    onlyCard !== null &&
    problems.length === 0 &&
    unsettled === 0 &&
    additions.length > 0 &&
    template !== undefined &&
    day !== undefined;

  const leave = () => {
    useCardImportStore.getState().reset();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleSave = () => {
    if (!allClear || !template || !day || !onlyCard) return;
    importExercises(template.id, day.id, additions);
    const { title, subtitle } = onlyCard.card;
    // A blank workout takes the card's name. A name the person has already given is kept.
    if (title && template.name === BLANK_TEMPLATE_NAME) {
      renameTemplate(template.id, subtitle ? `${title}: ${subtitle}` : title);
    }
    leave();
  };

  if (!template || !day) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>That workout is no longer here.</Text>
        <Pressable style={styles.button} onPress={leave} accessibilityRole="button">
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (photoCount === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No photo chosen.</Text>
        <Pressable style={styles.button} onPress={leave} accessibilityRole="button">
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const count = additions.length;
  const summary = reading
    ? `Reading photo ${cards.length + 1} of ${photoCount}…`
    : allClear
      ? `${count} ${count === 1 ? 'movement' : 'movements'} ready to add to ${day.name}.`
      : 'Check the card below before adding it.';

  const note = reading
    ? 'Still reading photos.'
    : cards.some((card) => card.reading === null)
      ? 'Remove the photo that could not be read.'
      : cards.length > 1
        ? `Remove the extra ${cards.length === 2 ? 'card' : 'cards'}. One workout goes into one day.`
        : unsettled > 0
          ? `${unsettled} ${unsettled === 1 ? 'movement needs' : 'movements need'} an exercise, or a skip.`
          : // A photo with no movements is not a card at all, and a movement still
            // missing a value was not skipped. Both are checked before the
            // skipped-or-present note, which would otherwise claim a photo of a wall
            // held movements, and that a movement nobody has settled is settled.
            rows.length === 0 && onlyCard !== null
            ? 'Remove this photo and take one of those two cards.'
            : problems.length > 0
              ? 'Resolve the highlighted values first.'
              : additions.length === 0 && onlyCard !== null
                ? 'Every movement is skipped or already in this workout. Nothing to add.'
                : '';

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.summary}>{summary}</Text>

        {cards.map((card) =>
          card.reading ? (
            <ReviewCardView
              key={card.key}
              reading={card.reading}
              matchFor={matchFor}
              onEdit={(path, text) => editCard(card.key, (r) => setField(r, path, text))}
              onKeep={(path) => editCard(card.key, (r) => clearFlag(r, path))}
              onRemoveRow={(index) => editCard(card.key, (r) => removeRow(r, index))}
              onRemoveCard={() => store().removeCard(card.key)}
              onChoose={(rowId) => setChoosingRowId(rowId)}
              onToggleSkip={toggleSkip}
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
            disabled={!allClear}
            accessibilityRole="button"
            accessibilityState={{ disabled: !allClear }}
            style={[styles.button, !allClear && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              Add {count} {count === 1 ? 'exercise' : 'exercises'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ExercisePickerModal
        visible={choosingRowId !== null}
        title="Choose Exercise"
        onClose={() => setChoosingRowId(null)}
        onSelect={(exerciseId) => {
          if (choosingRowId === null) return;
          setChoices((current) => ({ ...current, [choosingRowId]: { exerciseId } }));
        }}
      />
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
