// =============================================================================
// Suggestions — the catalog names offered under a name field while it has focus
// =============================================================================

import { Pressable, Text, View } from 'react-native';

import { suggestCardio } from '@/lib/cardio';
import { suggestExercises } from '@/lib/manual-workout';

import { manualStyles as styles } from './manualStyles';
import type { Suggestion } from './types';

export const exerciseSuggestions = (query: string): Suggestion[] =>
  suggestExercises(query).map((def) => ({
    key: def.id,
    name: def.name,
    meta: `${def.primaryMuscle} · ${def.equipment.join(' / ')}`,
  }));

export const cardioSuggestions = (query: string): Suggestion[] =>
  suggestCardio(query).map((name) => ({ key: name, name }));

export function Suggestions({
  items,
  onChoose,
}: {
  items: Suggestion[];
  onChoose: (name: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.suggestions}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onChoose(item.name)}
          style={styles.suggestion}
          accessibilityRole="button"
        >
          <Text style={styles.suggestionName}>{item.name}</Text>
          {item.meta && <Text style={styles.suggestionMeta}>{item.meta}</Text>}
        </Pressable>
      ))}
    </View>
  );
}
