// =============================================================================
// Embr Manual Workout — reads a typed-in workout into the saved-log shape
// =============================================================================
// Pure: no store, no React. The add-workout screen passes the strings it
// collected; this decides what they mean. The result is the same Exercise and
// LoggedSet shape a live session writes, so history and backups read both alike.

import { EXERCISE_DATABASE, type ExerciseDefinition } from '@/data';
import type { CardioDetail, DistanceUnit, Exercise, LoggedSet } from '@/types';

import { localDayKey } from './local-day';

export interface ManualSetDraft {
  weight: string;
  reps: string;
}

export interface ManualCardioDraft {
  /** Minutes as typed. Required. */
  minutes: string;
  /** Distance as typed. Blank means none was recorded. */
  distance: string;
  distanceUnit: DistanceUnit;
  /** Rate of perceived exertion as typed. Blank means none was recorded. */
  rpe: string;
}

export interface ManualExerciseDraft {
  name: string;
  /** Strength sets. Ignored when `cardio` is set. */
  sets: ManualSetDraft[];
  /** Present on a cardio entry, which has no sets. */
  cardio?: ManualCardioDraft;
}

export interface ManualWorkoutDraft {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes as typed. Blank means the duration was not recorded. */
  durationMinutes: string;
  exercises: ManualExerciseDraft[];
}

export type ManualWorkoutResult =
  | { ok: true; timestamp: string; durationSeconds: number; exercises: Exercise[] }
  | { ok: false; error: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_DURATION_MINUTES = 24 * 60;
const SUGGESTION_LIMIT = 5;

/** The local calendar date as YYYY-MM-DD. */
export const todayIsoDate = (now: Date): string => localDayKey(now);

/**
 * Reads a typed date into the timestamp the log is stored under.
 *
 * Today keeps the current time, so it sorts after earlier workouts that day.
 * Any other date is stored at local noon, far enough from midnight that no
 * timezone can move it onto the neighboring day when history reads it back.
 */
export function parseWorkoutDate(input: string, now: Date): Result<string> {
  const match = DATE_PATTERN.exec(input.trim());
  if (!match) return { ok: false, error: 'Enter the date as YYYY-MM-DD.' };

  const [key, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { ok: false, error: 'That date doesn’t exist.' };
  }

  const today = todayIsoDate(now);
  if (key > today) return { ok: false, error: 'That date is in the future.' };
  if (key === today) return { ok: true, value: now.toISOString() };
  return { ok: true, value: date.toISOString() };
}

function parseDurationSeconds(input: string): Result<number> {
  const text = input.trim();
  if (text === '') return { ok: true, value: 0 };

  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_DURATION_MINUTES) {
    return { ok: false, error: `Duration must be between 1 and ${MAX_DURATION_MINUTES} minutes.` };
  }
  return { ok: true, value: Math.round(minutes * 60) };
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * A typed name that matches the catalog takes the catalog's id, so the log
 * lines up with seeded exercises. Any other name gets a stable id from its text.
 */
function identifyExercise(name: string): Pick<Exercise, 'id' | 'name' | 'muscleGroups'> {
  const known = EXERCISE_DATABASE.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (known) return { id: known.id, name: known.name, muscleGroups: [...known.muscleGroups] };
  return { id: `custom-${slugify(name)}`, name, muscleGroups: [] };
}

/**
 * Cardio needs minutes. Distance and RPE are optional, but if typed they must be
 * valid, so a bad value is never silently dropped.
 */
function buildCardio(name: string, fields: ManualCardioDraft): Result<Exercise> {
  const minutes = Number(fields.minutes.trim());
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_DURATION_MINUTES) {
    return { ok: false, error: `${name}: minutes must be between 1 and ${MAX_DURATION_MINUTES}.` };
  }

  const cardio: CardioDetail = { durationSeconds: Math.round(minutes * 60) };

  const distanceText = fields.distance.trim();
  if (distanceText !== '') {
    const distance = Number(distanceText);
    if (!Number.isFinite(distance) || distance <= 0) {
      return { ok: false, error: `${name}: distance must be a number above zero.` };
    }
    cardio.distance = distance;
    cardio.distanceUnit = fields.distanceUnit;
  }

  const rpeText = fields.rpe.trim();
  if (rpeText !== '') {
    const rpe = Number(rpeText);
    if (!/^\d+$/.test(rpeText) || rpe < 1 || rpe > 10) {
      return { ok: false, error: `${name}: RPE must be a whole number from 1 to 10.` };
    }
    cardio.rpe = rpe;
  }

  return {
    ok: true,
    value: {
      id: `cardio-${slugify(name)}`,
      name,
      muscleGroups: [],
      sets: [],
      restSeconds: 0,
      completed: true,
      cardio,
    },
  };
}

/**
 * Rows the user never filled in are skipped. A row with only one of weight or
 * reps is an error, because it is either a typo or a set that was started and
 * left behind, and guessing which would save the wrong number.
 */
function buildExercise(draft: ManualExerciseDraft): Result<Exercise> {
  const name = normalizeName(draft.name);
  if (name === '') return { ok: false, error: 'Every exercise needs a name.' };
  if (draft.cardio) return buildCardio(name, draft.cardio);

  const sets: LoggedSet[] = [];
  for (let index = 0; index < draft.sets.length; index++) {
    const weightText = draft.sets[index].weight.trim();
    const repsText = draft.sets[index].reps.trim();
    if (weightText === '' && repsText === '') continue;

    const reps = Number(repsText);
    if (!/^\d+$/.test(repsText) || reps < 1) {
      return { ok: false, error: `${name}: set ${index + 1} needs reps, as a whole number.` };
    }

    // Blank weight is bodyweight. History already reads a zero or missing
    // weight as "N reps", so both are stored the same way.
    const weight = weightText === '' ? null : Number(weightText);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
      return { ok: false, error: `${name}: set ${index + 1} weight must be a number.` };
    }

    sets.push({ reps, weight, logged: true, isPR: false, isRepPR: false });
  }

  if (sets.length === 0) return { ok: false, error: `${name} has no sets.` };

  return {
    ok: true,
    value: { ...identifyExercise(name), sets, restSeconds: 0, completed: true },
  };
}

/** Validates a whole typed workout. The first problem found is the one returned. */
export function parseManualWorkout(draft: ManualWorkoutDraft, now: Date): ManualWorkoutResult {
  const date = parseWorkoutDate(draft.date, now);
  if (!date.ok) return date;

  const duration = parseDurationSeconds(draft.durationMinutes);
  if (!duration.ok) return duration;

  if (draft.exercises.length === 0) return { ok: false, error: 'Add at least one exercise.' };

  const exercises: Exercise[] = [];
  for (const exerciseDraft of draft.exercises) {
    const exercise = buildExercise(exerciseDraft);
    if (!exercise.ok) return exercise;
    exercises.push(exercise.value);
  }

  return { ok: true, timestamp: date.value, durationSeconds: duration.value, exercises };
}

/**
 * Catalog exercises to offer while a name is typed. Names that start with the
 * query come first. An exact match is left out, since it is already typed.
 */
export function suggestExercises(query: string, limit = SUGGESTION_LIMIT): ExerciseDefinition[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const prefixed: ExerciseDefinition[] = [];
  const contained: ExerciseDefinition[] = [];
  for (const exercise of EXERCISE_DATABASE) {
    const name = exercise.name.toLowerCase();
    if (name === needle) continue;
    if (name.startsWith(needle)) prefixed.push(exercise);
    else if (name.includes(needle)) contained.push(exercise);
  }
  return [...prefixed, ...contained].slice(0, limit);
}
