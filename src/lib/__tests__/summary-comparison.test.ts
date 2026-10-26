// =============================================================================
// summary-comparison — "vs last time" on the summary (issue #80)
// =============================================================================
// The sentence names a reference and a number, so what it matches on and when
// it stays silent are the whole feature. Both are tested here rather than
// through a render.

import type { TemplateDay, WorkoutTemplateDefinition } from '@/data';
import type { Exercise, LoggedSet, WorkoutLog } from '@/types';
import { describe, expect, it } from '@jest/globals';

import type { VolumeComparison } from '../summary-comparison';
import {
  comparisonSentence,
  previousSession,
  volumeComparison,
  workoutDisplayName,
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
  workoutName?: string;
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
  ...(over.workoutName === undefined ? {} : { workoutName: over.workoutName }),
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

    expect(previousSession(logs, today, 'lb')?.id).toBe('recent');
  });

  it('ignores another day of the same template', () => {
    const today = pushA(at(0), 10_000);
    const pullA = pushA(at(3), 9_000, { id: 'pull', dayKey: 'ppl_pull_a' });

    expect(previousSession([today, pullA], today, 'lb')).toBeNull();
  });

  it('ignores the same day of a different template', () => {
    const today = pushA(at(0), 10_000);
    const copy = pushA(at(3), 9_000, { id: 'copy', templateId: 'ppl_6day__copy' });

    expect(previousSession([today, copy], today, 'lb')).toBeNull();
  });

  it('ignores logs written before the workout identity was recorded', () => {
    const today = pushA(at(0), 10_000);
    const legacy = log(at(3), 9_000, { id: 'legacy' });

    expect(previousSession([today, legacy], today, 'lb')).toBeNull();
  });

  it('ignores an unsaved session and one logged later', () => {
    const today = pushA(at(3), 10_000);
    const abandoned = pushA(at(7), 9_000, { id: 'abandoned', claimedAt: null });
    const later = pushA(at(0), 9_000, { id: 'later' });

    expect(previousSession([today, abandoned, later], today, 'lb')).toBeNull();
  });

  it('skips an earlier session that moved no weight', () => {
    const today = pushA(at(0), 10_000);
    const planks = pushA(at(2), 0, { id: 'planks', exercises: [hold(120)] });
    const real = pushA(at(6), 9_000, { id: 'real' });

    expect(previousSession([today, planks, real], today, 'lb')?.id).toBe('real');
  });
});

// -----------------------------------------------------------------------------
// The comparison itself
// -----------------------------------------------------------------------------

