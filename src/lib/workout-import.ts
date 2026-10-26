// =============================================================================
// Workout import — add logged workouts from a file, keep everything else
// =============================================================================
// Restore (backup.ts) overwrites every key it carries, so it cannot add one
// workout to a history that already holds others. This is the additive path:
// read the workout history out of a backup-format file. Merging the result into
// the history is workout-merge.ts. Only the history is touched: PRs, weight
// history and the baseline are not reconstructed from an imported workout.

import { BackupParseError, parseBackup } from '@/lib/backup';
import { BLOCK_MODES } from '@/lib/blocks';
import type { BlockMode, WeightUnit, WorkoutBlock, WorkoutLog } from '@/types';
import { STORAGE_KEYS } from '@/utils/storage';

export interface WorkoutImport {
  logs: WorkoutLog[];
  /** Entries in the file that were malformed and could not be read. */
  skipped: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// Checks only what the history screen and the summary read. Everything else on
// a log is passed through untouched, so legacy fields and fields from a newer
// build survive the trip the same way they do through a backup.
const isLoggedSet = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.logged === 'boolean' &&
  (value.reps === null || isFiniteNumber(value.reps)) &&
  (value.weight === null || isFiniteNumber(value.weight));

const isExercise = (value: unknown): boolean =>
  isRecord(value) &&
  isNonEmptyString(value.id) &&
  typeof value.name === 'string' &&
  Array.isArray(value.muscleGroups) &&
  Array.isArray(value.sets) &&
  value.sets.every(isLoggedSet);

const isBlock = (value: unknown): value is WorkoutBlock =>
  isRecord(value) &&
  isNonEmptyString(value.id) &&
  typeof value.mode === 'string' &&
  (BLOCK_MODES as string[]).includes(value.mode as BlockMode);

// A unit we don't recognise is dropped rather than failing the whole entry:
// it's optional, no reader depends on it, and the workout itself is the part
// that cannot be reconstructed (#85).
const readWeightUnit = (value: unknown): WeightUnit | undefined =>
  value === 'lb' || value === 'kg' ? value : undefined;

const isWorkoutLog = (value: unknown): value is WorkoutLog => {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) {
    return false;
  }
  if (!isFiniteNumber(value.durationSeconds) || !isFiniteNumber(value.streakDays)) return false;
  if (typeof value.sessionIntent !== 'string') return false;
  if (value.claimedAt !== undefined && value.claimedAt !== null) {
    if (typeof value.claimedAt !== 'string') return false;
  }
  if (!Array.isArray(value.exercises) || !value.exercises.every(isExercise)) return false;
  if (value.blocks !== undefined && !(Array.isArray(value.blocks) && value.blocks.every(isBlock))) {
    return false;
  }
  if (
    value.blockTimes !== undefined &&
    !(isRecord(value.blockTimes) && Object.values(value.blockTimes).every(isFiniteNumber))
  ) {
    return false;
  }
  return true;
};

/**
 * Read the workouts out of a backup-format file.
 *
 * Throws `BackupParseError` with a message fit to show the user when the file
 * is not a backup, carries no workout history, or holds no readable workouts.
 * A file with some good and some malformed entries returns the good ones and
 * counts the rest.
 */
export function parseWorkoutImport(text: string): WorkoutImport {
  const backup = parseBackup(text);

  const raw = backup.data[STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE];
  if (raw === undefined) {
    throw new BackupParseError('That file has no workout history in it.');
  }

  let history: unknown;
  try {
    history = JSON.parse(raw);
  } catch {
    throw new BackupParseError("That file's workout history is damaged.");
  }
  if (!isRecord(history) || !Array.isArray(history.logs)) {
    throw new BackupParseError("That file's workout history is damaged.");
  }

  const entries: unknown[] = history.logs;
  if (entries.length === 0) {
    throw new BackupParseError('That file has no workouts in it.');
  }

  const logs = entries.filter(isWorkoutLog).map(({ weightUnit, ...log }) => {
    const unit = readWeightUnit(weightUnit);
    return { ...log, claimedAt: log.claimedAt ?? null, ...(unit ? { weightUnit: unit } : {}) };
  });
  if (logs.length === 0) {
    throw new BackupParseError('None of the workouts in that file could be read.');
  }

  return { logs, skipped: entries.length - logs.length };
}
