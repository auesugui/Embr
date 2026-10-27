// =============================================================================
// Reconcile — two readings of one photo, with every disagreement flagged
// =============================================================================
// Each photo is read at two preprocessing settings. Where the readings agree, the
// value is taken as read. Where they differ, the first reading is kept and the
// field is flagged, so the person picks the right value before anything is saved.
// Nothing is saved on a guess.
//
// The card's format is not compared: it is read from the card's own shape rather
// than from a value, and there is no field for the person to settle it in.

import type { ParsedCard, ParsedRow } from './parse-card';

export interface Disagreement {
  /** The field the readings disagree on: "date", "rows.2.weightLb", or "rows.2" for a whole row. */
  path: string;
  /** The first reading's value, as shown to the person. */
  first: string;
  /** The second reading's value. */
  second: string;
}

export interface Reading {
  card: ParsedCard;
  disagreements: Disagreement[];
}

const shown = (value: string | number | null): string =>
  value === null || value === '' ? 'nothing' : String(value);

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** One movement in the merged card, and where it came from. */
interface Slot {
  row: ParsedRow;
  from: 'first' | 'second';
  /** The second reading's version of the same movement, when it found one. */
  other?: ParsedRow;
}

export function reconcile(first: ParsedCard, second: ParsedCard): Reading {
  const disagreements: Disagreement[] = [];
  const compare = (path: string, a: string | number | null, b: string | number | null) => {
    if (a !== b) disagreements.push({ path, first: shown(a), second: shown(b) });
  };
  const compareText = (path: string, a: string | null, b: string | null) => {
    const key = (text: string | null) => text?.replace(/\s+/g, '').toLowerCase() ?? null;
    if (key(a) !== key(b)) disagreements.push({ path, first: shown(a), second: shown(b) });
  };

  // Text is compared without case and spacing: "Week 2-Day 1" and "Week 2 - Day 1" are the same subtitle.
  compareText('title', first.title, second.title);
  compareText('subtitle', first.subtitle, second.subtitle);
  compareText('weekDay', first.weekDay, second.weekDay);
  compare('date', first.date, second.date);
  compare('durationMin', first.durationMin, second.durationMin);
  compare('volumeLb', first.volumeLb, second.volumeLb);
  compare('totalSets', first.totalSets, second.totalSets);

  // The first reading's order is the card's order. A movement only the second
  // reading found goes in just after the movement that precedes it in the second
  // reading, so it lands where it sits on the card.
  const slots: Slot[] = first.rows.map((row) => ({
    row: { ...row },
    from: 'first',
    other: second.rows.find((candidate) => sameName(candidate.name, row.name)),
  }));
  second.rows.forEach((row, j) => {
    if (first.rows.some((candidate) => sameName(candidate.name, row.name))) return;
    const previous = j > 0 ? second.rows[j - 1] : null;
    const at = previous ? slots.findIndex((slot) => sameName(slot.row.name, previous.name)) + 1 : 0;
    slots.splice(at, 0, { row: { ...row, id: `s${j}` }, from: 'second' });
  });

  // Flags are numbered after the final order, so each one points at the row it
  // describes.
  const rows: ParsedRow[] = [];
  slots.forEach((slot, i) => {
    rows.push(slot.row);
    if (slot.from === 'second') {
      disagreements.push({ path: `rows.${i}`, first: 'not found', second: slot.row.name });
      return;
    }
    if (!slot.other) {
      disagreements.push({ path: `rows.${i}`, first: slot.row.name, second: 'not found' });
      return;
    }
    compare(`rows.${i}.sets`, slot.row.sets, slot.other.sets);
    compare(`rows.${i}.weightLb`, slot.row.weightLb, slot.other.weightLb);
    compare(`rows.${i}.reps`, slot.row.reps, slot.other.reps);
  });

  return { card: { ...first, rows }, disagreements };
}
