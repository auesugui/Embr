// =============================================================================
// Match a card's movement to a library exercise
// =============================================================================
// A movement is matched only when the library clearly has it. Anything less is left
// for the person to choose, so these tests pin both the matches and the refusals.

import { EXERCISE_DATABASE, setCustomExercises } from '@/data';
import { afterEach, describe, expect, it } from '@jest/globals';
import { autoMatch, matchExercise, movementKey } from '../card-import/match-exercise';

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

  it('matches the kettlebell movements on the Boostcamp cards', () => {
    expect(matchExercise('Kettlebell Swing')).toBe('kettlebell_swing');
    expect(matchExercise('Single Arm Kettlebell Swing')).toBe('single_arm_kettlebell_swing');
    expect(matchExercise('Kettlebell Halo')).toBe('kettlebell_halo');
    expect(matchExercise('Snatch (Kettlebell)')).toBe('kettlebell_snatch');
    expect(matchExercise('Kettlebell Clean and Press')).toBe('kettlebell_clean_and_press');
    expect(matchExercise('Bent Over Row (Kettlebell)')).toBe('kettlebell_bent_over_row');
  });

  it('leaves a movement with no clear match for the person to choose', () => {
    expect(matchExercise('Chest Press (Dumbbell)')).toBeUndefined();
    expect(matchExercise('Incline Chest Fly (Dumbbell)')).toBeUndefined();
  });

  it('keeps a barbell movement apart from its dumbbell version', () => {
    expect(matchExercise('Overhead Press')).toBe('overhead_press');
    expect(matchExercise('DB Overhead Press')).toBe('db_overhead_press');
  });

  it('matches a plan card movement the library names with its equipment', () => {
    expect(matchExercise('Goblet Squat')).toBe('db_goblet_squat');
    expect(matchExercise('Standing Calf Raise')).toBe('db_standing_calf_raise');
  });

  it('matches across a plural the library writes and the card does not', () => {
    expect(matchExercise('Lunge (Dumbbell)')).toBe('db_lunges');
    expect(matchExercise('Pull-Up')).toBe('pull_ups');
  });

  it('lets an equipment hint pick between the versions of one movement', () => {
    // The library has Shrugs and DB Shrugs, so the card's "(Dumbbell)" is the difference.
    expect(matchExercise('Shrug (Dumbbell)')).toBe('db_shrugs');
    expect(matchExercise('Shrug')).toBeUndefined();
  });

  it('refuses the only candidate when the card says other equipment', () => {
    // Bodyweight Squat is the only movement that reads as "Squat", and it is not a barbell one.
    expect(matchExercise('Squat (Barbell)')).toBeUndefined();
    expect(matchExercise('Squat (Bodyweight)')).toBe('bodyweight_squat');
    // Pull-ups carries no equipment word in its name, only in what the library records.
    expect(matchExercise('Pull-Up (Bodyweight)')).toBe('pull_ups');
    expect(matchExercise('Pull-Up (Machine)')).toBeUndefined();
  });

  it('refuses a hint that fits none of several candidates', () => {
    // Shrugs is barbell or dumbbell, DB Shrugs is dumbbell. Neither is a cable movement.
    expect(matchExercise('Shrug (Cable)')).toBeUndefined();
  });

  it('matches an exercise the person created, as the picker lists it', () => {
    setCustomExercises([
      {
        id: 'custom_sled_push',
        name: 'Sled Push',
        muscleGroups: ['quads'],
        primaryMuscle: 'quads',
        movementPattern: 'lunge',
        equipment: ['machine'],
        defaultSets: 3,
        defaultReps: '10',
        defaultRestSeconds: 90,
        isCompound: true,
        fpDistribution: { power: 1 },
      },
    ]);

    expect(matchExercise('Sled Push (Machine)')).toBe('custom_sled_push');
    expect(matchExercise('Sled Push')).toBe('custom_sled_push');
    expect(matchExercise('Sled Push (Barbell)')).toBeUndefined();
  });
});

afterEach(() => setCustomExercises([]));

describe('autoMatch', () => {
  it('never matches a name the card cut off, however well what is left reads', () => {
    expect(matchExercise('Hanging Leg Raise...')).toBe('hanging_leg_raise');
    expect(autoMatch('Hanging Leg Raise...')).toBeUndefined();
    expect(autoMatch('Pull-Up…')).toBeUndefined();
    expect(autoMatch('Single Leg Romanian Deadlift (Dumbb...')).toBeUndefined();
  });

  it('matches once the name is whole again, the way the library would', () => {
    expect(autoMatch('Hanging Leg Raise')).toBe('hanging_leg_raise');
    expect(autoMatch('Lunge (Dumbbell)')).toBe('db_lunges');
  });

  it('leaves a cut-off name the library does not have unmatched either', () => {
    expect(autoMatch('Single Leg Romanian Deadlift (Dumbb…')).toBeUndefined();
    expect(autoMatch('Chest Press (Dumbbell)')).toBeUndefined();
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
