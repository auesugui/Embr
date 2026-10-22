// =============================================================================
// Custom exercise store — exercises the user created, saved on this device
// =============================================================================
// Every add is written before the store changes, so a failed write leaves the
// library as it was and reaches the form as an error. The list is also handed
// to the exercise lookups in @/data, which is how every picker and template
// screen finds these by id.
//
// Adds run one at a time. Each one checks the name and builds the new list only
// after the previous write settles, so two overlapping saves cannot both start
// from the same list and drop each other.

import { type ExerciseDefinition, allExercises, setCustomExercises } from '@/data';
import {
  type CustomExerciseInput,
  type CustomExerciseResult,
  buildCustomExercise,
  isStoredExercise,
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

// The tail of the add queue. A failed add must not block the next one.
let pending: Promise<unknown> = Promise.resolve();

export const useCustomExerciseStore = create<CustomExerciseState>((set, get) => ({
  exercises: [],

  addExercise: (input) => {
    const run = pending.then(async (): Promise<CustomExerciseResult> => {
      const result = buildCustomExercise(input, allExercises());
      if (!result.ok) return result;

      const exercises = [result.exercise, ...get().exercises];
      await appStorage.setJSON(STORAGE_KEYS.CUSTOM_EXERCISES.FULL_STATE, { exercises });
      setCustomExercises(exercises);
      set({ exercises });
      return result;
    });
    pending = run.catch(() => undefined);
    return run;
  },

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<{ exercises: unknown }>(
        STORAGE_KEYS.CUSTOM_EXERCISES.FULL_STATE
      );
      if (!Array.isArray(stored?.exercises)) return;

      // A restored backup is outside data. Entries that would break a lookup
      // or a picker row are left out rather than published.
      const exercises = stored.exercises.filter(isStoredExercise);
      if (exercises.length < stored.exercises.length) {
        console.warn(
          `Skipped ${stored.exercises.length - exercises.length} malformed custom exercise(s).`
        );
      }
      setCustomExercises(exercises);
      set({ exercises });
    } catch (error) {
      console.warn('Failed to hydrate custom exercise store:', error);
    }
  },

  reset: () => {
    setCustomExercises([]);
    set({ exercises: [] });
  },
}));
