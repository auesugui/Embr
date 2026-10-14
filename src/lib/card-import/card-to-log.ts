// =============================================================================
// Card to log — a reviewed card becomes a history entry
// =============================================================================
// A card shows only each movement's best set, so each movement becomes one logged
// set. The card's per-movement set counts are checked against its total but not
// stored, because the card does not say what the other sets were. Card weights are
// in lb and are converted when the app is set to kg.
//
// The entry's id comes from the card's contents, so importing the same card again
// adds nothing (workoutHistoryStore.mergeLogs skips ids it already holds).

import type { Exercise, WorkoutLog } from '@/types';
import type { ParsedCard } from './parse-card';

const KG_PER_LB = 0.45359237;

export interface CardLogOptions {
  units: 'lb' | 'kg';
  importedAt: string;
}

export function cardToLog(card: ParsedCard, { units, importedAt }: CardLogOptions): WorkoutLog {
  const [year, month, day] = (card.date ?? '').split('-').map(Number);
  if (!year || !month || !day) throw new Error('A card needs a date before it can be saved.');

  const exercises: Exercise[] = card.rows.map((row) => ({
    id: slug(row.name),
    name: row.name.trim(),
    muscleGroups: [],
    sets: [
      {
        reps: row.reps,
        weight: row.weightLb === null ? null : toUnits(row.weightLb, units),
        logged: true,
        isPR: false,
        isRepPR: false,
      },
    ],
    restSeconds: 0,
    completed: true,
  }));

  return {
    id: `photo_${card.date}_${slug(card.title ?? 'workout')}_${fingerprint(card)}`,
    // Noon in the local timezone, so the card's date is the date shown everywhere.
    timestamp: new Date(year, month - 1, day, 12).toISOString(),
    exercises,
    durationSeconds: (card.durationMin ?? 0) * 60,
    streakDays: 0,
    sessionIntent: 'normal',
    claimedAt: importedAt,
    importedFrom: 'photo',
  };
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Half a kilo is the finest step a person would enter, so weights round to it.
const toUnits = (lb: number, units: 'lb' | 'kg'): number =>
  units === 'kg' ? Math.round(lb * KG_PER_LB * 2) / 2 : lb;

// FNV-1a over the card's contents. Enough to tell two cards apart; not a secret.
function fingerprint(card: ParsedCard): string {
  const text = JSON.stringify([card.rows, card.durationMin, card.volumeLb, card.totalSets]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
