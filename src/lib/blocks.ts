// =============================================================================
// Blocks — how a chunk of work is bounded, and by what clock
// =============================================================================
// A *block* is one or more exercises sharing a single clock and a single round
// counter. "5 pull-ups, 10 push-ups, 15 squats, AMRAP 20 min" is one block with
// three members; a plain 4×8 bench press is a block of one in `sets` mode.
//
// WHY A SIDE TABLE AND NOT NESTING
// The obvious model is `day.blocks[].exercises[]`. It is also the one model we
// cannot have. `WorkoutLog.exercises` is a flat `Exercise[]` and it is the only
// irreplaceable slice in storage (there is no backend — see CLAUDE.md). Nesting
// it would break every stored workout and every backup file ever exported.
//
// So membership is a key, not a shape: exercises stay a flat array and carry an
// optional `blockId`; the block's own settings live in a parallel `blocks` list.
// Both fields are optional additions, so anything written before blocks existed
// loads and restores untouched.
//
// LEGACY
// The first AMRAP pass wrote `mode: 'amrap'` directly on an exercise, with no
// block at all. Those records still exist. `resolveBlock` reads them as an
// implicit one-member `amrap_reps` block, which is exactly what they meant.
// Nothing outside this file compares `mode` directly — this is the single place
// that decides what "absent" and "legacy" mean.

import { exerciseMetric, formatPrescription } from '@/lib/metric';
import type { BlockMode, ExerciseMode, WorkoutBlock } from '@/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** What the reps field reads as when a set has no rep target. */
export const AMRAP_REPS_LABEL = 'AMRAP';

/** Default work window for a newly-switched timed block: 20 minutes. */
export const DEFAULT_AMRAP_SECONDS = 20 * 60;

/** Clamp bounds for the editor's duration stepper. */
export const MIN_AMRAP_SECONDS = 60;
export const MAX_AMRAP_SECONDS = 90 * 60;

/** EMOM cadence bounds. Thirty seconds is the shortest useful interval. */
export const DEFAULT_INTERVAL_SECONDS = 60;
export const MIN_INTERVAL_SECONDS = 30;
export const MAX_INTERVAL_SECONDS = 10 * 60;

/** Planned-round bounds for the modes that have a fixed round count. */
export const DEFAULT_ROUNDS = 5;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 99;

// -----------------------------------------------------------------------------
// Mode predicates
// -----------------------------------------------------------------------------

/** Every mode the editor can offer, in the order it offers them. */
export const BLOCK_MODES: BlockMode[] = ['sets', 'amrap_rounds', 'amrap_reps', 'for_time', 'emom'];

const MODE_LABELS: Record<BlockMode, string> = {
  sets: 'Sets × Reps',
  amrap_rounds: 'AMRAP rounds',
  amrap_reps: 'AMRAP reps',
  for_time: 'For time',
  emom: 'EMOM',
};

const MODE_HINTS: Record<BlockMode, string> = {
  sets: 'A fixed number of sets at a rep target.',
  amrap_rounds: 'Fixed reps per movement. As many rounds as possible before the clock runs out.',
  amrap_reps: 'One movement, no rep target. As many reps as possible before the clock runs out.',
  for_time: 'Fixed rounds at fixed reps. The clock counts up — finish as fast as you can.',
  emom: 'Every minute on the minute. One interval of work, then rest what is left of it.',
};

export function blockModeLabel(mode: BlockMode): string {
  return MODE_LABELS[mode] ?? MODE_LABELS.sets;
}

export function blockModeHint(mode: BlockMode): string {
  return MODE_HINTS[mode] ?? MODE_HINTS.sets;
}

/** True for anything driven by a clock rather than a set count. */
export function isTimed(mode: BlockMode): boolean {
  return mode !== 'sets';
}

/**
 * True when the clock counts up rather than down.
 *
 * Only `for_time` does. The distinction matters beyond display: a count-up
 * block ends when the work is finished, a count-down block ends when the clock
 * is, and the session has to know which question to ask.
 */
export function countsUp(mode: BlockMode): boolean {
  return mode === 'for_time';
}

/** True when the round count is open-ended — the clock decides, not a plan. */
export function isOpenEnded(mode: BlockMode): boolean {
  return mode === 'amrap_rounds' || mode === 'amrap_reps';
}

