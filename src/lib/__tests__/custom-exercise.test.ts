// =============================================================================
// Custom exercise builder tests
// =============================================================================

import { EXERCISE_DATABASE } from '@/data';
import { describe, expect, it } from '@jest/globals';
import {
  type CustomExerciseInput,
  buildCustomExercise,
  findExerciseByName,
  toExerciseName,
} from '../custom-exercise';

const input = (overrides: Partial<CustomExerciseInput> = {}): CustomExerciseInput => ({
  name: 'Goblet Squat',
  primaryMuscle: 'quads',
  equipment: 'kettlebell',
  metric: 'reps',
  ...overrides,
});

describe('toExerciseName', () => {
  it('capitalizes each word and collapses spaces', () => {
    expect(toExerciseName('  goblet   squat ')).toBe('Goblet Squat');
  });

  it('keeps capitals the user typed', () => {
    expect(toExerciseName('kb RDL')).toBe('Kb RDL');
  });
});

describe('findExerciseByName', () => {
  it('matches ignoring case and spacing', () => {
    const bench = EXERCISE_DATABASE[0];
    expect(findExerciseByName(`  ${bench.name.toUpperCase()} `, EXERCISE_DATABASE)?.id).toBe(
      bench.id
    );
  });

  it('does not match a partial name', () => {
    expect(findExerciseByName('Bench', EXERCISE_DATABASE)).toBeUndefined();
  });
});

describe('buildCustomExercise', () => {
  it('builds a reps exercise with defaults and no metric key', () => {
    const result = buildCustomExercise(input(), EXERCISE_DATABASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exercise).toMatchObject({
      id: 'custom-goblet-squat',
      name: 'Goblet Squat',
      primaryMuscle: 'quads',
      muscleGroups: ['quads'],
      equipment: ['kettlebell'],
      defaultSets: 3,
      defaultReps: '8-12',
    });
    expect(result.exercise).not.toHaveProperty('metric');
  });

  it('builds a held exercise in seconds', () => {
    const result = buildCustomExercise(input({ name: 'Wall Sit', metric: 'time' }), []);
    expect(result.ok && result.exercise.metric).toBe('time');
    expect(result.ok && result.exercise.defaultReps).toBe('30-60');
  });

  it('refuses a blank name', () => {
    expect(buildCustomExercise(input({ name: '   ' }), [])).toEqual({
      ok: false,
      error: 'Give the exercise a name.',
    });
  });

  it('refuses a name already in the library', () => {
    const bench = EXERCISE_DATABASE[0];
    const result = buildCustomExercise(
      input({ name: bench.name.toLowerCase() }),
      EXERCISE_DATABASE
    );
    expect(result).toEqual({ ok: false, error: `${bench.name} is already in the library.` });
  });

  it('gives a fresh id when the slug is taken', () => {
    const first = buildCustomExercise(input(), []);
    if (!first.ok) throw new Error('expected ok');
    const renamed = { ...first.exercise, name: 'Something Else' };
    const second = buildCustomExercise(input(), [renamed]);
    expect(second.ok && second.exercise.id).toBe('custom-goblet-squat-2');
  });

  it('falls back to a generic slug for a name with no letters or digits', () => {
    const result = buildCustomExercise(input({ name: '???' }), []);
    expect(result.ok && result.exercise.id).toBe('custom-exercise');
  });
});
