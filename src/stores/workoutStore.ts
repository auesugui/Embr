// =============================================================================
// IronQuest Workout Store - Active Session, Exercises, Rest Timer
// =============================================================================

import type { Exercise, SessionIntent } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';
import { usePRStore } from './prStore';
import { useSettingsStore } from './settingsStore';
import { useWeightHistoryStore } from './weightHistoryStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RestTimerState {
  duration: number;
  remaining: number;
  running: boolean;
  paused: boolean;
}

/**
 * The clock behind an AMRAP block.
 *
 * Unlike the rest timer this one carries `endsAt` (wall clock) and derives
 * `remaining` from it on every tick. A 20-minute window outlives a backgrounded
 * tab or a reload, and a tick-counted timer would silently pause for exactly as
 * long as the app wasn't running — which is the one thing an AMRAP must not do.
 * `remaining` is still stored so the UI has something to render before the
 * first tick lands.
 */
interface AmrapTimerState {
  /** Which exercise the window belongs to; null when no AMRAP is running. */
  exerciseIndex: number | null;
  duration: number;
  remaining: number;
  running: boolean;
  paused: boolean;
  /** ms epoch the window ends at. Null while paused or stopped. */
  endsAt: number | null;
}

interface WorkoutState {
  // Session state
  active: boolean;
  templateId: string | null;
  startedAt: number | null;
  currentExerciseIndex: number;
  exercises: Exercise[];
  intent: SessionIntent;
  gymRushActive: boolean;

  // Rest timer
  restTimer: RestTimerState;

  // AMRAP window (one at a time — you can only be inside one block)
  amrapTimer: AmrapTimerState;
}

interface WorkoutActions {
  // Session lifecycle
  startSession: (templateId: string, exercises: Exercise[], intent?: SessionIntent) => void;
  endSession: () => void;
  cancelSession: () => void;

  // Exercise flow
  logSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  /** Append an empty set row. AMRAP rounds are open-ended, so the UI grows the list as you log. */
  addSet: (exerciseIndex: number) => void;
  editSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  clearSet: (exerciseIndex: number, setIndex: number) => void;
  completeExercise: (exerciseIndex: number) => void;
  nextExercise: () => void;
  previousExercise: () => void;
  setCurrentExercise: (index: number) => void;

  // Rest timer
  startRestTimer: (duration: number) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  resetRestTimer: () => void;
  tickRestTimer: () => void;

  // AMRAP window
  startAmrapTimer: (exerciseIndex: number, duration: number) => void;
  pauseAmrapTimer: () => void;
  resumeAmrapTimer: () => void;
  resetAmrapTimer: () => void;
  tickAmrapTimer: () => void;

  // Modifiers
  toggleGymRush: () => void;
  setIntent: (intent: SessionIntent) => void;

  // Getters (for deriving state)
  getCurrentExercise: () => Exercise | null;
  getCompletedSets: () => number;
  getTotalReps: () => number;

  // Hydration
  hydrate: () => Promise<void>;
  reset: () => void;
}

type WorkoutStore = WorkoutState & WorkoutActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialRestTimer: RestTimerState = {
  duration: 90,
  remaining: 0,
  running: false,
  paused: false,
};

const initialAmrapTimer: AmrapTimerState = {
  exerciseIndex: null,
  duration: 0,
  remaining: 0,
  running: false,
  paused: false,
  endsAt: null,
};

const initialState: WorkoutState = {
  active: false,
  templateId: null,
  startedAt: null,
  currentExerciseIndex: 0,
  exercises: [],
  intent: 'normal',
  gymRushActive: false,
  restTimer: initialRestTimer,
  amrapTimer: initialAmrapTimer,
};

const emptySet = () => ({
  reps: null,
  weight: null,
  logged: false,
  isPR: false,
  isRepPR: false,
});

// Helper to persist session state
const persistSession = async (state: Partial<WorkoutState>) => {
  await appStorage.setJSON(STORAGE_KEYS.SESSION.FULL_STATE, state);
};

/**
 * Rebuild an AMRAP clock from persisted state.
 *
 * Sessions saved before AMRAP existed have no `amrapTimer` at all — those load
 * as "no window running". A window that expired while the app was closed comes
 * back finished rather than resuming with time that no longer exists.
 */
