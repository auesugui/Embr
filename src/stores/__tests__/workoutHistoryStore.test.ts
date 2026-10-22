// =============================================================================
// Embr Workout History Store Tests
// =============================================================================
// Regression coverage for issue #16 (double-save via URL replay / audit C1).
// The store is the idempotency boundary: `saveWorkout` must return the log on
// the first call and null on every replay, so the summary's finish path can
// never act twice on one workout.

import type { Exercise, LoggedSet } from '@/types';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { useWorkoutHistoryStore } from '../workoutHistoryStore';

// Mock storage (mirrors playerStore.test.ts setup)
jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    WORKOUT_HISTORY: {
      FULL_STATE: 'workout_history.full_state',
    },
  },
}));

const makeSet = (overrides: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 100,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...overrides,
});

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex-1',
  name: 'Bench Press',
  muscleGroups: ['chest', 'triceps'],
  sets: [makeSet()],
  restSeconds: 60,
  completed: false,
  ...overrides,
});

describe('Workout History Store', () => {
  beforeEach(() => {
    useWorkoutHistoryStore.getState().reset();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // createLog + getLog
  // ---------------------------------------------------------------------------

  describe('createLog / getLog', () => {
    it('persists an unclaimed log and returns its id', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');

      const log = useWorkoutHistoryStore.getState().getLog(id);
      expect(log).toBeDefined();
      expect(log?.claimedAt).toBeNull();
      expect(log?.streakDays).toBe(0);
      expect(log?.sessionIntent).toBe('normal');
    });

    it('persists to storage on create', () => {
      useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
      });

      expect(require('@/utils/storage').appStorage.setJSON as jest.Mock).toHaveBeenCalled();
    });

    it('returns undefined for an unknown id', () => {
      expect(useWorkoutHistoryStore.getState().getLog('nope')).toBeUndefined();
    });

    it('generates unique ids for distinct logs', () => {
      const a = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
      });
      const b = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
      });

      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // saveWorkout idempotency (acceptance criterion: no double-save)
  //
  // The guard was built to stop a URL replay double-*awarding* FP (issue #16 /
  // audit C1). FP is gone (ADR-0015); the guard is not, because the same replay
  // would otherwise stamp the same workout as saved twice.
  // ---------------------------------------------------------------------------

  describe('saveWorkout — idempotency', () => {
    it('returns the log on first save and stamps claimedAt', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 1,
        sessionIntent: 'normal',
      });

      const claimed = useWorkoutHistoryStore.getState().saveWorkout(id);

      expect(claimed).not.toBeNull();
      expect(claimed?.id).toBe(id);
      expect(claimed?.claimedAt).not.toBeNull();
    });

    it('returns null on a second save for the same workout (no-op)', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 1,
        sessionIntent: 'normal',
      });

      const first = useWorkoutHistoryStore.getState().saveWorkout(id);
      const second = useWorkoutHistoryStore.getState().saveWorkout(id);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it('does not overwrite claimedAt on replay', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 1,
        sessionIntent: 'normal',
      });

      const first = useWorkoutHistoryStore.getState().saveWorkout(id);
      useWorkoutHistoryStore.getState().saveWorkout(id); // replay
      const after = useWorkoutHistoryStore.getState().getLog(id);

      expect(after?.claimedAt).toBe(first?.claimedAt);
    });

    it('returns null and warns for an unknown id', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = useWorkoutHistoryStore.getState().saveWorkout('bogus');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    // Acceptance criterion: "saving the same workout twice does not
    // double-save". Models the summary screen's guard — only act when
    // saveWorkout returns non-null.
    it('acts once when the save path is invoked twice', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 1,
        sessionIntent: 'normal',
      });

      // Mirror of summary.tsx handleFinish: act only when saveWorkout returns
      // a log.
      let sideEffects = 0;
      const save = () => useWorkoutHistoryStore.getState().saveWorkout(id);

      if (save()) sideEffects++;
      if (save()) sideEffects++;

      expect(sideEffects).toBe(1); // not 2
    });
  });

  // ---------------------------------------------------------------------------
  // addManualLog — a workout typed in by hand
  // ---------------------------------------------------------------------------

  describe('addManualLog', () => {
    it('stores the log already claimed, at the given time', async () => {
      const id = await useWorkoutHistoryStore.getState().addManualLog({
        exercises: [makeExercise()],
        durationSeconds: 2700,
        streakDays: 4,
        timestamp: '2026-10-20T12:00:00.000Z',
      });

      const log = useWorkoutHistoryStore.getState().getLog(id);
      expect(log?.claimedAt).not.toBeNull();
      expect(log?.timestamp).toBe('2026-10-20T12:00:00.000Z');
      expect(log?.durationSeconds).toBe(2700);
      expect(log?.streakDays).toBe(4);
      expect(log?.sessionIntent).toBe('normal');
    });

    it('stamps the current time when no timestamp is given', async () => {
      const before = Date.now();
      const id = await useWorkoutHistoryStore.getState().addManualLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
      });

      const log = useWorkoutHistoryStore.getState().getLog(id);
      expect(Date.parse(log?.timestamp ?? '')).toBeGreaterThanOrEqual(before);
    });

    it('writes storage once, with the log already claimed', async () => {
      await useWorkoutHistoryStore.getState().addManualLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
      });

      const { appStorage } = require('@/utils/storage');
      expect(appStorage.setJSON).toHaveBeenCalledTimes(1);
      const [, persisted] = (appStorage.setJSON as jest.Mock).mock.calls[0];
      expect(persisted.logs[0].claimedAt).not.toBeNull();
    });

    it('refuses a second save, the same as a session log', async () => {
      const id = await useWorkoutHistoryStore.getState().addManualLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(useWorkoutHistoryStore.getState().saveWorkout(id)).toBeNull();
      warnSpy.mockRestore();
    });

    it('rejects when the write fails, and leaves the history unchanged', async () => {
      const { appStorage } = require('@/utils/storage');
      (appStorage.setJSON as jest.Mock).mockRejectedValueOnce(new Error('QuotaExceededError'));
      const before = useWorkoutHistoryStore.getState().logs;

      await expect(
        useWorkoutHistoryStore.getState().addManualLog({
          exercises: [makeExercise()],
          durationSeconds: 600,
          streakDays: 0,
        })
      ).rejects.toThrow('QuotaExceededError');
      expect(useWorkoutHistoryStore.getState().logs).toBe(before);
    });
  });

  // ---------------------------------------------------------------------------
  // Hydration
  // ---------------------------------------------------------------------------

  describe('hydrate', () => {
    it('restores logs and sets hydrated=true', async () => {
      const stored = {
        logs: [
          {
            id: 'workout_existing',
            timestamp: '2026-07-01T00:00:00.000Z',
            exercises: [makeExercise()],
            durationSeconds: 600,
            streakDays: 3,
            sessionIntent: 'normal',
            claimedAt: '2026-07-01T00:05:00.000Z',
            totalFP: 103,
            fpEarned: {
              generic: 103,
              power: 0,
              guard: 0,
              speed: 0,
              vigor: 0,
              focus: 0,
              spirit: 15,
            },
          },
        ],
      };
      (require('@/utils/storage').appStorage.getJSON as jest.Mock).mockResolvedValue(stored);

      await useWorkoutHistoryStore.getState().hydrate();

      const state = useWorkoutHistoryStore.getState();
      expect(state.hydrated).toBe(true);
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0].id).toBe('workout_existing');
      // An already-claimed restored log must stay claimed (replay guard holds
      // across reloads).
      expect(state.logs[0].claimedAt).not.toBeNull();
    });

    it('a restored claimed log refuses re-claim (idempotency survives reload)', async () => {
      const stored = {
        logs: [
          {
            id: 'workout_claimed',
            timestamp: '2026-07-01T00:00:00.000Z',
            exercises: [makeExercise()],
            durationSeconds: 600,
            streakDays: 1,
            sessionIntent: 'normal',
            claimedAt: '2026-07-01T00:05:00.000Z',
            totalFP: 103,
            fpEarned: {
              generic: 103,
              power: 0,
              guard: 0,
              speed: 0,
              vigor: 0,
              focus: 0,
              spirit: 5,
            },
          },
        ],
      };
      (require('@/utils/storage').appStorage.getJSON as jest.Mock).mockResolvedValue(stored);

      await useWorkoutHistoryStore.getState().hydrate();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const replay = useWorkoutHistoryStore.getState().saveWorkout('workout_claimed');

      expect(replay).toBeNull(); // no double-save after reload
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('handles empty storage gracefully (hydrated=true, empty logs)', async () => {
      (require('@/utils/storage').appStorage.getJSON as jest.Mock).mockResolvedValue(undefined);

      await useWorkoutHistoryStore.getState().hydrate();

      const state = useWorkoutHistoryStore.getState();
      expect(state.hydrated).toBe(true);
      expect(state.logs).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // mergeLogs — additive, for workouts brought in from a file
  // ---------------------------------------------------------------------------

  describe('mergeLogs', () => {
    const importedLog = (id: string) => ({
      id,
      timestamp: '2026-10-10T12:00:00.000Z',
      exercises: [makeExercise()],
      durationSeconds: 1980,
      streakDays: 0,
      sessionIntent: 'normal' as const,
      claimedAt: null,
    });

    it('adds the workouts, persists them, and reports how many were added', () => {
      const id = useWorkoutHistoryStore.getState().createLog({
        exercises: [makeExercise()],
        durationSeconds: 600,
        streakDays: 0,
        sessionIntent: 'normal',
      });

      const added = useWorkoutHistoryStore.getState().mergeLogs([importedLog('imported-1')]);

      expect(added).toBe(1);
      const logs = useWorkoutHistoryStore.getState().logs;
      expect(logs.map((log) => log.id)).toContain(id);
      expect(logs.map((log) => log.id)).toContain('imported-1');
      expect(logs.find((log) => log.id === 'imported-1')?.claimedAt).not.toBeNull();
      expect(require('@/utils/storage').appStorage.setJSON).toHaveBeenLastCalledWith(
        'workout_history.full_state',
        { logs }
      );
    });

    it('adds nothing when every workout is already here', () => {
      useWorkoutHistoryStore.getState().mergeLogs([importedLog('imported-1')]);
      const before = useWorkoutHistoryStore.getState().logs;

      const added = useWorkoutHistoryStore.getState().mergeLogs([importedLog('imported-1')]);

      expect(added).toBe(0);
      expect(useWorkoutHistoryStore.getState().logs).toBe(before);
    });
  });
});
