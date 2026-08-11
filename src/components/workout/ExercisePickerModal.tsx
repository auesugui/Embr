// =============================================================================
// IronQuest Exercise Picker Modal
// =============================================================================
// Searchable list of the built-in exercise database. Used by the template
// editor (issue #5) to swap an exercise or add one to a personal copy.

import { memo, useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type ExerciseDefinition, searchExercises } from '@/data';
import { colors, radius, spacing, textStyles } from '@/theme';
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
  onSelect,
}: {
  exercise: ExerciseDefinition;
  onSelect: (id: string) => void;
}) {
  const handle = () => {
    haptics.selection();
    onSelect(exercise.id);
  };
  return (
    <Pressable style={styles.row} onPress={handle}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{exercise.name}</Text>
        <Text style={styles.rowMeta}>
          {exercise.primaryMuscle} · {exercise.equipment.join('/')}
        </Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
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

  useEffect(() => {
    if (visible) setQuery('');
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
  const results = searchExercises(query.trim()).filter((e) => !excludeSet.has(e.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The backdrop is a SIBLING of the sheet, not its parent. Wrapping the
          sheet in a Pressable (to absorb taps) breaks the search field on web:
          react-native-web's press responder claims the mouse events before the
          TextInput can take focus, so the field can never be typed into. Keeping
          the tap-to-close target behind the sheet means the sheet's own subtree
          has no press handler above it and inputs behave normally. */}
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close exercise picker"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable hitSlop={12} onPress={onClose}>
                <Text style={styles.closeButton}>Cancel</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises or muscle group…"
              placeholderTextColor={colors.text.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {results.length === 0 ? (
                <Text style={styles.emptyText}>No exercises match “{query}”.</Text>
              ) : (
                results.map((exercise) => (
                  <MemoRow key={exercise.id} exercise={exercise} onSelect={handleSelect} />
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    maxHeight: '85%',
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
  list: {
    maxHeight: 400,
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
  rowName: {
    ...textStyles.body,
    color: colors.text.primary,
  },
  rowMeta: {
    ...textStyles.caption,
    color: colors.text.muted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rowChevron: {
    ...textStyles.h3,
    color: colors.text.muted,
    marginLeft: spacing[3],
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
});
