// =============================================================================
// summary-comparison — "vs last time" on the summary (issue #80)
// =============================================================================
// The sentence names a reference and a number, so what it matches on and when
// it stays silent are the whole feature. Both are tested here rather than
// through a render.

import type { WorkoutTemplateDefinition } from '@/data';
import type { Exercise, LoggedSet, WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import {
  comparisonSentence,
  previousSession,
  volumeComparison,
  workoutLabel,
} from '../summary-comparison';

const NOW_MS = Date.parse('2026-10-23T18:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/** `daysAgo` before the fixed clock, as an ISO timestamp. */
const at = (daysAgo: number): string => new Date(NOW_MS - daysAgo * DAY_MS).toISOString();

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 100,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...over,
});

/** One movement carrying exactly `volume` of work. */
const lift = (volume: number): Exercise => ({
  id: 'bench_press-0',
  name: 'Bench Press',
  muscleGroups: ['chest'],
  sets: [set({ weight: volume / 10, reps: 10 })],
  restSeconds: 90,
  completed: true,
});

/** A hold: seconds in `reps`, so it carries no volume at all. */
const hold = (seconds: number): Exercise => ({
  id: 'plank-0',
  name: 'Plank',
  muscleGroups: ['core'],
  metric: 'time',
  sets: [set({ weight: null, reps: seconds })],
  restSeconds: 60,
  completed: true,
});

interface LogOver {
  id?: string;
  templateId?: string;
  dayKey?: string;
  claimedAt?: string | null;
  exercises?: Exercise[];
}

const log = (timestamp: string, volume: number, over: LogOver = {}): WorkoutLog => ({
  id: over.id ?? timestamp,
  timestamp,
  exercises: over.exercises ?? [lift(volume)],
  durationSeconds: 1800,
  streakDays: 1,
  sessionIntent: 'normal',
  claimedAt: over.claimedAt === undefined ? timestamp : over.claimedAt,
  ...(over.templateId === undefined ? {} : { templateId: over.templateId }),
  ...(over.dayKey === undefined ? {} : { dayKey: over.dayKey }),
});

/** A saved Push A session. */
const pushA = (timestamp: string, volume: number, over: LogOver = {}): WorkoutLog =>
  log(timestamp, volume, { templateId: 'ppl_6day', dayKey: 'ppl_push_a', ...over });

// -----------------------------------------------------------------------------
// Which session it compares against
// -----------------------------------------------------------------------------

describe('previousSession', () => {
  it('picks the most recent earlier session of the same workout', () => {
    const today = pushA(at(0), 10_000);
    const logs = [today, pushA(at(3), 9_000, { id: 'recent' }), pushA(at(9), 8_000, { id: 'old' })];

    expect(previousSession(logs, today)?.id).toBe('recent');
  });

  it('ignores another day of the same template', () => {
    const today = pushA(at(0), 10_000);
    const pullA = pushA(at(3), 9_000, { id: 'pull', dayKey: 'ppl_pull_a' });

    expect(previousSession([today, pullA], today)).toBeNull();
  });

  it('ignores the same day of a different template', () => {
    const today = pushA(at(0), 10_000);
    const copy = pushA(at(3), 9_000, { id: 'copy', templateId: 'ppl_6day__copy' });

    expect(previousSession([today, copy], today)).toBeNull();
  });

  it('ignores logs written before the workout identity was recorded', () => {
    const today = pushA(at(0), 10_000);
    const legacy = log(at(3), 9_000, { id: 'legacy' });

    expect(previousSession([today, legacy], today)).toBeNull();
  });

  it('ignores an unsaved session and one logged later', () => {
    const today = pushA(at(3), 10_000);
    const abandoned = pushA(at(7), 9_000, { id: 'abandoned', claimedAt: null });
    const later = pushA(at(0), 9_000, { id: 'later' });

    expect(previousSession([today, abandoned, later], today)).toBeNull();
  });

  it('skips an earlier session that moved no weight', () => {
    const today = pushA(at(0), 10_000);
    const planks = pushA(at(2), 0, { id: 'planks', exercises: [hold(120)] });
    const real = pushA(at(6), 9_000, { id: 'real' });

    expect(previousSession([today, planks, real], today)?.id).toBe('real');
  });
});

// -----------------------------------------------------------------------------
// The comparison itself
// -----------------------------------------------------------------------------

