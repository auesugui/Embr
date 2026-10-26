// =============================================================================
// Match a card's movement to a library exercise
// =============================================================================
// A copied workout points at exercises in the library, so each movement on the card
// has to be matched to one. Only a clear match is made automatically. A movement the
// library cannot name clearly is left for the person to choose, or to skip, rather
// than being guessed at.

import { allExercises } from '@/data';

const EQUIPMENT = /^(dumbbells?|db|barbells?|bb|kettlebells?|kb|cables?|machines?|bodyweight|bw)$/;

const words = (name: string): string[] =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');

/**
 * The words a movement is compared by: lowercase, punctuation dropped, "dumbbell"
 * written as "db", and the words sorted. So "Bent Over Row (Dumbbell)" and
 * "DB Bent-Over Row" are the same movement, while "Overhead Press" and
 * "DB Overhead Press" stay apart.
 */
export function movementKey(name: string): string {
  return [...new Set(words(name).map((word) => (word === 'dumbbell' ? 'db' : word)))]
    .sort()
    .join(' ');
}

/**
 * The same movement with the equipment and the plurals taken out, so "Lunge
 * (Dumbbell)", "DB Lunges" and "Lunge" all read as one movement. It is only ever
 * used to find candidates, never to pick between them.
 */
function baseKey(name: string): string {
  return [
    ...new Set(
      words(name)
        .filter((word) => !EQUIPMENT.test(word))
        .map((word) => word.replace(/s$/, ''))
    ),
  ]
    .sort()
    .join(' ');
}

/** The equipment a name names, from the words the base key drops. */
const equipmentIn = (name: string): string[] =>
  words(name)
    .filter((word) => EQUIPMENT.test(word))
    .map((word) => (word.startsWith('d') ? 'db' : word.replace(/s$/, '')));

/**
 * Card names the rule below cannot reach, because the library calls the movement
 * something else: a word the card does not use at all. Each is a clear match, so
 * each is listed here rather than left to the person to choose.
 */
const CARD_ALIASES = new Map<string, string>(
  ([['Reverse Fly', 'bent_over_db_reverse_fly']] as const).map(
    ([cardName, exerciseId]): [string, string] => [movementKey(cardName), exerciseId]
  )
);

/**
 * The library exercise a movement on the card clearly is, or undefined when there is
 * no clear match. Undefined is a choice for the person, not an error.
 *
 * The name as the library writes it wins first, so "Overhead Press" stays the barbell
 * one. Failing that, the movement is compared without its equipment and its plurals,
 * and only one candidate counts as clear. Where several fit, an equipment hint on the
 * card — "Shrug (Dumbbell)" — picks between them; without one the person chooses.
 */
export function matchExercise(cardName: string): string | undefined {
  const key = movementKey(cardName);
  const base = baseKey(cardName);
  // The picker's library, so an exercise the person created is matchable too.
  const library = allExercises();

  const exact = library.find((exercise) => movementKey(exercise.name) === key);
  if (exact) return exact.id;

  const alias = CARD_ALIASES.get(key);
  if (alias) return alias;

  const candidates = library.filter((exercise) => baseKey(exercise.name) === base);
  if (candidates.length === 1) return candidates[0].id;

  const hint = equipmentIn(cardName);
  if (candidates.length > 1 && hint.length > 0) {
    const fitting = candidates.filter((exercise) =>
      hint.every((word) => equipmentIn(exercise.name).includes(word))
    );
    if (fitting.length === 1) return fitting[0].id;
  }

  return undefined;
}
