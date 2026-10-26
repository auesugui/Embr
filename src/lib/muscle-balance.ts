// =============================================================================
// muscle-balance — sets per muscle for one week, ranked
// =============================================================================
// THE COUNTING RULE. One performed set credits exactly ONE muscle: the PRIMARY
// muscle of the exercise it was logged under. A bench press gives chest three
// sets and triceps none; a barbell row gives back and not biceps. Secondary
// muscles would need a weighting rule and a secondary list on all 73 built-ins
// (issue #82 states the cost on the card instead).
//
// The muscle is resolved from the exercise library by base id, which is the
// same lookup the rest of the app uses: `getExerciseById` reads the user's own
// exercises before the built-in database, so a custom exercise resolves to the
// muscle its form asked for. The logged `Exercise.muscleGroups` field is NOT
// used — it is every muscle the movement touches, in no guaranteed order, so
// reading a primary muscle off it would credit whatever happens to be first.
// An exercise the library no longer knows, or one carrying a muscle outside
// `MuscleGroup`, goes to Other.
//
// A set counts when `isPerformedSet` says so and nothing else does, so this
// card and the Progress list can never disagree about what you logged. Holds
// count (seconds live in `reps`); cardio entries carry no sets and are skipped
// outright, as they are in exercise-progress.
//
// Only saved (claimed) workouts count, weeks run Monday to Sunday in local
// time — the same boundary as the weekly goal — and `now` is a required
// parameter so a tab left open across midnight cannot keep drawing last week.
// Nothing here is persisted: every number is folded out of the logs at open.

import { type MuscleGroup, getExerciseById } from '@/data';
import { isPerformedSet } from '@/lib/exercise-progress';
import { baseExerciseId } from '@/lib/metric';
import type { WorkoutLog } from '@/types';

import { formatMonthDay, monthName } from './history-calendar';
import { localDayKey } from './local-day';
import { localWeekKey, previousWeekKey, weekDayKeys, weekKeyForDay } from './local-week';

/** The Other bucket: not a muscle, so it is never ranked or named as one. */
export const OTHER_GROUP = 'other';

export type BalanceGroup = MuscleGroup | typeof OTHER_GROUP;

/**
 * Tie order, and the order untrained muscles are named in.
 *
 * Fixed here rather than taken from the `MuscleGroup` union: the approved
 * mockup calls this "the order the type declares", but the union is ordered by
 * body region (chest, back, shoulders, biceps, triceps, forearms, quads, …)
 * and every frame of the mockup is drawn in this order instead. A tied week
 * must not reshuffle between two renders, so one explicit list decides it.
 */
export const MUSCLE_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'core',
  'traps',
  'calves',
  'forearms',
];

/** Rows shown before Show all. Five keeps four exercise rows on a 390px screen. */
export const COLLAPSED_ROWS = 5;

/** Muscles that take a singular verb: "chest trails", against "calves trail". */
const SINGULAR_VERB: ReadonlySet<string> = new Set(['chest', 'back', 'core']);

const KNOWN_MUSCLES: ReadonlySet<string> = new Set(MUSCLE_ORDER);

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const COUNT_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

export interface MuscleBalanceRow {
  group: BalanceGroup;
  /** `Back`, `Other`. */
  label: string;
  sets: number;
  /** Share of the largest count on the card, 0 to 1. */
  share: number;
  /** Carries the week's largest count, and is a muscle rather than Other. */
  top: boolean;
}

export interface MuscleBalance {
  /** Monday of the week being counted, as YYYY-MM-DD. */
  weekKey: string;
  /** `Mon Oct 26 – Sun Nov 1`, the label beside the heading. */
  range: string;
  /** `Monday 26 October to Sunday 1 November`, for a screen reader. */
  rangeLong: string;
  /** Ranked: most sets first, ties by MUSCLE_ORDER, Other always last. */
  rows: MuscleBalanceRow[];
  total: number;
  /** Muscles with no performed set this week, in MUSCLE_ORDER. */
  untrained: MuscleGroup[];
  /** Names of the exercises that landed in Other, first seen first. */
  otherExercises: string[];
  /** Last week's totals. Read only by the nothing-logged-yet sentence. */
  lastWeek: { sets: number; groups: number };
}

interface Tally {
  sets: number;
  /** Only Other needs these: the sentence names the exercises worth tagging. */
  names: string[];
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

const label = (group: BalanceGroup): string =>
  group === OTHER_GROUP ? 'Other' : group.charAt(0).toUpperCase() + group.slice(1);

/** The muscle one performed set of this exercise credits. */
function groupFor(exerciseId: string): BalanceGroup {
  const muscle = getExerciseById(baseExerciseId(exerciseId))?.primaryMuscle;
  return muscle !== undefined && KNOWN_MUSCLES.has(muscle) ? muscle : OTHER_GROUP;
}

/** Performed sets per group across the claimed logs of one local week. */
function tallyWeek(logs: WorkoutLog[], weekKey: string): Map<BalanceGroup, Tally> {
  const tallies = new Map<BalanceGroup, Tally>();

  for (const log of logs) {
    if (log.claimedAt === null) continue;
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) continue;
    if (weekKeyForDay(localDayKey(date)) !== weekKey) continue;

    for (const exercise of log.exercises) {
      // A cardio entry has no sets at all; skipping it says so out loud.
      if (exercise.cardio) continue;
      const sets = exercise.sets.filter(isPerformedSet).length;
      if (sets === 0) continue;

      const group = groupFor(exercise.id);
      const tally = tallies.get(group);
      if (tally) {
        tally.sets += sets;
        if (group === OTHER_GROUP && !tally.names.includes(exercise.name)) {
          tally.names.push(exercise.name);
        }
      } else {
        tallies.set(group, { sets, names: group === OTHER_GROUP ? [exercise.name] : [] });
      }
    }
  }

