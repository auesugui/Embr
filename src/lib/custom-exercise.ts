// =============================================================================
// Custom exercises — a library entry built from what the user typed
// =============================================================================
// The picker's New Exercise form asks for four things. Everything else an
// ExerciseDefinition carries gets a plain default the template editor can
// change per day, the same way it changes a built-in's sets and reps.

import type { Equipment, ExerciseDefinition, MuscleGroup } from '@/data';
import type { Metric } from '@/types';

export interface CustomExerciseInput {
  name: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  metric: Metric;
}

export type CustomExerciseResult =
  | { ok: true; exercise: ExerciseDefinition }
  | { ok: false; error: string };

const collapseSpaces = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** Search text as an exercise name: "goblet  squat" becomes "Goblet Squat". */
export function toExerciseName(query: string): string {
  return collapseSpaces(query)
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** The exercise with this name, ignoring case and spacing. */
export function findExerciseByName(
  name: string,
  exercises: ExerciseDefinition[]
): ExerciseDefinition | undefined {
  const wanted = collapseSpaces(name).toLowerCase();
  return exercises.find((e) => e.name.toLowerCase() === wanted);
}

// An id never ends in `-<digits>`: a session exercise's id is the library id
// plus `-<position>`, and baseExerciseId strips exactly that. "Wall Sit 2"
// would otherwise lose its own 2 and look up the wrong movement.
function uniqueId(name: string, exercises: ExerciseDefinition[]): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercise';
  const base = /-\d+$/.test(`custom-${slug}`) ? `custom-${slug}-ex` : `custom-${slug}`;
  const taken = new Set(exercises.map((e) => e.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-v${n}`;
  return id;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * True for a saved entry with every field the lookups, picker rows and template
 * defaults read. Used on hydrate, where the data may come from a restored file.
 */
export function isStoredExercise(value: unknown): value is ExerciseDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.startsWith('custom-') &&
    typeof e.name === 'string' &&
    e.name.trim() !== '' &&
    typeof e.primaryMuscle === 'string' &&
    isStringArray(e.muscleGroups) &&
    isStringArray(e.equipment) &&
    typeof e.movementPattern === 'string' &&
    typeof e.defaultSets === 'number' &&
    typeof e.defaultReps === 'string' &&
    typeof e.defaultRestSeconds === 'number' &&
    (e.metric === undefined || e.metric === 'reps' || e.metric === 'time')
  );
}

export function buildCustomExercise(
  input: CustomExerciseInput,
  exercises: ExerciseDefinition[]
): CustomExerciseResult {
  const name = collapseSpaces(input.name);
  if (!name) return { ok: false, error: 'Give the exercise a name.' };

  const existing = findExerciseByName(name, exercises);
  if (existing) return { ok: false, error: `${existing.name} is already in the library.` };

  const timed = input.metric === 'time';
  return {
    ok: true,
    exercise: {
      id: uniqueId(name, exercises),
      name,
      muscleGroups: [input.primaryMuscle],
      primaryMuscle: input.primaryMuscle,
      movementPattern: input.primaryMuscle === 'core' ? 'core' : 'isolation',
      equipment: [input.equipment],
      defaultSets: 3,
      // Seconds for a hold, reps otherwise. See ExerciseDefinition.metric.
      defaultReps: timed ? '30-60' : '8-12',
      defaultRestSeconds: 90,
      isCompound: false,
      ...(timed ? { metric: 'time' as const } : {}),
      fpDistribution: {},
    },
  };
}
