// =============================================================================
// IronQuest Weight History Store Unit Tests (TDD)
// =============================================================================

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

      expect(getLastWeightInUnit('bench-press', 'lb')).toBe(135);
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

      expect(getLastWeightInUnit('bench-press', 'kg')).toBe(100);
      expect(getLastWeightInUnit('bench-press', 'lb')).toBe(195);
    });

    it('takes the most recent entry in that unit, not the oldest', () => {
      const { saveWeight, getLastWeightInUnit } = useWeightHistoryStore.getState();

      saveWeight('bench-press', 85, 'kg');
      saveWeight('bench-press', 90, 'kg');
      saveWeight('bench-press', 195, 'lb');

      expect(getLastWeightInUnit('bench-press', 'kg')).toBe(90);
    });

    it('is null for a movement with no history at all', () => {
      expect(useWeightHistoryStore.getState().getLastWeightInUnit('deadlift', 'lb')).toBeNull();
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
      expect(getLastWeightInUnit('bench-press', 'lb')).toBe(135);
      expect(getLastWeightInUnit('bench-press', 'kg')).toBeNull();
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
