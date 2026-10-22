// =============================================================================
// Custom exercise store — exercises the user created, saved on this device
// =============================================================================
// Every add is written before the store changes, so a failed write leaves the
// library as it was and reaches the form as an error. The list is also handed
// to the exercise lookups in @/data, which is how every picker and template
// screen finds these by id.

import { type ExerciseDefinition, allExercises, setCustomExercises } from '@/data';
import {
  type CustomExerciseInput,
  type CustomExerciseResult,
  buildCustomExercise,
} from '@/lib/custom-exercise';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

interface CustomExerciseState {
  exercises: ExerciseDefinition[];
  /** Rejects only when the write fails. A refused name comes back as `ok: false`. */
  addExercise: (input: CustomExerciseInput) => Promise<CustomExerciseResult>;
  hydrate: () => Promise<void>;
  reset: () => void;
}

export const useCustomExerciseStore = create<CustomExerciseState>((set, get) => ({
  exercises: [],

  addExercise: async (input) => {
    const result = buildCustomExercise(input, allExercises());
    if (!result.ok) return result;

    const exercises = [result.exercise, ...get().exercises];
    await appStorage.setJSON(STORAGE_KEYS.CUSTOM_EXERCISES.FULL_STATE, { exercises });
    setCustomExercises(exercises);
    set({ exercises });
    return result;
  },

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<{ exercises: ExerciseDefinition[] }>(
        STORAGE_KEYS.CUSTOM_EXERCISES.FULL_STATE
      );
      if (Array.isArray(stored?.exercises)) {
        setCustomExercises(stored.exercises);
        set({ exercises: stored.exercises });
      }
    } catch (error) {
      console.warn('Failed to hydrate custom exercise store:', error);
    }
  },

  reset: () => {
    setCustomExercises([]);
    set({ exercises: [] });
  },
}));
