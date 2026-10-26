// =============================================================================
// weekly-volume — the twelve-week strip and the sentence under it
// =============================================================================
// The two things worth getting wrong here are a week with workouts and no
// volume (a week of holds, which is real work) against a week with no workouts
// at all, and the in-progress week, which is a running total and is never the
// subject of a comparison.

import type { Exercise, LoggedSet, WorkoutLog } from '@/types';

import {
  STRIP_WEEKS,
  describeWindow,
  volumeReading,
  volumeReadingSegments,
  volumeStrip,
} from '../weekly-volume';

const set = (overrides: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 100,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...overrides,
});

const lift = (sets: LoggedSet[]): Exercise =>
  ({ id: 'bench-press', name: 'Bench Press', sets, restSeconds: 60 }) as unknown as Exercise;

/** A hold logs seconds in `reps`, so it is worth nothing. */
const hold = (): Exercise =>
  ({
    id: 'plank',
    name: 'Plank',
    metric: 'time',
    sets: [set({ reps: 60, weight: 0 })],
    restSeconds: 60,
  }) as unknown as Exercise;

let nextId = 0;

const log = (
  year: number,
  month: number,
  day: number,
  exercises: Exercise[],
  hour = 9
): WorkoutLog =>
  ({
    id: `log-${nextId++}`,
    timestamp: new Date(year, month - 1, day, hour, 30).toISOString(),
    claimedAt: new Date(year, month - 1, day, hour, 45).toISOString(),
    exercises,
  }) as unknown as WorkoutLog;

/** A lift worth `volume` at ten reps a set. */
const worth = (volume: number) => [lift([set({ weight: volume / 10 })])];

// Sat 24 October 2026, inside the week of Mon 19 October.
const TODAY = new Date(2026, 9, 24, 11, 0);

const strip = (logs: WorkoutLog[], now: Date = TODAY) => {
  const value = volumeStrip(logs, now);
  if (value === null) throw new Error('expected a strip');
  return value;
};

describe('volumeStrip', () => {
  it('is null for someone with no saved workouts', () => {
    expect(volumeStrip([], TODAY)).toBeNull();
    expect(volumeStrip([{ ...log(2026, 10, 20, worth(1000)), claimedAt: null }], TODAY)).toBeNull();
  });

  it('ends with the week holding today and never runs past twelve', () => {
    const value = strip([log(2025, 1, 6, worth(1000)), log(2026, 10, 20, worth(1000))]);

    expect(value.weeks).toHaveLength(STRIP_WEEKS);
    expect(value.weeks[value.weeks.length - 1].weekKey).toBe('2026-10-19');
    expect(value.weeks[value.weeks.length - 1].inProgress).toBe(true);
    expect(value.weeks[0].weekKey).toBe('2026-08-03');
  });

  it('shows only the weeks that exist when there are fewer than twelve', () => {
    const value = strip([log(2026, 10, 12, worth(1000))]);

    expect(value.weeks.map((week) => week.weekKey)).toEqual(['2026-10-12', '2026-10-19']);
  });

  it('buckets Monday to Sunday, and a Sunday night workout with its own week', () => {
    const value = strip([log(2026, 10, 18, worth(5000), 23), log(2026, 10, 19, worth(3000))]);
    const week = (key: string) => value.weeks.find((candidate) => candidate.weekKey === key);

    expect(week('2026-10-12')?.volume).toBe(5000);
    expect(week('2026-10-19')?.volume).toBe(3000);
  });

  it('adds the day’s workouts together', () => {
    const value = strip([log(2026, 10, 20, worth(5000)), log(2026, 10, 20, worth(2500), 18)]);

    expect(value.weeks[value.weeks.length - 1].volume).toBe(7500);
  });

  it('excludes holds, so a week of them is trained and worth nothing', () => {
    const value = strip([log(2026, 10, 13, [hold()]), log(2026, 10, 20, worth(4000))]);
    const held = value.weeks.find((week) => week.weekKey === '2026-10-12');

    expect(held?.volume).toBe(0);
    expect(held?.trained).toBe(true);
  });

  it('leaves a week with no workouts untrained rather than zero-valued work', () => {
    const value = strip([log(2026, 10, 5, worth(4000)), log(2026, 10, 20, worth(4000))]);
    const skipped = value.weeks.find((week) => week.weekKey === '2026-10-12');

    expect(skipped?.trained).toBe(false);
    expect(skipped?.volume).toBe(0);
  });

  it('counts an unlogged set and a cardio entry as nothing', () => {
    const value = strip([
      log(2026, 10, 20, [lift([set({ logged: false })]), { ...lift([]), cardio: {} } as Exercise]),
    ]);

    expect(value.weeks[value.weeks.length - 1].volume).toBe(0);
    expect(value.weeks[value.weeks.length - 1].trained).toBe(true);
  });

  it('takes the tallest week in view as the scale', () => {
    const value = strip([log(2026, 10, 13, worth(9000)), log(2026, 10, 20, worth(4000))]);
    expect(value.max).toBe(9000);
  });
});

