// =============================================================================
// history-calendar — the grid, its bounds, and the day filter
// =============================================================================
// The grid is Monday-first and always whole weeks, so the cases that matter
// are the months that start on a Monday and on a Sunday, and the day keys that
// sit on a local midnight boundary.

import type { WorkoutLog } from '@/types';

import {
  COLLAPSE_AT,
  COLLAPSE_MARGIN,
  COLLAPSE_SHRINK,
  calendarRows,
  canCollapseOnScroll,
  canStepBack,
  canStepForward,
  earliestMonth,
  formatDayLabel,
  formatMonthDay,
  isCollapsed,
  logsForDay,
  monthGrid,
  monthName,
  monthOfDay,
  monthTitle,
  shiftMonth,
  trainingDayKeys,
  weekRowForDay,
} from '../history-calendar';

let nextId = 0;

/** A saved workout on a local date. `hour` lets a test sit on a day boundary. */
const log = (year: number, month: number, day: number, hour = 9): WorkoutLog =>
  ({
    id: `log-${nextId++}`,
    timestamp: new Date(year, month - 1, day, hour, 30).toISOString(),
    claimedAt: new Date(year, month - 1, day, hour, 45).toISOString(),
  }) as unknown as WorkoutLog;

const unsaved = (year: number, month: number, day: number): WorkoutLog =>
  ({ ...log(year, month, day), claimedAt: null }) as WorkoutLog;

const grid = (
  month: string,
  today: string,
  trained: string[] = [],
  selected: string | null = null
) =>
  monthGrid(month, {
    todayKey: today,
    trainedDays: new Set(trained),
    selectedKey: selected,
  });

const numbers = (days: ReturnType<typeof grid>) => days.map((cell) => cell.day);

describe('month labels', () => {
  it('names the month and the year', () => {
    expect(monthTitle('2026-10')).toBe('October 2026');
    expect(monthName('2026-07')).toBe('July');
    expect(monthOfDay('2026-07-04')).toBe('2026-07');
  });

  it('steps across a year boundary in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -4)).toBe('2026-06');
  });

  it('prints a day with and without its weekday', () => {
    expect(formatMonthDay('2026-08-03')).toBe('Aug 3');
    expect(formatDayLabel('2026-10-23')).toBe('Fri, Oct 23');
    expect(formatDayLabel('2026-10-25')).toBe('Sun, Oct 25');
  });
});

