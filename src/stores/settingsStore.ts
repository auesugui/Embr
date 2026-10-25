// =============================================================================
// IronQuest Settings Store - App Preferences
// =============================================================================

import { localWeekKey } from '@/lib/local-week';
import { goalForWeek, normalizeWeeklyGoals, setGoalForWeek } from '@/lib/weekly-goal';
import type { NotificationSettings, Settings } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SettingsActions {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateNotifications: (notifications: Partial<NotificationSettings>) => void;
  /** Set the weekly goal from this week on. Finished weeks keep their own. */
  setWeeklyGoal: (days: number, now?: Date) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

type SettingsStore = Settings & SettingsActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: Settings = {
  theme: 'system',
  haptics: true,
  notifications: {
    streakReminder: true,
    petHunger: true,
    weeklySummary: false,
  },
  units: 'lb',
  reducedMotion: false,
  weeklyGoals: [],
  goalPromptSeen: false,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialState,

  updateSetting: (key, value) => {
    set({ [key]: value });

    // Persist to storage (async, fire-and-forget)
    appStorage
      .setJSON(STORAGE_KEYS.SETTINGS.FULL_STATE, {
        ...get(),
        [key]: value,
      })
      .catch(console.warn);
  },

  updateNotifications: (notifications) => {
    set((state) => ({
      notifications: { ...state.notifications, ...notifications },
    }));

    const current = get();
    appStorage.setJSON(STORAGE_KEYS.SETTINGS.FULL_STATE, current).catch(console.warn);
  },

  setWeeklyGoal: (days, now = new Date()) => {
    get().updateSetting('weeklyGoals', setGoalForWeek(get().weeklyGoals, localWeekKey(now), days));
  },

  reset: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.SETTINGS.FULL_STATE).catch(console.warn);
  },

  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<Partial<Settings>>(STORAGE_KEYS.SETTINGS.FULL_STATE);
      if (stored) {
        set({
          theme: stored.theme ?? initialState.theme,
          haptics: stored.haptics ?? initialState.haptics,
          units: stored.units ?? initialState.units,
          reducedMotion: stored.reducedMotion ?? initialState.reducedMotion,
          notifications: stored.notifications ?? initialState.notifications,
          // A backup written before issue #78 has neither, which is an install
          // on the default goal of 3 that has not been prompted.
          weeklyGoals: normalizeWeeklyGoals(stored.weeklyGoals),
          goalPromptSeen: stored.goalPromptSeen ?? initialState.goalPromptSeen,
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate settings:', error);
    }
  },
}));

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const selectTheme = (state: SettingsStore) => state.theme;
export const selectHapticsEnabled = (state: SettingsStore) => state.haptics;
export const selectReducedMotion = (state: SettingsStore) => state.reducedMotion;

/** The weekly goal in effect right now. */
export const selectWeeklyGoal = (state: SettingsStore) =>
  goalForWeek(state.weeklyGoals, localWeekKey(new Date()));
