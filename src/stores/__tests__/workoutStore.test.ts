// =============================================================================
// IronQuest Workout Store Unit Tests
// =============================================================================
// Tests for session lifecycle, exercise management, set logging, rest timer

import type { Exercise } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { useWeightHistoryStore } from '../weightHistoryStore';
import {
  selectExerciseProgress,
  selectIsRestTimerComplete,
  selectSessionDuration,
  useWorkoutStore,
} from '../workoutStore';

// Mock dependencies
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    SESSION: {
      FULL_STATE: 'session.full_state',
    },
  },
}));

jest.mock('../weightHistoryStore', () => ({
  useWeightHistoryStore: {
    getState: jest.fn(() => ({
      saveWeight: jest.fn(),
    })),
  },
}));

jest.mock('../prStore', () => ({
  usePRStore: {
    getState: jest.fn(() => ({
      recordPR: jest.fn(() => ({ isWeightPR: false, isRepPR: false })),
    })),
  },
}));

describe('Workout Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useWorkoutStore.getState().reset();
    jest.clearAllMocks();
  });

  // Helper to create valid exercises
  const createTestExercises = (): Exercise[] => [
    {
      id: 'bench-press',
      name: 'Bench Press',
      muscleGroups: ['chest', 'triceps'],
      sets: [
        { reps: 10, weight: null, logged: false, isPR: false, isRepPR: false },
        { reps: 10, weight: null, logged: false, isPR: false, isRepPR: false },
      ],
      restSeconds: 120,
      completed: false,
    },
    {
      id: 'squat',
      name: 'Squat',
      muscleGroups: ['quads', 'glutes'],
      sets: [{ reps: 8, weight: null, logged: false, isPR: false, isRepPR: false }],
      restSeconds: 180,
      completed: false,
    },
  ];

  // Helper to build a minimal but fully-typed Exercise[] for intent tests.
  const makeIntentExercises = (): Exercise[] => [
    {
      id: 'intent-test-ex',
      name: 'Test Exercise',
      muscleGroups: [],
      sets: [],
      restSeconds: 60,
      completed: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // Session Lifecycle
  // ---------------------------------------------------------------------------

  describe('Session Lifecycle', () => {
    describe('startSession', () => {
      it('should create a new session with exercises', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', createTestExercises());

        const state = useWorkoutStore.getState();
        expect(state.active).toBe(true);
        expect(state.exercises).toHaveLength(2);
        expect(state.exercises[0].name).toBe('Bench Press');
      });

      it('should reset current exercise index to 0', () => {
        const { startSession, setCurrentExercise } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);
        setCurrentExercise(2);

        startSession('template-2', [
          {
            id: 'test2',
            name: 'Test 2',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });

      it('should initialize rest timer as inactive', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.running).toBe(false);
        expect(restTimer.paused).toBe(false);
        expect(restTimer.remaining).toBe(0);
      });

      it('should persist session to storage', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);

        expect(appStorage.setJSON).toHaveBeenCalled();
      });

      it('should default intent to normal when no intent is provided', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', makeIntentExercises());

        expect(useWorkoutStore.getState().intent).toBe('normal');
      });

      it('should accept a deload intent and persist it on the session', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', makeIntentExercises(), 'deload');

        expect(useWorkoutStore.getState().intent).toBe('deload');
      });
    });

    describe('setIntent', () => {
      it('should update the intent on the active session', () => {
        const { startSession, setIntent } = useWorkoutStore.getState();

        startSession('template-1', makeIntentExercises());
        setIntent('deload');

        expect(useWorkoutStore.getState().intent).toBe('deload');
      });

      it('should reset intent to normal when a new session starts', () => {
        const { startSession } = useWorkoutStore.getState();

        startSession('template-1', makeIntentExercises(), 'deload');
        startSession('template-2', makeIntentExercises());

        expect(useWorkoutStore.getState().intent).toBe('normal');
      });
    });

    describe('endSession', () => {
      it('should clear session state', () => {
        const { startSession, endSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);
        endSession();

        const state = useWorkoutStore.getState();
        expect(state.active).toBe(false);
        expect(state.exercises).toEqual([]);
      });

      it('should reset rest timer', () => {
        const { startSession, startRestTimer, endSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);
        startRestTimer(90);
        endSession();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.running).toBe(false);
      });

      it('should delete session from storage', () => {
        const { startSession, endSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);
        endSession();

        expect(appStorage.delete).toHaveBeenCalledWith(STORAGE_KEYS.SESSION.FULL_STATE);
      });
    });

    describe('cancelSession', () => {
      it('should clear session without saving', () => {
        const { startSession, cancelSession } = useWorkoutStore.getState();

        startSession('template-1', [
          {
            id: 'test',
            name: 'Test',
            muscleGroups: [],
            sets: [],
            restSeconds: 60,
            completed: false,
          },
        ]);
        cancelSession();

        expect(useWorkoutStore.getState().active).toBe(false);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Exercise Management
  // ---------------------------------------------------------------------------

  describe('Exercise Management', () => {
    beforeEach(() => {
      const { startSession } = useWorkoutStore.getState();
      startSession('template-1', createTestExercises());
    });

    describe('nextExercise', () => {
      it('should move to next exercise', () => {
        const { nextExercise } = useWorkoutStore.getState();

        nextExercise();

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });

      it('should not go past last exercise', () => {
        const { nextExercise } = useWorkoutStore.getState();

        nextExercise();
        nextExercise(); // Try to go past end

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });
    });

    describe('previousExercise', () => {
      it('should move to previous exercise', () => {
        const { setCurrentExercise, previousExercise } = useWorkoutStore.getState();

        setCurrentExercise(1);
        previousExercise();

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });

      it('should not go before first exercise', () => {
        const { previousExercise } = useWorkoutStore.getState();

        previousExercise();

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
      });
    });

    describe('setCurrentExercise', () => {
      it('should set specific exercise index', () => {
        const { setCurrentExercise } = useWorkoutStore.getState();

        setCurrentExercise(1);

        expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
      });

      it('should clamp to valid range', () => {
        const { setCurrentExercise } = useWorkoutStore.getState();

        setCurrentExercise(99);

        expect(useWorkoutStore.getState().currentExerciseIndex).toBeLessThan(2);
      });
    });

    describe('completeExercise', () => {
      it('should mark exercise as completed', () => {
        const { completeExercise } = useWorkoutStore.getState();

        completeExercise(0);

        const state = useWorkoutStore.getState();
        expect(state.exercises[0].completed).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Set Logging
  // ---------------------------------------------------------------------------

  describe('Set Logging', () => {
    beforeEach(() => {
      const { startSession } = useWorkoutStore.getState();
      startSession('template-1', [
        {
          id: 'bench-press',
          name: 'Bench Press',
          muscleGroups: ['chest', 'triceps'],
          sets: [
            { reps: 10, weight: null, logged: false, isPR: false, isRepPR: false },
            { reps: 10, weight: null, logged: false, isPR: false, isRepPR: false },
          ],
          restSeconds: 120,
          completed: false,
        },
      ]);
    });

    describe('logSet', () => {
      it('should log set with reps and weight', () => {
        const { logSet } = useWorkoutStore.getState();

        logSet(0, 0, 10, 135);

        const set = useWorkoutStore.getState().exercises[0].sets[0];
        expect(set.logged).toBe(true);
        expect(set.reps).toBe(10);
        expect(set.weight).toBe(135);
      });

      it('should log set without weight', () => {
        const { logSet } = useWorkoutStore.getState();

        logSet(0, 0, 10);

        const set = useWorkoutStore.getState().exercises[0].sets[0];
        expect(set.logged).toBe(true);
        expect(set.weight).toBeNull();
      });

      it('should save weight to weight history', () => {
        const mockSaveWeight = jest.fn();
        (useWeightHistoryStore.getState as jest.Mock).mockReturnValue({
          saveWeight: mockSaveWeight,
        });

        const { logSet } = useWorkoutStore.getState();
        logSet(0, 0, 10, 135);

        expect(mockSaveWeight).toHaveBeenCalledWith('bench-press', 135, 'lb');
      });

      it('should not save weight to history when weight is null', () => {
        const mockSaveWeight = jest.fn();
        (useWeightHistoryStore.getState as jest.Mock).mockReturnValue({
          saveWeight: mockSaveWeight,
        });

        const { logSet } = useWorkoutStore.getState();
        logSet(0, 0, 10);

        expect(mockSaveWeight).not.toHaveBeenCalled();
      });

      it('should persist session after logging', () => {
        const { logSet } = useWorkoutStore.getState();

        logSet(0, 0, 10, 135);

        expect(appStorage.setJSON).toHaveBeenCalled();
      });
    });

    describe('editSet', () => {
      it('should update logged set values', () => {
        const { logSet, editSet } = useWorkoutStore.getState();

        logSet(0, 0, 10, 135);
        editSet(0, 0, 12, 145);

        const set = useWorkoutStore.getState().exercises[0].sets[0];
        expect(set.reps).toBe(12);
        expect(set.weight).toBe(145);
      });

      it('should save edited weight to weight history', () => {
        const mockSaveWeight = jest.fn();
        (useWeightHistoryStore.getState as jest.Mock).mockReturnValue({
          saveWeight: mockSaveWeight,
        });

        const { editSet } = useWorkoutStore.getState();
        editSet(0, 0, 10, 145);

        expect(mockSaveWeight).toHaveBeenCalledWith('bench-press', 145, 'lb');
      });

      it('should not save weight to history when edited weight is undefined', () => {
        const mockSaveWeight = jest.fn();
        (useWeightHistoryStore.getState as jest.Mock).mockReturnValue({
          saveWeight: mockSaveWeight,
        });

        const { editSet } = useWorkoutStore.getState();
        editSet(0, 0, 10);

        expect(mockSaveWeight).not.toHaveBeenCalled();
      });
    });

    describe('clearSet', () => {
      it('should reset set to unlogged state', () => {
        const { logSet, clearSet } = useWorkoutStore.getState();

        logSet(0, 0, 10, 135);
        clearSet(0, 0);

        const set = useWorkoutStore.getState().exercises[0].sets[0];
        expect(set.logged).toBe(false);
      });
    });

    describe('getTotalReps', () => {
      it('should return sum of all logged reps', () => {
        const { logSet, getTotalReps } = useWorkoutStore.getState();

        logSet(0, 0, 10, 135);
        logSet(0, 1, 8, 135);

        expect(getTotalReps()).toBe(18);
      });

      it('should return 0 for no logged sets', () => {
        const { getTotalReps } = useWorkoutStore.getState();

        expect(getTotalReps()).toBe(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Rest Timer
  // ---------------------------------------------------------------------------

  describe('Rest Timer', () => {
    describe('startRestTimer', () => {
      it('should start timer with specified duration', () => {
        const { startRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.running).toBe(true);
        expect(restTimer.paused).toBe(false);
        expect(restTimer.remaining).toBe(90);
        expect(restTimer.duration).toBe(90);
      });
    });

    describe('pauseRestTimer', () => {
      it('should pause active timer', () => {
        const { startRestTimer, pauseRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);
        pauseRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.paused).toBe(true);
      });
    });

    describe('resumeRestTimer', () => {
      it('should resume paused timer', () => {
        const { startRestTimer, pauseRestTimer, resumeRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);
        pauseRestTimer();
        resumeRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.paused).toBe(false);
      });
    });

    describe('resetRestTimer', () => {
      it('should stop and reset timer', () => {
        const { startRestTimer, resetRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);
        resetRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.running).toBe(false);
        expect(restTimer.remaining).toBe(0);
      });
    });

    describe('tickRestTimer', () => {
      it('should decrement remaining time', () => {
        const { startRestTimer, tickRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);
        tickRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.remaining).toBe(89);
      });

      it('should auto-stop when reaching 0', () => {
        const { startRestTimer, tickRestTimer } = useWorkoutStore.getState();

        startRestTimer(1);
        tickRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.running).toBe(false);
        expect(restTimer.remaining).toBe(0);
      });

      it('should not tick when paused', () => {
        const { startRestTimer, pauseRestTimer, tickRestTimer } = useWorkoutStore.getState();

        startRestTimer(90);
        pauseRestTimer();
        tickRestTimer();

        const { restTimer } = useWorkoutStore.getState();
        expect(restTimer.remaining).toBe(90);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------------------

  describe('Hydration', () => {
    describe('hydrate', () => {
      it('should restore session from storage', async () => {
        const mockSession = {
          active: true,
          exercises: [
            {
              id: 'test',
              name: 'Test',
              muscleGroups: [],
              sets: [],
              restSeconds: 60,
              completed: false,
            },
          ],
          currentExerciseIndex: 0,
        };

        (appStorage.getJSON as jest.Mock).mockResolvedValue(mockSession);

        const { hydrate } = useWorkoutStore.getState();
        await hydrate();

        const state = useWorkoutStore.getState();
        expect(state.active).toBe(true);
        expect(state.exercises).toHaveLength(1);
      });

      it('should handle empty storage gracefully', async () => {
        (appStorage.getJSON as jest.Mock).mockResolvedValue(undefined);

        const { hydrate } = useWorkoutStore.getState();
        await hydrate();

        const state = useWorkoutStore.getState();
        expect(state.active).toBe(false);
      });

      it('should handle storage errors gracefully', async () => {
        (appStorage.getJSON as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const { hydrate } = useWorkoutStore.getState();
        await hydrate();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  describe('Selectors', () => {
    describe('selectSessionDuration', () => {
      it('should return 0 for inactive session', () => {
        const state = useWorkoutStore.getState();
        expect(selectSessionDuration(state)).toBe(0);
      });
    });

    describe('selectExerciseProgress', () => {
      beforeEach(() => {
        const { startSession } = useWorkoutStore.getState();
        startSession('template-1', [
          {
            id: 'ex1',
            name: 'Exercise 1',
            muscleGroups: ['chest'],
            sets: [
              { reps: 10, weight: null, logged: true, isPR: false, isRepPR: false },
              { reps: 10, weight: null, logged: true, isPR: false, isRepPR: false },
              { reps: 10, weight: null, logged: false, isPR: false, isRepPR: false },
            ],
            restSeconds: 60,
            completed: false,
          },
        ]);
      });

      it('should return correct progress percentage', () => {
        const state = useWorkoutStore.getState();
        const progress = selectExerciseProgress(state);

        expect(progress.completed).toBe(0); // No exercises marked as completed
        expect(progress.total).toBe(1);
      });
    });

    describe('selectIsRestTimerComplete', () => {
      it('should return true when timer is inactive and at 0', () => {
        const state = useWorkoutStore.getState();
        expect(selectIsRestTimerComplete(state)).toBe(true);
      });

      it('should return false when timer is running', () => {
        const { startRestTimer } = useWorkoutStore.getState();
        startRestTimer(90);

        const state = useWorkoutStore.getState();
        expect(selectIsRestTimerComplete(state)).toBe(false);
      });
    });
  });
  // ---------------------------------------------------------------------------
  // AMRAP
  // ---------------------------------------------------------------------------

  describe('AMRAP', () => {
    const makeAmrapExercises = (): Exercise[] => [
      {
        id: 'bodyweight_squat-0',
        name: 'Bodyweight Squat',
        muscleGroups: ['quads'],
        sets: [{ reps: null, weight: null, logged: false, isPR: false, isRepPR: false }],
        restSeconds: 0,
        completed: false,
        mode: 'amrap',
        durationSeconds: 1200,
      },
    ];

    describe('addSet', () => {
      it('appends an empty round so AMRAP logging never runs out of rows', () => {
        const { startSession, addSet } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        addSet(0);

        const sets = useWorkoutStore.getState().exercises[0].sets;
        expect(sets).toHaveLength(2);
        expect(sets[1]).toEqual({
          reps: null,
          weight: null,
          logged: false,
          isPR: false,
          isRepPR: false,
        });
      });

      it('leaves already-logged rounds untouched', () => {
        const { startSession, logSet, addSet } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        logSet(0, 0, 15);
        addSet(0);

        const sets = useWorkoutStore.getState().exercises[0].sets;
        expect(sets[0].reps).toBe(15);
        expect(sets[0].logged).toBe(true);
        expect(sets[1].logged).toBe(false);
      });

      it('ignores an out-of-range exercise', () => {
        const { startSession, addSet } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        addSet(9);

        expect(useWorkoutStore.getState().exercises[0].sets).toHaveLength(1);
      });
    });

    describe('the window clock', () => {
      afterEach(() => {
        jest.useRealTimers();
      });

      it('starts against the wall clock, not a tick count', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startAmrapTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        startAmrapTimer(0, 1200);

        const timer = useWorkoutStore.getState().amrapTimer;
        expect(timer).toMatchObject({
          exerciseIndex: 0,
          duration: 1200,
          remaining: 1200,
          running: true,
          paused: false,
          endsAt: 1_000_000 + 1200 * 1000,
        });
      });

      it('does not lose time while the app is not ticking', () => {
        // The whole point of a wall-clock anchor: five minutes pass with no
        // tick delivered (backgrounded tab), and the window is five minutes
        // shorter when we come back.
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startAmrapTimer, tickAmrapTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startAmrapTimer(0, 1200);

        jest.setSystemTime(1_000_000 + 300 * 1000);
        tickAmrapTimer();

        expect(useWorkoutStore.getState().amrapTimer.remaining).toBe(900);
      });

      it('stops the clock when the window closes', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startAmrapTimer, tickAmrapTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startAmrapTimer(0, 60);

        jest.setSystemTime(1_000_000 + 61 * 1000);
        tickAmrapTimer();

        const timer = useWorkoutStore.getState().amrapTimer;
        expect(timer.remaining).toBe(0);
        expect(timer.running).toBe(false);
        // Kept so the session can still say which block the window belonged to.
        expect(timer.exerciseIndex).toBe(0);
      });

      it('freezes remaining time on pause and re-anchors on resume', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startAmrapTimer, pauseAmrapTimer, resumeAmrapTimer } =
          useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startAmrapTimer(0, 600);

        jest.setSystemTime(1_000_000 + 100 * 1000);
        pauseAmrapTimer();

        let timer = useWorkoutStore.getState().amrapTimer;
        expect(timer).toMatchObject({ remaining: 500, running: false, paused: true, endsAt: null });

        // Two minutes of paused time must NOT come out of the window.
        jest.setSystemTime(1_000_000 + 220 * 1000);
        resumeAmrapTimer();

        timer = useWorkoutStore.getState().amrapTimer;
        expect(timer.remaining).toBe(500);
        expect(timer.running).toBe(true);
        expect(timer.endsAt).toBe(1_000_000 + 220 * 1000 + 500 * 1000);
      });

      it('clears with the session', () => {
        const { startSession, startAmrapTimer, endSession } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startAmrapTimer(0, 600);

        endSession();

        expect(useWorkoutStore.getState().amrapTimer.exerciseIndex).toBeNull();
      });
    });
  });
});
