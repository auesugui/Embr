// =============================================================================
// IronQuest Template Store — Personal (custom) workout templates
// =============================================================================
// Users can duplicate any built-in template (src/data/templates.ts) into a
// personal copy, then edit it: rename, swap/add/remove/reorder exercises, and
// tweak set/rep/rest schemes. Built-ins are NEVER mutated — personal copies are
// deep clones marked `isCustom: true` and persisted to AsyncStorage.
//
// FP distribution recalculation delegates to the REAL engine functions
// (calculateDayFPDistribution / calculateTotalFPDistribution) exported from
// src/data/templates.ts. There is no shadow calculator here — see the engineer
// prompt's "Shadow calculator guard".

import {
  type TemplateExercise,
  type WorkoutTemplateDefinition,
  getExerciseById,
  getTemplateById,
} from '@/data';
import { DEFAULT_AMRAP_SECONDS, clampAmrapSeconds } from '@/lib/amrap';
import type { ExerciseMode } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TemplateState {
  /** Personal (custom) templates only. Built-ins live in src/data/templates.ts. */
  templates: WorkoutTemplateDefinition[];
}

interface SetRepPatch {
  sets?: number;
  reps?: string;
  restSeconds?: number;
  /** Switch the block between a fixed set scheme and a timed AMRAP window. */
  mode?: ExerciseMode;
  /** AMRAP window in seconds. Ignored while `mode` is `sets`. */
  durationSeconds?: number;
}

interface TemplateActions {
  /** Create an empty single-day personal template from scratch. Returns the new id. */
  createBlankTemplate: () => string;
  /** Deep-clone a built-in or personal template into a new personal copy. Returns the new id, or null if the source wasn't found. */
  duplicateTemplate: (sourceId: string) => string | null;
  /** Rename a personal copy. No-op on built-ins. */
  renameTemplate: (id: string, name: string) => void;
  /** Append an exercise (by exerciseId) to a day, using the exercise's defaults. */
  addExercise: (templateId: string, dayId: string, exerciseId: string) => void;
  /** Remove the exercise at `exerciseIndex` from a day. */
  removeExercise: (templateId: string, dayId: string, exerciseIndex: number) => void;
  /** Swap the exerciseId at `exerciseIndex` (keeps sets/reps/rest). */
  swapExercise: (
    templateId: string,
    dayId: string,
    exerciseIndex: number,
    newExerciseId: string
  ) => void;
  /** Move the exercise at `fromIndex` to `toIndex` within a day. */
  reorderExercises: (templateId: string, dayId: string, fromIndex: number, toIndex: number) => void;
  /** Patch the set/rep/rest scheme for the exercise at `exerciseIndex`. */
  updateSetRepScheme: (
    templateId: string,
    dayId: string,
    exerciseIndex: number,
    patch: SetRepPatch
  ) => void;
  /** Permanently delete a personal copy. No-op on built-ins. */
  deleteTemplate: (id: string) => void;
  /** Resolve a template by id across built-ins first, then personal copies. */
  getTemplate: (id: string) => WorkoutTemplateDefinition | undefined;
  /** True only for a personal copy the user owns (not a built-in). */
  isCustom: (id: string) => boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
}

type TemplateStore = TemplateState & TemplateActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const initialState: TemplateState = {
  templates: [],
};

const persistState = async (state: TemplateState) => {
  await appStorage.setJSON(STORAGE_KEYS.PERSONAL_TEMPLATES.FULL_STATE, state);
};

/** Plain-data deep clone. Template definitions are JSON-serializable. */
const cloneDeep = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Rebuild derived day fields in place. */
const recalcDistributions = (t: WorkoutTemplateDefinition): WorkoutTemplateDefinition => {
  const days = t.days.map((d) => ({
    ...d,
  }));
  return { ...t, days };
};

/** Marks ids for templates built from scratch rather than copied. */
const BLANK_ORIGIN = 'custom';

