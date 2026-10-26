// =============================================================================
// Workout import — read a file's workouts, merge them without overwriting
// =============================================================================
// The file is untrusted input, so every rejection path is asserted one by one.
// The merge into real history is covered in workout-merge.test.ts.

import type { WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';
import { BackupParseError } from '../backup';
import { parseWorkoutImport } from '../workout-import';

jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}));

const HISTORY_KEY = 'workout_history.full_state';

const makeLog = (overrides: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: 'log-1',
  timestamp: '2026-10-10T12:00:00.000Z',
  exercises: [
    {
      id: 'kettlebell_swing',
      name: 'Kettlebell Swing',
      muscleGroups: ['glutes', 'hamstrings'],
      sets: [{ reps: 15, weight: 45, logged: true, isPR: false, isRepPR: false }],
      restSeconds: 0,
      completed: true,
    },
  ],
  durationSeconds: 1980,
  streakDays: 0,
  sessionIntent: 'normal',
  claimedAt: null,
  ...overrides,
});

const backupText = (logs: unknown[]): string =>
  JSON.stringify({
    app: 'embr',
    formatVersion: 1,
    exportedAt: '2026-10-13T00:00:00.000Z',
    data: { [HISTORY_KEY]: JSON.stringify({ logs }) },
  });

describe('parseWorkoutImport', () => {
  it('reads the workouts out of a backup file', () => {
    const { logs, skipped } = parseWorkoutImport(backupText([makeLog()]));

    expect(logs.map((log) => log.id)).toEqual(['log-1']);
    expect(skipped).toBe(0);
  });

  it('treats a missing claimedAt as never saved', () => {
    const { logs } = parseWorkoutImport(backupText([{ ...makeLog(), claimedAt: undefined }]));

    expect(logs[0].claimedAt).toBeNull();
  });

  it('keeps fields it does not read, so older logs come through intact', () => {
    const base = makeLog();
    const legacy = {
      ...base,
      exercises: [{ ...base.exercises[0], mode: 'amrap', durationSeconds: 60 }],
    };

    const { logs } = parseWorkoutImport(backupText([legacy]));

    expect(logs[0].exercises[0]).toMatchObject({ mode: 'amrap', durationSeconds: 60 });
  });

  it('rejects a file made by a different app', () => {
    const text = JSON.stringify({ app: 'someone-else', formatVersion: 1, data: {} });

    expect(() => parseWorkoutImport(text)).toThrow(BackupParseError);
  });

  it('says so when the file has no workout history', () => {
    const text = JSON.stringify({ app: 'embr', formatVersion: 1, data: {} });

    expect(() => parseWorkoutImport(text)).toThrow('no workout history');
  });

  it('says so when the workout history cannot be read', () => {
    const notJson = JSON.stringify({
      app: 'embr',
      formatVersion: 1,
      data: { [HISTORY_KEY]: 'not json' },
    });
    const noLogs = JSON.stringify({
      app: 'embr',
      formatVersion: 1,
      data: { [HISTORY_KEY]: JSON.stringify({}) },
    });

    expect(() => parseWorkoutImport(notJson)).toThrow('damaged');
    expect(() => parseWorkoutImport(noLogs)).toThrow('damaged');
  });

  it('says so when the file holds no workouts', () => {
    expect(() => parseWorkoutImport(backupText([]))).toThrow('no workouts in it');
  });

  it('skips malformed entries and counts them', () => {
    const badDate = { ...makeLog({ id: 'log-3' }), timestamp: 'not a date' };

    const { logs, skipped } = parseWorkoutImport(backupText([makeLog(), { id: '' }, badDate]));

    expect(logs.map((log) => log.id)).toEqual(['log-1']);
    expect(skipped).toBe(2);
  });

  it('skips a log whose block has a mode the app does not know', () => {
    const unknownMode = { ...makeLog({ id: 'log-4' }), blocks: [{ id: 'b', mode: 'superset' }] };

    const { logs, skipped } = parseWorkoutImport(backupText([makeLog(), unknownMode]));

    expect(logs.map((log) => log.id)).toEqual(['log-1']);
    expect(skipped).toBe(1);
  });

  it('carries the logged weight unit through, and leaves an older log without one (#85)', () => {
    const withUnit = { ...makeLog({ id: 'log-5' }), weightUnit: 'kg' };

    const { logs, skipped } = parseWorkoutImport(backupText([makeLog(), withUnit]));

    expect(logs[0]).not.toHaveProperty('weightUnit');
    expect(logs[1].weightUnit).toBe('kg');
    expect(skipped).toBe(0);
  });

  it('drops a weight unit it does not recognise rather than the workout (#85)', () => {
    const bogus = { ...makeLog({ id: 'log-6' }), weightUnit: 'stone' };

    const { logs, skipped } = parseWorkoutImport(backupText([bogus]));

    expect(logs.map((log) => log.id)).toEqual(['log-6']);
    expect(logs[0]).not.toHaveProperty('weightUnit');
    expect(skipped).toBe(0);
  });

  it('says so when none of the workouts can be read', () => {
    expect(() => parseWorkoutImport(backupText([{ id: '' }]))).toThrow(
      'None of the workouts in that file could be read.'
    );
  });
});
