// =============================================================================
// Card parser — OCR lines in, a card out
// =============================================================================
// The lines below are shaped like what the reader returns for a Boostcamp card,
// including the glitches it actually produces ("451|b", "201lbx", "27 bx 10",
// "4,3001b", a lowercase "incline"). Values are invented; the glitches are real.

import { describe, expect, it } from '@jest/globals';
import { cardWarnings, normalizeLine, parseCard } from '../card-import/parse-card';

const standaloneCard = [
  'Dumbbell PPL',
  'Workout B Oct 7,2026',
  'EXERCISE SETS BEST SET',
  'Pull-Up (Bodyweight) 3 5reps',
  'Bent Over Row (Dumbbell) 3 701b x8',
  'Shrug (Dumbbell) 3 451|b x 12',
  'incline Chest Fly (Dumbbell) 3 301bx 10',
  'Reverse Fly 3 201bx 7',
  'Hanging Leg Raise 3 10 reps',
  '® Max Weight Reps ® Estimated 1RM',
  '40 m 4,3001b 18',
  'DURATION VOLUME SETS',
  'BOOSTCAMP',
];

describe('normalizeLine', () => {
  it('reads the unit back out of the glitches OCR produces', () => {
    expect(normalizeLine('Shrug (Dumbbell) 3 451|b x 12')).toBe('Shrug (Dumbbell) 3 45 lb x 12');
    expect(normalizeLine('Bent Over Row 3 701b x8')).toBe('Bent Over Row 3 70 lb x8');
    expect(normalizeLine('Snatch (Kettlebell) 3 27 bx 10')).toBe(
      'Snatch (Kettlebell) 3 27 lb x 10'
    );
  });

  it('turns lbx into lb x and reads a footer weight with a comma', () => {
    expect(normalizeLine('Chest Press 3 60lbx 6')).toBe('Chest Press 3 60 lb x 6');
    expect(normalizeLine('40 m 4,3001b 18')).toBe('40 m 4,300 lb 18');
  });
});

describe('parseCard', () => {
  it('reads the title, subtitle and date from the lines above the table', () => {
    const card = parseCard(standaloneCard);

    expect(card.title).toBe('Dumbbell PPL');
    expect(card.subtitle).toBe('Workout B');
    expect(card.date).toBe('2026-10-07');
  });

  it('reads each movement, with bodyweight rows as reps only', () => {
    const { rows } = parseCard(standaloneCard);

    expect(rows).toEqual([
      expect.objectContaining({ name: 'Pull-Up (Bodyweight)', sets: 3, weightLb: null, reps: 5 }),
      expect.objectContaining({ name: 'Bent Over Row (Dumbbell)', sets: 3, weightLb: 70, reps: 8 }),
      expect.objectContaining({ name: 'Shrug (Dumbbell)', sets: 3, weightLb: 45, reps: 12 }),
      expect.objectContaining({
        name: 'Incline Chest Fly (Dumbbell)',
        sets: 3,
        weightLb: 30,
        reps: 10,
      }),
      expect.objectContaining({ name: 'Reverse Fly', sets: 3, weightLb: 20, reps: 7 }),
      expect.objectContaining({ name: 'Hanging Leg Raise', sets: 3, weightLb: null, reps: 10 }),
    ]);
  });

  it('reads the footer, with the volume written with a comma', () => {
    const card = parseCard(standaloneCard);

    expect(card.durationMin).toBe(40);
    expect(card.volumeLb).toBe(4300);
    expect(card.totalSets).toBe(18);
  });

  it('takes the title from the phone layout, past the app text above it', () => {
    const phone = [
      '17:11',
      'Solid one!',
      '44th workout in the books',
      'New Personal Records',
      'Kettlebell Clean and Press 25 1b x 10',
      'Kettlebell Filler',
      'Week 2 - Day 1 Sep 27,2026',
      'EXERCISE SETS BEST SET',
      'Kettlebell Swing 3 27 1b x 15',
      'Bent Over Row (Kettlebell) 3 45 |b x 20',
      '47 m 5,988 Ib 15',
    ];

    const card = parseCard(phone);

    expect(card.title).toBe('Kettlebell Filler');
    expect(card.subtitle).toBe('Week 2 - Day 1');
    expect(card.date).toBe('2026-09-27');
    // The PR sheet lists movements above the table. They are not part of the card.
    expect(card.rows.map((row) => row.name)).toEqual([
      'Kettlebell Swing',
      'Bent Over Row (Kettlebell)',
    ]);
    expect(card.durationMin).toBe(47);
    expect(card.volumeLb).toBe(5988);
  });

  it('reads a date whose comma OCR has turned into a period', () => {
    const card = parseCard(['Dumbbell PPL', 'Workout A Oct 10.2026', 'EXERCISE SETS BEST SET']);

    expect(card.date).toBe('2026-10-10');
    expect(card.subtitle).toBe('Workout A');
  });

  it('leaves the footer values empty when there is no footer line', () => {
    const card = parseCard(['Dumbbell PPL', 'Workout A Oct 6,2026', 'EXERCISE SETS BEST SET']);

    expect(card.durationMin).toBeNull();
    expect(card.volumeLb).toBeNull();
    expect(card.totalSets).toBeNull();
  });
});

describe('cardWarnings', () => {
  it('flags a missing movement list, and not a missing date, since a copy has no date', () => {
    expect(cardWarnings(parseCard(['EXERCISE SETS BEST SET']))).toEqual([
      'No movements found on this card.',
    ]);
  });

  it('flags a set count that does not match the footer', () => {
    const card = parseCard([
      'Dumbbell PPL',
      'Workout A Oct 6,2026',
      'EXERCISE SETS BEST SET',
      'Chest Press (Dumbbell) 3 60 lb x 6',
      'Pullover (Dumbbell) 1 40 lb x 10',
      '43 m 4,610 lb 18',
    ]);

    expect(cardWarnings(card)).toEqual(['The movements add up to 4 sets, but the card says 18.']);
  });

  it('has nothing to say about a card that adds up', () => {
    expect(cardWarnings(parseCard(standaloneCard))).toEqual([]);
  });
});
