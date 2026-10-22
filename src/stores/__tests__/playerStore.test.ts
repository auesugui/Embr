// =============================================================================
// Embr Player Store Unit Tests
// =============================================================================
// Streak logic, workout count, profile, and achievements. The FP balance and
// spending suites went with the engine (ADR-0015).

import type { WorkoutLog } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import {
  LEGACY_DEFAULT_NAME,
  needsOnboarding,
  selectNeedsOnboarding,
  selectStreakDays,
  usePlayerStore,
} from '../playerStore';

// Mock storage
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    PLAYER: {
      FULL_STATE: 'player.full_state',
    },
  },
}));

describe('Player Store', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Streak Actions
  // ---------------------------------------------------------------------------

  describe('Streak Actions', () => {
    describe('syncStreak', () => {
      // Local noon, so the day key is right in every time zone.
      const daysAgo = (days: number) => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).toISOString();
      };
      const workout = (timestamp: string): WorkoutLog => ({
        id: `workout_${timestamp}`,
        timestamp,
        exercises: [],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
        claimedAt: timestamp,
      });

      it('is zero with no saved workouts', () => {
        usePlayerStore.getState().syncStreak([]);

        expect(usePlayerStore.getState().streak).toMatchObject({
          current: 0,
          lastWorkoutDate: null,
        });
      });

      it('counts consecutive days ending today', () => {
        usePlayerStore
          .getState()
          .syncStreak([workout(daysAgo(0)), workout(daysAgo(1)), workout(daysAgo(2))]);

        expect(usePlayerStore.getState().streak.current).toBe(3);
      });

      it('joins two runs when a back-dated workout fills the gap', () => {
        usePlayerStore.getState().syncStreak([workout(daysAgo(0)), workout(daysAgo(2))]);
        expect(usePlayerStore.getState().streak.current).toBe(1);

        usePlayerStore
          .getState()
          .syncStreak([workout(daysAgo(0)), workout(daysAgo(2)), workout(daysAgo(1))]);
        expect(usePlayerStore.getState().streak.current).toBe(3);
      });

      it('keeps the stored longest streak when the current run is shorter', () => {
        usePlayerStore.setState({ streak: { current: 0, longest: 30, lastWorkoutDate: null } });

        usePlayerStore.getState().syncStreak([workout(daysAgo(0))]);

        expect(usePlayerStore.getState().streak.longest).toBe(30);
      });

      it('persists the derived streak', () => {
        usePlayerStore.getState().syncStreak([workout(daysAgo(0))]);

        expect(require('@/utils/storage').appStorage.setJSON as jest.Mock).toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Workout Actions
  // ---------------------------------------------------------------------------

  describe('Workout Actions', () => {
    describe('incrementWorkoutCount', () => {
      it('should increment total workouts', () => {
        const { incrementWorkoutCount } = usePlayerStore.getState();

        incrementWorkoutCount();
        incrementWorkoutCount();
        incrementWorkoutCount();

        expect(usePlayerStore.getState().totalWorkouts).toBe(3);
      });

      it('should persist workout count', () => {
        const { incrementWorkoutCount } = usePlayerStore.getState();

        incrementWorkoutCount();

        expect(appStorage.setJSON).toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Profile Actions
  // ---------------------------------------------------------------------------

  describe('Profile Actions', () => {
    describe('updateProfile', () => {
      it('should update profile fields', () => {
        const { updateProfile } = usePlayerStore.getState();

        updateProfile({ name: 'New Name' });

        expect(usePlayerStore.getState().profile.name).toBe('New Name');
      });

      it('should merge with existing profile', () => {
        const { updateProfile } = usePlayerStore.getState();

        updateProfile({ name: 'Name 1' });
        updateProfile({ avatar: 'avatar.png' });

        const { profile } = usePlayerStore.getState();
        expect(profile.name).toBe('Name 1');
        expect(profile.avatar).toBe('avatar.png');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Achievement Actions
  // ---------------------------------------------------------------------------

  describe('Achievement Actions', () => {
    describe('unlockAchievement', () => {
      it('should add achievement to list', () => {
        const { unlockAchievement } = usePlayerStore.getState();

        const result = unlockAchievement('first-workout');

        expect(result).toBe(true);
        expect(usePlayerStore.getState().achievements).toContain('first-workout');
      });

      it('should return false for duplicate achievement', () => {
        const { unlockAchievement } = usePlayerStore.getState();

        unlockAchievement('first-workout');
        const result = unlockAchievement('first-workout');

        expect(result).toBe(false);
      });

      it('should not add duplicate achievements', () => {
        const { unlockAchievement } = usePlayerStore.getState();

        unlockAchievement('first-workout');
        unlockAchievement('first-workout');

        expect(usePlayerStore.getState().achievements).toHaveLength(1);
      });
    });

    describe('removeAchievement', () => {
      it('should remove achievement from list', () => {
        const { unlockAchievement, removeAchievement } = usePlayerStore.getState();

        unlockAchievement('first-workout');
        removeAchievement('first-workout');

        expect(usePlayerStore.getState().achievements).not.toContain('first-workout');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------------------

  describe('Hydration', () => {
    describe('hydrate', () => {
      it('should restore player state from storage', async () => {
        const mockPlayer = {
          profile: { name: 'Test User', avatar: null, createdAt: '2024-01-01' },
          // Legacy `fp` balances are intentionally still in this fixture: real
          // stored player state has them (ADR-0015 removed the engine, not the
          // bytes already on disk). Hydrate must ignore the key, not choke.
          fp: { generic: 100, power: 50, guard: 30, speed: 20, vigor: 10, focus: 5, spirit: 15 },
          streak: { current: 5, longest: 10, lastWorkoutDate: '2024-01-15' },
          achievements: ['first-workout', 'streak-7'],
          totalWorkouts: 25,
        };

        (appStorage.getJSON as jest.Mock).mockResolvedValue(mockPlayer);

        const { hydrate } = usePlayerStore.getState();
        await hydrate();

        const state = usePlayerStore.getState();
        expect(state.streak.current).toBe(5);
        expect(state.totalWorkouts).toBe(25);
        expect(state.achievements).toContain('first-workout');
      });

      it('should handle empty storage gracefully', async () => {
        (appStorage.getJSON as jest.Mock).mockResolvedValue(undefined);

        const { hydrate } = usePlayerStore.getState();
        await hydrate();

        const state = usePlayerStore.getState();
        expect(state.streak.current).toBe(0);
      });

      it('should handle storage errors gracefully', async () => {
        (appStorage.getJSON as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { hydrate } = usePlayerStore.getState();
        await hydrate();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should use defaults for missing fields', async () => {
        const mockPlayer = {
          // Only partial data
        };

        (appStorage.getJSON as jest.Mock).mockResolvedValue(mockPlayer);

        const { hydrate } = usePlayerStore.getState();
        await hydrate();

        const state = usePlayerStore.getState();
        // Should have defaults for missing fields
        expect(state.streak.current).toBe(0);
        expect(state.achievements).toEqual([]);
      });
    });

    describe('reset', () => {
      it('should clear all player state', () => {
        const { reset } = usePlayerStore.getState();

        reset();

        const state = usePlayerStore.getState();
        expect(state.streak.current).toBe(0);
        expect(state.achievements).toEqual([]);
      });

      it('should delete player from storage', () => {
        const { reset } = usePlayerStore.getState();

        reset();

        expect(appStorage.delete).toHaveBeenCalledWith(STORAGE_KEYS.PLAYER.FULL_STATE);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  describe('Selectors', () => {
    beforeEach(() => {
      usePlayerStore.setState({
        streak: {
          current: 7,
          longest: 14,
          lastWorkoutDate: new Date().toISOString().split('T')[0],
        },
      });
    });

    describe('selectStreakDays', () => {
      it('should return current streak days', () => {
        const state = usePlayerStore.getState();

        const days = selectStreakDays(state);

        expect(days).toBe(7);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Onboarding gate
  // ---------------------------------------------------------------------------
  // `needsOnboarding` is what routes a cold start to the name prompt instead of
  // the tab navigator. Getting it wrong in either direction is loud: too eager
  // and a returning user is asked their name again on every launch, too lax and
  // a new user lands on a profile labelled with nothing.

  describe('needsOnboarding', () => {
    const profile = (name: string) => ({
      name,
      avatar: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    it('is true for a fresh install', () => {
      expect(needsOnboarding(profile(''))).toBe(true);
    });

    it('is true for whitespace, so a stray space cannot skip the prompt', () => {
      expect(needsOnboarding(profile('   '))).toBe(true);
    });

    it('is true for the old shipped default, which nobody chose', () => {
      expect(needsOnboarding(profile(LEGACY_DEFAULT_NAME))).toBe(true);
      expect(LEGACY_DEFAULT_NAME).toBe('Iron Master');
    });

    it('is false once a real name is set', () => {
      expect(needsOnboarding(profile('Adrian'))).toBe(false);
    });

    it('does not treat a name merely containing the old default as unset', () => {
      expect(needsOnboarding(profile('Iron Masterson'))).toBe(false);
    });

    it('defaults a brand new store to needing onboarding', () => {
      usePlayerStore.getState().reset();

      expect(selectNeedsOnboarding(usePlayerStore.getState())).toBe(true);
    });

    it('stops needing onboarding after the name is saved', () => {
      usePlayerStore.getState().reset();
      usePlayerStore.getState().updateProfile({ name: 'Adrian' });

      expect(selectNeedsOnboarding(usePlayerStore.getState())).toBe(false);
    });

    it('leaves createdAt alone when the name is set, so join date survives', () => {
      usePlayerStore.getState().reset();
      const before = usePlayerStore.getState().profile.createdAt;

      usePlayerStore.getState().updateProfile({ name: 'Adrian' });

      expect(usePlayerStore.getState().profile.createdAt).toBe(before);
    });
  });
});