const restoreAmrapTimer = (stored: AmrapTimerState | undefined): AmrapTimerState => {
  if (!stored || stored.exerciseIndex === null) return initialAmrapTimer;

  if (stored.running && stored.endsAt) {
    const remaining = Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
    return remaining === 0
      ? { ...stored, remaining: 0, running: false, paused: false, endsAt: null }
      : { ...stored, remaining };
  }

  return { ...stored, running: false, endsAt: null };
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  ...initialState,

  // Session lifecycle
  startSession: (templateId, exercises, intent = 'normal') => {
    const startedAt = Date.now();

    const newState: WorkoutState = {
      ...initialState,
      active: true,
      templateId,
      startedAt,
      currentExerciseIndex: 0,
      exercises,
      intent,
      gymRushActive: false,
    };

    set(newState);
    persistSession(newState).catch(console.warn);
  },

  endSession: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.SESSION.FULL_STATE).catch(console.warn);
  },

  cancelSession: () => {
    get().endSession();
  },

  // Exercise flow
  logSet: (exerciseIndex, setIndex, reps, weight = undefined) => {
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      // Check for PR before recording
      let isPR = false;
      let isRepPR = false;

      if (weight !== undefined && weight !== null && weight > 0 && exercise.id) {
        // PRs compare within the unit the set was logged in (issue #42).
        const unit = useSettingsStore.getState().units;
        const prResult = usePRStore.getState().recordPR(exercise.id, weight, reps, unit);
        isPR = prResult.isWeightPR;
        isRepPR = prResult.isRepPR;
      }

      sets[setIndex] = {
        reps,
        weight: weight ?? null,
        logged: true,
        isPR,
        isRepPR,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);

      // Save weight to history if weight is provided
      if (weight !== undefined && weight !== null) {
        const exerciseData = state.exercises[exerciseIndex];
        if (exerciseData?.id) {
          useWeightHistoryStore
            .getState()
            .saveWeight(exerciseData.id, weight, useSettingsStore.getState().units);
        }
      }

      return { exercises };
    });
  },

  editSet: (exerciseIndex, setIndex, reps, weight = undefined) => {
    // Same as logSet but without triggering side effects (like rest timer)
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        reps,
        weight: weight ?? null,
        logged: true,
        isPR: false,
        isRepPR: false,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);

      // Keep weight history fresh so next session auto-fills the edited value
      if (weight !== undefined && weight !== null) {
        const exerciseData = state.exercises[exerciseIndex];
        if (exerciseData?.id) {
          useWeightHistoryStore
            .getState()
            .saveWeight(exerciseData.id, weight, useSettingsStore.getState().units);
        }
      }

      return { exercises };
    });
  },

  clearSet: (exerciseIndex, setIndex) => {
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        reps: 0,
        weight: null,
        logged: false,
        isPR: false,
        isRepPR: false,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  addSet: (exerciseIndex) => {
    set((state) => {
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      const exercises = [...state.exercises];
      exercises[exerciseIndex] = { ...exercise, sets: [...exercise.sets, emptySet()] };

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  completeExercise: (exerciseIndex) => {
    set((state) => {
      const exercises = [...state.exercises];
      exercises[exerciseIndex] = {
        ...exercises[exerciseIndex],
        completed: true,
      };
      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  nextExercise: () => {
    set((state) => {
      const nextIndex = Math.min(state.currentExerciseIndex + 1, state.exercises.length - 1);
      return { currentExerciseIndex: nextIndex };
    });
  },

  previousExercise: () => {
    set((state) => {
      const prevIndex = Math.max(state.currentExerciseIndex - 1, 0);
      return { currentExerciseIndex: prevIndex };
    });
  },

  setCurrentExercise: (index) => {
    set((state) => {
      if (index >= 0 && index < state.exercises.length) {
        return { currentExerciseIndex: index };
      }
      return state;
    });
  },

  // Rest timer
  startRestTimer: (duration) => {
    set({
      restTimer: {
        duration,
        remaining: duration,
        running: true,
        paused: false,
      },
    });
  },

  pauseRestTimer: () => {
    set((state) => ({
      restTimer: { ...state.restTimer, paused: true, running: false },
    }));
  },

  resumeRestTimer: () => {
    set((state) => ({
      restTimer: { ...state.restTimer, paused: false, running: true },
    }));
  },

  resetRestTimer: () => {
    set({ restTimer: initialRestTimer });
  },

  tickRestTimer: () => {
    set((state) => {
      if (!state.restTimer.running || state.restTimer.paused) {
        return state;
      }

      const remaining = Math.max(0, state.restTimer.remaining - 1);

      if (remaining === 0) {
        return {
          restTimer: {
            ...state.restTimer,
            remaining: 0,
            running: false,
          },
        };
      }

      return {
        restTimer: { ...state.restTimer, remaining },
      };
    });
  },

  // AMRAP window
  //
  // Persisted with the session (unlike the rest timer) because a 20-minute
  // block routinely outlives a reload, and coming back to a stopped clock
  // mid-block would lose the only thing bounding the exercise.
  startAmrapTimer: (exerciseIndex, duration) => {
    const safeDuration = Math.max(0, Math.round(duration));
    set((state) => {
      const amrapTimer: AmrapTimerState = {
        exerciseIndex,
        duration: safeDuration,
        remaining: safeDuration,
        running: safeDuration > 0,
        paused: false,
        endsAt: safeDuration > 0 ? Date.now() + safeDuration * 1000 : null,
      };
      persistSession({ ...state, amrapTimer }).catch(console.warn);
      return { amrapTimer };
    });
  },

  pauseAmrapTimer: () => {
    set((state) => {
      if (!state.amrapTimer.running) return state;
      // Freeze the true remaining time, then drop endsAt — resume re-anchors it.
      const remaining = state.amrapTimer.endsAt
        ? Math.max(0, Math.ceil((state.amrapTimer.endsAt - Date.now()) / 1000))
        : state.amrapTimer.remaining;
      const amrapTimer: AmrapTimerState = {
        ...state.amrapTimer,
        remaining,
        running: false,
        paused: true,
        endsAt: null,
      };
      persistSession({ ...state, amrapTimer }).catch(console.warn);
      return { amrapTimer };
    });
  },

  resumeAmrapTimer: () => {
    set((state) => {
      if (!state.amrapTimer.paused || state.amrapTimer.remaining <= 0) return state;
      const amrapTimer: AmrapTimerState = {
        ...state.amrapTimer,
        running: true,
        paused: false,
        endsAt: Date.now() + state.amrapTimer.remaining * 1000,
      };
      persistSession({ ...state, amrapTimer }).catch(console.warn);
      return { amrapTimer };
    });
  },

  resetAmrapTimer: () => {
    set((state) => {
      persistSession({ ...state, amrapTimer: initialAmrapTimer }).catch(console.warn);
      return { amrapTimer: initialAmrapTimer };
    });
  },

  tickAmrapTimer: () => {
    set((state) => {
      const timer = state.amrapTimer;
      if (!timer.running || timer.paused || timer.endsAt === null) return state;

      const remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));

      if (remaining === 0) {
        // The window closed. Keep exerciseIndex so the UI can say which block
        // finished; stop the clock so nothing keeps ticking at zero.
        const amrapTimer: AmrapTimerState = {
          ...timer,
          remaining: 0,
          running: false,
          paused: false,
          endsAt: null,
        };
        persistSession({ ...state, amrapTimer }).catch(console.warn);
        return { amrapTimer };
      }

      if (remaining === timer.remaining) return state;
      return { amrapTimer: { ...timer, remaining } };
    });
  },

  // Modifiers
  toggleGymRush: () => {
    set((state) => ({ gymRushActive: !state.gymRushActive }));
  },

  setIntent: (intent) => {
    set({ intent });
  },

  // Getters
  getCurrentExercise: () => {
    const state = get();
    if (!state.active || state.exercises.length === 0) {
      return null;
    }
    return state.exercises[state.currentExerciseIndex] ?? null;
  },

  getCompletedSets: () => {
    const state = get();
    return state.exercises.flatMap((e) => e.sets.filter((s) => s.logged)).length;
  },

  getTotalReps: () => {
    const state = get();
    return state.exercises
      .flatMap((e) => e.sets.filter((s) => s.logged))
      .reduce((sum, s) => sum + (s.reps || 0), 0);
  },

  // Hydration
  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<Partial<WorkoutState>>(
        STORAGE_KEYS.SESSION.FULL_STATE
      );
      if (stored?.active) {
        set({
          active: stored.active,
          templateId: stored.templateId ?? null,
          startedAt: stored.startedAt ?? null,
          currentExerciseIndex: stored.currentExerciseIndex ?? 0,
          exercises: stored.exercises ?? [],
          intent: stored.intent ?? 'normal',
          gymRushActive: stored.gymRushActive ?? false,
          amrapTimer: restoreAmrapTimer(stored.amrapTimer),
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate workout store:', error);
    }
  },

  reset: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.SESSION.FULL_STATE).catch(console.warn);
  },
}));

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const selectSessionDuration = (state: WorkoutStore) => {
  if (!state.startedAt) return 0;
  return Math.floor((Date.now() - state.startedAt) / 1000 / 60);
};

export const selectExerciseProgress = (state: WorkoutStore) => {
  const completed = state.exercises.filter((e) => e.completed).length;
  const total = state.exercises.length;
  return { completed, total, percentage: total > 0 ? completed / total : 0 };
};

export const selectIsRestTimerComplete = (state: WorkoutStore) => {
  return state.restTimer.remaining === 0 && !state.restTimer.running;
};
