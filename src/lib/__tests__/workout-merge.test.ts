// =============================================================================
// Workout merge — incoming logs join the history, existing ones are untouched
// =============================================================================
// The merge is the only thing between an import and the user's real history, so
// the guarantee that a log already on the device is never changed is asserted
// directly, along with the dedupe that makes re-importing a file harmless.

import type { WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';
import { mergeWorkoutLogs } from '../workout-merge';

const IMPORTED_AT = '2026-10-13T09:00:00.000Z';

const makeLog = (overrides: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: 'log-1',
  timestamp: '2026-10-10T12:00:00.000Z',
  exercises: [],
  durationSeconds: 1980,
  streakDays: 0,
  sessionIntent: 'normal',
  claimedAt: null,
  ...overrides,
});

describe('mergeWorkoutLogs', () => {
  it('adds logs the history does not hold, newest first', () => {
    const existing = [makeLog({ id: 'a', timestamp: '2026-10-01T12:00:00.000Z' })];
    const incoming = [makeLog({ id: 'b', timestamp: '2026-10-10T12:00:00.000Z' })];

    const { logs, added } = mergeWorkoutLogs(existing, incoming, IMPORTED_AT);

    expect(logs.map((log) => log.id)).toEqual(['b', 'a']);
    expect(added).toBe(1);
  });

  it('skips ids it already holds and leaves those logs exactly as they were', () => {
    const kept = makeLog({ id: 'a' });
    const existing = [kept];

    const { logs, added } = mergeWorkoutLogs(
      existing,
      [makeLog({ id: 'a', durationSeconds: 1 })],
      IMPORTED_AT
    );

    expect(added).toBe(0);
    expect(logs).toBe(existing);
    expect(logs[0]).toBe(kept);
  });

  it('stamps a never-saved log as saved at import time', () => {
    const { logs } = mergeWorkoutLogs([], [makeLog({ id: 'b', claimedAt: null })], IMPORTED_AT);

    expect(logs[0].claimedAt).toBe(IMPORTED_AT);
  });

  it('keeps a claimedAt the incoming log already has', () => {
    const saved = '2026-10-11T00:00:00.000Z';

    const { logs } = mergeWorkoutLogs([], [makeLog({ id: 'b', claimedAt: saved })], IMPORTED_AT);

    expect(logs[0].claimedAt).toBe(saved);
  });

  it('adds nothing the second time the same file is merged', () => {
    const first = mergeWorkoutLogs([], [makeLog({ id: 'b' })], IMPORTED_AT);

    const second = mergeWorkoutLogs(first.logs, [makeLog({ id: 'b' })], IMPORTED_AT);

    expect(second.added).toBe(0);
    expect(second.logs).toBe(first.logs);
  });

  it('adds a workout once even when the file lists it twice', () => {
    const { logs, added } = mergeWorkoutLogs(
      [],
      [makeLog({ id: 'b' }), makeLog({ id: 'b' })],
      IMPORTED_AT
    );

    expect(logs).toHaveLength(1);
    expect(added).toBe(1);
  });
});
