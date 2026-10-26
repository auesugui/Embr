// =============================================================================
// IronQuest Exercise Picker Modal
// =============================================================================
// Searchable list of the exercise library, built-ins plus the user's own. Used
// by the template editor (issue #5) to swap an exercise or add one to a
// personal copy. A search that names no exercise offers to create it.
//
// Above the list: a Recent row read back out of saved workouts and one row of
// filter chips (issue #83). Search and chips narrow together, never
// separately, and the rules for both live in `src/lib/exercise-filter.ts`.

import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Plus } from '@/components/icons';
import { CreateExerciseForm } from '@/components/workout/CreateExerciseForm';
import { EquipmentFilterSheet } from '@/components/workout/EquipmentFilterSheet';
import { ExerciseFilterChips } from '@/components/workout/ExerciseFilterChips';
import { ExercisePickerRecents } from '@/components/workout/ExercisePickerRecents';
import { ExercisePickerResults } from '@/components/workout/ExercisePickerResults';
import { type Equipment, type MuscleGroup, allExercises } from '@/data';
import { useKeyboardInset } from '@/hooks';
import { findExerciseByName, toExerciseName } from '@/lib/custom-exercise';
import {
  describeEmptyPicker,
  filterExercises,
  filterMuscles,
  isNarrowed,
  recentExercises,
} from '@/lib/exercise-filter';
import { useCustomExerciseStore, useWorkoutHistoryStore } from '@/stores';
import { colors, radius, roles, spacing, textStyles } from '@/theme';
import { haptics } from '@/utils/haptics';

interface ExercisePickerModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  /** Exercise ids to hide (e.g. exercises already in the day). */
  excludeIds?: string[];
}

