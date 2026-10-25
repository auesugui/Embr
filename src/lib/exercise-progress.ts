// =============================================================================
// exercise-progress — one series per exercise, derived from logged history
// =============================================================================
// The Progress tab and the exercise detail screen both read from here. Nothing
// new is persisted: every number on both screens is recomputed from the logged
// sets of claimed workouts, so a workout typed in for a past date lands in the
// series at its own date.
//
// THE SESSION RULE. One point per claimed session, in session order. A session
// is a LOG, not an entry: the Powerbuilding templates carry the same movement
// twice (a heavy entry and a back-off entry), and those are one session of it.
// Every entry of the movement in a log has its logged sets merged before the
// session's best set is picked, so the point reads the heavier of the two.
//
// Each session's best logged set is read in its own terms:
//
//   hold (metric 'time')   the longest hold, in seconds
//   any weight logged      the heaviest weight, with the reps it was done for
//   no weight logged       the best reps
//
// THE SERIES RULE. The exercise's series metric is the hold, when the most
// recent session is one; otherwise weight when any session carried a weight;
// otherwise reps. `comparable` is the subset of sessions measured in that
// metric, and it is the only thing the chart and the PR list ever read — reps
// are never compared with weights, and a plotted line never changes units
// partway along.
//
// EVERY SESSION STILL COUNTS. `points` holds all of them whatever their
// metric, and that is what the list ordering, the last logged date, the
// session count and the History row read. So a lift you did bodyweight last
// Tuesday keeps its place at the top of the list and is counted, while the
// chart and the records stay in weights. When the most recent session is not
// in the series metric, a caller showing "the latest" shows that session in
// its own terms (`point.metric`).
//
// Sets with `logged: false` are not part of the record and are ignored. A
// session whose logged sets produce no positive value is not a point at all.
// Cardio entries carry no sets and are left out entirely. Two sessions on the
// same calendar day stay two points — the session is the unit, not the day.
//
// A WorkoutLog carries no weight unit, so the series has no unit of its own.
// Callers label it with the current setting, exactly as the History screen
// does.

import { getClaimedLogs } from '@/lib/history-stats';
import { baseExerciseId, exerciseMetric, formatSeconds } from '@/lib/metric';
import type { LoggedSet, WeightUnit, WorkoutLog } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long after a logged PR the list still badges the exercise. */
const PR_BADGE_DAYS = 14;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** What the series measures. `time` is seconds held. */
export type ProgressMetric = 'weight' | 'reps' | 'time';

export interface ProgressPoint {
  /** The claimed log this point came from. */
  logId: string;
  /** ISO timestamp of the session. */
  timestamp: string;
  /** What this session's own best set measures. */
  metric: ProgressMetric;
  /** Heaviest weight, best reps, or longest hold in seconds — per `metric`. */
  value: number;
  /** Reps at the best set. Only carries information on a `weight` point. */
  reps: number;
  /** A logged set in this session was flagged a PR when it was logged. */
  hasPR: boolean;
}

export interface ExerciseProgress {
  /** Library id, with the session's positional suffix stripped. */
  exerciseId: string;
  /** The name as the most recent log spells it. */
  name: string;
  /** What the chart and the PR list are measured in. */
  metric: ProgressMetric;
  /** Every session, whatever its metric. Oldest first, never empty. */
  points: ProgressPoint[];
  /** The subset in `metric` — what the chart and the PR list plot. Never empty. */
  comparable: ProgressPoint[];
}

export interface ProgressRecord {
  timestamp: string;
  value: number;
  /** The record this one beat, or null for the first one. */
  previous: number | null;
}

export type ProgressRange = '8W' | '3M' | '6M' | '1Y' | 'All';

export const PROGRESS_RANGES: ProgressRange[] = ['8W', '3M', '6M', '1Y', 'All'];

export const DEFAULT_PROGRESS_RANGE: ProgressRange = '3M';

const RANGE_DAYS: Record<Exclude<ProgressRange, 'All'>, number> = {
  '8W': 56,
  '3M': 91,
  '6M': 182,
  '1Y': 365,
};

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

/** One session's logged sets of one exercise, merged across repeated entries. */
interface RawSession {
  logId: string;
  timestamp: string;
  /** What the movement measures, from the last entry of it in the log. */
  metric: 'reps' | 'time';
  sets: LoggedSet[];
}

