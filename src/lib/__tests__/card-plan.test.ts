// =============================================================================
// Plan cards — the "Next up" card, and the row rule both cards share
// =============================================================================
// PLAN_CARD_PASSES below is not invented. It is what the reader returned for
// Adrian's screenshot of a Boostcamp plan card, one entry per preprocessing pass,
// captured from the live import on 2026-10-26. The first pass loses the orange
// "NEXT UP" line and the W of the title, which is the kind of error the second
// reading exists to catch.

import { describe, expect, it } from '@jest/globals';
import { cardWarnings, isCutOffName, parseCard } from '../card-import/parse-card';
import { reconcile } from '../card-import/reconcile';
import { readReps, setField } from '../card-import/review';

const PLAN_CARD_PASSES: [string[], string[]] = [
  [
    'de oo U2 WLLK §- BAY 3 [7 eee',
    '~ orkout B',
    '4 7 4 Dumbbell PPL',
    'ES 96%',
    'Goblet Squat 3 sets - 3-12 reps',
    'Lunge (Dumbbell) 3 sets - 3-12 reps',
    'Single Leg Romanian Deadlift (Dumbb... 3 sets - 3-12 reps',
    'Standing Calf Raise 3 sets - 3-12 reps',
    'Hanging Leg Raise 3 sets - 3-12 reps',
    'Show less ~',
  ],
  [
    'F NEXT UP - WEEK 8 - DAY 3 [7 eee',
    'gaa Workout B',
    '4 # J Dumbbell PPL',
    'EE 96%',
    'Goblet Squat 3 sets - 3-12 reps',
    'Lunge (Dumbbell) 3 sets - 3-12 reps',
    'Single Leg Romanian Deadlift (Dumbb... 3 sets - 3-12 reps',
    'Standing Calf Raise 3 sets - 3-12 reps',
    'Hanging Leg Raise 3 sets - 3-12 reps',
    'Show less ~',
  ],
];

const planRow = (line: string) => parseCard([line]).rows[0];

