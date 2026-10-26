// =============================================================================
// IronQuest Weight History Store - Remembers Last Used Weight Per Exercise
// =============================================================================

import type { ExerciseWeightHistory, WeightHistoryEntry, WeightUnit } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WeightHistoryState {
  history: Record<string, ExerciseWeightHistory>;
}

interface WeightHistoryActions {
  getLastWeight: (exerciseId: string) => number | null;
  // Unit-aware read: pre-#42 entries default to lb.
  getLastWeightWithUnit: (exerciseId: string) => { weight: number; unit: WeightUnit } | null;
  /** What the pre-fill remembers, with its time — see `lastWeightInUnit`. */
  getLastWeightInUnit: (exerciseId: string, unit: WeightUnit) => CachedWeight | null;
  saveWeight: (exerciseId: string, weight: number, unit?: WeightUnit) => void;
  getRecentWeights: (exerciseId: string) => WeightHistoryEntry[];
  clearExerciseHistory: (exerciseId: string) => void;
  clearAllHistory: () => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

type WeightHistoryStore = WeightHistoryState & WeightHistoryActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_RECENT_WEIGHTS = 5;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: WeightHistoryState = {
  history: {},
};

/** A remembered weight and when it was written, so it can be ranked by age. */
export interface CachedWeight {
  weight: number;
  /** ISO timestamp of the set that wrote it. */
  recordedAt: string;
}

/**
 * The most recent remembered weight for this movement IN `unit`, or null.
 *
 * The pre-fill is the one surface where a unit mix-up puts the wrong plates on
 * a bar: filling 275 into a kg field loads 275 kg onto a bar that held 275 lb.
 * So it never crosses units and never converts — it falls back to the last
 * weight recorded in the unit being logged in, and opens empty when there is
 * none (#85 step 2, Q5).
 *
 * It comes back WITH its timestamp because this cache is not the only record
 * of what you lifted: a workout added through history writes no entry here, so
 * the two have to be ranked rather than one trusted over the other. See
 * `prefillWeight`. `lastWeight` is written in the same breath as `updatedAt`,
 * which is why that is its time.
 *
 * Exported as a pure function so the screen's selector and the store action
 * answer this from one definition rather than two.
 */
export function lastWeightInUnit(
  history: ExerciseWeightHistory | undefined,
  unit: WeightUnit
): CachedWeight | null {
  if (!history) return null;
  // Pre-#42 entries carry no unit — they were all logged in lb.
  if ((history.lastUnit ?? 'lb') === unit && history.lastWeight !== null) {
    return { weight: history.lastWeight, recordedAt: history.updatedAt };
  }
  // Also the fallback for a record whose `lastWeight` is missing while its
  // entries are not: a restored backup can hold one, and dropping the entries
  // because of it would throw away a weight the cache still has.
  const match = history.recentWeights.find((entry) => (entry.unit ?? 'lb') === unit);
  return match === undefined ? null : { weight: match.weight, recordedAt: match.timestamp };
}

// Helper to persist state
const persistState = async (state: WeightHistoryState) => {
  await appStorage.setJSON(STORAGE_KEYS.WEIGHT_HISTORY.FULL_STATE, state);
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWeightHistoryStore = create<WeightHistoryStore>((set, get) => ({
  ...initialState,

  getLastWeight: (exerciseId) => {
    const state = get();
    const exerciseHistory = state.history[exerciseId];
    return exerciseHistory?.lastWeight ?? null;
  },

  getLastWeightWithUnit: (exerciseId) => {
    const exerciseHistory = get().history[exerciseId];
    if (exerciseHistory?.lastWeight == null) return null;
    return {
      weight: exerciseHistory.lastWeight,
      unit: exerciseHistory.lastUnit ?? 'lb',
    };
  },

  getLastWeightInUnit: (exerciseId, unit) => lastWeightInUnit(get().history[exerciseId], unit),

  saveWeight: (exerciseId, weight, unit = 'lb') => {
    set((state) => {
      const existingHistory = state.history[exerciseId];
      const now = new Date().toISOString();

      // Create new entry
      const newEntry: WeightHistoryEntry = {
        weight,
        timestamp: now,
        unit,
      };

      // Build recent weights array
      let recentWeights: WeightHistoryEntry[];
      if (existingHistory) {
        // Prepend new entry and limit to MAX_RECENT_WEIGHTS
        recentWeights = [newEntry, ...existingHistory.recentWeights].slice(0, MAX_RECENT_WEIGHTS);
      } else {
        recentWeights = [newEntry];
      }

      // Update history
      const updatedHistory: ExerciseWeightHistory = {
        exerciseId,
        lastWeight: weight,
        lastUnit: unit,
        recentWeights,
        updatedAt: now,
      };

      const newState = {
        history: {
          ...state.history,
          [exerciseId]: updatedHistory,
        },
      };

      persistState(newState).catch(console.warn);

      return newState;
    });
  },

  getRecentWeights: (exerciseId) => {
    const state = get();
    const exerciseHistory = state.history[exerciseId];
    return exerciseHistory?.recentWeights ?? [];
  },

  clearExerciseHistory: (exerciseId) => {
    set((state) => {
      const { [exerciseId]: _, ...remainingHistory } = state.history;

      const newState = {
        history: remainingHistory,
      };

      persistState(newState).catch(console.warn);

      return newState;
    });
  },

  clearAllHistory: () => {
    const newState = { ...initialState };
    set(newState);
    persistState(newState).catch(console.warn);
  },

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<WeightHistoryState>(
        STORAGE_KEYS.WEIGHT_HISTORY.FULL_STATE
      );

      if (stored?.history) {
        set({
          history: stored.history,
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate weight history store:', error);
    }
  },

  reset: () => {
    set(initialState);
  },
}));

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const selectLastWeight = (exerciseId: string) => (state: WeightHistoryStore) => {
  return state.history[exerciseId]?.lastWeight ?? null;
};

export const selectRecentWeights = (exerciseId: string) => (state: WeightHistoryStore) => {
  return state.history[exerciseId]?.recentWeights ?? [];
};
