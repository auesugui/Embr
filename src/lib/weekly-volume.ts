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
//
// ONE UNIT PER STRIP (#85 step 2, Q3). A week with sessions in both units has
// no honest total: 4,980 kg and 21,300 lb drawn on one axis say the lb session
// was four times the work. So the strip counts the CURRENT unit only, its
// window starts at the first week holding a session in that unit, and a week
// that also held a session in the other unit keeps its ring and is named in the
// reading line. Nothing is converted, which means switching units restarts the
// trend — the price of not making the shape a lie. A lifter who has only ever
// used one unit gets the strip exactly as it reads today.

import { formatMonthDay } from '@/lib/history-calendar';
import { effectiveWeightUnit, historyHasBothUnits, otherWeightUnit } from '@/lib/weight-unit';
import type { Exercise, WeightUnit, WorkoutLog } from '@/types';

import { localDayKey } from './local-day';
import { localWeekKey, previousWeekKey, weekKeyForDay } from './local-week';
import { formatWeight, totalVolume } from './workout-summary';

/** The window, when there is that much history. Fewer weeks show fewer bars. */
export const STRIP_WEEKS = 12;

export interface VolumeWeek {
  /** Monday of the week, as YYYY-MM-DD. */
  weekKey: string;
  /** Sessions in the strip's unit only. */
  volume: number;
  /** At least one saved workout, whatever it was worth or logged in. */
  trained: boolean;
  /** The week holding today: a running total, never compared. */
  inProgress: boolean;
  /** Sessions in the other unit, left out of `volume`. Usually zero. */
  excluded: number;
}

export interface VolumeStrip {
  /** Oldest first, ending with the week that holds today. */
  weeks: VolumeWeek[];
  /** The tallest week in view. Zero when no week moved any weight. */
  max: number;
  /** What every bar is counted in: the current setting. */
  unit: WeightUnit;
  /** Saved history also holds the other unit, so the window is a short one. */
  split: boolean;
}

/** One week's sessions, split by whether the strip counts them. */
interface WeekSessions {
  counted: Exercise[];
  excluded: number;
}

/**
 * The strip, or null when no saved workout is in the current unit.
 *
 * Null is also the brand-new account — the empty History state says that once,
 * and a flat row above it would say it again. Someone whose whole history is
 * tagged with the other unit gets the same answer: there are no weeks in this
 * unit yet, and drawing twelve empty tracks would read as a layoff.
 */
export function volumeStrip(
  logs: WorkoutLog[],
  now: Date,
  setting: WeightUnit
): VolumeStrip | null {
  const byWeek = new Map<string, WeekSessions>();
  let earliest: string | null = null;

  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    const week = weekKeyForDay(localDayKey(date));
    const counts = effectiveWeightUnit(log, setting) === setting;

    let sessions = byWeek.get(week);
    if (!sessions) {
      sessions = { counted: [], excluded: 0 };
      byWeek.set(week, sessions);
    }
    if (counts) sessions.counted.push(...log.exercises);
    else sessions.excluded += 1;

    // The window starts at the first week in this unit: an earlier week that
    // held only the other unit is outside it, not an empty track inside it.
    if (counts && (earliest === null || week < earliest)) earliest = week;
  }
  if (earliest === null) return null;

  const current = localWeekKey(now);
  const keys = [current];
  while (keys.length < STRIP_WEEKS && keys[0] > earliest) keys.unshift(previousWeekKey(keys[0]));

  const weeks = keys.map((weekKey) => {
    const sessions = byWeek.get(weekKey);
    return {
      weekKey,
      volume: sessions ? totalVolume(sessions.counted) : 0,
      // A week that held only the other unit still trained: an empty track is
      // this strip's mark for "no workout logged", and reusing it for "cannot
      // be summed" makes a trained week read as a skipped one.
      trained: sessions !== undefined,
      inProgress: weekKey === current,
      excluded: sessions?.excluded ?? 0,
    };
  });

  return {
    weeks,
    max: Math.max(0, ...weeks.map((week) => week.volume)),
    unit: setting,
    split: historyHasBothUnits(logs, setting),
  };
}

/** `lb · 12 weeks`, or `kg · since Oct 12` once the window is a unit's own. */
export function describeWindow(strip: VolumeStrip): string {
  if (strip.split) return `${strip.unit} · since ${formatMonthDay(strip.weeks[0].weekKey)}`;
  const count = strip.weeks.length;
  return `${strip.unit} · ${count} week${count === 1 ? '' : 's'}`;
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
 *
 * THE COMPARISON READS TWO COMPLETED WEEKS, the last full one and the one
 * before it, so a session left out of EITHER of them leaves the percentage
 * resting on a figure that is only part of that week's work. When either has
 * one, the sentence says how many were left out and prints no percentage at
 * all — a number that cannot be trusted is left out rather than qualified,
 * which is how every other missing figure in the app is handled. The rings on
 * the bars say which weeks they were in, so the sentence does not have to.
 */
export function volumeReadingSegments(strip: VolumeStrip): ReadingSegment[] {
  const { weeks, unit } = strip;
  const running = {
    id: 'running',
    text: formatWeight(weeks[weeks.length - 1].volume, unit),
    strong: true,
  };

  if (weeks.length === 1) {
    const window = strip.split ? ` in ${unit}` : '';
    return [
      running,
      { id: 'first', text: ` so far this week. Your first full week${window} ends Sunday.` },
    ];
  }

  const previous = weeks[weeks.length - 2];
  const last = {
    id: 'last',
    text: formatWeight(previous.volume, unit),
    strong: true,
  };

  /** The sentence that states the last full week and what it left out. */
  const notCounted = (count: number): ReadingSegment[] => [
    running,
    { id: 'lead', text: ' so far this week. Last full week ' },
    last,
    { id: 'excluded', text: `, with ${describeExcluded(count, unit)}.` },
  ];

  // Nothing to compare against yet, so there is only the one week to qualify.
  if (weeks.length === 2) {
    if (previous.excluded > 0) return notCounted(previous.excluded);
    return [
      { id: 'lead', text: 'Last full week ' },
      last,
      { id: 'wait', text: '. Next Monday gives you the first comparison.' },
    ];
  }

  // The week the percentage is measured against. A session left out of it
  // skews the comparison exactly as much as one left out of the week being
  // compared, so the two are counted together and answered once.
  const baseline = weeks[weeks.length - 3];
  const excluded = previous.excluded + baseline.excluded;
  if (excluded > 0) return notCounted(excluded);

  // Both weeks are whole, so the percentage compares like with like.
  const change = describeChange(previous.volume, baseline.volume);
  return [
    running,
    { id: 'lead', text: ' so far this week. Last full week ' },
    last,
    { id: 'change', text: `${change}.` },
  ];
}

/** The same sentence as one string, for a screen reader. */
export const volumeReading = (strip: VolumeStrip): string =>
  volumeReadingSegments(strip)
    .map((segment) => segment.text)
    .join('');

/** `one lb session not counted`, `2 lb sessions not counted`. */
function describeExcluded(count: number, unit: WeightUnit): string {
  const other = otherWeightUnit(unit);
  return count === 1
    ? `one ${other} session not counted`
    : `${count} ${other} sessions not counted`;
}

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