describe('the real plan card', () => {
  it('reads the five movements, each with its sets and its rep range', () => {
    const card = parseCard(PLAN_CARD_PASSES[1]);

    expect(card.format).toBe('plan');
    expect(card.rows).toEqual([
      expect.objectContaining({ name: 'Goblet Squat', sets: 3, weightLb: null, reps: '3-12' }),
      expect.objectContaining({ name: 'Lunge (Dumbbell)', sets: 3, weightLb: null, reps: '3-12' }),
      expect.objectContaining({
        name: 'Single Leg Romanian Deadlift (Dumbb...',
        sets: 3,
        weightLb: null,
        reps: '3-12',
      }),
      expect.objectContaining({ name: 'Standing Calf Raise', sets: 3, reps: '3-12' }),
      expect.objectContaining({ name: 'Hanging Leg Raise', sets: 3, reps: '3-12' }),
    ]);
  });

  it('names the workout, the program and the week, and reads no date and no weights', () => {
    const card = parseCard(PLAN_CARD_PASSES[1]);

    expect(card.title).toBe('Workout B');
    expect(card.subtitle).toBe('Dumbbell PPL');
    expect(card.weekDay).toBe('Week 8 · Day 3');
    expect(card.date).toBeNull();
    expect(card.durationMin).toBeNull();
    expect(cardWarnings(card)).toEqual([]);
  });

  it('flags the name Boostcamp cut off, and nothing else about the movements', () => {
    const [first, second] = PLAN_CARD_PASSES;
    const reading = reconcile(parseCard(first), parseCard(second));

    expect(reading.card.rows.map((row) => isCutOffName(row.name))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(reading.disagreements.filter((flag) => flag.path.startsWith('rows.'))).toEqual([]);
  });

  it('reads the title the second pass got right, as a flag on the first pass', () => {
    const [first, second] = PLAN_CARD_PASSES;
    const reading = reconcile(parseCard(first), parseCard(second));

    expect(reading.disagreements).toContainEqual({
      path: 'weekDay',
      first: 'nothing',
      second: 'Week 8 · Day 3',
    });
    expect(reading.disagreements.map((flag) => flag.path)).toContain('title');
    // The check line is settled from the flag, like every other value on the card.
    const settled = setField(reading, 'weekDay', 'Week 8 · Day 3');
    expect(settled.card.weekDay).toBe('Week 8 · Day 3');
    expect(settled.disagreements.map((flag) => flag.path)).not.toContain('weekDay');
  });
});

describe('the row rule', () => {
  it('reads a finished weight row and a bodyweight reps row', () => {
    expect(planRow('Bent Over Row (Dumbbell) 3 70 lb x 8')).toEqual(
      expect.objectContaining({
        name: 'Bent Over Row (Dumbbell)',
        sets: 3,
        weightLb: 70,
        reps: '8',
      })
    );
    expect(planRow('Pull-Up (Bodyweight) 3 5 reps')).toEqual(
      expect.objectContaining({ sets: 3, weightLb: null, reps: '5' })
    );
  });

  it('reads a plan row however the card separates its figures', () => {
    expect(planRow('Goblet Squat 3 sets · 3-12 reps')).toEqual(
      expect.objectContaining({ name: 'Goblet Squat', sets: 3, reps: '3-12' })
    );
    expect(planRow('Goblet Squat 3 sets - 3-12 reps')).toEqual(
      expect.objectContaining({ sets: 3, reps: '3-12' })
    );
    expect(planRow('Goblet Squat 3 x 8 reps')).toEqual(
      expect.objectContaining({ sets: 3, reps: '8' })
    );
    expect(planRow('Goblet Squat 3 sets 3-12')).toEqual(
      expect.objectContaining({ sets: 3, reps: '3-12' })
    );
    expect(planRow('Goblet Squat 3 sets')).toEqual(expect.objectContaining({ sets: 3, reps: '' }));
  });

  it('still reads through the glitches normalizeLine undoes', () => {
    expect(planRow('Shrug (Dumbbell) 3 451|b x 12')).toEqual(
      expect.objectContaining({ name: 'Shrug (Dumbbell)', weightLb: 45, reps: '12' })
    );
    expect(planRow('incline Chest Fly (Dumbbell) 3 301bx 10')).toEqual(
      expect.objectContaining({ name: 'Incline Chest Fly (Dumbbell)', weightLb: 30, reps: '10' })
    );
  });

  it('leaves everything that is not a movement out of the table', () => {
    const lines = [
      'NEXT UP - WEEK 8 - DAY 3',
      'Workout B',
      'Dumbbell PPL',
      'ES 96%',
      'Show less ~',
      'Start workout',
      '48 m 12,480 lb 18',
      'EXERCISE SETS BEST SET',
      '® Max Weight Reps ® Estimated 1RM',
      'Week 2 - Day 1 Sep 27,2026',
      'Workout A Oct 10.2026',
    ];

    for (const line of lines) {
      expect(parseCard([line]).rows).toEqual([]);
    }
  });

  it('calls a card with no movements neither format, and says what it can read', () => {
    const card = parseCard(['Show less ~', 'ES 96%']);

    expect(card.format).toBeNull();
    expect(cardWarnings(card)[0]).toContain('No workout found in this photo.');
  });
});

describe('reps as a string', () => {
  it('takes a count or a range, however OCR wrote the dash', () => {
    expect(readReps('8')).toBe('8');
    expect(readReps('3-12')).toBe('3-12');
    expect(readReps('3 - 12')).toBe('3-12');
    expect(readReps('3–12')).toBe('3-12');
    expect(readReps('3 to 12')).toBe('3-12');
  });

  it('refuses what a template cannot hold as a rep scheme', () => {
    expect(readReps('12-3')).toBeNull();
    expect(readReps('3-1 2')).toBeNull();
    expect(readReps('3--12')).toBeNull();
    expect(readReps('3-')).toBeNull();
    expect(readReps('0')).toBeNull();
    expect(readReps('100-120')).toBeNull();
    expect(readReps('ten')).toBeNull();
  });

  it('keeps the last good value when a typed reading is not a rep count', () => {
    const reading = {
      card: parseCard(PLAN_CARD_PASSES[1]),
      disagreements: [{ path: 'rows.0.reps', first: '3-12', second: '3-1 2' }],
    };

    expect(setField(reading, 'rows.0.reps', '3-1 2').card.rows[0].reps).toBe('3-12');
    expect(setField(reading, 'rows.0.reps', '8').card.rows[0].reps).toBe('8');
    expect(setField(reading, 'rows.0.reps', '3 to 12').disagreements).toEqual([]);
  });
});
