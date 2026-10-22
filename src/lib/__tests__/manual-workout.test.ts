// =============================================================================
// Embr Manual Workout Tests
// =============================================================================
// A typed-in workout is checked here, not in the screen. The rules decide what
// gets saved, so they are pinned down without rendering anything.

import { describe, expect, it } from '@jest/globals';

import {
  type ManualCardioDraft,
  type ManualWorkoutDraft,
  type ManualWorkoutResult,
  parseManualWorkout,
  parseWorkoutDate,
  suggestExercises,
  todayIsoDate,
} from '../manual-workout';

// Local time on purpose: dates are read in the device's calendar, not UTC.
const NOW = new Date(2026, 9, 22, 18, 30);

const row = (weight: string, reps: string) => ({ weight, reps });

const makeDraft = (overrides: Partial<ManualWorkoutDraft> = {}): ManualWorkoutDraft => ({
  date: '2026-10-20',
  durationMinutes: '45',
  exercises: [{ name: 'Back Squat', sets: [row('135', '8')] }],
  ...overrides,
});

type Saved = Extract<ManualWorkoutResult, { ok: true }>;

function saved(result: ManualWorkoutResult): Saved {
  if (!result.ok) throw new Error(`expected a saved workout, got: ${result.error}`);
  return result;
}

function failure(result: ManualWorkoutResult): string {
  if (result.ok) throw new Error('expected an error, got a saved workout');
  return result.error;
}

