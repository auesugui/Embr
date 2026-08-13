// =============================================================================
// Session duration estimates
// =============================================================================
// The bug that produced this file: a 20-minute AMRAP of three movements was
// reported as "3 exercises · ~45 min". Two causes, both covered below —
// personal templates carried a hardcoded 45 forever, and nothing anywhere
// understood that a timed block costs its clock ONCE.

import type { TemplateDay } from '@/data/templates';
import { WORKOUT_TEMPLATES } from '@/data/templates';
import { estimateDayMinutes, estimateDaySeconds, setWorkSeconds } from '@/lib/duration';

describe('setWorkSeconds', () => {
  it('reads a range as its midpoint, at 3s per rep', () => {
    expect(setWorkSeconds('8-12')).toBe(30); // 10 reps
  });

  it('reads a bare count per set', () => {
    expect(setWorkSeconds('10')).toBe(30);
  });

  it('reads a trailing-s hold as seconds, not reps', () => {
    expect(setWorkSeconds('30-60s')).toBe(45);
    expect(setWorkSeconds('45s')).toBe(45);
  });

  // The one that silently overstated Powerbuilding by 5x.
  it('spreads a "total" prescription across the sets', () => {
    expect(setWorkSeconds('15 total', 5)).toBe(9); // 3 reps a set
    expect(setWorkSeconds('15 total', 1)).toBe(45);
  });

  it('falls back rather than throwing on free text', () => {
    expect(setWorkSeconds('AMQRAP')).toBe(30);
    expect(setWorkSeconds('')).toBe(30);
  });
});

describe('estimateDaySeconds — timed blocks', () => {
  // Cindy: 20-minute AMRAP of 5 pull-ups, 10 push-ups, 15 air squats.
  const CINDY: TemplateDay = {
    id: 'cindy',
    name: 'Cindy',
    shortName: 'Cindy',
    blocks: [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 }],
    exercises: [
      { exerciseId: 'pull_ups', sets: 1, reps: '5', restSeconds: 0, blockId: 'b1' },
      { exerciseId: 'push_ups', sets: 1, reps: '10', restSeconds: 0, blockId: 'b1' },
      { exerciseId: 'back_squat', sets: 1, reps: '15', restSeconds: 0, blockId: 'b1' },
    ],
  };

  it('counts a 20-minute AMRAP as 20 minutes, not once per movement', () => {
    expect(estimateDayMinutes(CINDY)).toBe(20);
  });

  it('does not grow when movements are added to the same window', () => {
    const bigger: TemplateDay = {
      ...CINDY,
      exercises: [
        ...CINDY.exercises,
        { exerciseId: 'dips', sets: 1, reps: '20', restSeconds: 0, blockId: 'b1' },
        { exerciseId: 'plank', sets: 1, reps: '60s', restSeconds: 0, blockId: 'b1' },
      ],
    };
    expect(estimateDayMinutes(bigger)).toBe(estimateDayMinutes(CINDY));
  });

  it('scales with the window, which is the thing that actually sets the length', () => {
    const short: TemplateDay = {
      ...CINDY,
      blocks: [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 600 }],
    };
    expect(estimateDayMinutes(short)).toBe(10);
  });

  it('costs an EMOM its cadence times its interval count', () => {
    const emom: TemplateDay = {
      id: 'e',
      name: 'E',
      shortName: 'E',
      blocks: [{ id: 'b1', mode: 'emom', intervalSeconds: 60, rounds: 12 }],
      exercises: [{ exerciseId: 'burpees', sets: 1, reps: '8', restSeconds: 0, blockId: 'b1' }],
    };
    expect(estimateDayMinutes(emom)).toBe(15); // 12 min + setup, to the nearest 5
  });
});

describe('estimateDaySeconds — straight sets', () => {
  it('counts work and rest for every set, plus one setup per exercise', () => {
    const day: TemplateDay = {
      id: 'd',
      name: 'D',
      shortName: 'D',
      exercises: [{ exerciseId: 'back_squat', sets: 3, reps: '10', restSeconds: 120 }],
    };
    // 3 x (30s work + 120s rest) = 450, + 60 setup
    expect(estimateDaySeconds(day)).toBe(510);
  });

  it('is empty for a day with no exercises', () => {
    const day: TemplateDay = { id: 'd', name: 'D', shortName: 'D', exercises: [] };
    expect(estimateDayMinutes(day)).toBe(0);
  });
});

describe('built-in templates stay in a sane range', () => {
  // Not pinned to the hand-written `estimatedDuration` values — those are a
  // single number per template and demonstrably rough (Minimalist claims 45
  // while prescribing 240-300s rests). This guards against a tuning change
  // that sends everything to 5 or 300 minutes.
  it.each(WORKOUT_TEMPLATES.map((t) => [t.name, t] as const))(
    '%s: every day lands between 20 and 100 minutes',
    (_name, template) => {
      for (const day of template.days) {
        const minutes = estimateDayMinutes(day);
        expect(minutes).toBeGreaterThanOrEqual(20);
        expect(minutes).toBeLessThanOrEqual(100);
      }
    }
  );

  it('gives different days different lengths — the point of computing it', () => {
    const ppl = WORKOUT_TEMPLATES.find((t) => t.id === 'ppl_6day');
    const lengths = new Set((ppl?.days ?? []).map(estimateDayMinutes));
    expect(lengths.size).toBeGreaterThan(1);
  });
});
