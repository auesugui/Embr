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
import { weekDayKeys, weekKeyForDay } from './local-week';
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

export interface GridOptions {
  todayKey: string;
  trainedDays: ReadonlySet<string>;
  selectedKey: string | null;
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

/** One day, read the same way wherever a cell is built. */
const dayCell = (
  key: string,
  { todayKey, trainedDays, selectedKey }: GridOptions
): CalendarDay => ({
  id: key,
  key,
  day: Number(key.slice(8)),
  trained: trainedDays.has(key),
  isToday: key === todayKey,
  // YYYY-MM-DD compares chronologically as plain text.
  isFuture: key > todayKey,
  selected: key === selectedKey,
});

/**
 * One month as whole Monday-first weeks, leading and trailing placeholders
 * included so the cells always divide into rows of seven.
 */
export function monthGrid(month: string, options: GridOptions): CalendarDay[] {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(year, index - 1, 1, 12);
  // Day 0 of the next month is the last day of this one.
  const length = new Date(year, index, 0, 12).getDate();

  const days: CalendarDay[] = [];
  for (let lead = (first.getDay() + 6) % 7; lead > 0; lead--) days.push(blank(`lead-${lead}`));
  for (let day = 1; day <= length; day++) {
    days.push(dayCell(localDayKey(new Date(year, index - 1, day, 12)), options));
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
 * The Monday-to-Sunday week holding `key`, as seven real cells.
 *
 * Built from the day itself rather than looked up in the viewed month's grid.
 * A selected day survives stepping to another month, and the collapsed row has
 * to keep showing the day being filtered by rather than the first week of
 * whatever month is being browsed. The week can therefore span two months, and
 * it has no placeholders: every one of its days exists.
 */
export function weekRowForDay(key: string, options: GridOptions): CalendarDay[] {
  return weekDayKeys(weekKeyForDay(key)).map((day) => dayCell(day, options));
}

// -----------------------------------------------------------------------------
// The collapse
// -----------------------------------------------------------------------------

/** Scroll past this many pixels and the grid drops to one week. */
export const COLLAPSE_AT = 80;

/** One day cell's height, and the gap above each grid row. */
export const CALENDAR_CELL_HEIGHT = 31;
export const CALENDAR_ROW_GAP = 2;

/**
 * Height the collapse takes away: a five-row month keeps one week, so four
 * rows go. Read off the cell HistoryCalendar draws the grid with, not written
 * as the 132 px it comes to, so restyling a row moves this with it.
 */
export const COLLAPSE_SHRINK = 4 * (CALENDAR_CELL_HEIGHT + CALENDAR_ROW_GAP);

/** Scroll range the collapse has to leave above COLLAPSE_AT to be stable. */
export const COLLAPSE_MARGIN = 16;

export interface ScrollExtent {
  /** The list's content height as measured now, collapsed or not. */
  contentHeight: number;
  /** The visible height of the list. */
  viewportHeight: number;
  /** Whether contentHeight was measured with the grid already collapsed. */
  collapsed: boolean;
}

/**
 * Whether a scroll past COLLAPSE_AT may collapse the grid.
 *
 * Collapsing shortens the content, and the browser then clamps the offset to
 * whatever scroll range is left. On a short list that lands under COLLAPSE_AT,
 * the next scroll event expands the grid again, and the header flaps. So the
 * collapse is only allowed when the collapsed list would still have enough
 * range to hold an offset past the threshold, with COLLAPSE_MARGIN to spare.
 *
 * Before the first layout both heights are 0 and nothing may collapse: the
 * list has not been measured, and an unmeasured list is not known to scroll.
 */
export function canCollapseOnScroll({
  contentHeight,
  viewportHeight,
  collapsed,
}: ScrollExtent): boolean {
  if (contentHeight <= 0 || viewportHeight <= 0) return false;
  const collapsedHeight = collapsed ? contentHeight : contentHeight - COLLAPSE_SHRINK;
  return collapsedHeight - viewportHeight >= COLLAPSE_AT + COLLAPSE_MARGIN;
}

export interface FoldState {
  /** The chevron's choice, kept for the visit. Null while scrolling decides. */
  folded: boolean | null;
  /** The list is scrolled past COLLAPSE_AT. */
  scrolled: boolean;
  /** A month step opened the grid, until the list passes the threshold again. */
  openedByStep: boolean;
}

/**
 * Whether the calendar shows one week instead of the whole month.
 *
 * Three inputs, in order of who wins. A month step opens the grid, because
 * collapsed a step would change nothing you can see — but only until the list
 * is scrolled past the threshold again, which hands control back rather than
 * leaving the screen stuck open until the chevron is touched. The chevron is a
 * deliberate choice and keeps for the visit. Otherwise the scroll decides.
 */
export const isCollapsed = ({ folded, scrolled, openedByStep }: FoldState): boolean =>
  openedByStep ? false : (folded ?? scrolled);

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
