// =============================================================================
// Match a card's movement to a library exercise
// =============================================================================
// A movement is matched only when the library clearly has it. Anything less is left
// for the person to choose, so these tests pin both the matches and the refusals.

import { EXERCISE_DATABASE } from '@/data';
import { describe, expect, it } from '@jest/globals';
import { matchExercise, movementKey } from '../card-import/match-exercise';

describe('matchExercise', () => {
  it('matches a movement the card names the way the library does', () => {
    expect(matchExercise('Hanging Leg Raise')).toBe('hanging_leg_raise');
    expect(matchExercise('Bent Over Row (Dumbbell)')).toBe('db_bent_over_row');
    expect(matchExercise('Dumbbell Shoulder Press')).toBe('dumbbell_shoulder_press');
  });

  it('matches a movement the card names differently where the library has a clear equivalent', () => {
    expect(matchExercise('Pull-Up (Bodyweight)')).toBe('pull_ups');
    expect(matchExercise('Reverse Fly')).toBe('bent_over_db_reverse_fly');
    expect(matchExercise('Lateral Raise')).toBe('lateral_raises');
    expect(matchExercise('Shrug (Dumbbell)')).toBe('db_shrugs');
  });

  it('leaves a movement with no clear match for the person to choose', () => {
    expect(matchExercise('Kettlebell Swing')).toBeUndefined();
    expect(matchExercise('Chest Press (Dumbbell)')).toBeUndefined();
    expect(matchExercise('Incline Chest Fly (Dumbbell)')).toBeUndefined();
  });

  it('keeps a barbell movement apart from its dumbbell version', () => {
    expect(matchExercise('Overhead Press')).toBe('overhead_press');
    expect(matchExercise('DB Overhead Press')).toBe('db_overhead_press');
  });
});

describe('movementKey', () => {
  it('reads the same movement whatever the order of its words and however the equipment is written', () => {
    expect(movementKey('DB Bent-Over Row')).toBe(movementKey('Bent Over Row (Dumbbell)'));
  });

  it('gives every library exercise its own key, so no two can be confused', () => {
    const keys = EXERCISE_DATABASE.map((exercise) => movementKey(exercise.name));

    expect(new Set(keys).size).toBe(keys.length);
  });
});
