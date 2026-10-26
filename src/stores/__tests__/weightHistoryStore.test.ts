// =============================================================================
// IronQuest Weight History Store Unit Tests (TDD)
// =============================================================================

import { prefillWeight } from '@/lib/last-time';
import type { WorkoutLog } from '@/types';
import { appStorage } from '@/utils/storage';
import { useWeightHistoryStore } from '../weightHistoryStore';

// Mock the storage module
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn(),
  },
  STORAGE_KEYS: {
    WEIGHT_HISTORY: {
      FULL_STATE: 'weight_history.full_state',
    },
  },
}));

describe('Weight History Store', () => {
  beforeEach(() => {
    // Reset the store before each test
    useWeightHistoryStore.getState().reset();
    // Clear all mocks
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getLastWeight Tests
  // ---------------------------------------------------------------------------

  describe('getLastWeight', () => {
    it('should return null for exercise with no history', () => {
      const { getLastWeight } = useWeightHistoryStore.getState();
      const result = getLastWeight('bench-press');
      expect(result).toBeNull();
    });

    it('should return saved weight after saving', () => {
      const { saveWeight, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);

      const result = getLastWeight('bench-press');
      expect(result).toBe(135);
    });

    it('should return most recent weight after multiple saves', () => {
      const { saveWeight, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      saveWeight('bench-press', 145);
      saveWeight('bench-press', 155);

      const result = getLastWeight('bench-press');
      expect(result).toBe(155);
    });

    it('should maintain separate history per exercise', () => {
      const { saveWeight, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      saveWeight('squat', 225);
      saveWeight('deadlift', 315);

      expect(getLastWeight('bench-press')).toBe(135);
      expect(getLastWeight('squat')).toBe(225);
      expect(getLastWeight('deadlift')).toBe(315);
    });
  });

  // ---------------------------------------------------------------------------
  // saveWeight Tests
  // ---------------------------------------------------------------------------

  describe('saveWeight', () => {
    it('should create new entry for first weight', () => {
      const { saveWeight, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);

      expect(getLastWeight('bench-press')).toBe(135);
    });

    it('should update lastWeight when saving new weight', () => {
      const { saveWeight, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      expect(getLastWeight('bench-press')).toBe(135);

      saveWeight('bench-press', 155);
      expect(getLastWeight('bench-press')).toBe(155);
    });

    it('should store timestamp for chronological ordering', () => {
      const { saveWeight, getRecentWeights } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);

      const history = getRecentWeights('bench-press');
      expect(history).toHaveLength(1);
      expect(history[0].weight).toBe(135);
      expect(history[0].timestamp).toBeDefined();
      expect(new Date(history[0].timestamp).getTime()).not.toBeNaN();
    });

    it('should limit recent weights to 5 entries', () => {
      const { saveWeight, getRecentWeights } = useWeightHistoryStore.getState();

      // Save 7 weights
      saveWeight('bench-press', 95);
      saveWeight('bench-press', 115);
      saveWeight('bench-press', 135);
      saveWeight('bench-press', 155);
      saveWeight('bench-press', 175);
      saveWeight('bench-press', 185);
      saveWeight('bench-press', 195);

      const history = getRecentWeights('bench-press');
      expect(history).toHaveLength(5);
      // Should keep the most recent 5: 195, 185, 175, 155, 135
      expect(history[0].weight).toBe(195); // newest
      expect(history[4].weight).toBe(135); // 5th newest (oldest kept)
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentWeights Tests
  // ---------------------------------------------------------------------------

  describe('getRecentWeights', () => {
    it('should return empty array for exercise with no history', () => {
      const { getRecentWeights } = useWeightHistoryStore.getState();
      const result = getRecentWeights('bench-press');
      expect(result).toEqual([]);
    });

    it('should return weights in reverse chronological order (newest first)', () => {
      const { saveWeight, getRecentWeights } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      saveWeight('bench-press', 155);
      saveWeight('bench-press', 175);

      const history = getRecentWeights('bench-press');
      expect(history).toHaveLength(3);
      expect(history[0].weight).toBe(175); // Newest
      expect(history[1].weight).toBe(155);
      expect(history[2].weight).toBe(135); // Oldest
    });
  });

  // ---------------------------------------------------------------------------
  // clearExerciseHistory Tests
  // ---------------------------------------------------------------------------

  describe('clearExerciseHistory', () => {
    it('should remove history for specific exercise only', () => {
      const { saveWeight, clearExerciseHistory, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      saveWeight('squat', 225);

      clearExerciseHistory('bench-press');

      expect(getLastWeight('bench-press')).toBeNull();
      expect(getLastWeight('squat')).toBe(225);
    });
  });

  // ---------------------------------------------------------------------------
  // clearAllHistory Tests
  // ---------------------------------------------------------------------------

  describe('clearAllHistory', () => {
    it('should remove all history for all exercises', () => {
      const { saveWeight, clearAllHistory, getLastWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);
      saveWeight('squat', 225);
      saveWeight('deadlift', 315);

      clearAllHistory();

      expect(getLastWeight('bench-press')).toBeNull();
      expect(getLastWeight('squat')).toBeNull();
      expect(getLastWeight('deadlift')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // hydrate Tests
  // ---------------------------------------------------------------------------

  describe('hydrate', () => {
    it('should load state from storage', async () => {
      const mockStoredState = {
        history: {
          'bench-press': {
            exerciseId: 'bench-press',
            lastWeight: 135,
            recentWeights: [{ weight: 135, timestamp: '2024-01-01T00:00:00.000Z' }],
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      (appStorage.getJSON as jest.Mock).mockResolvedValue(mockStoredState);

      const { hydrate, getLastWeight } = useWeightHistoryStore.getState();
      await hydrate();

      expect(getLastWeight('bench-press')).toBe(135);
    });

    it('should handle empty storage gracefully', async () => {
      (appStorage.getJSON as jest.Mock).mockResolvedValue(undefined);

      const { hydrate, getLastWeight } = useWeightHistoryStore.getState();
      await hydrate();

      expect(getLastWeight('bench-press')).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      (appStorage.getJSON as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { hydrate, getLastWeight } = useWeightHistoryStore.getState();
      await hydrate();

      expect(getLastWeight('bench-press')).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // The pre-fill never crosses units (issue #85 step 2)
  // ---------------------------------------------------------------------------
  // Pre-filling 275 into a kg field loads 275 kg onto a bar that held 275 lb.
  // This is the one read in the app with a physical consequence, so it falls
  // back to the last weight in the unit being logged in and nothing else.

  describe('getLastWeightInUnit', () => {
    it('returns the last weight when it was logged in that unit', () => {
      const { saveWeight, getLastWeightInUnit } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135, 'lb');

      const cached = getLastWeightInUnit('bench-press', 'lb');
      expect(cached?.weight).toBe(135);
      // The time comes with it, so a saved session can be ranked against it.
      expect(Number.isNaN(Date.parse(cached?.recordedAt ?? ''))).toBe(false);
    });

    it('does not hand the other unit’s number to the field', () => {
      const { saveWeight, getLastWeightInUnit } = useWeightHistoryStore.getState();

      saveWeight('back-squat', 275, 'lb');

      expect(getLastWeightInUnit('back-squat', 'kg')).toBeNull();
    });

    it('falls back to the last weight recorded in that unit', () => {
      const { saveWeight, getLastWeightInUnit } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 100, 'kg');
      saveWeight('bench-press', 195, 'lb');

      expect(getLastWeightInUnit('bench-press', 'kg')?.weight).toBe(100);
      expect(getLastWeightInUnit('bench-press', 'lb')?.weight).toBe(195);
    });

    it('takes the most recent entry in that unit, not the oldest', () => {
      const { saveWeight, getLastWeightInUnit } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 85, 'kg');
      saveWeight('bench-press', 90, 'kg');
      saveWeight('bench-press', 195, 'lb');

      expect(getLastWeightInUnit('bench-press', 'kg')?.weight).toBe(90);
    });

    it('is null for a movement with no history at all', () => {
      expect(useWeightHistoryStore.getState().getLastWeightInUnit('deadlift', 'lb')).toBeNull();
    });

    it('falls back to the entries when a restored record has no lastWeight', () => {
      // Nothing the app writes leaves this gap, but a restored backup can, and
      // dropping the entries over it would throw away a weight the cache has.
      useWeightHistoryStore.setState({
        history: {
          'bench-press': {
            exerciseId: 'bench-press',
            lastWeight: null,
            lastUnit: 'kg',
            recentWeights: [{ weight: 100, timestamp: '2026-10-20T12:00:00.000Z', unit: 'kg' }],
            updatedAt: '2026-10-20T12:00:00.000Z',
          },
        },
      });

      const { getLastWeightInUnit } = useWeightHistoryStore.getState();
      expect(getLastWeightInUnit('bench-press', 'kg')?.weight).toBe(100);
      expect(getLastWeightInUnit('bench-press', 'lb')).toBeNull();
    });

    it('reads a pre-#42 entry, which carries no unit, as lb', () => {
      useWeightHistoryStore.setState({
        history: {
          'bench-press': {
            exerciseId: 'bench-press',
            lastWeight: 135,
            recentWeights: [{ weight: 135, timestamp: '2026-01-01T00:00:00.000Z' }],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      });

      const { getLastWeightInUnit } = useWeightHistoryStore.getState();
      expect(getLastWeightInUnit('bench-press', 'lb')?.weight).toBe(135);
      expect(getLastWeightInUnit('bench-press', 'kg')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // When the cache has rolled over (issue #85 step 2)
  // ---------------------------------------------------------------------------
  // The cache holds five entries per movement. Five sets logged in the other
  // unit evict a real session from it, and the field would then open empty
  // although the session it should read is still saved. `prefillWeight` reads
  // the workouts behind the cache for exactly this case.

  describe('the pre-fill behind the cache', () => {
    const SESSION_START = Date.parse('2026-10-26T18:00:00.000Z');

    /** A saved kg session of the bench at 100 kg. */
    const kgSession = (): WorkoutLog =>
      ({
        id: 'kg-session',
        timestamp: '2026-10-20T12:00:00.000Z',
        claimedAt: '2026-10-20T12:30:00.000Z',
        durationSeconds: 1800,
        streakDays: 1,
        sessionIntent: 'normal',
        weightUnit: 'kg',
        exercises: [
          {
            id: 'bench_press-0',
            name: 'Bench Press',
            muscleGroups: ['chest'],
            restSeconds: 90,
            completed: true,
            sets: [{ reps: 5, weight: 100, logged: true, isPR: false, isRepPR: false }],
          },
        ],
      }) as WorkoutLog;

    const fill = (logs: WorkoutLog[], units: 'lb' | 'kg') =>
      prefillWeight({
        cached: useWeightHistoryStore.getState().getLastWeightInUnit('bench_press-0', units),
        logs,
        exerciseId: 'bench_press-0',
        before: SESSION_START,
        units,
      });

    it('still finds the kg weight after five lb writes push it out of the cache', () => {
      const { saveWeight } = useWeightHistoryStore.getState();

      saveWeight('bench_press-0', 100, 'kg');
      for (const weight of [185, 190, 195, 200, 205]) {
        saveWeight('bench_press-0', weight, 'lb');
      }

      // The cache itself has lost it — that is the defect this guards.
      expect(
        useWeightHistoryStore.getState().getLastWeightInUnit('bench_press-0', 'kg')
      ).toBeNull();
      // The saved session has not, so the field opens on it.
      expect(fill([kgSession()], 'kg')).toBe(100);
      // And the lb side still answers from the cache, which is newer than the
      // saved kg session it is ranked against.
      expect(fill([kgSession()], 'lb')).toBe(205);
    });

    it('lets a workout added through History beat an older remembered weight', () => {
      // A workout typed in or imported writes no cache entry, so the cache can
      // hold a weight from before a session the lifter has since trained.
      useWeightHistoryStore.setState({
        history: {
          'bench_press-0': {
            exerciseId: 'bench_press-0',
            lastWeight: 85,
            lastUnit: 'kg',
            recentWeights: [{ weight: 85, timestamp: '2026-10-10T12:00:00.000Z', unit: 'kg' }],
            updatedAt: '2026-10-10T12:00:00.000Z',
          },
        },
      });

      // The saved session is ten days newer than the remembered weight.
      expect(fill([kgSession()], 'kg')).toBe(100);
    });

    it('keeps a weight logged in this session over an earlier saved one', () => {
      // saveWeight stamps now, which is after every workout this reads.
      useWeightHistoryStore.getState().saveWeight('bench_press-0', 125, 'kg');

      expect(fill([kgSession()], 'kg')).toBe(125);
    });

    it('opens empty when no session in that unit exists either', () => {
      const { saveWeight } = useWeightHistoryStore.getState();

      for (const weight of [185, 190, 195, 200, 205, 210]) {
        saveWeight('bench_press-0', weight, 'lb');
      }

      expect(fill([], 'kg')).toBeNull();
    });

    it('reads a saved workout with no unit of its own as the setting', () => {
      const legacy = { ...kgSession(), id: 'legacy' } as WorkoutLog;
      // biome-ignore lint/performance/noDelete: the point is a log without the field
      delete (legacy as { weightUnit?: 'lb' | 'kg' }).weightUnit;

      expect(fill([legacy], 'kg')).toBe(100);
      expect(fill([legacy], 'lb')).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Persistence Tests
  // ---------------------------------------------------------------------------

  describe('persistence', () => {
    it('should persist state after saving weight', () => {
      const { saveWeight } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 135);

      expect(appStorage.setJSON).toHaveBeenCalled();
    });
  });
});
