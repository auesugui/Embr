// =============================================================================
// Reconcile and review — two readings in, a reading the person can save
// =============================================================================
// These cover the rule that matters most: a value is never saved on a guess. Where
// the two readings disagree the value is flagged, and only an edit or a choice
// clears the flag.

import { describe, expect, it } from '@jest/globals';
import type { ParsedCard } from '../card-import/parse-card';
import { type Reading, reconcile } from '../card-import/reconcile';
import {
  clearFlag,
  formatCardDate,
  removeRow,
  saveProblems,
  setField,
} from '../card-import/review';

const card = (overrides: Partial<ParsedCard> = {}): ParsedCard => ({
  format: 'workout',
  weekDay: null,
  title: 'Dumbbell PPL',
  subtitle: 'Workout A',
  date: '2026-10-13',
  rows: [
    { id: 'r0', name: 'Chest Press (Dumbbell)', sets: 3, weightLb: 60, reps: '10' },
    { id: 'r1', name: 'Hanging Leg Raise', sets: 3, weightLb: null, reps: '10' },
    { id: 'r2', name: 'Arnold Press', sets: 3, weightLb: 40, reps: '8' },
  ],
  durationMin: 57,
  volumeLb: 4890,
  totalSets: 9,
  ...overrides,
});

const clean = (): Reading => ({ card: card(), disagreements: [] });

describe('reconcile', () => {
  it('reports nothing when the two readings agree', () => {
    const reading = reconcile(card(), card());

    expect(reading.disagreements).toEqual([]);
    expect(reading.card).toEqual(card());
  });

  it('keeps the first reading and flags a weight the readings disagree on', () => {
    const second = card({
      rows: [{ id: 'r0', name: 'Chest Press (Dumbbell)', sets: 3, weightLb: 20, reps: '10' }],
    });

    const reading = reconcile(card(), second);

    expect(reading.card.rows[0].weightLb).toBe(60);
    expect(reading.disagreements).toContainEqual({
      path: 'rows.0.weightLb',
      first: '60',
      second: '20',
    });
  });

  it('flags a movement only one reading found, and keeps the one the second reading found', () => {
    const second = card({
      rows: [
        { id: 'r0', name: 'Chest Press (Dumbbell)', sets: 3, weightLb: 60, reps: '10' },
        { id: 'r1', name: 'Hanging Leg Raise', sets: 3, weightLb: null, reps: '10' },
        { id: 'r2', name: 'Arnold Press', sets: 3, weightLb: 40, reps: '8' },
        { id: 'r3', name: 'Lateral Raise', sets: 2, weightLb: 15, reps: '12' },
      ],
    });

    const reading = reconcile(card(), second);

    expect(reading.card.rows.map((row) => row.name)).toContain('Lateral Raise');
    expect(reading.disagreements).toContainEqual({
      path: 'rows.3',
      first: 'not found',
      second: 'Lateral Raise',
    });
  });

  it('puts a movement only the second reading found where it sits on the card', () => {
    const second = card({
      rows: [
        { id: 'r0', name: 'Chest Press (Dumbbell)', sets: 3, weightLb: 60, reps: '10' },
        { id: 'r1', name: 'Reverse Fly', sets: 3, weightLb: 20, reps: '7' },
        { id: 'r2', name: 'Hanging Leg Raise', sets: 3, weightLb: null, reps: '10' },
        { id: 'r3', name: 'Arnold Press', sets: 3, weightLb: 40, reps: '8' },
      ],
    });

    const reading = reconcile(card(), second);

    expect(reading.card.rows.map((row) => row.name)).toEqual([
      'Chest Press (Dumbbell)',
      'Reverse Fly',
      'Hanging Leg Raise',
      'Arnold Press',
    ]);
    expect(reading.disagreements).toEqual([
      { path: 'rows.1', first: 'not found', second: 'Reverse Fly' },
    ]);
  });

  it('flags a movement the first reading found and the second did not', () => {
    const second = card({ rows: [card().rows[0]] });

    const reading = reconcile(card(), second);

    expect(reading.card.rows).toHaveLength(3);
    expect(reading.disagreements).toContainEqual({
      path: 'rows.1',
      first: 'Hanging Leg Raise',
      second: 'not found',
    });
  });

  it('does not flag the same subtitle read with different spacing', () => {
    const reading = reconcile(
      card({ subtitle: 'Week 2-Day 1' }),
      card({ subtitle: 'Week 2 - Day 1' })
    );

    expect(reading.disagreements).toEqual([]);
  });

  it('flags a difference in the date', () => {
    const reading = reconcile(card({ date: '2026-10-13' }), card({ date: '2026-10-18' }));

    expect(reading.disagreements).toContainEqual({
      path: 'date',
      first: '2026-10-13',
      second: '2026-10-18',
    });
  });
});

