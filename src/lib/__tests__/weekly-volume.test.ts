// =============================================================================
// weekly-volume — the twelve-week strip and the sentence under it
// =============================================================================
// The two things worth getting wrong here are a week with workouts and no
// volume (a week of holds, which is real work) against a week with no workouts
// at all, and the in-progress week, which is a running total and is never the
// subject of a comparison.

import type { Exercise, LoggedSet, WeightUnit, WorkoutLog } from '@/types';

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

const strip = (logs: WorkoutLog[], setting: WeightUnit = 'lb', now: Date = TODAY) => {
  const value = volumeStrip(logs, now, setting);
  if (value === null) throw new Error('expected a strip');
  return value;
};

describe('volumeStrip', () => {
  it('is null for someone with no saved workouts', () => {
    expect(volumeStrip([], TODAY, 'lb')).toBeNull();
    expect(
      volumeStrip([{ ...log(2026, 10, 20, worth(1000)), claimedAt: null }], TODAY, 'lb')
    ).toBeNull();
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
    expect(describeWindow(strip([log(2026, 10, 20, worth(1000))]))).toBe('lb · 1 week');
    expect(describeWindow(strip([log(2026, 10, 13, worth(1000))], 'kg'))).toBe('kg · 2 weeks');
  });
});

describe('volumeReading', () => {
  const read = (logs: WorkoutLog[]) => volumeReading(strip(logs));

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
    expect(volumeReading(strip([log(2026, 10, 20, worth(12400))], 'kg'))).toContain('12,400 kg');
  });

  it('sets the figures apart from the words', () => {
    const segments = volumeReadingSegments(strip([log(2026, 10, 20, worth(12400))]));

    expect(segments.filter((segment) => segment.strong).map((segment) => segment.text)).toEqual([
      '12,400 lb',
    ]);
  });
});

// -----------------------------------------------------------------------------
// One unit per strip (issue #85 step 2)
// -----------------------------------------------------------------------------
// A week with sessions in both units has no honest total, so the strip counts
// the current unit only. What has to hold: a lifter with one unit gets today's
// strip, and a trained week whose sessions were all excluded is still a trained
// week rather than an empty track.

describe('volumeStrip — units', () => {
  /** A log worth `volume`, stamped with the unit it was logged in. */
  const inUnit = (
    year: number,
    month: number,
    day: number,
    volume: number,
    weightUnit: WeightUnit,
    hour = 9
  ): WorkoutLog => ({ ...log(year, month, day, worth(volume), hour), weightUnit });

  it('counts the current unit and leaves the other out of the total', () => {
    const value = strip(
      [inUnit(2026, 10, 20, 4980, 'kg'), inUnit(2026, 10, 20, 21300, 'lb', 18)],
      'kg'
    );
    const week = value.weeks[value.weeks.length - 1];

    expect(week.volume).toBe(4980);
    expect(week.excluded).toBe(1);
    expect(week.trained).toBe(true);
  });

  it('starts the window at the first week in this unit', () => {
    const value = strip(
      [
        inUnit(2025, 1, 6, 1000, 'lb'),
        inUnit(2026, 10, 12, 4980, 'kg'),
        inUnit(2026, 10, 20, 5270, 'kg'),
      ],
      'kg'
    );

    expect(value.weeks.map((week) => week.weekKey)).toEqual(['2026-10-12', '2026-10-19']);
    expect(value.split).toBe(true);
  });

  it('keeps a week whose only sessions were in the other unit as trained', () => {
    const value = strip(
      [
        inUnit(2026, 10, 5, 4000, 'kg'),
        inUnit(2026, 10, 13, 21300, 'lb'),
        inUnit(2026, 10, 20, 4000, 'kg'),
      ],
      'kg'
    );
    const mixed = value.weeks.find((week) => week.weekKey === '2026-10-12');

    expect(mixed?.trained).toBe(true);
    expect(mixed?.volume).toBe(0);
    expect(mixed?.excluded).toBe(1);
  });

  it('is null when no saved workout is in this unit', () => {
    expect(volumeStrip([inUnit(2026, 10, 20, 4980, 'kg')], TODAY, 'lb')).toBeNull();
  });

  it('moves the logs that carry no unit with the setting', () => {
    const logs = [log(2026, 10, 20, worth(4980)), inUnit(2026, 10, 20, 21300, 'lb', 18)];

    // On lb both read as lb, so nothing is excluded and the window is whole.
    expect(strip(logs, 'lb').weeks[0].excluded).toBe(0);
    expect(strip(logs, 'lb').split).toBe(false);
    // On kg the legacy session is kg and the stamped one is left out.
    expect(strip(logs, 'kg').weeks[0].excluded).toBe(1);
  });

  it('leaves a one-unit lifter’s strip exactly as it was', () => {
    const logs = [log(2026, 10, 13, worth(48900)), log(2026, 10, 20, worth(10000))];
    const value = strip(logs);

    expect(value.split).toBe(false);
    expect(value.weeks.every((week) => week.excluded === 0)).toBe(true);
    expect(describeWindow(value)).toBe('lb · 2 weeks');
  });
});

