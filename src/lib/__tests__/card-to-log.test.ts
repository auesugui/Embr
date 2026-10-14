// =============================================================================
// Card to log — a reviewed card becomes a history entry
// =============================================================================
// The entry has to read back the same way in history, and importing the same card
// twice has to add it once. Both are asserted here, along with the unit conversion.

import { describe, expect, it } from '@jest/globals';
import { cardToLog } from '../card-import/card-to-log';
import type { ParsedCard } from '../card-import/parse-card';

const IMPORTED_AT = '2026-10-14T09:00:00.000Z';

const card = (overrides: Partial<ParsedCard> = {}): ParsedCard => ({
  title: 'Dumbbell PPL',
  subtitle: 'Workout A',
  date: '2026-10-13',
  rows: [
    { id: 'r0', name: '  Chest Press (Dumbbell) ', sets: 3, weightLb: 60, reps: 10 },
    { id: 'r1', name: 'Hanging Leg Raise', sets: 3, weightLb: null, reps: 10 },
  ],
  durationMin: 57,
  volumeLb: 4890,
  totalSets: 6,
  ...overrides,
});

describe('cardToLog', () => {
  it('stamps the entry at noon on the card date, in the local timezone', () => {
    const log = cardToLog(card(), { units: 'lb', importedAt: IMPORTED_AT });

    expect(log.timestamp).toBe(new Date(2026, 9, 13, 12).toISOString());
  });

  it('records one logged set per movement: the best set, read as the card shows it', () => {
    const log = cardToLog(card(), { units: 'lb', importedAt: IMPORTED_AT });

    expect(log.exercises).toEqual([
      expect.objectContaining({
        id: 'chest_press_dumbbell',
        name: 'Chest Press (Dumbbell)',
        sets: [{ reps: 10, weight: 60, logged: true, isPR: false, isRepPR: false }],
      }),
      expect.objectContaining({
        id: 'hanging_leg_raise',
        sets: [{ reps: 10, weight: null, logged: true, isPR: false, isRepPR: false }],
      }),
    ]);
  });

  it('carries the duration, and marks the entry as saved and as imported from a photo', () => {
    const log = cardToLog(card(), { units: 'lb', importedAt: IMPORTED_AT });

    expect(log.durationSeconds).toBe(57 * 60);
    expect(log.claimedAt).toBe(IMPORTED_AT);
    expect(log.importedFrom).toBe('photo');
    expect(log.streakDays).toBe(0);
    expect(log.sessionIntent).toBe('normal');
  });

  it('gives the same card the same id every time, and a different card a different one', () => {
    const first = cardToLog(card(), { units: 'lb', importedAt: IMPORTED_AT });
    const again = cardToLog(card(), { units: 'lb', importedAt: '2026-11-01T00:00:00.000Z' });
    const other = cardToLog(
      card({ rows: [{ id: 'r0', name: 'Arnold Press', sets: 3, weightLb: 40, reps: 8 }] }),
      { units: 'lb', importedAt: IMPORTED_AT }
    );

    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
  });

  it('converts weights to kilograms when the app is set to kg, to the nearest half kilo', () => {
    const log = cardToLog(card(), { units: 'kg', importedAt: IMPORTED_AT });

    // 60 lb is 27.2 kg, which rounds to 27.0.
    expect(log.exercises[0].sets[0].weight).toBe(27);
    expect(log.exercises[1].sets[0].weight).toBeNull();
  });

  it('refuses a card with no date, since history cannot place it', () => {
    expect(() => cardToLog(card({ date: null }), { units: 'lb', importedAt: IMPORTED_AT })).toThrow(
      'A card needs a date before it can be saved.'
    );
  });
});
