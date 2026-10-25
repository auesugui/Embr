// =============================================================================
// Local week — Monday-to-Sunday boundaries
// =============================================================================
// Dates are constructed with local parts (not ISO strings) on purpose: the
// whole point of these helpers is that they agree with the calendar on the
// wall, and `new Date('2026-10-25')` is parsed as UTC midnight.

import {
  WEEK_DAY_INITIALS,
  daysLeftInWeek,
  localWeekKey,
  previousWeekKey,
  weekDayKeys,
  weekKeyForDay,
} from '../local-week';

// 2026-10-19 is a Monday, so that week runs to Sunday 2026-10-25.
describe('localWeekKey', () => {
  it('returns the Monday of the week', () => {
    expect(localWeekKey(new Date(2026, 9, 19, 9, 0))).toBe('2026-10-19');
    expect(localWeekKey(new Date(2026, 9, 22, 9, 0))).toBe('2026-10-19');
  });

  it('puts Sunday in the week it ends rather than the one it starts', () => {
    expect(localWeekKey(new Date(2026, 9, 25, 9, 0))).toBe('2026-10-19');
    expect(localWeekKey(new Date(2026, 9, 26, 9, 0))).toBe('2026-10-26');
  });

  it('keeps a late-evening workout in its own local day and week', () => {
    // 23:30 on the Sunday belongs to that Sunday, not to the Monday after.
    expect(localWeekKey(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-19');
    expect(localWeekKey(new Date(2026, 9, 26, 0, 30))).toBe('2026-10-26');
  });

  it('crosses a month and a year boundary', () => {
    expect(localWeekKey(new Date(2026, 10, 1, 9, 0))).toBe('2026-10-26');
    expect(localWeekKey(new Date(2027, 0, 1, 9, 0))).toBe('2026-12-28');
  });
});

describe('weekKeyForDay', () => {
  it('maps a day key to its week', () => {
    expect(weekKeyForDay('2026-10-25')).toBe('2026-10-19');
    expect(weekKeyForDay('2026-10-26')).toBe('2026-10-26');
  });
});

describe('previousWeekKey', () => {
  it('steps back seven days', () => {
    expect(previousWeekKey('2026-10-26')).toBe('2026-10-19');
    expect(previousWeekKey('2026-01-05')).toBe('2025-12-29');
  });
});

describe('weekDayKeys', () => {
  it('lists Monday through Sunday', () => {
    expect(weekDayKeys('2026-10-19')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('lines up with the day letters', () => {
    expect(weekDayKeys('2026-10-19')).toHaveLength(WEEK_DAY_INITIALS.length);
  });
});

describe('daysLeftInWeek', () => {
  it('counts today through Sunday', () => {
    expect(daysLeftInWeek(new Date(2026, 9, 19, 9, 0))).toBe(7); // Monday
    expect(daysLeftInWeek(new Date(2026, 9, 22, 9, 0))).toBe(4); // Thursday
    expect(daysLeftInWeek(new Date(2026, 9, 25, 9, 0))).toBe(1); // Sunday
  });
});
