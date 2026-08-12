// =============================================================================
// Dev Panel Actions Unit Tests
// =============================================================================
// Per the dev-panel spec (§7): fixture shape (the history screen must never see
// null FP on seeded logs) and full reset (every store back to initial state).
// The stage-snap test went with the pet store (ADR-0014).

import { usePlayerStore } from '@/stores/playerStore';
import { usePRStore } from '@/stores/prStore';
import { useWorkoutHistoryStore } from '@/stores/workoutHistoryStore';
import { devResetAll, devSeedHistory, devSeedPRs, devSetStreak } from '../devActions';

// Mock storage (same pattern as the store tests)
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn().mockResolvedValue(undefined),
    setJSON: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    PLAYER: { FULL_STATE: 'player.full_state' },
    PR: { FULL_STATE: 'pr.full_state' },
    BASELINE: { FULL_STATE: 'baseline.full_state' },
    WEIGHT_HISTORY: { FULL_STATE: 'weight_history.full_state' },
    PERSONAL_TEMPLATES: { FULL_STATE: 'personal_templates.full_state' },
    WORKOUT_HISTORY: { FULL_STATE: 'workout_history.full_state' },
    SETTINGS: { FULL_STATE: 'settings.full_state' },
    SESSION: { FULL_STATE: 'session.full_state' },
  },
}));

describe('devActions', () => {
  beforeEach(() => {
    devResetAll();
    jest.clearAllMocks();
  });

  it('seeds history logs that are already saved (history only lists saved ones)', () => {
    devSeedHistory();
    const { logs } = useWorkoutHistoryStore.getState();

    expect(logs).toHaveLength(5);
    for (const log of logs) {
      expect(log.claimedAt).not.toBeNull();
      expect(log.exercises.length).toBeGreaterThan(0);
      for (const exercise of log.exercises) {
        for (const set of exercise.sets) {
          expect(set.logged).toBe(true);
        }
      }
    }
  });

  it('returns every store to initial state after devResetAll', () => {
    // Seed across every store first.
    devSetStreak(7);
    devSeedPRs('lb');
    devSeedHistory();

    devResetAll();

    const player = usePlayerStore.getState();
    expect(player.streak.current).toBe(0);
    expect(player.totalWorkouts).toBe(0);

    expect(useWorkoutHistoryStore.getState().logs).toEqual([]);
    expect(usePRStore.getState().totalPRCount).toBe(0);
    expect(usePRStore.getState().records).toEqual({});
  });
});