describe('describeWindow', () => {
  it('counts the weeks it is showing, singular included', () => {
    expect(describeWindow(strip([log(2026, 10, 20, worth(1000))]), 'lb')).toBe('lb · 1 week');
    expect(describeWindow(strip([log(2026, 10, 13, worth(1000))]), 'kg')).toBe('kg · 2 weeks');
  });
});

describe('volumeReading', () => {
  const read = (logs: WorkoutLog[]) => volumeReading(strip(logs), 'lb');

  it('has no comparison in the first week, only a running total', () => {
    expect(read([log(2026, 10, 20, worth(12400))])).toBe(
      '12,400 lb so far this week. Your first full week ends Sunday.'
    );
  });

  it('names the date the first comparison arrives once one week is complete', () => {
    expect(read([log(2026, 10, 13, worth(48900)), log(2026, 10, 20, worth(10000))])).toBe(
      'Last full week 48,900 lb. Next Monday gives you the first comparison.'
    );
  });

  it('compares the last full week with the one before it', () => {
    const logs = [
      log(2026, 10, 6, worth(100000)),
      log(2026, 10, 13, worth(104000)),
      log(2026, 10, 20, worth(61750)),
    ];

    expect(read(logs)).toBe(
      '61,750 lb so far this week. Last full week 104,000 lb, up 4 % on the one before.'
    );
  });

  it('says down when the last full week was lighter', () => {
    const logs = [
      log(2026, 10, 6, worth(100000)),
      log(2026, 10, 13, worth(93000)),
      log(2026, 10, 20, worth(1000)),
    ];

    expect(read(logs)).toContain('down 7 % on the one before.');
  });

  it('says level rather than up 0 % when the two weeks match', () => {
    const logs = [
      log(2026, 10, 6, worth(50000)),
      log(2026, 10, 13, worth(50000)),
      log(2026, 10, 20, worth(1000)),
    ];

    expect(read(logs)).toContain('Last full week 50,000 lb, level with the one before.');
  });

  it('makes no percentage against a week that moved no weight', () => {
    const logs = [log(2026, 10, 6, [hold()]), log(2026, 10, 13, worth(40000))];

    expect(read(logs)).toBe('0 lb so far this week. Last full week 40,000 lb.');
  });

  it('labels the figures with the unit setting', () => {
    expect(volumeReading(strip([log(2026, 10, 20, worth(12400))]), 'kg')).toContain('12,400 kg');
  });

  it('sets the figures apart from the words', () => {
    const segments = volumeReadingSegments(strip([log(2026, 10, 20, worth(12400))]), 'lb');

    expect(segments.filter((segment) => segment.strong).map((segment) => segment.text)).toEqual([
      '12,400 lb',
    ]);
  });
});