interface RawGroup {
  exerciseId: string;
  name: string;
  /** Keyed by log id — that key is what merges the repeated entries. */
  sessions: Map<string, RawSession>;
}

/** The best set of a session, read under the resolved metric. */
function bestSet(sets: LoggedSet[], metric: ProgressMetric): { value: number; reps: number } {
  if (metric === 'weight') {
    let best = { value: 0, reps: 0 };
    for (const set of sets) {
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      // A tie on weight is broken by reps, so "275 lb × 5" names the hardest
      // set of the session rather than whichever row came first.
      if (weight > best.value || (weight === best.value && reps > best.reps)) {
        best = { value: weight, reps };
      }
    }
    return best;
  }

  // Reps and seconds are both `LoggedSet.reps` — see src/lib/metric.ts.
  let value = 0;
  for (const set of sets) value = Math.max(value, set.reps ?? 0);
  return { value, reps: value };
}

/**
 * Every exercise with logged history, each with its own series.
 *
 * Ordered by last logged date, newest first — what you trained this week is at
 * the top, which is the ordering the Progress list wants.
 */
export function buildExerciseProgress(logs: WorkoutLog[]): ExerciseProgress[] {
  const groups = new Map<string, RawGroup>();

  // Oldest first, so the last write of a name is the most recent one and the
  // points come out in session order without a second sort.
  for (const log of [...getClaimedLogs(logs)].reverse()) {
    for (const exercise of log.exercises) {
      if (exercise.cardio) continue;

      const sets = exercise.sets.filter((set) => set.logged);
      if (sets.length === 0) continue;

      const exerciseId = baseExerciseId(exercise.id);
      let group = groups.get(exerciseId);
      if (!group) {
        group = { exerciseId, name: exercise.name, sessions: new Map() };
        groups.set(exerciseId, group);
      }
      group.name = exercise.name;

      // Repeated entries of one movement in one log are one session of it.
      const session = group.sessions.get(log.id);
      if (session) {
        session.sets.push(...sets);
        session.metric = exerciseMetric(exercise);
      } else {
        group.sessions.set(log.id, {
          logId: log.id,
          timestamp: log.timestamp,
          metric: exerciseMetric(exercise),
          sets: [...sets],
        });
      }
    }
  }

  const progress: ExerciseProgress[] = [];

  for (const group of groups.values()) {
    const points: ProgressPoint[] = [];
    // Insertion order is log order, which is session order.
    for (const session of group.sessions.values()) {
      const metric: ProgressMetric =
        session.metric === 'time'
          ? 'time'
          : session.sets.some((set) => (set.weight ?? 0) > 0)
            ? 'weight'
            : 'reps';
      const { value, reps } = bestSet(session.sets, metric);
      if (value <= 0) continue;
      points.push({
        logId: session.logId,
        timestamp: session.timestamp,
        metric,
        value,
        reps,
        hasPR: session.sets.some((set) => set.isPR),
      });
    }

    if (points.length === 0) continue;

    // A hold is a property of the movement, so the most recent session decides
    // it. Otherwise weight wins over reps wherever both were logged, and the
    // latest session always has a metric, so `comparable` is never empty.
    const latest = points[points.length - 1];
    const metric: ProgressMetric =
      latest.metric === 'time'
        ? 'time'
        : points.some((point) => point.metric === 'weight')
          ? 'weight'
          : 'reps';

    progress.push({
      exerciseId: group.exerciseId,
      name: group.name,
      metric,
      points,
      comparable: points.filter((point) => point.metric === metric),
    });
  }

  return progress.sort(
    (a, b) =>
      Date.parse(b.points[b.points.length - 1].timestamp) -
      Date.parse(a.points[a.points.length - 1].timestamp)
  );
}

/** One exercise's series, or null when nothing has been logged for it. */
export function findExerciseProgress(
  logs: WorkoutLog[],
  exerciseId: string
): ExerciseProgress | null {
  const wanted = baseExerciseId(exerciseId);
  return buildExerciseProgress(logs).find((p) => p.exerciseId === wanted) ?? null;
}

/**
 * The points inside a range chip's window.
 *
 * The window is counted back from now, not from the last session, so a chip on
 * an exercise you stopped doing can legitimately come back empty.
 */
export function rangePoints(
  points: ProgressPoint[],
  range: ProgressRange,
  nowMs: number = Date.now()
): ProgressPoint[] {
  if (range === 'All') return points;
  const since = nowMs - RANGE_DAYS[range] * DAY_MS;
  return points.filter((point) => Date.parse(point.timestamp) >= since);
}