  return tallies;
}

/** Most sets first, ties by MUSCLE_ORDER, Other pinned last whatever its count. */
function rank(tallies: Map<BalanceGroup, Tally>): MuscleBalanceRow[] {
  const entries = [...tallies].filter(([, tally]) => tally.sets > 0);
  const max = Math.max(0, ...entries.map(([, tally]) => tally.sets));

  entries.sort(([a, left], [b, right]) => {
    if (a === OTHER_GROUP) return 1;
    if (b === OTHER_GROUP) return -1;
    if (left.sets !== right.sets) return right.sets - left.sets;
    return MUSCLE_ORDER.indexOf(a) - MUSCLE_ORDER.indexOf(b);
  });

  return entries.map(([group, tally]) => ({
    group,
    label: label(group),
    sets: tally.sets,
    // Scaled to the largest count on the card, Other included, so no bar can
    // run past its track on a week where Other leads.
    share: max > 0 ? tally.sets / max : 0,
    top: group !== OTHER_GROUP && tally.sets === max,
  }));
}

/**
 * The week's ranking, or null for someone with no saved workout at all — the
 * Progress empty state already explains the tab, and a second empty box above
 * it would be the first thing a new user reads.
 */
export function muscleBalance(logs: WorkoutLog[], now: Date): MuscleBalance | null {
  if (!logs.some((log) => log.claimedAt !== null)) return null;

  const weekKey = localWeekKey(now);
  const tallies = tallyWeek(logs, weekKey);
  const rows = rank(tallies);
  const last = tallyWeek(logs, previousWeekKey(weekKey));
  const days = weekDayKeys(weekKey);

  return {
    weekKey,
    range: `${shortDay(days[0])} – ${shortDay(days[6])}`,
    rangeLong: `${longDay(days[0])} to ${longDay(days[6])}`,
    rows,
    total: rows.reduce((sum, row) => sum + row.sets, 0),
    untrained: MUSCLE_ORDER.filter((muscle) => !tallies.has(muscle)),
    otherExercises: tallies.get(OTHER_GROUP)?.names ?? [],
    lastWeek: {
      sets: [...last.values()].reduce((sum, tally) => sum + tally.sets, 0),
      groups: last.size,
    },
  };
}

/** The rows on screen. Other keeps the last collapsed slot, so it never hides. */
export function visibleRows(rows: MuscleBalanceRow[], expanded: boolean): MuscleBalanceRow[] {
  if (expanded || rows.length <= COLLAPSED_ROWS) return rows;
  const last = rows[rows.length - 1];
  if (last.group !== OTHER_GROUP) return rows.slice(0, COLLAPSED_ROWS);
  return [...rows.slice(0, COLLAPSED_ROWS - 1), last];
}

// -----------------------------------------------------------------------------
// The reading line
// -----------------------------------------------------------------------------

/** A run of the sentence. The figures are set apart from the words. */
export interface ReadingSegment {
  id: string;
  text: string;
  strong?: boolean;
}

/** `traps or forearms`, `back, shoulders or quads` — no Oxford comma. */
function nameList(muscles: MuscleGroup[]): string {
  if (muscles.length === 1) return muscles[0];
  return `${muscles.slice(0, -1).join(', ')} or ${muscles[muscles.length - 1]}`;
}

/**
 * The sentence under the bars, in its parts.
 *
 * The only interpretation on the card: the total, one thing worth saying about
 * the shape of the week, and what has nothing yet. No praise, no warning, and
 * no comparison against last week except on a week with nothing in it, where
 * last week's total is the one number that says what normal looks like.
 */
