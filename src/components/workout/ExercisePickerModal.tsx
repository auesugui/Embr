// =============================================================================
// IronQuest Exercise Picker Modal
// =============================================================================
// Searchable list of the exercise library, built-ins plus the user's own. Used
// by the template editor (issue #5) to swap an exercise or add one to a
// personal copy. A search that names no exercise offers to create it.

import { memo, useCallback, useEffect, useState } from 'react';
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

import { ChevronRight, Plus } from '@/components/icons';
import { CreateExerciseForm } from '@/components/workout/CreateExerciseForm';
import { type ExerciseDefinition, allExercises, searchExercises } from '@/data';
import { useKeyboardInset } from '@/hooks';
import { findExerciseByName, toExerciseName } from '@/lib/custom-exercise';
import { useCustomExerciseStore } from '@/stores';
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

function ExerciseRow({
  exercise,
  isOwn,
  onSelect,
}: {
  exercise: ExerciseDefinition;
  isOwn: boolean;
  onSelect: (id: string) => void;
}) {
  const handle = () => {
    haptics.selection();
    onSelect(exercise.id);
  };
  return (
    <Pressable style={styles.row} onPress={handle}>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName}>{exercise.name}</Text>
          {isOwn && <Text style={styles.ownBadge}>YOURS</Text>}
        </View>
        <Text style={styles.rowMeta}>
          {exercise.primaryMuscle} · {exercise.equipment.join('/')}
        </Text>
      </View>
      <ChevronRight size={18} color={roles.textMuted} style={styles.rowChevron} />
    </Pressable>
  );
}

const MemoRow = memo(ExerciseRow);

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
  // Subscribed so a new exercise shows up, and to mark the user's own.
  const ownExercises = useCustomExerciseStore((state) => state.exercises);
  // The sheet has to get out of the keyboard's way itself: this is a PWA, and
  // KeyboardAvoidingView does nothing in a browser. See useKeyboardInset.
  const keyboardInset = useKeyboardInset();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setQuery('');
      setCreating(null);
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
  const trimmed = query.trim();
  const results = searchExercises(trimmed).filter((e) => !excludeSet.has(e.id));
  const canCreate = trimmed.length > 0 && !findExerciseByName(trimmed, allExercises());

  const startCreate = () => {
    haptics.tap();
    setCreating(toExerciseName(trimmed));
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
                {results.length === 0 && !canCreate ? (
                  <Text style={styles.emptyText}>No exercises match “{query}”.</Text>
                ) : (
                  results.map((exercise) => (
                    <MemoRow
                      key={exercise.id}
                      exercise={exercise}
                      isOwn={ownIds.has(exercise.id)}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </ScrollView>
            </>
          )}
        </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowName: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  ownBadge: {
    ...textStyles.caption,
    fontSize: 11,
    fontWeight: '700',
    color: roles.accentText,
    backgroundColor: roles.accentSubtle,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    overflow: 'hidden',
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
  rowMeta: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rowChevron: {
    marginLeft: spacing[3],
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
