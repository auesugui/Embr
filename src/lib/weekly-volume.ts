// =============================================================================
// weekly-volume — the twelve-week strip above the History list
// =============================================================================
// Volume is `totalVolume` from the workout summary, applied to a week's
// exercises instead of one session's. That is deliberate: the strip and a
// workout card can never print two different totals for the same work, and a
// hold contributes zero to both, so a week of planks is a real week worth 0.
//
// Weeks run Monday to Sunday, the same boundary the weekly goal uses, and the
// window always ends with the week containing `now` — the clock is a parameter
// so a screen left open across midnight does not keep drawing last week.

import type { Exercise, WeightUnit, WorkoutLog } from '@/types';

import { localDayKey } from './local-day';
import { localWeekKey, previousWeekKey, weekKeyForDay } from './local-week';
import { formatWeight, totalVolume } from './workout-summary';

/** The window, when there is that much history. Fewer weeks show fewer bars. */
export const STRIP_WEEKS = 12;

export interface VolumeWeek {
  /** Monday of the week, as YYYY-MM-DD. */
  weekKey: string;
  volume: number;
  /** At least one saved workout, whatever it was worth. */
  trained: boolean;
  /** The week holding today: a running total, never compared. */
  inProgress: boolean;
}

export interface VolumeStrip {
  /** Oldest first, ending with the week that holds today. */
  weeks: VolumeWeek[];
  /** The tallest week in view. Zero when no week moved any weight. */
  max: number;
}

/**
 * The strip, or null for someone with no saved workouts — the empty History
 * state says that once, and a flat row above it would say it again.
 */
export function volumeStrip(logs: WorkoutLog[], now: Date): VolumeStrip | null {
  const byWeek = new Map<string, Exercise[]>();
  let earliest: string | null = null;

  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const week = weekKeyForDay(localDayKey(date));
    const exercises = byWeek.get(week);
    if (exercises) exercises.push(...log.exercises);
    else byWeek.set(week, [...log.exercises]);
    if (earliest === null || week < earliest) earliest = week;
  }
  if (earliest === null) return null;

  const current = localWeekKey(now);
  const keys = [current];
  while (keys.length < STRIP_WEEKS && keys[0] > earliest) keys.unshift(previousWeekKey(keys[0]));

  const weeks = keys.map((weekKey) => {
    const exercises = byWeek.get(weekKey);
    return {
      weekKey,
      volume: exercises ? totalVolume(exercises) : 0,
      trained: exercises !== undefined,
      inProgress: weekKey === current,
    };
  });

  return { weeks, max: Math.max(0, ...weeks.map((week) => week.volume)) };
}

/** `lb · 12 weeks`, the label beside the heading. */
export function describeWindow(strip: VolumeStrip, units: WeightUnit): string {
  const count = strip.weeks.length;
  return `${units} · ${count} week${count === 1 ? '' : 's'}`;
}

/** A run of the sentence. The two figures are set apart from the words. */
export interface ReadingSegment {
  /** Unique within the sentence: two weeks can carry the same figure. */
  id: string;
  text: string;
  strong?: boolean;
}

/**
 * The sentence under the bars, in its parts.
 *
 * The in-progress week is printed as a running total and never compared: a
 * Monday-to-Saturday total against a full week is down a third every Monday.
 * The comparison is the last full week against the one before it, which needs
 * three weeks of window — before that the sentence names what is missing
 * rather than comparing against a week that does not exist.
 */
export function volumeReadingSegments(strip: VolumeStrip, units: WeightUnit): ReadingSegment[] {
  const { weeks } = strip;
  const running = {
    id: 'running',
    text: formatWeight(weeks[weeks.length - 1].volume, units),
    strong: true,
  };

  if (weeks.length === 1) {
    return [running, { id: 'first', text: ' so far this week. Your first full week ends Sunday.' }];
  }

  const last = {
    id: 'last',
    text: formatWeight(weeks[weeks.length - 2].volume, units),
    strong: true,
  };
  if (weeks.length === 2) {
    return [
      { id: 'lead', text: 'Last full week ' },
      last,
      { id: 'wait', text: '. Next Monday gives you the first comparison.' },
    ];
  }

  const change = describeChange(weeks[weeks.length - 2].volume, weeks[weeks.length - 3].volume);
  return [
    running,
    { id: 'lead', text: ' so far this week. Last full week ' },
    last,
    { id: 'change', text: `${change}.` },
  ];
}

/** The same sentence as one string, for a screen reader. */
export const volumeReading = (strip: VolumeStrip, units: WeightUnit): string =>
  volumeReadingSegments(strip, units)
    .map((segment) => segment.text)
    .join('');

/**
 * `, up 4 % on the one before`. Empty when the week before moved no weight at
 * all: every percentage against zero is infinite, and "up 100 %" from nothing
 * is arithmetic rather than information.
 */
function describeChange(last: number, before: number): string {
  if (before <= 0) return '';
  const percent = Math.round(((last - before) / before) * 100);
  if (percent === 0) return ', level with the one before';
  return `, ${percent > 0 ? 'up' : 'down'} ${Math.abs(percent)} % on the one before`;
}
