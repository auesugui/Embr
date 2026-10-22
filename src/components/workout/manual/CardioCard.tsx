// =============================================================================
// CardioCard — one typed-in cardio entry: activity, minutes, RPE, distance
// =============================================================================

import { Pressable, Text, TextInput, View } from 'react-native';

import { X } from '@/components/icons';
import { roles } from '@/theme';
import type { DistanceUnit } from '@/types';

import { Suggestions, cardioSuggestions } from './Suggestions';
import { manualStyles as styles } from './manualStyles';
import type { CardioFields, ExerciseHandlers, ExerciseRow } from './types';

const UNITS: readonly DistanceUnit[] = ['mi', 'km'];

export function CardioCard({
  exercise,
  cardio,
  isActive,
  isNewest,
  handlers,
}: {
  exercise: ExerciseRow;
  cardio: CardioFields;
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
          placeholder="Activity"
          placeholderTextColor={roles.textMuted}
          autoFocus={isNewest}
          autoCorrect={false}
          accessibilityLabel="Activity name"
        />
        <Pressable
          onPress={() => handlers.onRemove(exercise.key)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={exercise.name ? `Remove ${exercise.name}` : 'Remove activity'}
        >
          <X size={18} color={roles.textMuted} />
        </Pressable>
      </View>

      {isActive && (
        <Suggestions
          items={cardioSuggestions(exercise.name)}
          onChoose={(name) => handlers.onChooseSuggestion(exercise.key, name)}
        />
      )}

      <View style={styles.fieldRow}>
        <View style={styles.fieldGrow}>
          <Text style={styles.fieldLabel}>Minutes</Text>
          <TextInput
            style={styles.input}
            value={cardio.minutes}
            onChangeText={(minutes) => handlers.onUpdateCardio(exercise.key, { minutes })}
            placeholder="Required"
            placeholderTextColor={roles.textMuted}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Minutes"
          />
        </View>
        <View style={styles.fieldGrow}>
          <Text style={styles.fieldLabel}>RPE, 1 to 10</Text>
          <TextInput
            style={styles.input}
            value={cardio.rpe}
            onChangeText={(rpe) => handlers.onUpdateCardio(exercise.key, { rpe })}
            placeholder="Optional"
            placeholderTextColor={roles.textMuted}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Rate of perceived exertion, 1 to 10"
          />
        </View>
      </View>

      <View style={[styles.fieldRow, styles.distanceRow]}>
        <View style={styles.fieldGrow}>
          <Text style={styles.fieldLabel}>Distance</Text>
          <TextInput
            style={styles.input}
            value={cardio.distance}
            onChangeText={(distance) => handlers.onUpdateCardio(exercise.key, { distance })}
            placeholder="Optional"
            placeholderTextColor={roles.textMuted}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Distance"
          />
        </View>
        <View style={styles.unitToggle} accessibilityRole="radiogroup">
          {UNITS.map((unit) => {
            const selected = cardio.distanceUnit === unit;
            return (
              <Pressable
                key={unit}
                onPress={() => handlers.onUpdateCardio(exercise.key, { distanceUnit: unit })}
                style={[styles.unitOption, selected && styles.unitOptionSelected]}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={unit === 'mi' ? 'Miles' : 'Kilometers'}
              >
                <Text style={[styles.unitText, selected && styles.unitTextSelected]}>{unit}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