describe('volumeComparison', () => {
  it('reads up when this session moved more', () => {
    const today = pushA(at(0), 10_970);
    const earlier = pushA(at(3), 10_490, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today)).toEqual({
      direction: 'up',
      delta: 480,
      previousTimestamp: at(3),
    });
  });

  it('reads down when it moved less', () => {
    const today = pushA(at(0), 18_680);
    const earlier = pushA(at(6), 19_900, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today)).toMatchObject({
      direction: 'down',
      delta: 1_220,
    });
  });

  it('reads same on equal volume', () => {
    const today = pushA(at(0), 9_000);
    const earlier = pushA(at(6), 9_000, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today)).toMatchObject({
      direction: 'same',
      delta: 0,
    });
  });

  it('is absent on a first-ever session', () => {
    const today = pushA(at(0), 9_000);
    expect(volumeComparison([today], today)).toBeNull();
  });

  it('is absent for a workout never run before', () => {
    const today = pushA(at(0), 21_455, { templateId: 'ppl_6day', dayKey: 'ppl_legs_b' });
    const pushDays = [pushA(at(2), 9_000, { id: 'a' }), pushA(at(9), 8_000, { id: 'b' })];

    expect(volumeComparison([today, ...pushDays], today)).toBeNull();
  });

  it('is absent when this session moved no weight', () => {
    const today = pushA(at(0), 0, { exercises: [hold(150)] });
    const earlier = pushA(at(4), 7_980, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today)).toBeNull();
  });

  it('is absent on a log written before the workout identity was recorded', () => {
    const today = log(at(0), 9_000);
    const earlier = log(at(4), 8_000, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Copy
// -----------------------------------------------------------------------------

describe('comparisonSentence', () => {
  it('names the direction, the amount, the workout and the date', () => {
    expect(
      comparisonSentence({ direction: 'up', delta: 480, previousTimestamp: at(3) }, 'Push A', 'lb')
    ).toBe('Up 480 lb from your last Push A, Oct 20.');

    expect(
      comparisonSentence(
        { direction: 'down', delta: 1_220, previousTimestamp: at(6) },
        'Pull A',
        'lb'
      )
    ).toBe('Down 1,220 lb from your last Pull A, Oct 17.');

    expect(
      comparisonSentence({ direction: 'same', delta: 0, previousTimestamp: at(6) }, 'Pull A', 'lb')
    ).toBe('The same volume as your last Pull A, Oct 17.');
  });

  it('labels one unit the same way it labels many', () => {
    expect(
      comparisonSentence({ direction: 'up', delta: 1, previousTimestamp: at(3) }, 'Push A', 'lb')
    ).toBe('Up 1 lb from your last Push A, Oct 20.');

    expect(
      comparisonSentence({ direction: 'down', delta: 1, previousTimestamp: at(3) }, 'Push A', 'kg')
    ).toBe('Down 1 kg from your last Push A, Oct 20.');
  });

  it('uses the current unit setting, converting nothing', () => {
    expect(
      comparisonSentence({ direction: 'up', delta: 2.5, previousTimestamp: at(3) }, 'Push A', 'kg')
    ).toBe('Up 2.5 kg from your last Push A, Oct 20.');
  });
});

// -----------------------------------------------------------------------------
// Naming the workout
// -----------------------------------------------------------------------------

describe('workoutLabel', () => {
  const personal: WorkoutTemplateDefinition[] = [
    {
      id: 'mine',
      name: 'Garage Session',
      description: '',
      category: 'full_body',
      daysPerWeek: 1,
      difficulty: 'beginner',
      estimatedDuration: 45,
      days: [{ id: 'mine__day0', name: 'Day 1', shortName: 'Day 1', exercises: [] }],
      isCustom: true,
    },
  ];

  it('names the day of a program', () => {
    expect(workoutLabel('ppl_6day', 'ppl_push_a', [])).toBe('Push A');
  });

  it('names a one-day workout after itself, not after "Day 1"', () => {
    expect(workoutLabel('mine', 'mine__day0', personal)).toBe('Garage Session');
  });

  it('cannot name a template that is no longer installed', () => {
    expect(workoutLabel('deleted', 'deleted__day0', personal)).toBeNull();
  });

  it('cannot name a day that is no longer on the template', () => {
    expect(workoutLabel('ppl_6day', 'ppl_push_z', [])).toBeNull();
  });

  it('cannot name a log that carries no identity', () => {
    expect(workoutLabel(undefined, undefined, [])).toBeNull();
    expect(workoutLabel('ppl_6day', undefined, [])).toBeNull();
  });
});