describe('setField', () => {
  it('sets a weight from the typed value and clears its flag', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [{ path: 'rows.0.weightLb', first: '60', second: '20' }],
    };

    const next = setField(flagged, 'rows.0.weightLb', '20');

    expect(next.card.rows[0].weightLb).toBe(20);
    expect(next.disagreements).toEqual([]);
  });

  it('makes a weight bodyweight when the value is removed or chosen as "nothing"', () => {
    expect(setField(clean(), 'rows.0.weightLb', '').card.rows[0].weightLb).toBeNull();
    expect(setField(clean(), 'rows.0.weightLb', 'nothing').card.rows[0].weightLb).toBeNull();
  });

  it('ignores text that is not a number for a number field', () => {
    const next = setField(clean(), 'rows.0.weightLb', 'ten');

    expect(next.card.rows[0].weightLb).toBe(60);
  });

  it('keeps reps as typed, and holds the copy back while they are not a rep count', () => {
    // The field is a text field, so "3-12" arrives through "3-". What it holds is
    // checked before anything is copied, not on every keystroke.
    const next = setField(clean(), 'rows.0.reps', 'ten');

    expect(next.card.rows[0].reps).toBe('ten');
    expect(saveProblems(next)).toEqual(['1 value needs checking.']);
  });

  it('ignores a zero or fractional count', () => {
    expect(setField(clean(), 'rows.0.sets', '0').card.rows[0].sets).toBe(3);
    expect(setField(clean(), 'rows.0.sets', '2.5').card.rows[0].sets).toBe(3);
  });

  it('keeps a movement name as typed, so a space between two words can be entered', () => {
    const next = setField(clean(), 'rows.0.name', 'Chest ');

    expect(next.card.rows[0].name).toBe('Chest ');
  });

  it('accepts a date only in YYYY-MM-DD form', () => {
    const missing: Reading = { card: card({ date: null }), disagreements: [] };

    expect(setField(missing, 'date', '2026-10-07').card.date).toBe('2026-10-07');
    expect(setField(missing, 'date', 'Oct 7').card.date).toBeNull();
  });
});

describe('clearFlag and removeRow', () => {
  it('keeps the value as read when the flag is cleared', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [{ path: 'rows.2', first: 'Arnold Press', second: 'not found' }],
    };

    const next = clearFlag(flagged, 'rows.2');

    expect(next.disagreements).toEqual([]);
    expect(next.card.rows).toHaveLength(3);
  });

  it('drops a movement and renumbers the flags on the movements after it', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [
        { path: 'rows.1', first: 'Hanging Leg Raise', second: 'not found' },
        { path: 'rows.2.weightLb', first: '40', second: '4' },
      ],
    };

    const next = removeRow(flagged, 1);

    expect(next.card.rows.map((row) => row.name)).toEqual([
      'Chest Press (Dumbbell)',
      'Arnold Press',
    ]);
    expect(next.disagreements).toEqual([{ path: 'rows.1.weightLb', first: '40', second: '4' }]);
  });
});

describe('saveProblems', () => {
  it('has nothing to say about a clean reading', () => {
    expect(saveProblems(clean())).toEqual([]);
  });

  it('does not ask for a date, since a copy has none', () => {
    expect(saveProblems({ card: card({ date: null }), disagreements: [] })).toEqual([]);
  });

  it('keeps at least one movement', () => {
    expect(saveProblems({ card: card({ rows: [] }), disagreements: [] })).toEqual([
      'Keep at least one movement.',
    ]);
  });

  it('blocks saving while a movement name, sets or reps is still flagged', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [
        { path: 'rows.0.reps', first: '10', second: '12' },
        { path: 'rows.2.sets', first: '3', second: '2' },
      ],
    };

    expect(saveProblems(flagged)).toEqual(['2 values need checking.']);
  });

  it('blocks saving while a movement the readings disagree on is still flagged', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [{ path: 'rows.1', first: 'Hanging Leg Raise', second: 'not found' }],
    };

    expect(saveProblems(flagged)).toEqual(['1 value needs checking.']);
  });
});

describe('saveProblems and flags the copy does not use', () => {
  it('does not hold up a copy for a disagreement on a weight, the date, the duration, the totals or the title', () => {
    const flagged: Reading = {
      card: card(),
      disagreements: [
        { path: 'rows.0.weightLb', first: '60', second: '20' },
        { path: 'date', first: '2026-10-13', second: '2026-10-18' },
        { path: 'durationMin', first: '57', second: '75' },
        { path: 'totalSets', first: '9', second: '8' },
        { path: 'volumeLb', first: '4890', second: '4880' },
        { path: 'title', first: 'Dumbbell PPL', second: 'Dumbbell PPI' },
      ],
    };

    expect(saveProblems(flagged)).toEqual([]);
  });
});

describe('formatCardDate', () => {
  it('writes the date the way the card does', () => {
    expect(formatCardDate('2026-10-07')).toBe('Oct 7, 2026');
  });
});
