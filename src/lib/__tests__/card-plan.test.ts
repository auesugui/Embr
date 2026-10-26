// =============================================================================
// Plan cards — the "Next up" card, and the row rule both cards share
// =============================================================================
// PLAN_CARD_PASSES below is not invented. It is what the reader returned for
// Adrian's screenshot of a Boostcamp plan card, one entry per preprocessing pass,
// captured from the live import on 2026-10-26. The first pass loses the orange
// "NEXT UP" line and the W of the title, which is the kind of error the second
// reading exists to catch.

import { describe, expect, it } from '@jest/globals';
import {
  cardWarnings,
  isCutOffName,
  missingValues,
  parseCard,
  readReps,
} from '../card-import/parse-card';
import { type Reading, reconcile } from '../card-import/reconcile';
import { saveProblems, setField } from '../card-import/review';

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
    // The garbled pass reads the same five and nothing else: no header line, progress
    // bar or button on this card is a movement by accident.
    expect(parseCard(PLAN_CARD_PASSES[0]).rows).toHaveLength(5);
    expect(
      parseCard(PLAN_CARD_PASSES[0]).rows.every((row) => missingValues(row).length === 0)
    ).toBe(true);
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

  // One table for the whole grammar: what a line gives, and what it must not.
  // A dash between two numbers is a range, so a row that names one names no sets.
  const ROWS: [string, number | null, string, number | null][] = [
    // line                                        sets   reps     weight
    ['Goblet Squat 3 12 reps', 3, '12', null],
    ['Goblet Squat 3 sets 12 reps', 3, '12', null],
    ['Goblet Squat 3 sets · 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets - 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets . 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets , 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets : 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets ~ 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets * 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets | 3-12 reps', 3, '3-12', null],
    ['Goblet Squat 3 sets 3-12', 3, '3-12', null],
    ['Goblet Squat 3 sets · 3 to 12 reps', 3, '3-12', null],
    ['Goblet Squat 3 x 8 reps', 3, '8', null],
    // A range and no set count: the set count is missing, not three.
    ['Goblet Squat 3-12 reps', null, '3-12', null],
    ['Goblet Squat 3-12', null, '3-12', null],
    ['Goblet Squat 3 - 12 reps', null, '3-12', null],
    ['Goblet Squat 3–12 reps', null, '3-12', null],
    ['Goblet Squat 3 to 12 reps', null, '3-12', null],
    ['Goblet Squat 8 reps', null, '8', null],
    ['Goblet Squat 3 sets', 3, '', null],
    // Weight rows, including the decimal a period must not split.
    ['Bent Over Row (Dumbbell) 3 70 lb x 8', 3, '8', 70],
    ['Bent Over Row (Dumbbell) 70 lb x 8', null, '8', 70],
    ['Bent Over Row (Dumbbell) 3 12.5 lb x 8', 3, '8', 12.5],
  ];

  it.each(ROWS)('reads "%s"', (line, sets, reps, weightLb) => {
    expect(planRow(line)).toEqual(expect.objectContaining({ sets, reps, weightLb }));
  });

  const NOT_ROWS = [
    'Goblet Squat 3',
    'Goblet Squat 3 sets 12',
    'NEXT UP - WEEK 8 - DAY 3',
    'ES 96%',
    'Show less ~',
    '48 m 12,480 lb 18',
    'Workout A Oct 10.2026',
  ];

  it.each(NOT_ROWS)('does not read "%s" as a movement', (line) => {
    expect(parseCard([line]).rows).toEqual([]);
  });

  it('leaves a value the card did not name empty, rather than filling it in', () => {
    expect(planRow('Goblet Squat 3 sets')).toEqual(expect.objectContaining({ sets: 3, reps: '' }));
    expect(planRow('Goblet Squat 8 reps')).toEqual(
      expect.objectContaining({ sets: null, reps: '8' })
    );
    expect(missingValues(planRow('Goblet Squat 3 sets'))).toEqual(['reps']);
    expect(missingValues(planRow('Goblet Squat 8 reps'))).toEqual(['sets']);
    expect(missingValues(planRow('Goblet Squat 3 sets · 3-12 reps'))).toEqual([]);
    // Neither a set count nor a rep count is not a movement at all, as before.
    expect(parseCard(['Goblet Squat 3']).rows).toEqual([]);
  });

  it('leaves a rep count the card gave but the field would refuse for the person', () => {
    // "10 reps" read as "1 0 reps": the movement is still a movement, and 0 is not a
    // rep count, so the field is empty and flagged rather than holding a 0.
    expect(planRow('Hanging Leg Raise 1 0 reps')).toEqual(
      expect.objectContaining({ sets: 1, reps: '' })
    );
    expect(planRow('Goblet Squat 3 sets · 12-3 reps')).toEqual(
      expect.objectContaining({ sets: 3, reps: '' })
    );
  });

  it('holds the copy back until the person types the missing value in', () => {
    const reading = { card: parseCard(['Goblet Squat 3 sets']), disagreements: [] };

    expect(saveProblems(reading)).toEqual(['1 value needs checking.']);
    expect(saveProblems(setField(reading, 'rows.0.reps', '3-12'))).toEqual([]);
    expect(setField(reading, 'rows.0.reps', '3-12').card.rows[0].reps).toBe('3-12');

    const noSets = { card: parseCard(['Goblet Squat 8 reps']), disagreements: [] };

    expect(saveProblems(noSets)).toEqual(['1 value needs checking.']);
    expect(saveProblems(setField(noSets, 'rows.0.sets', '3'))).toEqual([]);
    expect(setField(noSets, 'rows.0.sets', '3').card.rows[0].sets).toBe(3);
  });

  it('counts a movement with no set count as none against the card total', () => {
    const card = parseCard([
      'Workout A Oct 6,2026',
      'EXERCISE SETS BEST SET',
      'Goblet Squat 8 reps',
      'Hanging Leg Raise 3 10 reps',
      '43 m 4,610 lb 18',
    ]);

    expect(card.rows.map((row) => row.sets)).toEqual([null, 3]);
    expect(cardWarnings(card)).toEqual(['The movements add up to 3 sets, but the card says 18.']);
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

  it('keeps a range typable, one character at a time', () => {
    // The field is the reading, so every keystroke passes through setField. "3-12" is
    // reached through "3-", which is not a rep range on its own.
    let reading: Reading = { card: parseCard(['Goblet Squat 3 sets']), disagreements: [] };
    for (const typed of ['3', '3-', '3-1', '3-12']) {
      reading = setField(reading, 'rows.0.reps', typed);
    }

    expect(reading.card.rows[0].reps).toBe('3-12');
    expect(saveProblems(reading)).toEqual([]);
  });

  it('flags a typed value that is not a rep count, and copies none', () => {
    const reading: Reading = { card: parseCard(['Goblet Squat 3 sets']), disagreements: [] };

    for (const typed of ['3-1 2', '3--12', '12-3', '0', '100-120', 'ten', '']) {
      const next = setField(reading, 'rows.0.reps', typed);

      expect(missingValues(next.card.rows[0])).toEqual(['reps']);
      expect(saveProblems(next)).toEqual(['1 value needs checking.']);
    }
    // What the person typed stays in the field, so they can see what to correct.
    expect(setField(reading, 'rows.0.reps', '3-1 2').card.rows[0].reps).toBe('3-1 2');
    // A reading they choose from the flag clears it.
    expect(setField(reading, 'rows.0.reps', '3 to 12').disagreements).toEqual([]);
    expect(readReps(setField(reading, 'rows.0.reps', '3 to 12').card.rows[0].reps)).toBe('3-12');
  });
});