describe('describeWindow — units', () => {
  it('carries the window’s start once the history holds both units', () => {
    const logs = [
      { ...log(2026, 10, 12, worth(4980)), weightUnit: 'kg' as WeightUnit },
      { ...log(2026, 10, 20, worth(5270)), weightUnit: 'lb' as WeightUnit },
    ];

    expect(describeWindow(strip(logs, 'kg'))).toBe('kg · since Oct 12');
  });
});

describe('volumeReading — units', () => {
  const inUnit = (
    year: number,
    month: number,
    day: number,
    volume: number,
    weightUnit: WeightUnit,
    hour = 9
  ): WorkoutLog => ({ ...log(year, month, day, worth(volume), hour), weightUnit });

  it('names the excluded session instead of comparing', () => {
    const logs = [
      inUnit(2026, 10, 12, 41450, 'kg'),
      inUnit(2026, 10, 15, 21300, 'lb'),
      inUnit(2026, 10, 20, 32900, 'kg'),
    ];

    expect(volumeReading(strip(logs, 'kg'))).toBe(
      '32,900 kg so far this week. Last full week 41,450 kg, with one lb session not counted.'
    );
  });

  it('counts more than one excluded session in the plural', () => {
    const logs = [
      inUnit(2026, 10, 12, 41450, 'kg'),
      inUnit(2026, 10, 15, 21300, 'lb'),
      inUnit(2026, 10, 16, 20000, 'lb'),
      inUnit(2026, 10, 20, 32900, 'kg'),
    ];

    expect(volumeReading(strip(logs, 'kg'))).toContain('with 2 lb sessions not counted.');
  });

  // The comparison reads the last full week AND the one before it, so a
  // session left out of either leaves the percentage resting on part of a
  // week. The window here is the weeks of Oct 5, Oct 12 and Oct 19 (today).
  describe('a comparison with a session left out of it', () => {
    const weeks = (over: { baseline?: WorkoutLog[]; lastFull?: WorkoutLog[] } = {}) => [
      inUnit(2026, 10, 5, 100000, 'kg'),
      ...(over.baseline ?? []),
      inUnit(2026, 10, 12, 104000, 'kg'),
      ...(over.lastFull ?? []),
      inUnit(2026, 10, 20, 61750, 'kg'),
    ];

    it('prints the percentage when neither compared week left anything out', () => {
      // The lb session is in the week in progress, which is never compared.
      const logs = [...weeks(), inUnit(2026, 10, 21, 21300, 'lb')];

      expect(volumeReading(strip(logs, 'kg'))).toBe(
        '61,750 kg so far this week. Last full week 104,000 kg, up 4 % on the one before.'
      );
    });

    it('drops the percentage when the week being compared left one out', () => {
      const logs = weeks({ lastFull: [inUnit(2026, 10, 14, 21300, 'lb')] });

      expect(volumeReading(strip(logs, 'kg'))).toBe(
        '61,750 kg so far this week. Last full week 104,000 kg, with one lb session not counted.'
      );
    });

    it('drops it when the week it is measured AGAINST left one out', () => {
      const logs = weeks({ baseline: [inUnit(2026, 10, 7, 21300, 'lb')] });

      expect(volumeReading(strip(logs, 'kg'))).toBe(
        '61,750 kg so far this week. Last full week 104,000 kg, with one lb session not counted.'
      );
    });

    it('counts both weeks together when each left one out', () => {
      const logs = weeks({
        baseline: [inUnit(2026, 10, 7, 21300, 'lb')],
        lastFull: [inUnit(2026, 10, 14, 20000, 'lb')],
      });

      expect(volumeReading(strip(logs, 'kg'))).toBe(
        '61,750 kg so far this week. Last full week 104,000 kg, with 2 lb sessions not counted.'
      );
    });

    it('still reads as one when both left-out sessions fall in one week', () => {
      const logs = weeks({
        baseline: [inUnit(2026, 10, 7, 21300, 'lb'), inUnit(2026, 10, 8, 20000, 'lb')],
      });

      expect(volumeReading(strip(logs, 'kg'))).toContain('with 2 lb sessions not counted.');
    });
  });

  it('names the unit in the first week after a switch', () => {
    const logs = [inUnit(2026, 10, 6, 21300, 'lb'), inUnit(2026, 10, 20, 4980, 'kg')];

    expect(volumeReading(strip(logs, 'kg'))).toBe(
      '4,980 kg so far this week. Your first full week in kg ends Sunday.'
    );
  });

  it('leaves the first-week sentence alone for a lifter with one unit', () => {
    expect(volumeReading(strip([log(2026, 10, 20, worth(12400))]))).toBe(
      '12,400 lb so far this week. Your first full week ends Sunday.'
    );
  });
});