/** True when members carry their own rep target rather than a free count. */
export function hasRepTargets(mode: BlockMode): boolean {
  return mode !== 'amrap_reps';
}

/**
 * True when a block of this mode may hold more than one exercise.
 *
 * `amrap_reps` is deliberately single-movement: "as many reps as possible" has
 * no meaning spread across three exercises, that is `amrap_rounds`.
 */
export function allowsMultipleMembers(mode: BlockMode): boolean {
  return mode === 'amrap_rounds' || mode === 'for_time' || mode === 'emom';
}

/** True when rest between sets applies. Timed blocks run their own clock. */
export function usesRestTimer(mode: BlockMode): boolean {
  return mode === 'sets';
}

// -----------------------------------------------------------------------------
// Clamping
// -----------------------------------------------------------------------------

const clampInt = (value: number, min: number, max: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export function clampAmrapSeconds(seconds: number): number {
  return clampInt(seconds, MIN_AMRAP_SECONDS, MAX_AMRAP_SECONDS, DEFAULT_AMRAP_SECONDS);
}

export function clampIntervalSeconds(seconds: number): number {
  return clampInt(seconds, MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS, DEFAULT_INTERVAL_SECONDS);
}

export function clampRounds(rounds: number): number {
  return clampInt(rounds, MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS);
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

/** Anything that can point at a block, including the legacy per-exercise mode. */
export interface BlockMember {
  blockId?: string;
  /** @deprecated Pre-block AMRAP. Read through `resolveBlock`, never directly. */
  mode?: ExerciseMode | BlockMode;
  durationSeconds?: number;
}

/**
 * A block with every field filled in and clamped.
 *
 * Screens read this, never the raw stored record, so "absent", "legacy" and
 * "corrupted" all collapse into one shape before any UI sees them.
 */
export interface ResolvedBlock {
  id: string | null;
  mode: BlockMode;
  /** Window for the AMRAP modes; the cap for `for_time` (0 means uncapped). */
  durationSeconds: number;
  /** EMOM cadence. Meaningless for the other modes but always populated. */
  intervalSeconds: number;
  /** Planned rounds for `for_time` and interval count for `emom`. */
  rounds: number;
}

const SETS_BLOCK: ResolvedBlock = {
  id: null,
  mode: 'sets',
  durationSeconds: 0,
  intervalSeconds: DEFAULT_INTERVAL_SECONDS,
  rounds: DEFAULT_ROUNDS,
};

/**
 * Normalise a stored mode string.
 *
 * `'amrap'` is the pre-block spelling and meant one movement, max reps — which
 * is `amrap_reps` now. Anything unrecognised falls back to `sets` rather than
 * throwing, because this runs against restored backup files.
 */
export function normalizeMode(mode: string | undefined | null): BlockMode {
  if (mode === 'amrap') return 'amrap_reps';
  if (
    mode === 'sets' ||
    mode === 'amrap_reps' ||
    mode === 'amrap_rounds' ||
    mode === 'for_time' ||
    mode === 'emom'
  ) {
    return mode;
  }
  return 'sets';
}

/**
 * The block a member belongs to, fully resolved.
 *
 * Resolution order: an explicit `blockId` found in `blocks` wins; failing that,
 * a legacy per-exercise `mode` becomes an implicit one-member block; failing
 * that, it is a plain set scheme.
 */
export function resolveBlock(
  member: BlockMember | null | undefined,
  blocks: WorkoutBlock[] | undefined
): ResolvedBlock {
  if (!member) return SETS_BLOCK;

  if (member.blockId) {
    const found = blocks?.find((b) => b.id === member.blockId);
    if (found) return resolveBlockRecord(found);
    // A dangling blockId (a half-restored file, a deleted block) must not
    // strand the exercise in a mode with no clock behind it.
    return SETS_BLOCK;
  }

  const legacy = normalizeMode(member.mode);
  if (legacy === 'sets') return SETS_BLOCK;

  return {
    id: null,
    mode: legacy,
    durationSeconds: clampAmrapSeconds(member.durationSeconds ?? DEFAULT_AMRAP_SECONDS),
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    rounds: DEFAULT_ROUNDS,
  };
}

/** Fill in and clamp a stored block record. */
export function resolveBlockRecord(block: WorkoutBlock): ResolvedBlock {
  const mode = normalizeMode(block.mode);
  if (mode === 'sets') return { ...SETS_BLOCK, id: block.id };

  // `for_time` is the one mode where a cap is optional — zero means "no cap,
  // the clock just runs" — so it skips the minimum-window clamp.
  const duration =
    mode === 'for_time'
      ? block.durationSeconds
        ? clampAmrapSeconds(block.durationSeconds)
        : 0
      : clampAmrapSeconds(block.durationSeconds ?? DEFAULT_AMRAP_SECONDS);

  return {
    id: block.id,
    mode,
    durationSeconds: duration,
    intervalSeconds: clampIntervalSeconds(block.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS),
    rounds: clampRounds(block.rounds ?? DEFAULT_ROUNDS),
  };
}

/**
 * The key the running clock is filed under.
 *
 * A real block has an id. A legacy `mode: 'amrap'` exercise does not — it is an
 * implicit block of one — so it is keyed by its position instead. One key space
 * means the session timer does not need to care which kind it is looking at.
 */
export function blockKey(member: BlockMember | null | undefined, index: number): string {
  return member?.blockId ?? `exercise:${index}`;
}

/** Convenience: is this member inside a timed block at all? */
export function isTimedMember(
  member: BlockMember | null | undefined,
  blocks: WorkoutBlock[] | undefined
): boolean {
  return isTimed(resolveBlock(member, blocks).mode);
}

/**
 * Every member of a block, in array order, with its original index kept.
 *
 * The index is what the session and the stores address exercises by, so it has
 * to survive the grouping — a block's second movement is still exercise 4.
 */
export function blockMembers<T extends BlockMember>(
  members: T[],
  blockId: string
): Array<{ exercise: T; index: number }> {
  return members
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => exercise.blockId === blockId);
}

/**
 * Group a flat exercise list into render order: each entry is either a lone
 * exercise or a block with its members.
 *
 * A block's position is the position of its first member. Members that are not
 * adjacent in the array are still grouped together — the editor keeps them
 * adjacent, but a hand-edited file or a restored backup may not.
 */
export function groupIntoBlocks<T extends BlockMember>(
  members: T[],
  blocks: WorkoutBlock[] | undefined
): Array<{ block: ResolvedBlock; entries: Array<{ exercise: T; index: number }> }> {
  const out: Array<{ block: ResolvedBlock; entries: Array<{ exercise: T; index: number }> }> = [];
  const seen = new Set<string>();

  members.forEach((exercise, index) => {
    const id = exercise.blockId;

    if (!id) {
      out.push({ block: resolveBlock(exercise, blocks), entries: [{ exercise, index }] });
      return;
    }

    if (seen.has(id)) return;
    seen.add(id);

    out.push({
      block: resolveBlock(exercise, blocks),
      entries: blockMembers(members, id),
    });
  });

  return out;
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

/** `20 min` / `1h 05m` — for prose lines, not the running clock. */
export function formatAmrapWindow(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** `MM:SS` — the running clock. Mirrors the rest timer's format. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * The one-line description of a block: `AMRAP · 20 min`, `3 rounds for time`,
 * `EMOM 12 × 1:00`. Used on the template row, the loadout preview and the
 * session header, so all three say the same thing.
 */
export function describeBlock(block: ResolvedBlock): string {
  switch (block.mode) {
    case 'amrap_rounds':
      return `AMRAP · ${formatAmrapWindow(block.durationSeconds)}`;
    case 'amrap_reps':
      return `${AMRAP_REPS_LABEL} · ${formatAmrapWindow(block.durationSeconds)}`;
    case 'for_time':
      return block.durationSeconds
        ? `${block.rounds} rounds for time · cap ${formatAmrapWindow(block.durationSeconds)}`
        : `${block.rounds} rounds for time`;
    case 'emom':
      return `EMOM ${block.rounds} × ${formatClock(block.intervalSeconds)}`;
    default:
      return '';
  }
}

/**
 * The one-line scheme description for a single exercise row.
 *
 * Inside a timed block the row describes its own prescription (`5 reps`) and
 * the block header carries the clock, so the two lines do not repeat.
 */
export function describeScheme(
  target: { sets: number; reps: string; exerciseId?: string } & BlockMember,
  blocks?: WorkoutBlock[]
): string {
  const block = resolveBlock(target, blocks);
  // A held movement is prescribed in seconds, so "3 sets × 30-60" has to read
  // "3 sets × 30-60s" or the number means the wrong thing. Looked up rather
  // than carried on the row: a template exercise stores only its id.
  const metric = target.exerciseId ? exerciseMetric({ id: target.exerciseId }) : ('reps' as const);

  if (block.mode === 'sets') {
    return metric === 'time'
      ? `${target.sets} sets × ${formatPrescription(target.reps, metric)}`
      : `${target.sets} sets × ${target.reps}`;
  }
  if (block.mode === 'amrap_reps') return describeBlock(block);
  return formatPrescription(target.reps, metric);
}

/**
 * The prescribed rep count as a number the quick-log button can use.
 *
 * Template reps are free text (`'5'`, `'8-12'`, `'AMRAP'`) because a set scheme
 * only ever displayed them. A circuit has to be able to log the prescription in
 * one tap, so the first number in the string wins — the bottom of a range is
 * the honest default, and anything without a number has no prescription.
 */
export function targetRepCount(reps: string | undefined | null): number | null {
  if (!reps) return null;
  const match = reps.match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** `Round 3` / `Set 3` — what one row of a block is called. */
export function roundLabel(mode: BlockMode, index: number): string {
  return isTimed(mode) ? `Round ${index + 1}` : `Set ${index + 1}`;
}

// -----------------------------------------------------------------------------
// Rounds
// -----------------------------------------------------------------------------

/**
 * How many rounds of a block are fully logged.
 *
 * A round counts only when every member has logged that round — three
 * movements with the third unlogged is two rounds and a partial, which is
 * exactly how it is scored in the gym.
 */
/**
 * The one line of plain instruction under a block's clock.
 *
 * Each mode is bounded by a different thing, so each has to say a different
 * thing — and what it says changes with the clock: before you start it is the
 * prescription, while running it is how to log, and once finished it is what
 * just happened.
 */
export function blockHintText(args: {
  mode: BlockMode;
  running: boolean;
  paused: boolean;
  finished: boolean;
  /** Elapsed seconds, for the `for_time` result. */
  elapsed: number;
  rounds: number;
  intervalSeconds: number;
}): string {
  if (args.paused) return 'Paused.';

  switch (args.mode) {
    case 'amrap_rounds':
      return args.finished
        ? 'Time — finish the round you’re in, then move on.'
        : args.running
          ? 'One tap banks the whole round.'
          : 'As many rounds as possible in the window.';
    case 'amrap_reps':
      return args.finished
        ? 'Time — finish the round you’re in, then move on.'
        : args.running
          ? 'Log each round as you finish it. No rest timer here.'
          : 'As many reps as possible in the window.';
    case 'for_time':
      return args.finished
        ? `Finished in ${formatClock(args.elapsed)}.`
        : args.running
          ? 'Clock is up. Hit Done the moment the last round lands.'
          : `${args.rounds} rounds, as fast as you can.`;
    case 'emom':
      return args.finished
        ? 'Done.'
        : args.running
          ? 'Work at the top of each minute. Rest whatever is left of it.'
          : `${args.rounds} intervals of ${formatClock(args.intervalSeconds)}.`;
    default:
      return '';
  }
}

export function completedRounds(
  entries: Array<{ exercise: { sets: Array<{ logged: boolean }> } }>
): number {
  if (entries.length === 0) return 0;
  const depth = Math.min(...entries.map(({ exercise }) => exercise.sets.length));

  let rounds = 0;
  for (let round = 0; round < depth; round += 1) {
    if (entries.every(({ exercise }) => exercise.sets[round]?.logged)) rounds += 1;
    else break;
  }
  return rounds;
}

/** Total reps logged across every member of a block. */
export function blockReps(
  entries: Array<{ exercise: { sets: Array<{ logged: boolean; reps: number | null }> } }>
): number {
  return entries.reduce(
    (sum, { exercise }) =>
      sum + exercise.sets.reduce((s, set) => s + (set.logged ? (set.reps ?? 0) : 0), 0),
    0
  );
}
