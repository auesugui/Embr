// =============================================================================
// Embr Player Store Unit Tests
// =============================================================================
// Streak logic, workout count, profile, and achievements. The FP balance and
// spending suites went with the engine (ADR-0015).

import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { selectStreakDays, usePlayerStore } from '../playerStore';

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
    describe('updateStreak', () => {
      it('should start streak at 1 for first workout', () => {
        const { updateStreak } = usePlayerStore.getState();

        updateStreak(true);

        expect(usePlayerStore.getState().streak.current).toBe(1);
      });

      it('should increment streak for consecutive days', () => {
        const { updateStreak } = usePlayerStore.getState();

        // First workout
        updateStreak(true);
        expect(usePlayerStore.getState().streak.current).toBe(1);

        // Simulate next day
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        usePlayerStore.setState({
          streak: {
            current: 1,
            longest: 1,
            lastWorkoutDate: yesterday,
          },
        });

        // Second day workout
        updateStreak(true);
        expect(usePlayerStore.getState().streak.current).toBe(2);
      });

      it('should reset streak when missing a day', () => {
        const { updateStreak } = usePlayerStore.getState();

        // First workout
        updateStreak(true);

        // Simulate 2 days ago (missed yesterday)
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
        usePlayerStore.setState({
          streak: {
            current: 5,
            longest: 5,
            lastWorkoutDate: twoDaysAgo,
          },
        });

        // Workout today - streak should reset to 1
        updateStreak(true);
        expect(usePlayerStore.getState().streak.current).toBe(1);
      });

      it('should not increment for same day workout', () => {
        const { updateStreak } = usePlayerStore.getState();

        updateStreak(true);
        updateStreak(true); // Same day

        expect(usePlayerStore.getState().streak.current).toBe(1);
      });

      it('should update longest streak', () => {
        const { updateStreak } = usePlayerStore.getState();

        // Start streak
        updateStreak(true);

        // Simulate building streak
        for (let i = 0; i < 5; i++) {
          const prevDate = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          usePlayerStore.setState({
            streak: {
              current: i + 1,
              longest: i + 1,
              lastWorkoutDate: prevDate,
            },
          });
          updateStreak(true);
        }

        expect(usePlayerStore.getState().streak.longest).toBeGreaterThanOrEqual(5);
      });

      it('should not update longest when current is lower', () => {
        const { updateStreak } = usePlayerStore.getState();

        // Set up a long existing streak
        usePlayerStore.setState({
          streak: {
            current: 0,
            longest: 30,
            lastWorkoutDate: null,
          },
        });

        updateStreak(true);

        // Longest should still be 30
        expect(usePlayerStore.getState().streak.longest).toBe(30);
      });
    });

    describe('resetStreak', () => {
      it('should reset current streak to 0', () => {
        const { resetStreak } = usePlayerStore.getState();

        usePlayerStore.setState({
          streak: { current: 10, longest: 10, lastWorkoutDate: '2024-01-01' },
        });

        resetStreak();

        expect(usePlayerStore.getState().streak.current).toBe(0);
      });

      it('should preserve longest streak', () => {
        const { resetStreak } = usePlayerStore.getState();

        usePlayerStore.setState({
          streak: { current: 10, longest: 15, lastWorkoutDate: '2024-01-01' },
        });

        resetStreak();

        expect(usePlayerStore.getState().streak.longest).toBe(15);
      });

      it('should clear lastWorkoutDate', () => {
        const { resetStreak } = usePlayerStore.getState();

        usePlayerStore.setState({
          streak: { current: 10, longest: 10, lastWorkoutDate: '2024-01-01' },
        });

        resetStreak();

        expect(usePlayerStore.getState().streak.lastWorkoutDate).toBeNull();
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
});