describe('monthGrid', () => {
  it('pads a month that starts mid-week into whole Monday-first rows', () => {
    // 1 October 2026 is a Thursday: three leading blanks, one trailing.
    const days = grid('2026-10', '2026-10-24');

    expect(days).toHaveLength(35);
    expect(numbers(days).slice(0, 4)).toEqual([null, null, null, 1]);
    expect(days[days.length - 1].day).toBeNull();
    expect(days[33].day).toBe(31);
  });

  it('needs no leading blanks when the month starts on a Monday', () => {
    // 1 June 2026 is a Monday.
    const days = grid('2026-06', '2026-10-24');

    expect(days[0].day).toBe(1);
    expect(days).toHaveLength(35);
  });

  it('gives a month starting on a Sunday six leading blanks and six rows', () => {
    // 1 November 2026 is a Sunday.
    const days = grid('2026-11', '2026-11-30');

    expect(numbers(days).slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(calendarRows(days)).toHaveLength(6);
  });

  it('counts the days of 28-, 30- and 31-day months', () => {
    const count = (month: string) => grid(month, '2027-12-31').filter((c) => c.key !== null).length;

    expect(count('2026-02')).toBe(28);
    expect(count('2024-02')).toBe(29);
    expect(count('2026-09')).toBe(30);
    expect(count('2026-10')).toBe(31);
  });

  it('rings today, marks training days and fills the selected one', () => {
    const days = grid('2026-10', '2026-10-24', ['2026-10-23'], '2026-10-23');
    const cell = (day: number) => days.find((c) => c.day === day);

    expect(cell(24)?.isToday).toBe(true);
    expect(cell(23)?.trained).toBe(true);
    expect(cell(23)?.selected).toBe(true);
    expect(cell(22)?.trained).toBe(false);
  });

  it('marks only the days after today as future', () => {
    const days = grid('2026-10', '2026-10-24');
    const cell = (day: number) => days.find((c) => c.day === day);

    expect(cell(23)?.isFuture).toBe(false);
    expect(cell(24)?.isFuture).toBe(false);
    expect(cell(25)?.isFuture).toBe(true);
  });
});

describe('weekRowForDay', () => {
  const week = (focus: string, selected: string | null = null) =>
    weekRowForDay(focus, {
      todayKey: '2026-10-26',
      trainedDays: new Set(['2026-10-19', '2026-09-30']),
      selectedKey: selected,
    });

  it('is the Monday-to-Sunday week holding the day', () => {
    expect(week('2026-10-21').map((cell) => cell.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('is the selected day’s own week whatever month is being browsed', () => {
    // The browsed month is irrelevant: this is built from the day itself.
    const row = week('2026-10-19', '2026-10-19');
    expect(row.find((cell) => cell.selected)?.key).toBe('2026-10-19');
    expect(row.some((cell) => cell.trained)).toBe(true);
  });

  it('spans two months when the week does, with no placeholders', () => {
    const row = week('2026-09-30', '2026-09-30');

    expect(row.map((cell) => cell.day)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(row.every((cell) => cell.key !== null)).toBe(true);
    expect(row[2].selected).toBe(true);
    expect(row[2].trained).toBe(true);
  });

  it('marks today and the days after it the same way the grid does', () => {
    const row = week('2026-10-26');

    expect(row[0].isToday).toBe(true);
    expect(row[1].isFuture).toBe(true);
    expect(row.map((cell) => cell.id)).toHaveLength(7);
  });
});

describe('isCollapsed', () => {
  const fold = (folded: boolean | null, scrolled: boolean, openedByStep = false) =>
    isCollapsed({ folded, scrolled, openedByStep });

  it('follows the scroll while the chevron has not been used', () => {
    expect(fold(null, false)).toBe(false);
    expect(fold(null, true)).toBe(true);
  });

  it('keeps the chevron’s choice through a scroll in either direction', () => {
    expect(fold(true, false)).toBe(true);
    expect(fold(false, true)).toBe(false);
  });

  it('opens on a month step, whatever the scroll and the chevron say', () => {
    expect(fold(null, true, true)).toBe(false);
    expect(fold(true, true, true)).toBe(false);
  });

  it('collapses again once the step’s expansion is given up', () => {
    // What handleScroll does when the list passes the threshold after a step.
    expect(fold(null, true, false)).toBe(true);
    // And the chevron's choice is what it goes back to, when there was one.
    expect(fold(true, false, false)).toBe(true);
  });
});

describe('canCollapseOnScroll', () => {
  // The screen the flap was measured on: a 724 px viewport, 865 px of content
  // expanded and 733 px collapsed, which leaves 9 px of scroll range.
  const VIEWPORT = 724;
  /** Content height that leaves `range` px of scroll once collapsed. */
  const expandedFor = (range: number) => VIEWPORT + range + COLLAPSE_SHRINK;
  const collapsedFor = (range: number) => VIEWPORT + range;
  const needed = COLLAPSE_AT + COLLAPSE_MARGIN;

  const cases: [string, number, number, boolean, boolean][] = [
    // name, contentHeight, viewportHeight, collapsed, allowed
    ['the short list the flap was measured on', 865, VIEWPORT, false, false],
    ['that same list once it has collapsed', 733, VIEWPORT, true, false],
    ['a long list that still scrolls collapsed', 2400, VIEWPORT, false, true],
    ['a long list measured collapsed', 2268, VIEWPORT, true, true],
    ['one pixel short of a stable collapse', expandedFor(needed - 1), VIEWPORT, false, false],
    ['exactly enough range to collapse', expandedFor(needed), VIEWPORT, false, true],
    ['one pixel more than enough', expandedFor(needed + 1), VIEWPORT, false, true],
    ['95 px of range, measured collapsed', collapsedFor(needed - 1), VIEWPORT, true, false],
    ['96 px of range, measured collapsed', collapsedFor(needed), VIEWPORT, true, true],
    ['97 px of range, measured collapsed', collapsedFor(needed + 1), VIEWPORT, true, true],
    ['content that does not fill the viewport', 400, VIEWPORT, false, false],
    ['nothing measured yet', 0, 0, false, false],
    ['a viewport measured before the content', 0, VIEWPORT, false, false],
    ['content measured before the viewport', 2400, 0, false, false],
  ];

  it.each(cases)('%s', (_name, contentHeight, viewportHeight, collapsed, allowed) => {
    expect(canCollapseOnScroll({ contentHeight, viewportHeight, collapsed })).toBe(allowed);
  });

  it('asks for 96 px of range, which is the threshold plus the margin', () => {
    expect(needed).toBe(96);
    expect(COLLAPSE_SHRINK).toBe(132);
  });
});

describe('the scroll decision handleScroll makes', () => {
  // What the screen does with the two rules together: the offset has to be
  // past the threshold and the collapse has to be able to hold.
  const scrolledPast = (offset: number, contentHeight: number, collapsed: boolean) =>
    offset > COLLAPSE_AT && canCollapseOnScroll({ contentHeight, viewportHeight: 724, collapsed });

  const fold = (folded: boolean | null, scrolled: boolean, openedByStep = false) =>
    isCollapsed({ folded, scrolled, openedByStep });

  it('leaves a short list expanded however far it is scrolled', () => {
    expect(scrolledPast(100, 865, false)).toBe(false);
    expect(fold(null, scrolledPast(100, 865, false))).toBe(false);
  });

  it('collapses a long list past the threshold and holds it there', () => {
    expect(fold(null, scrolledPast(100, 2400, false))).toBe(true);
    // Measured again after the grid shrank, the collapse still stands.
    expect(fold(null, scrolledPast(100, 2268, true))).toBe(true);
  });

  it('expands the long list again under the threshold', () => {
    expect(fold(null, scrolledPast(79, 2268, true))).toBe(false);
  });

  it('still lets the chevron collapse a short list', () => {
    expect(fold(true, scrolledPast(100, 865, false))).toBe(true);
  });
});

describe('trainingDayKeys', () => {
  it('keeps a 23:30 workout on its own local day', () => {
    expect([...trainingDayKeys([log(2026, 10, 23, 23)])]).toEqual(['2026-10-23']);
  });

  it('marks a day with two workouts once', () => {
    expect(trainingDayKeys([log(2026, 10, 17, 7), log(2026, 10, 17, 18)]).size).toBe(1);
  });

  it('ignores a workout that was never saved', () => {
    expect(trainingDayKeys([unsaved(2026, 10, 17)]).size).toBe(0);
  });
});

describe('month bounds', () => {
  const logs = [log(2026, 6, 1), log(2026, 10, 23)];

  it('starts at the month of the first saved workout', () => {
    expect(earliestMonth(logs)).toBe('2026-06');
    expect(earliestMonth([unsaved(2026, 6, 1)])).toBeNull();
  });

  it('stops stepping back at the earliest month', () => {
    expect(canStepBack('2026-07', '2026-06')).toBe(true);
    expect(canStepBack('2026-06', '2026-06')).toBe(false);
    expect(canStepBack('2026-06', null)).toBe(false);
  });

  it('stops stepping forward at the current month', () => {
    expect(canStepForward('2026-09', '2026-10-24')).toBe(true);
    expect(canStepForward('2026-10', '2026-10-24')).toBe(false);
  });
});

describe('logsForDay', () => {
  it('returns the day’s saved workouts, newest first', () => {
    const morning = log(2026, 10, 17, 7);
    const evening = log(2026, 10, 17, 18);
    const other = log(2026, 10, 16);

    expect(logsForDay([morning, other, evening], '2026-10-17')).toEqual([evening, morning]);
  });

  it('is empty for a day with nothing on it', () => {
    expect(logsForDay([log(2026, 10, 17)], '2026-10-18')).toEqual([]);
  });

  it('leaves out a workout that was never saved', () => {
    expect(logsForDay([unsaved(2026, 10, 17)], '2026-10-17')).toEqual([]);
  });
});