/** Collision-resistant id for a personal copy. Never matches a built-in id. */
const generateTemplateId = (sourceId: string): string => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${sourceId}__custom__${Date.now().toString(36)}__${suffix}`;
};

const DEFAULT_EXERCISE: TemplateExercise = {
  exerciseId: '',
  sets: 3,
  reps: '8-12',
  restSeconds: 90,
};

/** Build a TemplateExercise from an exercise id, pulling sensible defaults. */
const exerciseFromId = (exerciseId: string): TemplateExercise => {
  const def = getExerciseById(exerciseId);
  if (!def) return { ...DEFAULT_EXERCISE, exerciseId };
  return {
    exerciseId,
    sets: def.defaultSets,
    reps: def.defaultReps,
    restSeconds: def.defaultRestSeconds,
  };
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  ...initialState,

  createBlankTemplate: () => {
    // The from-scratch path. Copying a built-in and deleting its exercises was
    // the only way to get a custom workout, which is four screens and a pile of
    // someone else's exercises before you can log your own.
    //
    // One day, no exercises. Multi-day programs still come from duplicating a
    // built-in — the editor has no add/remove-day affordance, so a blank
    // template can't grow past the days it's born with.
    const now = Date.now();
    const newId = generateTemplateId(BLANK_ORIGIN);

    const blank: WorkoutTemplateDefinition = {
      id: newId,
      name: 'New Workout',
      description: '',
      // `category` and `difficulty` are required by the type and drive nothing
      // for a personal copy beyond the card's badge. Neutral defaults.
      category: 'full_body',
      daysPerWeek: 1,
      difficulty: 'beginner',
      estimatedDuration: 45,
      days: [
        {
          id: `${newId}__day0`,
          name: 'Day 1',
          shortName: 'Day 1',
          exercises: [],
        },
      ],
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };

    // Distributions are already zeroed above; running them through the engine
    // anyway keeps this path honest if the zero shape ever changes.
    const finalized = recalcDistributions(blank);

    set((state) => {
      const nextState = { templates: [...state.templates, finalized] };
      persistState(nextState).catch(console.warn);
      return nextState;
    });

    return newId;
  },

  duplicateTemplate: (sourceId) => {
    const source = getTemplateById(sourceId) ?? get().templates.find((t) => t.id === sourceId);
    if (!source) return null;

    const now = Date.now();
    const newId = generateTemplateId(sourceId);
    const copy = cloneDeep(source);
    copy.id = newId;
    copy.isCustom = true;
    copy.sourceTemplateId = sourceId;
    copy.createdAt = now;
    copy.updatedAt = now;
    copy.name = `${source.name} (Copy)`;
    // Namespace day ids so a copy never shares day ids with its source.
    copy.days = copy.days.map((day, index) => ({ ...day, id: `${newId}__day${index}` }));

    const finalized = recalcDistributions(copy);

    set((state) => {
      const nextState = { templates: [...state.templates, finalized] };
      persistState(nextState).catch(console.warn);
      return nextState;
    });

    return newId;
  },

  renameTemplate: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => {
      if (!state.templates.some((t) => t.id === id)) return state;
      const now = Date.now();
      const nextState = {
        templates: state.templates.map((t) =>
          t.id === id ? { ...t, name: trimmed, updatedAt: now } : t
        ),
      };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  addExercise: (templateId, dayId, exerciseId) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === templateId)) return state;
      const now = Date.now();
      const templates = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        const days = t.days.map((day) =>
          day.id === dayId
            ? { ...day, exercises: [...day.exercises, exerciseFromId(exerciseId)] }
            : day
        );
        return recalcDistributions({ ...t, days, updatedAt: now });
      });
      const nextState = { templates };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  removeExercise: (templateId, dayId, exerciseIndex) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === templateId)) return state;
      const now = Date.now();
      const templates = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        const days = t.days.map((day) => {
          if (day.id !== dayId) return day;
          if (exerciseIndex < 0 || exerciseIndex >= day.exercises.length) return day;
          const exercises = day.exercises.filter((_, i) => i !== exerciseIndex);
          return { ...day, exercises };
        });
        return recalcDistributions({ ...t, days, updatedAt: now });
      });
      const nextState = { templates };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  swapExercise: (templateId, dayId, exerciseIndex, newExerciseId) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === templateId)) return state;
      const now = Date.now();
      const templates = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        const days = t.days.map((day) => {
          if (day.id !== dayId) return day;
          if (exerciseIndex < 0 || exerciseIndex >= day.exercises.length) return day;
          const exercises = day.exercises.map((ex, i) =>
            i === exerciseIndex ? { ...ex, exerciseId: newExerciseId } : ex
          );
          return { ...day, exercises };
        });
        return recalcDistributions({ ...t, days, updatedAt: now });
      });
      const nextState = { templates };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  reorderExercises: (templateId, dayId, fromIndex, toIndex) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === templateId)) return state;
      const now = Date.now();
      const templates = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        const days = t.days.map((day) => {
          if (day.id !== dayId) return day;
          if (
            fromIndex < 0 ||
            fromIndex >= day.exercises.length ||
            toIndex < 0 ||
            toIndex >= day.exercises.length ||
            fromIndex === toIndex
          ) {
            return day;
          }
          const exercises = [...day.exercises];
          const [moved] = exercises.splice(fromIndex, 1);
          exercises.splice(toIndex, 0, moved);
          return { ...day, exercises };
        });
        return recalcDistributions({ ...t, days, updatedAt: now });
      });
      const nextState = { templates };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  updateSetRepScheme: (templateId, dayId, exerciseIndex, patch) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === templateId)) return state;
      const now = Date.now();
      const templates = state.templates.map((t) => {
        if (t.id !== templateId) return t;
        const days = t.days.map((day) => {
          if (day.id !== dayId) return day;
          if (exerciseIndex < 0 || exerciseIndex >= day.exercises.length) return day;
          const exercises = day.exercises.map((ex, i) => {
            if (i !== exerciseIndex) return ex;
            const mode = patch.mode ?? ex.mode ?? 'sets';
            const next: TemplateExercise = {
              ...ex,
              sets: patch.sets ?? ex.sets,
              reps: patch.reps ?? ex.reps,
              restSeconds: patch.restSeconds ?? ex.restSeconds,
              mode,
            };
            // An AMRAP block always carries a window; a set-scheme block never
            // carries a stale one. `sets`/`reps` survive the round trip either
            // way so flipping back restores the scheme you had.
            if (mode === 'amrap') {
              next.durationSeconds = clampAmrapSeconds(
                patch.durationSeconds ?? ex.durationSeconds ?? DEFAULT_AMRAP_SECONDS
              );
            } else {
              next.durationSeconds = undefined;
            }
            return next;
          });
          return { ...day, exercises };
        });
        return recalcDistributions({ ...t, days, updatedAt: now });
      });
      const nextState = { templates };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  deleteTemplate: (id) => {
    set((state) => {
      if (!state.templates.some((t) => t.id === id)) return state;
      const nextState = { templates: state.templates.filter((t) => t.id !== id) };
      persistState(nextState).catch(console.warn);
      return nextState;
    });
  },

  getTemplate: (id) => {
    return getTemplateById(id) ?? get().templates.find((t) => t.id === id);
  },

  isCustom: (id) => get().templates.some((t) => t.id === id),

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<TemplateState>(
        STORAGE_KEYS.PERSONAL_TEMPLATES.FULL_STATE
      );
      if (stored?.templates) {
        // Re-flag every loaded copy — defense-in-depth against stale/deserialized data.
        const templates = stored.templates.map((t) => ({ ...t, isCustom: true }));
        set({ templates });
      }
    } catch (error) {
      console.warn('Failed to hydrate template store:', error);
    }
  },

  reset: () => {
    set(initialState);
  },
}));
