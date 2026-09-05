// =============================================================================
// deriveSessionView — the quick ladder for a held movement
// =============================================================================
// The ladder is the 3-second rule made concrete, so it has to offer numbers
// that make sense for what you are doing. 5/8/10/12 are rep counts; nobody
// holds a plank for five seconds.

import type { BlockTimerState } from '@/stores/workoutStore';
import type { Exercise } from '@/types';
import { deriveSessionView } from '@/workout/sessionView';

// sessionView imports the store for its pure clock helpers; the store reaches
// AsyncStorage at module load. Persistence is irrelevant to a projection.
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn().mockResolvedValue(undefined),
    setJSON: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    SESSION: { FULL_STATE: 'session.full_state' },
  },
}));

const emptyTimer: BlockTimerState = {
  blockKey: null,
  mode: 'sets',
  duration: 0,
  intervalSeconds: 0,
  elapsedBeforePause: 0,
  runStartedAt: null,
  elapsed: 0,
  running: false,
  paused: false,
  finishedElapsed: null,
};

const exercise = (over: Partial<Exercise>): Exercise => ({
  id: 'plank-0',
  name: 'Plank',
  muscleGroups: ['core'],
  sets: [{ reps: null, weight: null, logged: false, isPR: false, isRepPR: false }],
  restSeconds: 45,
  completed: false,
  ...over,
});

const view = (ex: Exercise) =>
  deriveSessionView({
    exercises: [ex],
    blocks: undefined,
    currentExerciseIndex: 0,
    blockTimer: emptyTimer,
    blockTimes: {},
    completedSets: 0,
    scrimDismissed: false,
  });

describe('quick ladder by metric', () => {
  it('offers seconds for a held movement in a plain set scheme', () => {
    const v = view(exercise({ targetReps: '30-60' }));
    expect(v.currentMetric).toBe('time');
    expect(v.quickReps).toEqual([20, 30, 45, 60]);
    // The prescription's lower bound is highlighted, as it is in a circuit.
    expect(v.singleTarget).toBe(30);
  });

  it('leads with a prescription the ladder does not already carry', () => {
    expect(view(exercise({ targetReps: '90' })).quickReps).toEqual([90, 20, 30, 45]);
  });

  it('leaves a counted movement with the generic rep ladder and no target', () => {
    const v = view(exercise({ id: 'bodyweight_squat-0', name: 'Squat', targetReps: '8-12' }));
    expect(v.currentMetric).toBe('reps');
    expect(v.quickReps).toEqual([5, 8, 10, 12]);
    expect(v.singleTarget).toBeNull();
  });
});
