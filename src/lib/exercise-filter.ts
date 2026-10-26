// =============================================================================
// exercise-filter — what the picker shows, and what it says when it shows none
// =============================================================================
// The picker's Recent row and its chips (issue #83). Nothing new is persisted:
// recents are read back out of saved workouts, the same slice Last time and
// Progress read, and the chips filter on `primaryMuscle` and `equipment`,
// which the library already carries on every entry, custom ones included.
//
// HOW THE FILTERS COMBINE. AND across kinds, OR inside equipment: chest AND
// "press" AND (barbell OR dumbbell). An exercise has one `primaryMuscle`, so
// muscle is single-select — two muscles at once would always return nothing.
//
// WHAT IS RECENT. Distinct movements from claimed workouts, newest workout
// first, matched on the base exercise id so a session's positional suffix and
// the Powerbuilding heavy/back-off pair collapse to one movement. Inside one
// workout the order is the order you trained them: a log carries a single
// timestamp, so there is nothing finer to sort by, and the main lift reads
// ahead of the cooldown accessory. `isPerformedSet` decides what counts, so a
// row you opened and never filled is not a movement you did.

import { type Equipment, type ExerciseDefinition, type MuscleGroup, searchExercises } from '@/data';
import { isPerformedSet } from '@/lib/exercise-progress';
import { getClaimedLogs } from '@/lib/history-stats';
import { baseExerciseId } from '@/lib/metric';
import type { WorkoutLog } from '@/types';

/** Cards in the Recent row. The sixth peeks past the edge, so the row reads as scrollable. */
export const RECENT_LIMIT = 6;

/** The equipment the sheet offers, in the order it lists them. */
export const FILTER_EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
];

/** Library order — the `MuscleGroup` union's own order in `src/data/exercises.ts`. */
const MUSCLE_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'traps',
];

export interface ExerciseFilter {
  muscle: MuscleGroup | null;
  equipment: Equipment[];
  /** The search text, already trimmed. */
  query: string;
}

export const NO_FILTER: ExerciseFilter = { muscle: null, equipment: [], query: '' };

/**
 * The muscle chips, in library order. Only muscles something is filed under:
 * a chip that can never return a row is a filter that only ever disappoints.
 */
export function filterMuscles(exercises: ExerciseDefinition[]): MuscleGroup[] {
  const present = new Set(exercises.map((e) => e.primaryMuscle));
  return MUSCLE_ORDER.filter((muscle) => present.has(muscle));
}

/** A chip is on. The search text is not a chip — Clear filters never throws typing away. */
export function hasChips(filter: ExerciseFilter): boolean {
  return filter.muscle !== null || filter.equipment.length > 0;
}

/** Anything is narrowing the list, which is what hides Recent. */
export function isNarrowed(filter: ExerciseFilter): boolean {
  return hasChips(filter) || filter.query !== '';
}

/** The chips alone: muscle AND any of the selected equipment. */
export function matchesChips(exercise: ExerciseDefinition, filter: ExerciseFilter): boolean {
  if (filter.muscle !== null && exercise.primaryMuscle !== filter.muscle) return false;
  if (filter.equipment.length === 0) return true;
  return exercise.equipment.some((item) => filter.equipment.includes(item));
}

/** The list the picker shows: search text, then chips, then the ids it was told to hide. */
export function filterExercises(
  filter: ExerciseFilter,
  excludeIds: Set<string>
): ExerciseDefinition[] {
  return searchExercises(filter.query).filter(
    (exercise) => !excludeIds.has(exercise.id) && matchesChips(exercise, filter)
  );
}

/**
 * The last movements you performed that you can still pick, newest first.
 * `library` is what the picker can show; an exercise deleted from it drops out.
 */
export function recentExercises(args: {
  logs: WorkoutLog[];
  library: ExerciseDefinition[];
  excludeIds: Set<string>;
  limit?: number;
}): ExerciseDefinition[] {
  const { logs, library, excludeIds, limit = RECENT_LIMIT } = args;
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
  const seen = new Set<string>();
  const recent: ExerciseDefinition[] = [];

  for (const log of getClaimedLogs(logs)) {
    for (const entry of log.exercises) {
      if (entry.cardio) continue;
      // An entry with nothing logged in it is not a movement you did, so an
      // older workout that does carry it still names it recent.
      if (!entry.sets.some(isPerformedSet)) continue;

      const id = baseExerciseId(entry.id);
      if (seen.has(id)) continue;
      seen.add(id);

      const exercise = byId.get(id);
      if (!exercise || excludeIds.has(id)) continue;

      recent.push(exercise);
      if (recent.length === limit) return recent;
    }
  }

  return recent;
}

// -----------------------------------------------------------------------------
// Copy
// -----------------------------------------------------------------------------

/** `Show 1 exercise` / `Show 12 exercises` — the Equipment sheet's Done button. */
export function showCountLabel(count: number): string {
  return `Show ${count} exercise${count === 1 ? '' : 's'}`;
}

const equipmentPhrase = (item: Equipment): string =>
  item === 'bodyweight' ? 'bodyweight' : `a ${item}`;

export interface EmptyPicker {
  line: string;
  /** The second line, where the headline is not the whole answer. */
  hint: string | null;
  /** Whether Clear filters has anything to clear. */
  canClear: boolean;
}

/**
 * What an empty list says. Three different answers: the chips are too narrow,
 * the typed name is new, or the typed name exists and the chips are hiding it.
 * The third is the one that would otherwise sell you a duplicate.
 *
 * `named` is the library exercise the search text names exactly, if there is
 * one — the same lookup the create offer is decided by.
 */
export function describeEmptyPicker(args: {
  filter: ExerciseFilter;
  named: ExerciseDefinition | undefined;
}): EmptyPicker {
  const { filter, named } = args;
  const canClear = hasChips(filter);

  if (named) {
    const failing: string[] = [];
    if (filter.muscle !== null && named.primaryMuscle !== filter.muscle)
      failing.push(filter.muscle);
    if (!matchesChips(named, { ...filter, muscle: null })) failing.push(filter.equipment.join('/'));

    // Nothing on screen is hiding it, so it is one of the ids the picker was
    // told to leave out — already in the day it is being added to.
    if (failing.length === 0) {
      return { line: `${named.name} is already in this day.`, hint: null, canClear };
    }

    const filters = failing.length === 1 ? 'filter is' : 'filters are';
    return {
      line: `${named.name} is in your library. Your ${failing.join(' and ')} ${filters} hiding it.`,
      hint: null,
      canClear,
    };
  }

  if (!isNarrowed(filter)) {
    return { line: 'No exercises left to add.', hint: null, canClear };
  }

  const subject = filter.muscle ? `No ${filter.muscle} exercise` : 'No exercise';
  const name = filter.query ? ` named “${filter.query}”` : '';
  const uses = filter.equipment.length
    ? ` uses ${filter.equipment.map(equipmentPhrase).join(' or ')}`
    : '';

  return {
    line: `${subject}${name}${uses}.`,
    hint: canClear ? 'Drop one filter and the list comes back.' : null,
    canClear,
  };
}
