// =============================================================================
// Match a card's movement to a library exercise
// =============================================================================
// A copied workout points at exercises in the library, so each movement on the card
// has to be matched to one. Only a clear match is made automatically. A movement the
// library cannot name clearly is left for the person to choose, or to skip, rather
// than being guessed at.

import { type Equipment, type ExerciseDefinition, allExercises } from '@/data';
import { isCutOffName } from './parse-card';

/** Every way a card or a library name writes a piece of equipment. */
const EQUIPMENT_WORDS: Record<string, Equipment> = {
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  db: 'dumbbell',
  barbell: 'barbell',
  barbells: 'barbell',
  bb: 'barbell',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  kb: 'kettlebell',
  cable: 'cable',
  cables: 'cable',
  machine: 'machine',
  machines: 'machine',
  bodyweight: 'bodyweight',
  bw: 'bodyweight',
  band: 'band',
  bands: 'band',
};

const EQUIPMENT = new RegExp(`^(${Object.keys(EQUIPMENT_WORDS).join('|')})$`);

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
const equipmentIn = (name: string): Equipment[] =>
  words(name).flatMap((word) => (word in EQUIPMENT_WORDS ? [EQUIPMENT_WORDS[word]] : []));

/**
 * The equipment an exercise can be done with: what the library records, plus what its
 * own name says. "Pull-ups" names none and is recorded as bodyweight; "DB Shrugs" says
 * dumbbell in both places.
 */
const equipmentOf = (exercise: ExerciseDefinition): Equipment[] => [
  ...exercise.equipment,
  ...equipmentIn(exercise.name),
];

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
 * one. Failing that, the movement is compared without its equipment and its plurals.
 *
 * An equipment hint on the card — "Squat (Barbell)" — has to agree with the candidate
 * before it can be a match, so a hint the only candidate contradicts leaves the
 * movement for the person rather than matching it anyway. Where the hint agrees with
 * several, the one that carries it in its own name wins ("Shrug (Dumbbell)" is
 * DB Shrugs, not Shrugs). Without a hint nothing is checked, and only a single
 * candidate is clear.
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

  const hint = equipmentIn(cardName);
  const candidates = library
    .filter((exercise) => baseKey(exercise.name) === base)
    .filter((exercise) => hint.every((piece) => equipmentOf(exercise).includes(piece)));
  if (candidates.length === 1) return candidates[0].id;

  if (candidates.length > 1 && hint.length > 0) {
    const named = candidates.filter((exercise) =>
      hint.every((piece) => equipmentIn(exercise.name).includes(piece))
    );
    if (named.length === 1) return named[0].id;
  }

  return undefined;
}

/**
 * The match the review screen makes for the person, rather than the one the library
 * can make. A name Boostcamp cut off is never one of them, however well what is left
 * of it reads: "Hanging Leg Raise (Dumbb…" is not Hanging Leg Raise, and the rest of
 * the name is not in the photo to tell them apart. Those stay for the person to choose
 * or to skip, which is what the row asks them to do.
 */
export function autoMatch(cardName: string): string | undefined {
  return isCutOffName(cardName) ? undefined : matchExercise(cardName);
}
