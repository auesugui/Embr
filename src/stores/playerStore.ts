// =============================================================================
// Embr Player Store — profile, streak, workout count
// =============================================================================

import type { PlayerProfile, StreakData } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PlayerState {
  profile: PlayerProfile;
  streak: StreakData;
  achievements: string[];
  totalWorkouts: number;
}

interface PlayerActions {
  // Streak Actions
  updateStreak: (workedOutToday: boolean) => void;
  resetStreak: () => void;

  // Workout Actions
  incrementWorkoutCount: () => void;

  // Profile Actions
  updateProfile: (profile: Partial<PlayerProfile>) => void;

  // Achievement Actions
  unlockAchievement: (id: string) => boolean;
  removeAchievement: (id: string) => void;

  // Hydration
  hydrate: () => Promise<void>;
  reset: () => void;
}

type PlayerStore = PlayerState & PlayerActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PlayerState = {
  profile: {
    name: 'Iron Master',
    avatar: null,
    createdAt: new Date().toISOString(),
  },
  streak: {
    current: 0,
    longest: 0,
    lastWorkoutDate: null,
  },
  achievements: [],
  totalWorkouts: 0,
};

// Helper to persist state
const persistState = async (state: PlayerState) => {
  await appStorage.setJSON(STORAGE_KEYS.PLAYER.FULL_STATE, state);
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialState,

  // Streak Actions
  updateStreak: (workedOutToday) => {
    const today = new Date().toISOString().split('T')[0];
    const state = get();

    if (!workedOutToday) {
      const lastWorkout = state.streak.lastWorkoutDate;
      if (lastWorkout) {
        const lastDate = new Date(lastWorkout);
        const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 1) {
          get().resetStreak();
        }
      }
      return;
    }

    const lastWorkout = state.streak.lastWorkoutDate;
    let newCurrent = state.streak.current;

    if (lastWorkout !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastWorkout === yesterday) {
        newCurrent = state.streak.current + 1;
      } else if (!lastWorkout) {
        newCurrent = 1;
      } else {
        newCurrent = 1;
      }
    }

    const newStreak: StreakData = {
      current: newCurrent,
      longest: Math.max(state.streak.longest, newCurrent),
      lastWorkoutDate: today,
    };

    set({ streak: newStreak });
    persistState({ ...get(), streak: newStreak }).catch(console.warn);
  },

  resetStreak: () => {
    const newStreak: StreakData = {
      current: 0,
      longest: get().streak.longest,
      lastWorkoutDate: null,
    };

    set({ streak: newStreak });
    persistState({ ...get(), streak: newStreak }).catch(console.warn);
  },

  // Workout Actions
  incrementWorkoutCount: () => {
    set((state) => {
      const newCount = state.totalWorkouts + 1;
      const newState = { ...state, totalWorkouts: newCount };
      persistState(newState).catch(console.warn);
      return { totalWorkouts: newCount };
    });
  },

  // Profile Actions
  updateProfile: (profile) => {
    set((state) => ({
      profile: { ...state.profile, ...profile },
    }));
    persistState(get()).catch(console.warn);
  },

  // Achievement Actions
  unlockAchievement: (id) => {
    const state = get();
    if (state.achievements.includes(id)) {
      return false;
    }

    set((state) => ({
      achievements: [...state.achievements, id],
    }));
    persistState(get()).catch(console.warn);
    return true;
  },

  removeAchievement: (id) => {
    set((state) => ({
      achievements: state.achievements.filter((a) => a !== id),
    }));
    persistState(get()).catch(console.warn);
  },

  // Hydration
  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<Partial<PlayerState>>(STORAGE_KEYS.PLAYER.FULL_STATE);
      if (stored) {
        set({
          profile: stored.profile ?? initialState.profile,
          streak: stored.streak ?? initialState.streak,
          achievements: stored.achievements ?? initialState.achievements,
          totalWorkouts: stored.totalWorkouts ?? initialState.totalWorkouts,
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate player store:', error);
    }
  },

  reset: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.PLAYER.FULL_STATE).catch(console.warn);
  },
}));

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const selectStreakDays = (state: PlayerStore) => state.streak.current;