export function balanceReadingSegments(balance: MuscleBalance): ReadingSegment[] {
  const { rows, total, untrained, otherExercises, lastWeek } = balance;

  if (total === 0) {
    const nothing: ReadingSegment[] = [{ id: 'none', text: 'No sets yet this week.' }];
    if (lastWeek.sets === 0) return nothing;
    return [
      ...nothing,
      { id: 'lastLead', text: ' Last week you logged ' },
      { id: 'lastSets', text: plural(lastWeek.sets, 'set'), strong: true },
      { id: 'lastAcross', text: ' across ' },
      { id: 'lastGroups', text: plural(lastWeek.groups, 'muscle'), strong: true },
      { id: 'lastEnd', text: '.' },
    ];
  }

  const muscles = rows.filter((row) => row.group !== OTHER_GROUP);
  const other = rows.find((row) => row.group === OTHER_GROUP);
  const segments: ReadingSegment[] = [{ id: 'total', text: plural(total, 'set'), strong: true }];

  if (other === undefined && muscles.length === 1) {
    segments.push({ id: 'all', text: ` this week, all ${muscles[0].group}.` });
  } else if (other !== undefined) {
    segments.push({ id: 'lead', text: ' this week. ' }, ...otherSegments(other, otherExercises));
  } else if (muscles[1].sets === muscles[0].sets) {
    const level = muscles.filter((row) => row.sets === muscles[0].sets).length;
    segments.push(
      { id: 'tieLead', text: ` this week, ${COUNT_WORDS[level]} muscles level at ` },
      { id: 'tieSets', text: `${muscles[0].sets}`, strong: true },
      { id: 'tieEnd', text: '.' }
    );
  } else if (muscles[0].sets > muscles[1].sets * 3) {
    segments.push(...dominantSegments(muscles));
  } else {
    segments.push(...leaderSegments(muscles));
  }

  if (untrained.length > 0) {
    segments.push({ id: 'untrained', text: ` Nothing yet for ${nameList(untrained)}.` });
  }

  return segments;
}

/** `4 of them are in Other, from Sled Push, which has no muscle set.` */
function otherSegments(other: MuscleBalanceRow, names: string[]): ReadingSegment[] {
  const source =
    names.length === 1
      ? `from ${names[0]}, which has no muscle set`
      : `from ${plural(names.length, 'exercise')} with no muscle set`;
  return [
    { id: 'otherSets', text: `${other.sets}`, strong: true },
    { id: 'otherEnd', text: ` of them ${other.sets === 1 ? 'is' : 'are'} in Other, ${source}.` },
  ];
}

/** `Back at 24 is more than three times the next muscle. Calves have 1.` */
function dominantSegments(muscles: MuscleBalanceRow[]): ReadingSegment[] {
  const top = muscles[0];
  const trail = muscles[muscles.length - 1];
  const has = SINGULAR_VERB.has(trail.group) ? 'has' : 'have';
  return [
    { id: 'domLead', text: ` this week. ${top.label} at ` },
    { id: 'domSets', text: `${top.sets}`, strong: true },
    { id: 'domMid', text: ` is more than three times the next muscle. ${trail.label} ${has} ` },
    { id: 'domTrail', text: `${trail.sets}`, strong: true },
    { id: 'domEnd', text: '.' },
  ];
}

/** `Back leads at 14, calves trail at 2.` */
function leaderSegments(muscles: MuscleBalanceRow[]): ReadingSegment[] {
  const top = muscles[0];
  const trail = muscles[muscles.length - 1];
  const trails = SINGULAR_VERB.has(trail.group) ? 'trails' : 'trail';
  return [
    { id: 'leadIn', text: ` this week. ${top.label} leads at ` },
    { id: 'leadSets', text: `${top.sets}`, strong: true },
    { id: 'trailLead', text: `, ${trail.group} ${trails} at ` },
    { id: 'trailSets', text: `${trail.sets}`, strong: true },
    { id: 'trailEnd', text: '.' },
  ];
}

/** The same sentence as one string, for a screen reader. */
export const balanceReading = (balance: MuscleBalance): string =>
  balanceReadingSegments(balance)
    .map((segment) => segment.text)
    .join('');

// -----------------------------------------------------------------------------
// Spoken labels
// -----------------------------------------------------------------------------

/**
 * What the card itself announces. The bars carry nothing the numbers do not,
 * so they are hidden from assistive tech and this summary stands in for them.
 */
export function describeBalance(balance: MuscleBalance): string {
  const head = `Sets per muscle, ${balance.rangeLong}.`;
  if (balance.total === 0) return `${head} No sets yet this week.`;
  return `${head} ${plural(balance.total, 'set')} across ${plural(balance.rows.length, 'muscle')}.`;
}

/** `Back, 14 sets, most this week.` Never a bar length, a percentage or a rank. */
export function describeRow(row: MuscleBalanceRow): string {
  const sets = plural(row.sets, 'set');
  if (row.group === OTHER_GROUP) return `${row.label}, ${sets}, exercises with no muscle set`;
  return row.top ? `${row.label}, ${sets}, most this week` : `${row.label}, ${sets}`;
}

/** `Show all 10` on screen; `Show all 10 muscles` spoken. */
export const showAllLabel = (rows: MuscleBalanceRow[]): string => `Show all ${rows.length}`;

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

const parseDay = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

/** `Mon Oct 26`. Monday-first weekday names, as the week itself runs. */
function shortDay(key: string): string {
  return `${WEEKDAYS[(parseDay(key).getDay() + 6) % 7].slice(0, 3)} ${formatMonthDay(key)}`;
}

/** `Monday 26 October`, which is how a screen reader should say it. */
function longDay(key: string): string {
  const date = parseDay(key);
  return `${WEEKDAYS[(date.getDay() + 6) % 7]} ${date.getDate()} ${monthName(key.slice(0, 7))}`;
}
