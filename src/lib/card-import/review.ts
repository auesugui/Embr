// =============================================================================
// Review edits — changing a reading while the person checks it
// =============================================================================
// The review screen edits a Reading in place: typing a value, choosing one of two
// flagged readings, keeping or dropping a movement. Each edit is a pure function
// over a Reading, so the rules live in one place and are tested without a screen.
//
// A flag is cleared the moment its field is set, whichever reading the value came
// from. Text that does not parse for its field is ignored, so a number field never
// holds something that is not a number. The two free-text fields, the movement name
// and its reps, keep what is typed: both are reached through text that is not valid
// yet, and both are checked again before anything is copied.

import { missingValues, readSets } from './parse-card';
import type { Reading } from './reconcile';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-07" becomes "Oct 7, 2026", the way the card shows it. */
export function formatCardDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * Sets the field at `path` from text the person typed or chose ("nothing" means
 * no value), and clears the flag on that field.
 */
export function setField(reading: Reading, path: string, text: string): Reading {
  const card = { ...reading.card, rows: reading.card.rows.map((row) => ({ ...row })) };
  const trimmed = text.trim();
  const absent = trimmed === '' || trimmed === 'nothing';
  const number = Number(trimmed.replace(/,/g, ''));

  const movement = path.match(/^rows\.(\d+)\.(name|sets|weightLb|reps)$/);
  if (movement) {
    const row = card.rows[Number(movement[1])];
    if (!row) return reading;
    // Names are kept as typed, so a space between two words can be typed. Saving trims them.
    if (movement[2] === 'name' && trimmed !== '') row.name = text;
    // Sets take the same check as a set count read off the card, so the field cannot
    // hold a count the copy would refuse. A number pad reaches every valid one
    // directly, so an invalid keystroke keeps the last good value rather than showing.
    if (movement[2] === 'sets') {
      const count = readSets(trimmed);
      if (count !== null) row.sets = count;
    }
    // Reps are kept as typed, because "3-12" is reached through "3-", which is not a
    // rep range yet. A value readReps cannot read stays flagged and is never copied.
    if (movement[2] === 'reps') row.reps = text;
    if (movement[2] === 'weightLb') {
      if (absent) row.weightLb = null;
      else if (Number.isFinite(number) && number >= 0) row.weightLb = number;
    }
  } else {
    switch (path) {
      case 'title':
        card.title = trimmed === '' ? null : text;
        break;
      case 'subtitle':
        card.subtitle = trimmed === '' ? null : text;
        break;
      case 'weekDay':
        card.weekDay = absent ? null : text;
        break;
      case 'date':
        if (absent) card.date = null;
        else if (ISO_DATE.test(trimmed)) card.date = trimmed;
        break;
      case 'durationMin':
        card.durationMin = absent ? null : Number.isFinite(number) ? number : card.durationMin;
        break;
      case 'volumeLb':
        card.volumeLb = absent ? null : Number.isFinite(number) ? number : card.volumeLb;
        break;
      case 'totalSets':
        card.totalSets = absent ? null : Number.isFinite(number) ? number : card.totalSets;
        break;
      default:
        return reading;
    }
  }

  return {
    card,
    disagreements: reading.disagreements.filter((flag) => flag.path !== path),
  };
}

/** Clears a flag without changing anything: the person kept the value as read. */
export function clearFlag(reading: Reading, path: string): Reading {
  return { ...reading, disagreements: reading.disagreements.filter((flag) => flag.path !== path) };
}

/**
 * Drops the movement at `index`. Flags on later movements are renumbered to match
 * the rows that remain.
 */
export function removeRow(reading: Reading, index: number): Reading {
  const rows = reading.card.rows.filter((_, i) => i !== index);
  const disagreements = reading.disagreements.flatMap((flag) => {
    const match = flag.path.match(/^rows\.(\d+)(\..*)?$/);
    if (!match) return [flag];
    const at = Number(match[1]);
    if (at === index) return [];
    const renumbered = at > index ? at - 1 : at;
    return [{ ...flag, path: `rows.${renumbered}${match[2] ?? ''}` }];
  });
  return { card: { ...reading.card, rows }, disagreements };
}

/**
 * What still stands between this reading and a copy in the workout being built. An
 * empty list means it can be copied. Each movement also has to be matched to an
 * exercise or skipped. The review screen checks that, because it depends on the
 * library rather than on the reading.
 */
export function saveProblems(reading: Reading): string[] {
  const problems: string[] = [];
  if (reading.card.rows.length === 0) problems.push('Keep at least one movement.');
  // A value the readings disagree on and a value neither of them found are the same
  // thing to the person: a field to settle before the movement can be copied.
  const blocking =
    reading.disagreements.filter((flag) => isStoredField(flag.path)).length +
    reading.card.rows.reduce((count, row) => count + missingValues(row).length, 0);
  if (blocking > 0) {
    problems.push(`${blocking} ${blocking === 1 ? 'value needs' : 'values need'} checking.`);
  }
  return problems;
}

/**
 * Fields a copied workout is built from: each movement's name, sets and reps. A copy
 * has no date and no weights, so a disagreement on those, or on the card's own totals
 * and title, is still shown but does not hold up the copy.
 */
export function isStoredField(path: string): boolean {
  return /^rows\.\d+(\.(name|sets|reps))?$/.test(path);
}
