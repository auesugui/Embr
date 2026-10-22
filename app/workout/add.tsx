// =============================================================================
// Embr Add Workout Screen — type in a workout that was not logged live
// =============================================================================
// Reached from History. Saves a finished workout straight into the history
// store, so it lists like any other and counts toward the streak on its own
// date. It leaves PRs, baselines and weight history alone: those record what is
// happening now, and a typed-in workout is usually about a day that has passed.

import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Plus } from '@/components/icons';
import { CardioCard } from '@/components/workout/manual/CardioCard';
import { StrengthCard } from '@/components/workout/manual/StrengthCard';
import { manualStyles as styles } from '@/components/workout/manual/manualStyles';
import type {
  CardioFields,
  ExerciseHandlers,
  ExerciseRow,
  SetRow,
} from '@/components/workout/manual/types';
import { type ManualWorkoutDraft, parseManualWorkout, todayIsoDate } from '@/lib/manual-workout';
import { streakOnDay } from '@/lib/streak';
import { usePlayerStore, useSettingsStore, useWorkoutHistoryStore } from '@/stores';
import { roles, spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

// React keys only have to be unique on this screen, so a module counter is enough.
let lastKey = 0;
const nextKey = () => {
  lastKey += 1;
  return lastKey;
};

const blankSet = (): SetRow => ({ key: nextKey(), weight: '', reps: '' });

export default function AddWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const units = useSettingsStore((state) => state.units);

  const [date, setDate] = useState(() => todayIsoDate(new Date()));
  const [durationMinutes, setDurationMinutes] = useState('');
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  // The name field with focus. Its suggestions stay up after blur, so a tap on
  // one still lands: on web, blur fires before the tap is delivered.
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [newestKey, setNewestKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once a save goes through. Synchronous, unlike state: a second activation
  // before navigation unmounts the screen must not save the same workout again.
  const savedRef = useRef(false);

  // Any edit clears the message, so it only ever describes the form as it is now.
  const changeDate = (value: string) => {
    setError(null);
    setDate(value);
  };
  const changeDuration = (value: string) => {
    setError(null);
    setDurationMinutes(value);
  };
  const changeExercises = (update: (prev: ExerciseRow[]) => ExerciseRow[]) => {
    setError(null);
    setExercises(update);
  };

  const addRow = (row: ExerciseRow) => {
    haptics.tap();
    changeExercises((prev) => [...prev, row]);
    setNewestKey(row.key);
    setActiveKey(row.key);
  };

  const addExercise = () => addRow({ key: nextKey(), name: '', sets: [blankSet()] });

  const addCardio = () =>
    addRow({
      key: nextKey(),
      name: '',
      sets: [],
      // Miles for pounds, kilometers for kilograms. The card can change it.
      cardio: { minutes: '', distance: '', distanceUnit: units === 'kg' ? 'km' : 'mi', rpe: '' },
    });

  const renameExercise = (key: number, name: string) =>
    changeExercises((prev) => prev.map((ex) => (ex.key === key ? { ...ex, name } : ex)));

  const chooseSuggestion = (key: number, name: string) => {
    haptics.selection();
    renameExercise(key, name);
    setActiveKey(null);
  };

  const removeExercise = (key: number) => {
    haptics.tap();
    changeExercises((prev) => prev.filter((ex) => ex.key !== key));
  };

  const updateCardio = (exerciseKey: number, patch: Partial<CardioFields>) =>
    changeExercises((prev) =>
      prev.map((ex) =>
        ex.key === exerciseKey && ex.cardio ? { ...ex, cardio: { ...ex.cardio, ...patch } } : ex
      )
    );

  const addSet = (key: number) => {
    haptics.tap();
    // Copies the row above, so a run of identical sets is one tap each rather
    // than retyping the weight and reps every time.
    changeExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== key) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const next: SetRow = { key: nextKey(), weight: last?.weight ?? '', reps: last?.reps ?? '' };
        return { ...ex, sets: [...ex.sets, next] };
      })
    );
  };

  const updateSet = (
    exerciseKey: number,
    setKey: number,
    patch: Partial<Pick<SetRow, 'weight' | 'reps'>>
  ) =>
    changeExercises((prev) =>
      prev.map((ex) =>
        ex.key !== exerciseKey
          ? ex
          : { ...ex, sets: ex.sets.map((set) => (set.key === setKey ? { ...set, ...patch } : set)) }
      )
    );

  const removeSet = (exerciseKey: number, setKey: number) => {
    haptics.tap();
    changeExercises((prev) =>
      prev.map((ex) =>
        ex.key !== exerciseKey ? ex : { ...ex, sets: ex.sets.filter((set) => set.key !== setKey) }
      )
    );
  };

  const handlers: ExerciseHandlers = {
    onRename: renameExercise,
    onFocusName: (key) => setActiveKey(key),
    onRemove: removeExercise,
    onChooseSuggestion: chooseSuggestion,
    onAddSet: addSet,
    onUpdateSet: updateSet,
    onRemoveSet: removeSet,
    onUpdateCardio: updateCardio,
  };

  const handleSave = async () => {
    if (savedRef.current) return;
    const draft: ManualWorkoutDraft = { date, durationMinutes, exercises };
    const result = parseManualWorkout(draft, new Date());
    if (!result.ok) {
      setError(result.error);
      haptics.warning();
      return;
    }

    // Held until the write settles. A second activation during the write is
    // refused, and a failed write releases it so the same entry can be saved again.
    savedRef.current = true;
    const history = useWorkoutHistoryStore.getState();
    try {
      await history.addManualLog({
        exercises: result.exercises,
        durationSeconds: result.durationSeconds,
        // The streak on the workout's own day, so an old entry shows that day's streak.
        streakDays: streakOnDay(history.logs, result.timestamp),
        timestamp: result.timestamp,
      });
    } catch {
      savedRef.current = false;
      setError('Couldn’t save this workout. Nothing was added, so you can try again.');
      haptics.warning();
      return;
    }
    // Recomputed from every saved workout, so this one counts on its own date.
    usePlayerStore.getState().syncStreak(useWorkoutHistoryStore.getState().logs);
    // The lifetime count a live save bumps, so Home and History agree.
    usePlayerStore.getState().incrementWorkoutCount();
    haptics.success();

    if (router.canGoBack()) router.back();
    else router.replace('/history');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.detailsRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={changeDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={roles.textMuted}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Workout date"
            />
          </View>
          <View style={styles.durationField}>
            <Text style={styles.fieldLabel}>Duration (min)</Text>
            <TextInput
              style={styles.input}
              value={durationMinutes}
              onChangeText={changeDuration}
              placeholder="Optional"
              placeholderTextColor={roles.textMuted}
              keyboardType="number-pad"
              accessibilityLabel="Duration in minutes"
            />
          </View>
        </View>

        {exercises.map((exercise) =>
          exercise.cardio ? (
            <CardioCard
              key={exercise.key}
              exercise={exercise}
              cardio={exercise.cardio}
              isActive={activeKey === exercise.key}
              isNewest={exercise.key === newestKey}
              handlers={handlers}
            />
          ) : (
            <StrengthCard
              key={exercise.key}
              exercise={exercise}
              units={units}
              isActive={activeKey === exercise.key}
              isNewest={exercise.key === newestKey}
              handlers={handlers}
            />
          )
        )}

        <View style={styles.addRow}>
          <Pressable style={styles.addButton} onPress={addExercise} accessibilityRole="button">
            <Plus size={16} color={roles.accentText} />
            <Text style={styles.addButtonText}>Add exercise</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={addCardio} accessibilityRole="button">
            <Plus size={16} color={roles.accentText} />
            <Text style={styles.addButtonText}>Add cardio</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.saveButton} onPress={handleSave} accessibilityRole="button">
          <Text style={styles.saveButtonText}>Save workout</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