export function ExercisePickerModal({
  visible,
  title,
  onClose,
  onSelect,
  excludeIds = [],
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState('');
  // The name being created, while the New Exercise step is showing.
  const [creating, setCreating] = useState<string | null>(null);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  // Subscribed so a new exercise shows up, and to mark the user's own.
  const ownExercises = useCustomExerciseStore((state) => state.exercises);
  // Recents are derived from saved workouts. Nothing new is persisted.
  const logs = useWorkoutHistoryStore((state) => state.logs);
  // The sheet has to get out of the keyboard's way itself: this is a PWA, and
  // KeyboardAvoidingView does nothing in a browser. See useKeyboardInset.
  const keyboardInset = useKeyboardInset();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setQuery('');
      setCreating(null);
      setMuscle(null);
      setEquipment([]);
      setEquipmentOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) Keyboard.dismiss();
  }, [visible]);

  const handleSelect = useCallback(
    (exerciseId: string) => {
      onSelect(exerciseId);
      Keyboard.dismiss();
      onClose();
    },
    [onSelect, onClose]
  );

  const excludeSet = new Set(excludeIds);
  const ownIds = new Set(ownExercises.map((e) => e.id));
  const library = allExercises();
  const trimmed = query.trim();
  const filter = { muscle, equipment, query: trimmed };
  const results = filterExercises(filter, excludeSet);
  // Decided against the whole library, not the filtered results: chips can
  // never hide the fact that a name is free.
  const named = trimmed.length > 0 ? findExerciseByName(trimmed, library) : undefined;
  const canCreate = trimmed.length > 0 && !named;
  const narrowed = isNarrowed(filter);
  const empty = results.length === 0 ? describeEmptyPicker({ filter, named }) : null;
  // Hidden while anything narrows the list: a row that ignores your filter is
  // a second answer on screen competing with the right one.
  const recents = narrowed ? [] : recentExercises({ logs, library, excludeIds: excludeSet });

  const startCreate = () => {
    haptics.tap();
    setCreating(toExerciseName(trimmed));
  };

  const clearChips = () => {
    haptics.tap();
    setMuscle(null);
    setEquipment([]);
  };

  const toggleEquipment = (item: Equipment) => {
    setEquipment((current) =>
      current.includes(item) ? current.filter((e) => e !== item) : [...current, item]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The backdrop is a SIBLING of the sheet, not its parent. Wrapping the
          sheet in a Pressable (to absorb taps) breaks the search field on web:
          react-native-web's press responder claims the mouse events before the
          TextInput can take focus, so the field can never be typed into. Keeping
          the tap-to-close target behind the sheet means the sheet's own subtree
          has no press handler above it and inputs behave normally. */}
      {/* Padding the OVERLAY rather than offsetting the sheet is what makes the
          list shrink instead of sliding off the top: the sheet's `maxHeight` is
          a percentage of this box, so a keyboard-sized pad shortens the space
          the sheet is allowed to fill, and the sheet's own layout does the
          rest. */}
      <View style={[styles.overlay, { paddingBottom: keyboardInset }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close exercise picker"
        />

        {/* With the keyboard up it already fills the bottom of the screen, so
            the home-indicator inset would be padding against nothing. */}
        <View
          style={[
            styles.modal,
            { paddingBottom: keyboardInset > 0 ? spacing[4] : insets.bottom + spacing[4] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{creating === null ? title : 'New Exercise'}</Text>
            <Pressable hitSlop={12} onPress={creating === null ? onClose : () => setCreating(null)}>
              <Text style={styles.closeButton}>{creating === null ? 'Cancel' : 'Back'}</Text>
            </Pressable>
          </View>

          {creating !== null ? (
            <CreateExerciseForm initialName={creating} onSaved={handleSelect} />
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises or muscle group…"
                placeholderTextColor={colors.text.muted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />

              <ExercisePickerRecents exercises={recents} onSelect={handleSelect} />

              <ExerciseFilterChips
                muscles={filterMuscles(library)}
                muscle={muscle}
                equipmentCount={equipment.length}
                onPickMuscle={setMuscle}
                onOpenEquipment={() => {
                  Keyboard.dismiss();
                  setEquipmentOpen(true);
                }}
              />

              {/* The count takes the slot Recent left, so the list starts at
                  the same height either way. Counting the whole library on the
                  default sheet tells you nothing, so it is absent there. */}
              {narrowed && (
                <View style={styles.countRow}>
                  <Text style={styles.countLabel}>Results</Text>
                  <Text style={styles.countValue}>{results.length}</Text>
                </View>
              )}

              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {canCreate && (
                  <Pressable
                    style={styles.createRow}
                    onPress={startCreate}
                    accessibilityRole="button"
                  >
                    <View style={styles.createLine}>
                      <Plus size={16} color={roles.accentText} />
                      <Text style={styles.createText}>Create “{toExerciseName(trimmed)}”</Text>
                    </View>
                    <Text style={styles.createHint}>Saved to your library, then added here</Text>
                  </Pressable>
                )}
                <ExercisePickerResults
                  results={results}
                  ownIds={ownIds}
                  empty={empty}
                  underCreate={canCreate}
                  onSelect={handleSelect}
                  onClearChips={clearChips}
                />
              </ScrollView>
            </>
          )}
        </View>

        {/* Laid OVER the picker sheet, as a sibling of it: the list keeps its
            scroll position, and nothing new wraps the search field. */}
        {equipmentOpen && creating === null && (
          <>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setEquipmentOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close equipment filter"
            />
            <EquipmentFilterSheet
              selected={equipment}
              count={results.length}
              bottomInset={insets.bottom}
              onToggle={toggleEquipment}
              onClear={() => setEquipment([])}
              onDone={() => setEquipmentOpen(false)}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    maxHeight: '85%',
    // RN defaults flexShrink to 0. Without this the sheet insists on its
    // content's full height and overflows its own maxHeight rather than
    // letting the list scroll.
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    ...textStyles.h3,
    color: colors.text.primary,
  },
  closeButton: {
    ...textStyles.button,
    color: colors.text.secondary,
  },
  searchInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    ...textStyles.body,
    marginBottom: spacing[2],
  },
  // No fixed height: the list takes whatever the sheet has left after the
  // header and the field, which is the only number that stays right as the
  // keyboard opens and closes. A hard 400 was why the results kept demanding
  // room the sheet no longer had.
  list: {
    flexShrink: 1,
  },
  createRow: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  createLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  createText: {
    ...textStyles.button,
    color: roles.accentText,
  },
  createHint: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  countLabel: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontWeight: '600',
  },
  countValue: {
    ...textStyles.caption,
    color: roles.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
