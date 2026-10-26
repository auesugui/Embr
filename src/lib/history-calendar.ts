// =============================================================================
// history-calendar — the month grid, its bounds, and the day filter
// =============================================================================
// All of it is folded out of the saved logs when History renders. Nothing here
// is persisted: the viewed month and the selected day are component state.
//
// A training day is a local calendar day with at least one saved workout, which
// is the same reading the weekly goal uses — so a day the home dots count is a
// day this calendar marks, and two workouts on one day are one marked day.
//
// The clock is a parameter everywhere it is needed. History can stay open
// across midnight (see useLocalDay), and a grid built from a captured
// `new Date()` would go on ringing yesterday.

import type { WorkoutLog } from '@/types';

import { getClaimedLogs } from './history-stats';
import { localDayKey } from './local-day';
import { trainedDaysByWeek } from './weekly-goal';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Monday first, matching WEEK_DAY_INITIALS and the grid. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Noon, so a DST shift cannot push the date onto the neighbouring day. */
function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

// -----------------------------------------------------------------------------
// Months
// -----------------------------------------------------------------------------

/** The month the local day `key` belongs to, as YYYY-MM. */
export const monthOfDay = (key: string): string => key.slice(0, 7);

/** `October 2026`, the calendar's title. */
export function monthTitle(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return `${MONTHS[index - 1]} ${year}`;
}

/** `October` — the empty-month line and the collapsed nav bar. */
export const monthName = (month: string): string => MONTHS[Number(month.split('-')[1]) - 1];

/** The month `delta` months from `month`, as YYYY-MM. */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  return monthOfDay(localDayKey(new Date(year, index - 1 + delta, 1, 12)));
}

/** `Aug 3`. */
export function formatMonthDay(key: string): string {
  const date = parseDayKey(key);
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/** `Fri, Oct 23`, the Showing line's date. */
export function formatDayLabel(key: string): string {
  const date = parseDayKey(key);
  return `${WEEKDAYS[(date.getDay() + 6) % 7]}, ${formatMonthDay(key)}`;
}

// -----------------------------------------------------------------------------
// The grid
// -----------------------------------------------------------------------------

export interface CalendarDay {
  /** Unique within the grid, placeholders included — the cell's React key. */
  id: string;
  /** The local day key, or null for a leading or trailing placeholder. */
  key: string | null;
  day: number | null;
  trained: boolean;
  isToday: boolean;
  /** After today. There is nothing to filter to, so the cell does nothing. */
  isFuture: boolean;
  selected: boolean;
}

const blank = (id: string): CalendarDay => ({
  id,
  key: null,
  day: null,
  trained: false,
  isToday: false,
  isFuture: false,
  selected: false,
});

/**
 * One month as whole Monday-first weeks, leading and trailing placeholders
 * included so the cells always divide into rows of seven.
 */
export function monthGrid(
  month: string,
  {
    todayKey,
    trainedDays,
    selectedKey,
  }: { todayKey: string; trainedDays: ReadonlySet<string>; selectedKey: string | null }
): CalendarDay[] {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(year, index - 1, 1, 12);
  // Day 0 of the next month is the last day of this one.
  const length = new Date(year, index, 0, 12).getDate();

  const days: CalendarDay[] = [];
  for (let lead = (first.getDay() + 6) % 7; lead > 0; lead--) days.push(blank(`lead-${lead}`));
  for (let day = 1; day <= length; day++) {
    const key = localDayKey(new Date(year, index - 1, day, 12));
    days.push({
      id: key,
      key,
      day,
      trained: trainedDays.has(key),
      isToday: key === todayKey,
      // YYYY-MM-DD compares chronologically as plain text.
      isFuture: key > todayKey,
      selected: key === selectedKey,
    });
  }
  while (days.length % 7 !== 0) days.push(blank(`trail-${days.length}`));
  return days;
}

/** The grid as rows of seven. */
export function calendarRows(days: CalendarDay[]): CalendarDay[][] {
  const rows: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

/**
 * The row holding `key`, or the first row when this month does not hold it —
 * which is what the collapsed calendar shows after you step to another month.
 */
export function rowForDay(rows: CalendarDay[][], key: string): CalendarDay[] {
  return rows.find((row) => row.some((cell) => cell.key === key)) ?? rows[0];
}

// -----------------------------------------------------------------------------
// What the logs say
// -----------------------------------------------------------------------------

/** Local days with at least one saved workout. */
export function trainingDayKeys(logs: WorkoutLog[]): Set<string> {
  // Through the weekly goal's grouping rather than a second filter of its own:
  // "a day you trained" has to mean the same thing on both screens.
  const days = new Set<string>();
  for (const week of trainedDaysByWeek(logs).values()) {
    for (const day of week) days.add(day);
  }
  return days;
}

/** The month of the earliest saved workout, or null when there is none. */
export function earliestMonth(logs: WorkoutLog[]): string | null {
  let earliest: string | null = null;
  for (const day of trainingDayKeys(logs)) {
    if (earliest === null || day < earliest) earliest = day;
  }
  return earliest === null ? null : monthOfDay(earliest);
}

/** The saved workouts on `dayKey`, newest first — the list's own order. */
export function logsForDay(logs: WorkoutLog[], dayKey: string): WorkoutLog[] {
  return getClaimedLogs(logs).filter((log) => localDayKey(new Date(log.timestamp)) === dayKey);
}

/** False at the month of the first logged workout, and when there is none. */
export const canStepBack = (month: string, earliest: string | null): boolean =>
  earliest !== null && month > earliest;

/** False at the current month: there is nothing logged after today. */
export const canStepForward = (month: string, todayKey: string): boolean =>
  month < monthOfDay(todayKey);
