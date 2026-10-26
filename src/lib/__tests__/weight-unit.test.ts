// =============================================================================
// weight-unit — which unit a saved workout is in (issue #85 step 2)
// =============================================================================
// One rule, read by every surface that looks across sessions. The case worth
// pinning is the unrecognised value: `restoreBackup` passes `weightUnit`
// through unchanged, so a hand-edited or future-version backup can carry
// anything, and anything that is not 'lb' or 'kg' has to read as absent rather
// than as a third group nobody can see.

import type { WeightUnit, WorkoutLog } from '@/types';

import { effectiveWeightUnit, historyHasBothUnits, otherWeightUnit } from '../weight-unit';

const log = (over: Partial<WorkoutLog> = {}): WorkoutLog =>
  ({
    id: 'a',
    timestamp: '2026-10-21T18:00:00.000Z',
    exercises: [],
    durationSeconds: 1800,
    streakDays: 1,
    sessionIntent: 'normal',
    claimedAt: '2026-10-21T18:30:00.000Z',
    ...over,
  }) as WorkoutLog;

/** A value no version of the app writes, as a restored backup can hold. */
const bogus = 'stone' as unknown as WeightUnit;

describe('effectiveWeightUnit', () => {
  it('reads the unit the log records', () => {
    expect(effectiveWeightUnit(log({ weightUnit: 'lb' }), 'kg')).toBe('lb');
    expect(effectiveWeightUnit(log({ weightUnit: 'kg' }), 'lb')).toBe('kg');
  });

  it('falls back to the setting when the log carries none', () => {
    expect(effectiveWeightUnit(log(), 'lb')).toBe('lb');
    expect(effectiveWeightUnit(log(), 'kg')).toBe('kg');
  });

  it('reads an unrecognised value as absent', () => {
    expect(effectiveWeightUnit(log({ weightUnit: bogus }), 'kg')).toBe('kg');
  });

  it('moves a unit-less log when the setting changes, and never a stamped one', () => {
    const legacy = log();
    const stamped = log({ weightUnit: 'lb' });

    expect(effectiveWeightUnit(legacy, 'lb')).toBe('lb');
    expect(effectiveWeightUnit(legacy, 'kg')).toBe('kg');
    expect(effectiveWeightUnit(stamped, 'lb')).toBe('lb');
    expect(effectiveWeightUnit(stamped, 'kg')).toBe('lb');
  });
});

describe('otherWeightUnit', () => {
  it('is the one you are not looking at', () => {
    expect(otherWeightUnit('lb')).toBe('kg');
    expect(otherWeightUnit('kg')).toBe('lb');
  });
});

describe('historyHasBothUnits', () => {
  it('is false for a lifter who has only ever used one unit', () => {
    expect(historyHasBothUnits([log({ id: 'a' }), log({ id: 'b' })], 'lb')).toBe(false);
    expect(historyHasBothUnits([log({ id: 'a', weightUnit: 'kg' }), log({ id: 'b' })], 'kg')).toBe(
      false
    );
  });

  it('is true once each unit has a session', () => {
    const logs = [log({ id: 'a', weightUnit: 'lb' }), log({ id: 'b', weightUnit: 'kg' })];
    expect(historyHasBothUnits(logs, 'lb')).toBe(true);
    expect(historyHasBothUnits(logs, 'kg')).toBe(true);
  });

  it('splits a stamped log against the legacy logs the setting answers for', () => {
    const logs = [log({ id: 'legacy' }), log({ id: 'new', weightUnit: 'kg' })];

    // Setting lb: the legacy session is lb, the stamped one kg — two groups.
    expect(historyHasBothUnits(logs, 'lb')).toBe(true);
    // Setting kg: both read as kg, so there is nothing to separate.
    expect(historyHasBothUnits(logs, 'kg')).toBe(false);
  });

  it('counts saved workouts only', () => {
    const logs = [
      log({ id: 'a', weightUnit: 'lb' }),
      log({ id: 'abandoned', weightUnit: 'kg', claimedAt: null }),
    ];

    expect(historyHasBothUnits(logs, 'lb')).toBe(false);
  });

  it('is false with no history at all', () => {
    expect(historyHasBothUnits([], 'lb')).toBe(false);
  });
});
