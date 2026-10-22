// =============================================================================
// StrengthCard — one strength exercise: its name and a row for each set
// =============================================================================

import { Pressable, Text, TextInput, View } from 'react-native';

import { Plus, X } from '@/components/icons';
import { roles } from '@/theme';
import type { WeightUnit } from '@/types';

import { Suggestions, exerciseSuggestions } from './Suggestions';
import { manualStyles as styles } from './manualStyles';
import type { ExerciseHandlers, ExerciseRow } from './types';

export function StrengthCard({
  exercise,
  units,
  isActive,
  isNewest,
  handlers,
}: {
  exercise: ExerciseRow;
  units: WeightUnit;
  isActive: boolean;
  isNewest: boolean;
  handlers: ExerciseHandlers;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TextInput
          style={styles.nameInput}
          value={exercise.name}
          onChangeText={(name) => handlers.onRename(exercise.key, name)}
          onFocus={() => handlers.onFocusName(exercise.key)}
          placeholder="Exercise name"
          placeholderTextColor={roles.textMuted}
          autoFocus={isNewest}
          autoCorrect={false}
          accessibilityLabel="Exercise name"
        />
        <Pressable
          onPress={() => handlers.onRemove(exercise.key)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={exercise.name ? `Remove ${exercise.name}` : 'Remove exercise'}
        >
          <X size={18} color={roles.textMuted} />
        </Pressable>
      </View>

      {isActive && (
        <Suggestions
          items={exerciseSuggestions(exercise.name)}
          onChoose={(name) => handlers.onChooseSuggestion(exercise.key, name)}
        />
      )}

      {exercise.sets.length > 0 && (
        <View style={styles.setHeader}>
          <Text style={[styles.setHeaderText, styles.setNumber]}>Set</Text>
          <Text style={[styles.setHeaderText, styles.setColumn]}>Weight ({units})</Text>
          <View style={styles.timesSpacer} />
          <Text style={[styles.setHeaderText, styles.setColumn]}>Reps</Text>
          <View style={styles.removeSlot} />
        </View>
      )}

      {exercise.sets.map((set, index) => (
        <View key={set.key} style={styles.setRow}>
          <Text style={styles.setNumber}>{index + 1}</Text>
          <TextInput
            style={styles.setInput}
            value={set.weight}
            onChangeText={(weight) => handlers.onUpdateSet(exercise.key, set.key, { weight })}
            placeholder="BW"
            placeholderTextColor={roles.textMuted}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel={`Weight, set ${index + 1}, blank for bodyweight`}
          />
          <Text style={styles.times}>×</Text>
          <TextInput
            style={styles.setInput}
            value={set.reps}
            onChangeText={(reps) => handlers.onUpdateSet(exercise.key, set.key, { reps })}
            placeholder="Reps"
            placeholderTextColor={roles.textMuted}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel={`Reps, set ${index + 1}`}
          />
          <Pressable
            onPress={() => handlers.onRemoveSet(exercise.key, set.key)}
            hitSlop={10}
            style={styles.removeSlot}
            accessibilityRole="button"
            accessibilityLabel={`Remove set ${index + 1}`}
          >
            <X size={16} color={roles.textMuted} />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={() => handlers.onAddSet(exercise.key)}
        style={styles.addSetButton}
        accessibilityRole="button"
      >
        <Plus size={14} color={roles.accentText} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  );
}