describe('todayIsoDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});

describe('parseWorkoutDate', () => {
  it('keeps the current time for today', () => {
    expect(parseWorkoutDate('2026-10-22', NOW)).toEqual({ ok: true, value: NOW.toISOString() });
  });

  it('stores a past date at local noon, so it stays on that day', () => {
    expect(parseWorkoutDate('2026-10-20', NOW)).toEqual({
      ok: true,
      value: new Date(2026, 9, 20, 12).toISOString(),
    });
  });

  it('ignores surrounding whitespace', () => {
    expect(parseWorkoutDate(' 2026-10-20 ', NOW).ok).toBe(true);
  });

  it.each(['10/20/2026', '2026-10', '20-10-2026', '', 'yesterday'])(
    'rejects %p as not YYYY-MM-DD',
    (input) => {
      expect(parseWorkoutDate(input, NOW)).toEqual({
        ok: false,
        error: 'Enter the date as YYYY-MM-DD.',
      });
    }
  );

  it('rejects a date that does not exist', () => {
    expect(parseWorkoutDate('2026-02-30', NOW)).toEqual({
      ok: false,
      error: 'That date doesn’t exist.',
    });
  });

  it('rejects a future date', () => {
    expect(parseWorkoutDate('2026-10-23', NOW)).toEqual({
      ok: false,
      error: 'That date is in the future.',
    });
  });
});

describe('parseManualWorkout', () => {
  it('reads a catalog name onto the catalog exercise, in the shape a session writes', () => {
    const { exercises } = saved(
      parseManualWorkout(
        makeDraft({ exercises: [{ name: '  back   squat ', sets: [row('135', '8')] }] }),
        NOW
      )
    );

    expect(exercises[0]).toMatchObject({
      id: 'back_squat',
      name: 'Back Squat',
      completed: true,
      restSeconds: 0,
    });
    expect(exercises[0].muscleGroups).toContain('quads');
    expect(exercises[0].sets).toEqual([
      { reps: 8, weight: 135, logged: true, isPR: false, isRepPR: false },
    ]);
  });

  it('gives a name outside the catalog a custom id from its text', () => {
    const { exercises } = saved(
      parseManualWorkout(
        makeDraft({ exercises: [{ name: 'Sled Push', sets: [row('90', '20')] }] }),
        NOW
      )
    );

    expect(exercises[0]).toMatchObject({
      id: 'custom-sled-push',
      name: 'Sled Push',
      muscleGroups: [],
    });
  });

  it('stores the typed duration in seconds, and a blank one as zero', () => {
    const typed = saved(parseManualWorkout(makeDraft({ durationMinutes: '45' }), NOW));
    const blank = saved(parseManualWorkout(makeDraft({ durationMinutes: '' }), NOW));
    expect(typed.durationSeconds).toBe(2700);
    expect(blank.durationSeconds).toBe(0);
  });

  it('reads a blank weight as bodyweight and keeps a typed weight as a number', () => {
    const { exercises } = saved(
      parseManualWorkout(
        makeDraft({ exercises: [{ name: 'Pull-Ups', sets: [row('', '10'), row('22.5', '6')] }] }),
        NOW
      )
    );

    expect(exercises[0].sets.map((set) => [set.weight, set.reps])).toEqual([
      [null, 10],
      [22.5, 6],
    ]);
  });

  it('skips set rows that were never filled in', () => {
    const { exercises } = saved(
      parseManualWorkout(
        makeDraft({
          exercises: [
            { name: 'Back Squat', sets: [row('135', '8'), row('', ''), row('135', '6')] },
          ],
        }),
        NOW
      )
    );

    expect(exercises[0].sets.map((set) => set.reps)).toEqual([8, 6]);
  });

  it('rejects a workout with no exercises', () => {
    expect(failure(parseManualWorkout(makeDraft({ exercises: [] }), NOW))).toBe(
      'Add at least one exercise.'
    );
  });

  it('rejects an exercise without a name', () => {
    expect(
      failure(
        parseManualWorkout(
          makeDraft({ exercises: [{ name: '   ', sets: [row('135', '8')] }] }),
          NOW
        )
      )
    ).toBe('Every exercise needs a name.');
  });

  it('rejects an exercise whose sets are all blank', () => {
    const blank = makeDraft({ exercises: [{ name: 'Back Squat', sets: [row('', '')] }] });
    expect(failure(parseManualWorkout(blank, NOW))).toBe('Back Squat has no sets.');
  });

  it('rejects a set with weight but no reps', () => {
    expect(
      failure(
        parseManualWorkout(
          makeDraft({ exercises: [{ name: 'Back Squat', sets: [row('135', '')] }] }),
          NOW
        )
      )
    ).toBe('Back Squat: set 1 needs reps, as a whole number.');
  });

  it.each([
    ['8.5', 'a fraction'],
    ['0', 'zero'],
    ['-3', 'a negative'],
  ])('rejects reps of %p (%s)', (reps) => {
    expect(
      failure(
        parseManualWorkout(
          makeDraft({ exercises: [{ name: 'Back Squat', sets: [row('135', reps)] }] }),
          NOW
        )
      )
    ).toBe('Back Squat: set 1 needs reps, as a whole number.');
  });

  it('rejects a weight that is not a number', () => {
    expect(
      failure(
        parseManualWorkout(
          makeDraft({ exercises: [{ name: 'Back Squat', sets: [row('heavy', '8')] }] }),
          NOW
        )
      )
    ).toBe('Back Squat: set 1 weight must be a number.');
  });

  it('rejects a duration that is not between 1 and 1440 minutes', () => {
    const message = 'Duration must be between 1 and 1440 minutes.';
    expect(failure(parseManualWorkout(makeDraft({ durationMinutes: '0' }), NOW))).toBe(message);
    expect(failure(parseManualWorkout(makeDraft({ durationMinutes: '1441' }), NOW))).toBe(message);
    expect(failure(parseManualWorkout(makeDraft({ durationMinutes: 'an hour' }), NOW))).toBe(
      message
    );
  });

  it('reports a bad date before any other problem', () => {
    expect(failure(parseManualWorkout(makeDraft({ date: 'nope', exercises: [] }), NOW))).toBe(
      'Enter the date as YYYY-MM-DD.'
    );
  });
});

describe('cardio entries', () => {
  const cardioDraft = (overrides: Partial<ManualCardioDraft> = {}): ManualCardioDraft => ({
    minutes: '30',
    distance: '',
    distanceUnit: 'mi',
    rpe: '',
    ...overrides,
  });
  const cardioWorkout = (cardio: ManualCardioDraft, name = 'Run') =>
    makeDraft({ exercises: [{ name, sets: [], cardio }] });

  it('saves a cardio entry with no sets, in the shape a session writes', () => {
    const { exercises } = saved(parseManualWorkout(cardioWorkout(cardioDraft()), NOW));

    expect(exercises[0]).toMatchObject({
      id: 'cardio-run',
      name: 'Run',
      muscleGroups: [],
      sets: [],
      completed: true,
    });
    expect(exercises[0].cardio).toEqual({ durationSeconds: 1800 });
  });

  it('keeps a typed distance with its unit, and a typed RPE', () => {
    const { exercises } = saved(
      parseManualWorkout(
        cardioWorkout(cardioDraft({ distance: '3.1', distanceUnit: 'km', rpe: '6' })),
        NOW
      )
    );

    expect(exercises[0].cardio).toEqual({
      durationSeconds: 1800,
      distance: 3.1,
      distanceUnit: 'km',
      rpe: 6,
    });
  });

  it('keeps a cardio entry and a strength exercise in one workout', () => {
    const { exercises } = saved(
      parseManualWorkout(
        makeDraft({
          exercises: [
            { name: 'Back Squat', sets: [row('135', '8')] },
            { name: 'Bike', sets: [], cardio: cardioDraft({ minutes: '20' }) },
          ],
        }),
        NOW
      )
    );

    expect(exercises.map((exercise) => exercise.cardio === undefined)).toEqual([true, false]);
    expect(exercises[1]).toMatchObject({ id: 'cardio-bike', cardio: { durationSeconds: 1200 } });
  });

  it('requires minutes', () => {
    expect(failure(parseManualWorkout(cardioWorkout(cardioDraft({ minutes: '' })), NOW))).toBe(
      'Run: minutes must be between 1 and 1440.'
    );
  });

  it.each(['0', 'far'])('rejects a distance of %p', (distance) => {
    expect(failure(parseManualWorkout(cardioWorkout(cardioDraft({ distance })), NOW))).toBe(
      'Run: distance must be a number above zero.'
    );
  });

  it.each(['0', '11', '6.5', 'high'])('rejects an RPE of %p', (rpe) => {
    expect(failure(parseManualWorkout(cardioWorkout(cardioDraft({ rpe })), NOW))).toBe(
      'Run: RPE must be a whole number from 1 to 10.'
    );
  });

  it('still requires a name', () => {
    expect(failure(parseManualWorkout(cardioWorkout(cardioDraft(), '   '), NOW))).toBe(
      'Every exercise needs a name.'
    );
  });
});

describe('suggestExercises', () => {
  it('offers nothing for a blank query', () => {
    expect(suggestExercises('   ')).toEqual([]);
  });

  it('lists names that start with the query before names that only contain it', () => {
    const names = suggestExercises('back').map((exercise) => exercise.name.toLowerCase());
    expect(names[0].startsWith('back')).toBe(true);
  });

  it('leaves out the exact name, since it is already typed', () => {
    expect(suggestExercises('Back Squat').map((exercise) => exercise.name)).not.toContain(
      'Back Squat'
    );
  });

  it('caps the list at the limit', () => {
    expect(suggestExercises('a', 3)).toHaveLength(3);
  });
});