describe('volumeComparison', () => {
  it('reads up when this session moved more', () => {
    const today = pushA(at(0), 10_970);
    const earlier = pushA(at(3), 10_490, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today, 'lb')).toEqual({
      direction: 'up',
      delta: 480,
      previousTimestamp: at(3),
    });
  });

  it('reads down when it moved less', () => {
    const today = pushA(at(0), 18_680);
    const earlier = pushA(at(6), 19_900, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today, 'lb')).toMatchObject({
      direction: 'down',
      delta: 1_220,
    });
  });

  it('reads same on equal volume', () => {
    const today = pushA(at(0), 9_000);
    const earlier = pushA(at(6), 9_000, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today, 'lb')).toMatchObject({
      direction: 'same',
      delta: 0,
    });
  });

  it('is absent on a first-ever session', () => {
    const today = pushA(at(0), 9_000);
    expect(volumeComparison([today], today, 'lb')).toBeNull();
  });

  it('is absent for a workout never run before', () => {
    const today = pushA(at(0), 21_455, { templateId: 'ppl_6day', dayKey: 'ppl_legs_b' });
    const pushDays = [pushA(at(2), 9_000, { id: 'a' }), pushA(at(9), 8_000, { id: 'b' })];

    expect(volumeComparison([today, ...pushDays], today, 'lb')).toBeNull();
  });

  it('is absent when this session moved no weight', () => {
    const today = pushA(at(0), 0, { exercises: [hold(150)] });
    const earlier = pushA(at(4), 7_980, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today, 'lb')).toBeNull();
  });

  it('is absent on a log written before the workout identity was recorded', () => {
    const today = log(at(0), 9_000);
    const earlier = log(at(4), 8_000, { id: 'earlier' });

    expect(volumeComparison([today, earlier], today, 'lb')).toBeNull();
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

describe('workoutDisplayName', () => {
  const day = (id: string, name: string): TemplateDay => ({
    id,
    name,
    shortName: name,
    exercises: [],
  });

  const template = (name: string, days: TemplateDay[], id = 'tpl'): WorkoutTemplateDefinition => ({
    id,
    name,
    description: '',
    category: 'full_body',
    daysPerWeek: days.length,
    difficulty: 'beginner',
    estimatedDuration: 45,
    days,
  });

  it('names the day of a program', () => {
    const program = template('Push / Pull / Legs', [
      day('ppl_push_a', 'Push A'),
      day('ppl_pull_a', 'Pull A'),
    ]);

    expect(workoutDisplayName(program, program.days[0])).toBe('Push A');
  });

  it('names a one-day workout after itself, not after "Day 1"', () => {
    const mine = template('Garage Session', [day('mine__day0', 'Day 1')]);

    expect(workoutDisplayName(mine, mine.days[0])).toBe('Garage Session');
  });
});

// -----------------------------------------------------------------------------
// The name survives the template
// -----------------------------------------------------------------------------

describe('the stored name', () => {
  it('still reads the same after the template is renamed or deleted', () => {
    // Nothing here consults a template at all: the sentence is built from what
    // the log recorded, so editing or deleting the template cannot reach it.
    const today = pushA(at(0), 10_970, { workoutName: 'Push A' });
    const earlier = pushA(at(3), 10_490, { id: 'earlier', workoutName: 'Push A' });

    const comparison = volumeComparison([today, earlier], today, 'lb');
    expect(comparison).not.toBeNull();
    expect(
      comparisonSentence(comparison as VolumeComparison, today.workoutName as string, 'lb')
    ).toBe('Up 480 lb from your last Push A, Oct 20.');
  });

  it('is absent on a log saved before the name was recorded', () => {
    const today = pushA(at(0), 10_970);
    expect(today.workoutName).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// The comparison never crosses units (issue #85 step 2)
// -----------------------------------------------------------------------------

describe('volumeComparison — units', () => {
  const inUnit = (base: WorkoutLog, weightUnit: 'lb' | 'kg'): WorkoutLog => ({
    ...base,
    weightUnit,
  });

  it('says nothing when the last run of the workout was in the other unit', () => {
    const earlier = inUnit(pushA(at(7), 10000, { id: 'earlier' }), 'lb');
    const today = inUnit(pushA(at(0), 4980, { id: 'today' }), 'kg');

    expect(volumeComparison([today, earlier], today, 'lb')).toBeNull();
  });

  it('reaches past the other unit to the last session in this one', () => {
    const kgEarlier = inUnit(pushA(at(9), 4980, { id: 'kg-earlier' }), 'kg');
    const lbBetween = inUnit(pushA(at(3), 21300, { id: 'lb-between' }), 'lb');
    const today = inUnit(pushA(at(0), 5270, { id: 'today' }), 'kg');

    expect(previousSession([today, lbBetween, kgEarlier], today, 'kg')?.id).toBe('kg-earlier');
    expect(volumeComparison([today, lbBetween, kgEarlier], today, 'kg')).toMatchObject({
      direction: 'up',
      delta: 290,
    });
  });

  it('compares two sessions that both carry no unit, whatever the setting', () => {
    const earlier = pushA(at(7), 4980, { id: 'earlier' });
    const today = pushA(at(0), 5270, { id: 'today' });

    expect(volumeComparison([today, earlier], today, 'kg')).toMatchObject({ direction: 'up' });
  });
});
