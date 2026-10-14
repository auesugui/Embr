// =============================================================================
// Review edits — changing a reading while the person checks it
// =============================================================================
// The review screen edits a Reading in place: typing a value, choosing one of two
// flagged readings, keeping or dropping a movement. Each edit is a pure function
// over a Reading, so the rules live in one place and are tested without a screen.
//
// A flag is cleared the moment its field is set, whichever reading the value came
// from. Text that does not parse for its field is ignored, so a number field never
// holds something that is not a number.

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
  const whole = Number.isInteger(number) && number >= 1 ? number : null;

  const movement = path.match(/^rows\.(\d+)\.(name|sets|weightLb|reps)$/);
  if (movement) {
    const row = card.rows[Number(movement[1])];
    if (!row) return reading;
    // Names are kept as typed, so a space between two words can be typed. Saving trims them.
    if (movement[2] === 'name' && trimmed !== '') row.name = text;
    if (movement[2] === 'sets' && whole !== null) row.sets = whole;
    if (movement[2] === 'reps' && whole !== null) row.reps = whole;
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
 * What still stands between this reading and a saved workout. An empty list means
 * it can be saved.
 */
export function saveProblems(reading: Reading): string[] {
  const problems: string[] = [];
  if (!reading.card.date) problems.push('Set the date.');
  if (reading.card.rows.length === 0) problems.push('Keep at least one movement.');
  const blocking = reading.disagreements.filter((flag) => isStoredField(flag.path)).length;
  if (blocking > 0) {
    problems.push(`${blocking} ${blocking === 1 ? 'value needs' : 'values need'} checking.`);
  }
  return problems;
}

/**
 * Fields a saved workout is built from: the date, the duration, and each movement's
 * name, weight and reps. A disagreement on anything else (the card's own totals,
 * the title) is still shown, but it does not hold up the save.
 */
export function isStoredField(path: string): boolean {
  return (
    path === 'date' || path === 'durationMin' || /^rows\.\d+(\.(name|weightLb|reps))?$/.test(path)
  );
}
