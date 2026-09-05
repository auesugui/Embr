// =============================================================================
// Session view rules — what the session screen shows, and when
// =============================================================================
// Three booleans decide the shape of a timed session: is the clock running (so
// the scrim covers the working surface), has the block not started yet (so the
// screen offers Start and nothing else), and has anything actually happened
// yet (so "Finish" exists at all).
//
// They live here rather than inline in the screen because they are rules, not
// rendering: each one encodes a decision about what a workout IS at a given
// moment, and a 1500-line component is where that kind of decision goes to
// hide.

import type { BlockMode } from '@/types';
import { isOpenEnded } from './blocks';

/**
 * Whether the focused AMRAP scrim should cover the session screen.
 *
 * Only the open-ended modes. An EMOM wants its interval clock and a `for_time`
 * wants its round ladder — both are working surfaces in a way an AMRAP is not.
 */
export function showAmrapScrim(args: {
  mode: BlockMode;
  /** The block on screen owns the running clock. */
  clockIsOurs: boolean;
  /** The user dismissed the scrim to log a partial round. */
  dismissed: boolean;
}): boolean {
  return isOpenEnded(args.mode) && args.clockIsOurs && !args.dismissed;
}

/**
 * Whether an AMRAP is sitting untouched, before its clock has ever run.
 *
 * Everything about logging a round belongs to a running clock, so before one
 * exists the screen shows the prescription and Start — nothing else. Rounds
 * already banked mean it isn't pre-start even if the clock was reset.
 */
export function isPreStart(args: {
  mode: BlockMode;
  clockIsOurs: boolean;
  roundsDone: number;
}): boolean {
  return isOpenEnded(args.mode) && !args.clockIsOurs && args.roundsDone === 0;
}

/**
 * Whether this session has anything worth writing to history.
 *
 * "Finish" is for a workout that HAPPENED. Opening a timed workout and
 * changing your mind should leave by the back arrow, not by a Finish that
 * banks an empty session — a real record of nothing is worse than no record.
 *
 * A logged set counts on its own, so a lifting session (which has no clock to
 * start) gets its Finish back the moment the first set lands.
 */
export function hasRecordedWork(args: {
  completedSets: number;
  /** The block key of the live clock, or null when no clock is running. */
  activeBlockKey: string | null;
  /** How many blocks have already recorded a finished time. */
  finishedBlockCount: number;
}): boolean {
  return args.completedSets > 0 || args.activeBlockKey !== null || args.finishedBlockCount > 0;
}
