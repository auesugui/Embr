// =============================================================================
// IronQuest Workout Store Unit Tests
// =============================================================================
// Tests for session lifecycle, exercise management, set logging, rest timer

import type { Exercise } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { useWeightHistoryStore } from '../weightHistoryStore';
import {
  blockElapsed,
  blockInterval,
  blockRemaining,
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

    describe('the block clock', () => {
      afterEach(() => {
        jest.useRealTimers();
      });

      const timer = () => useWorkoutStore.getState().blockTimer;

      it('starts against the wall clock, not a tick count', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        startBlockTimer('b1', { mode: 'amrap_rounds', duration: 1200 });

        expect(timer()).toMatchObject({
          blockKey: 'b1',
          mode: 'amrap_rounds',
          duration: 1200,
          running: true,
          paused: false,
          runStartedAt: 1_000_000,
        });
        expect(blockRemaining(timer())).toBe(1200);
      });

      it('does not lose time while the app is not ticking', () => {
        // The whole point of a wall-clock anchor: five minutes pass with no
        // tick delivered (backgrounded tab), and the window is five minutes
        // shorter when we come back.
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer, tickBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'amrap_rounds', duration: 1200 });

        jest.setSystemTime(1_000_000 + 300 * 1000);
        tickBlockTimer();

        expect(blockRemaining(timer())).toBe(900);
      });

      it('stops the clock when the window closes', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer, tickBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'amrap_reps', duration: 60 });

        jest.setSystemTime(1_000_000 + 61 * 1000);
        tickBlockTimer();

        expect(blockRemaining(timer())).toBe(0);
        expect(timer().running).toBe(false);
        // Kept so the session can still say which block the window belonged to.
        expect(timer().blockKey).toBe('b1');
      });

      it('freezes elapsed time on pause and re-anchors on resume', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer, pauseBlockTimer, resumeBlockTimer } =
          useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'amrap_rounds', duration: 600 });

        jest.setSystemTime(1_000_000 + 100 * 1000);
        pauseBlockTimer();

        expect(timer()).toMatchObject({ running: false, paused: true, runStartedAt: null });
        expect(blockRemaining(timer())).toBe(500);

        // Two minutes of paused time must NOT come out of the window.
        jest.setSystemTime(1_000_000 + 220 * 1000);
        resumeBlockTimer();

        expect(blockRemaining(timer())).toBe(500);
        expect(timer().running).toBe(true);
      });

      it('counts up for a for-time block and never runs out', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer, tickBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        // Uncapped: duration 0 must still start the clock for a count-up block.
        startBlockTimer('b1', { mode: 'for_time', duration: 0 });

        expect(timer().running).toBe(true);

        jest.setSystemTime(1_000_000 + 400 * 1000);
        tickBlockTimer();

        expect(Math.round(blockElapsed(timer()))).toBe(400);
        expect(timer().running).toBe(true);
      });

      it('records the finishing time of a for-time block and freezes it', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer, finishBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'for_time', duration: 0 });

        jest.setSystemTime(1_000_000 + 372 * 1000);
        finishBlockTimer();

        expect(useWorkoutStore.getState().blockTimes.b1).toBe(372);

        // The recorded time must not keep climbing while you look at it.
        jest.setSystemTime(1_000_000 + 900 * 1000);
        expect(blockElapsed(timer())).toBe(372);
      });

      it('derives the EMOM interval from elapsed time rather than counting it', () => {
        jest.useFakeTimers().setSystemTime(1_000_000);
        const { startSession, startBlockTimer } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'emom', duration: 12 * 60, intervalSeconds: 60 });

        // Three and a half minutes in with no ticks delivered: interval 3, half left.
        jest.setSystemTime(1_000_000 + 210 * 1000);

        const interval = blockInterval(timer());
        expect(interval.index).toBe(3);
        expect(interval.remaining).toBe(30);
      });

      it('clears with the session', () => {
        const { startSession, startBlockTimer, endSession } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());
        startBlockTimer('b1', { mode: 'amrap_rounds', duration: 600 });

        endSession();

        expect(timer().blockKey).toBeNull();
      });
    });

    // -------------------------------------------------------------------------
    // Rounds across a multi-movement block
    // -------------------------------------------------------------------------

    describe('openRound', () => {
      const makeCircuit = (): Exercise[] =>
        ['pull_up', 'push_up', 'bodyweight_squat'].map((id) => ({
          id: `${id}-0`,
          name: id,
          muscleGroups: [],
          sets: [{ reps: null, weight: null, logged: false, isPR: false, isRepPR: false }],
          restSeconds: 0,
          completed: false,
          blockId: 'b1',
        }));

      it('grows every member together so a round stays aligned', () => {
        // Round index is what pairs the movements. If one member could run
        // ahead, round 3 of the squats would sit beside round 2 of the pull-ups.
        const { startSession, logSet, openRound } = useWorkoutStore.getState();
        startSession('t', makeCircuit(), 'normal', [
          { id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 },
        ]);

        logSet(0, 0, 5);
        logSet(1, 0, 10);
        logSet(2, 0, 15);
        openRound([0, 1, 2]);

        const { exercises } = useWorkoutStore.getState();
        expect(exercises.map((e) => e.sets.length)).toEqual([2, 2, 2]);
        expect(exercises.every((e) => e.sets[1].logged === false)).toBe(true);
      });

      it('is a no-op for a member that still has an open row', () => {
        // Otherwise every log would stack another blank row on the movements
        // that had not been logged yet.
        const { startSession, logSet, openRound } = useWorkoutStore.getState();
        startSession('t', makeCircuit(), 'normal', [
          { id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 },
        ]);

        logSet(0, 0, 5);
        openRound([0, 1, 2]);

        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([2, 1, 1]);
      });

      it('ignores out-of-range indexes', () => {
        const { startSession, openRound } = useWorkoutStore.getState();
        startSession('t', makeCircuit());

        openRound([0, 99]);

        expect(useWorkoutStore.getState().exercises).toHaveLength(3);
      });

      it('converges back to an aligned circuit when called mid-round', () => {
        // Called early it grows only the members that are full, which leaves the
        // circuit ragged for a moment. It must not stay that way: a later call,
        // once the round has closed, brings the others level rather than pushing
        // the leader further ahead.
        const { startSession, logSet, openRound } = useWorkoutStore.getState();
        startSession('t', makeCircuit(), 'normal', [
          { id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 },
        ]);

        logSet(0, 0, 5);
        openRound([0, 1, 2]);
        logSet(1, 0, 10);
        logSet(2, 0, 15);
        openRound([0, 1, 2]);

        // Pull-ups must not end up a round ahead of the other two.
        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([2, 2, 2]);
      });
    });

    describe('logRound', () => {
      const makeCircuit = (): Exercise[] =>
        ['pull_up', 'push_up', 'bodyweight_squat'].map((id) => ({
          id: `${id}-0`,
          name: id,
          muscleGroups: [],
          sets: [{ reps: null, weight: null, logged: false, isPR: false, isRepPR: false }],
          restSeconds: 0,
          completed: false,
          blockId: 'b1',
        }));

      const start = () => {
        const { startSession } = useWorkoutStore.getState();
        startSession('t', makeCircuit(), 'normal', [
          { id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 },
        ]);
      };

      it('banks every movement and opens the next round in one go', () => {
        // The whole point: a circuit is worked as a unit, so it logs as one.
        start();
        useWorkoutStore.getState().logRound([
          { exerciseIndex: 0, setIndex: 0, reps: 5 },
          { exerciseIndex: 1, setIndex: 0, reps: 10 },
          { exerciseIndex: 2, setIndex: 0, reps: 15 },
        ]);

        const { exercises } = useWorkoutStore.getState();
        expect(exercises.map((e) => e.sets[0].reps)).toEqual([5, 10, 15]);
        expect(exercises.map((e) => e.sets.length)).toEqual([2, 2, 2]);
        expect(exercises.every((e) => e.sets[1].logged === false)).toBe(true);
      });

      it('counts as a completed round', () => {
        start();
        useWorkoutStore.getState().logRound([
          { exerciseIndex: 0, setIndex: 0, reps: 5 },
          { exerciseIndex: 1, setIndex: 0, reps: 10 },
          { exerciseIndex: 2, setIndex: 0, reps: 15 },
        ]);

        expect(useWorkoutStore.getState().getTotalReps()).toBe(30);
      });

      it('does not open a round for a movement left unlogged', () => {
        // A partial round stays partial — the clock cut it short and that is
        // the fact being recorded.
        start();
        useWorkoutStore.getState().logRound([{ exerciseIndex: 0, setIndex: 0, reps: 5 }]);

        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([2, 1, 1]);
      });

      it('opens the next round for a member banked earlier in a partial round', () => {
        // Regression: finishing a partial round grew only the movements in
        // `rows`, so the one logged first stayed a round behind and vanished
        // from the next round entirely.
        start();
        useWorkoutStore
          .getState()
          .logRound([{ exerciseIndex: 0, setIndex: 0, reps: 5 }], [0, 1, 2]);
        useWorkoutStore.getState().logRound(
          [
            { exerciseIndex: 1, setIndex: 0, reps: 10 },
            { exerciseIndex: 2, setIndex: 0, reps: 15 },
          ],
          [0, 1, 2]
        );

        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([2, 2, 2]);
      });

      it('does not clobber a movement already logged in this round', () => {
        start();
        useWorkoutStore
          .getState()
          .logRound([{ exerciseIndex: 0, setIndex: 0, reps: 3 }], [0, 1, 2]);
        useWorkoutStore.getState().logRound(
          [
            { exerciseIndex: 1, setIndex: 0, reps: 10 },
            { exerciseIndex: 2, setIndex: 0, reps: 15 },
          ],
          [0, 1, 2]
        );

        // The scaled 3 the user actually logged must survive.
        expect(useWorkoutStore.getState().exercises[0].sets[0].reps).toBe(3);
      });

      it('stops at the planned round count when the mode has one', () => {
        // Regression: a 2-round for-time offered a Round 3, because the round
        // always grew regardless of mode. `for_time` and `emom` are bounded by
        // their plan, not by a clock running out.
        start();
        useWorkoutStore.getState().logRound(
          [
            { exerciseIndex: 0, setIndex: 0, reps: 5 },
            { exerciseIndex: 1, setIndex: 0, reps: 10 },
            { exerciseIndex: 2, setIndex: 0, reps: 15 },
          ],
          [0, 1, 2],
          false
        );

        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([1, 1, 1]);
      });

      it('ignores out-of-range rows rather than throwing', () => {
        start();
        useWorkoutStore.getState().logRound([{ exerciseIndex: 99, setIndex: 0, reps: 5 }]);

        expect(useWorkoutStore.getState().getTotalReps()).toBe(0);
      });

      it('is a no-op for an empty round', () => {
        start();
        useWorkoutStore.getState().logRound([]);

        expect(useWorkoutStore.getState().exercises.map((e) => e.sets.length)).toEqual([1, 1, 1]);
      });

      it('records weight to history so the next round auto-fills', () => {
        start();
        useWorkoutStore
          .getState()
          .logRound([{ exerciseIndex: 0, setIndex: 0, reps: 5, weight: 45 }]);

        expect(useWeightHistoryStore.getState().saveWeight).toHaveBeenCalledWith(
          'pull_up-0',
          45,
          'lb'
        );
      });
    });

    // -------------------------------------------------------------------------
    // Blocks on the session
    // -------------------------------------------------------------------------

    describe('session blocks', () => {
      it('carries the block list onto the session', () => {
        const { startSession } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises(), 'normal', [
          { id: 'b1', mode: 'emom', rounds: 12, intervalSeconds: 60 },
        ]);

        expect(useWorkoutStore.getState().blocks).toEqual([
          { id: 'b1', mode: 'emom', rounds: 12, intervalSeconds: 60 },
        ]);
      });

      it('defaults to no blocks, which is every pre-block session', () => {
        const { startSession } = useWorkoutStore.getState();
        startSession('t', makeAmrapExercises());

        expect(useWorkoutStore.getState().blocks).toEqual([]);
      });
    });
  });
});
