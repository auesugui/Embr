// =============================================================================
// Embr Workout History Store — persisted WorkoutLog records
// =============================================================================
// Owns the WorkoutLog lifecycle: a log is created at session finish (BEFORE
// navigation to the summary) and saved exactly once. `saveWorkout` is the
// idempotency boundary — it returns the log on the first call and null on every
// subsequent attempt (URL reload, double-tap, etc.). This is the mitigation for
// the URL-replay exploit (issue #16 / audit C1).
//
// The guard predates the game layer's removal and outlives it: it originally
// stopped double-*awarding* FP, and now stops double-*saving*. `claimedAt` keeps
// its name because it is a persisted field — renaming it would be a storage
// migration for cosmetics.
//
// The summary screen receives only a workout ID (never the full payload), then
// reads the log back here by ID. On a web reload the root layout rehydrates
// this store, so the claimed log — and its `claimedAt` guard — is restored
// before any re-claim can happen.

import type { Exercise, SessionIntent, WorkoutLog } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CreateLogInput {
  exercises: Exercise[];
  durationSeconds: number;
  /** Streak day count snapshot at finish time. */
  streakDays: number;
  sessionIntent: SessionIntent;
}

interface WorkoutHistoryState {
  logs: WorkoutLog[];
  /** True once the initial AsyncStorage hydrate has resolved. */
  hydrated: boolean;
}

interface WorkoutHistoryActions {
  /** Persist a new (unclaimed) log and return its id. Call before navigation. */
  createLog: (input: CreateLogInput) => string;
  /** Read a log by id (undefined if missing / not yet hydrated). */
  getLog: (id: string) => WorkoutLog | undefined;
  /**
   * Idempotent save. Stamps `claimedAt` and returns the updated log on the
   * FIRST call. Returns null on every subsequent call for the same id (or for
   * an unknown id) — callers must treat null as "already saved" and no-op.
   */
  saveWorkout: (id: string) => WorkoutLog | null;
  /** Hydrate from AsyncStorage. */
  hydrate: () => Promise<void>;
  /** Reset to initial state (dev/test only). */
  reset: () => void;
}

type WorkoutHistoryStore = WorkoutHistoryState & WorkoutHistoryActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: WorkoutHistoryState = {
  logs: [],
  hydrated: false,
};

const generateId = (): string =>
  `workout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const persistLogs = async (logs: WorkoutLog[]) => {
  await appStorage.setJSON(STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE, { logs });
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWorkoutHistoryStore = create<WorkoutHistoryStore>((set, get) => ({
  ...initialState,

  createLog: ({ exercises, durationSeconds, streakDays, sessionIntent }) => {
    const id = generateId();
    const log: WorkoutLog = {
      id,
      timestamp: new Date().toISOString(),
      exercises,
      durationSeconds,
      streakDays,
      sessionIntent,
      claimedAt: null,
    };

    set((state) => {
      const logs = [log, ...state.logs];
      persistLogs(logs).catch(console.warn);
      return { logs };
    });

    return id;
  },

  getLog: (id) => get().logs.find((log) => log.id === id),

  saveWorkout: (id) => {
    const existing = get().logs.find((log) => log.id === id);
    if (!existing) {
      console.warn(`[workoutHistory] saveWorkout: unknown workout id "${id}" — ignoring.`);
      return null;
    }
    if (existing.claimedAt !== null) {
      console.warn(
        `[workoutHistory] saveWorkout: workout "${id}" already saved at ${existing.claimedAt} — ignoring replay.`
      );
      return null;
    }

    const claimedAt = new Date().toISOString();
    const claimedLog: WorkoutLog = { ...existing, claimedAt };

    set((state) => {
      const logs = state.logs.map((log) => (log.id === id ? claimedLog : log));
      persistLogs(logs).catch(console.warn);
      return { logs };
    });

    return claimedLog;
  },

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<{ logs?: WorkoutLog[] }>(
        STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE
      );
      set({ logs: stored?.logs ?? [], hydrated: true });
    } catch (error) {
      console.warn('Failed to hydrate workout history store:', error);
      set({ hydrated: true });
    }
  },

  reset: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE).catch(console.warn);
  },
}));