/**
 * The PR history: every session that beat the running maximum, newest first.
 *
 * Derived rather than read from `prStore`, because the store keeps only the
 * current record per exercise — the progression is in the sessions.
 */
export function progressRecords(points: ProgressPoint[]): ProgressRecord[] {
  const records: ProgressRecord[] = [];
  let max = 0;

  for (const point of points) {
    if (point.value <= max) continue;
    records.push({
      timestamp: point.timestamp,
      value: point.value,
      previous: records.length === 0 ? null : max,
    });
    max = point.value;
  }

  return records.reverse();
}

/** True when a set logged in the badge window was flagged a PR at the time. */
export function hasRecentPR(points: ProgressPoint[], nowMs: number = Date.now()): boolean {
  const since = nowMs - PR_BADGE_DAYS * DAY_MS;
  return points.some((point) => point.hasPR && Date.parse(point.timestamp) >= since);
}

// -----------------------------------------------------------------------------
// Chart axis
// -----------------------------------------------------------------------------

/** The nearest 1 / 2 / 2.5 / 5 × 10ⁿ at or above `raw`. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const multiple of [1, 2, 2.5, 5]) {
    if (raw <= pow * multiple) return pow * multiple;
  }
  return pow * 10;
}

/**
 * The chart's three gridline values, lowest first.
 *
 * The floor is rounded down to a whole step so the labels read as round
 * numbers, and the step is walked up the ladder until two of them actually
 * reach the highest session. Without that walk a narrow window like 177–192
 * picks a step of 10, floors to 170, and tops out at 190 — with the series
 * drawn two pounds outside its own band.
 */
export function chartAxis(values: number[]): [number, number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Nothing changed: centre the value in its own band. Pinned to the floor it
  // would read as a collapse, which is not what a plateau is.
  if (max === min) {
    const step = niceStep(Math.max(max, 4) / 4);
    return [max - step, max, max + step];
  }

  let step = niceStep((max - min) / 2);
  for (let attempt = 0; attempt < 6; attempt++) {
    const low = Math.floor(min / step) * step;
    if (low + step * 2 >= max) return [low, low + step, low + step * 2];
    step = niceStep(step * 1.5);
  }
  return [min, (min + max) / 2, max];
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

/** "Oct 23" — the local calendar day, month short and day numeric (en-US). */
export function formatProgressDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** One series value with its units: `275 lb`, `12 reps`, `45s`. */
export function formatProgressValue(
  value: number,
  metric: ProgressMetric,
  units: WeightUnit
): string {
  if (metric === 'time') return formatSeconds(value);
  if (metric === 'reps') return `${value} reps`;
  return `${value} ${units}`;
}

/** The bare number for a chart axis, where the unit is stated in the caption. */
export function formatProgressAxis(value: number, metric: ProgressMetric): string {
  return metric === 'time' ? formatSeconds(value) : `${value}`;
}

/** A list row's summary: `275 lb × 5 · Oct 23`, `12 reps · Oct 23`, `45s · Oct 23`. */
export function summarizePoint(
  point: ProgressPoint,
  metric: ProgressMetric,
  units: WeightUnit
): string {
  const date = formatProgressDate(point.timestamp);
  if (metric === 'weight') return `${point.value} ${units} × ${point.reps} · ${date}`;
  return `${formatProgressValue(point.value, metric, units)} · ${date}`;
}

/** What the chart is plotting, for the caption under it. */
export function describeSeries(metric: ProgressMetric, units: WeightUnit): string {
  if (metric === 'time') return 'Longest hold per session.';
  if (metric === 'reps') return 'Best set per session, in reps.';
  return `Heaviest set per session, in ${units}.`;
}

/** What the headline number is, for the caption under it. */
export function describeLatest(metric: ProgressMetric): string {
  if (metric === 'time') return 'Longest hold';
  if (metric === 'reps') return 'Best set';
  return 'Heaviest set';
}

/** The headline number split into a big part and the small unit beside it. */
export function splitHeadline(
  value: number,
  metric: ProgressMetric,
  units: WeightUnit
): { value: string; unit: string | null } {
  if (metric === 'time') return { value: formatSeconds(value), unit: null };
  return { value: `${value}`, unit: metric === 'reps' ? 'reps' : units };
}
