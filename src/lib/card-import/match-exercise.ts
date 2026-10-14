// =============================================================================
// Match a card's movement to a library exercise
// =============================================================================
// A copied workout points at exercises in the library, so each movement on the card
// has to be matched to one. Only a clear match is made automatically. A movement the
// library cannot name clearly is left for the person to choose, or to skip, rather
// than being guessed at.

import { EXERCISE_DATABASE } from '@/data';

/**
 * The words a movement is compared by: lowercase, punctuation dropped, "dumbbell"
 * written as "db", and the words sorted. So "Bent Over Row (Dumbbell)" and
 * "DB Bent-Over Row" are the same movement, while "Overhead Press" and
 * "DB Overhead Press" stay apart.
 */
export function movementKey(name: string): string {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
    .map((word) => (word === 'dumbbell' ? 'db' : word));
  return [...new Set(words)].sort().join(' ');
}

const LIBRARY_BY_KEY = new Map(
  EXERCISE_DATABASE.map((exercise): [string, string] => [movementKey(exercise.name), exercise.id])
);

/**
 * Card names that are a library movement under a different name: a singular where the
 * library has a plural, or a short name where the library has the full one. Each is
 * a clear match, so each is listed here rather than left to the person to choose.
 */
const CARD_ALIASES = new Map<string, string>(
  (
    [
      ['Pull-Up', 'pull_ups'],
      ['Pull-Up (Bodyweight)', 'pull_ups'],
      ['Reverse Fly', 'bent_over_db_reverse_fly'],
      ['Lateral Raise', 'lateral_raises'],
      ['Shrug (Dumbbell)', 'db_shrugs'],
    ] as const
  ).map(([cardName, exerciseId]): [string, string] => [movementKey(cardName), exerciseId])
);

/**
 * The library exercise a movement on the card clearly is, or undefined when there is
 * no clear match. Undefined is a choice for the person, not an error.
 */
export function matchExercise(cardName: string): string | undefined {
  const key = movementKey(cardName);
  return LIBRARY_BY_KEY.get(key) ?? CARD_ALIASES.get(key);
}
