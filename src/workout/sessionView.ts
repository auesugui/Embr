// =============================================================================
// deriveSessionView — everything the session screen renders from
// =============================================================================
// A block may hold several movements, and a round spans all of them. So the
// unit on screen is the BLOCK, not the exercise: "5 pull-ups, 10 push-ups, 15
// squats" is one thing you work through, and showing one movement at a time
// would hide the round you are actually in.
//
// This is a plain function, not a hook, because none of it needs to be: it is
// a projection of store state onto the screen's questions. Keeping it pure
// means the answers can be asserted directly instead of through a rendered
// component, and it keeps ~130 lines of branching out of the screen.

import {
  type ResolvedBlock,
  blockKey as blockKeyOf,
  blockMembers,
  completedRounds,
  countsUp,
  groupIntoBlocks,
  isTimed,
  resolveBlock,
  targetRepCount,
} from '@/lib/blocks';
import { hasRecordedWork, isPreStart, showAmrapScrim } from '@/lib/session-view';
import {
  type BlockTimerState,
  blockElapsed,
  blockInterval,
  blockRemaining,
} from '@/stores/workoutStore';
import type { Exercise, WorkoutBlock } from '@/types';

/** The generic quick-log ladder, used when a movement has no prescription. */
const GENERIC_REPS = [5, 8, 10, 12];

export interface SessionViewArgs {
  exercises: Exercise[];
  blocks: WorkoutBlock[] | undefined;
  currentExerciseIndex: number;
  blockTimer: BlockTimerState;
  /** Block key -> recorded elapsed time, for blocks already finished. */
  blockTimes: Record<string, number>;
  completedSets: number;
  /** The AMRAP scrim was dismissed to log a partial round. */
  scrimDismissed: boolean;
}

export function deriveSessionView(args: SessionViewArgs) {
  const { exercises, blocks, currentExerciseIndex, blockTimer, blockTimes } = args;

  const currentExercise = exercises[currentExerciseIndex];
  const currentBlock: ResolvedBlock = resolveBlock(currentExercise, blocks);
  const currentTimed = isTimed(currentBlock.mode);

  const entries = currentExercise?.blockId
    ? blockMembers(exercises, currentExercise.blockId)
    : [{ exercise: currentExercise, index: currentExerciseIndex }];
  const isCircuit = entries.length > 1;

  const currentKey = blockKeyOf(currentExercise, currentExerciseIndex);
  // The clock belongs to one block at a time — moving away leaves its window
  // running, but the controls only show on the block that owns it.
  const clockIsOurs = blockTimer.blockKey === currentKey;
  const clockRunning = clockIsOurs && blockTimer.running;
  const clockPaused = clockIsOurs && blockTimer.paused;
  const counting = countsUp(currentBlock.mode);

  const elapsed = clockIsOurs ? blockElapsed(blockTimer) : 0;
  const remaining = clockIsOurs ? blockRemaining(blockTimer) : currentBlock.durationSeconds;
  // A count-up block is finished when its time has been recorded, not when a
  // window closes — there is no window to close.
  const clockFinished =
    clockIsOurs &&
    (counting ? blockTimer.finishedElapsed !== null : !blockTimer.running && remaining === 0);
  const clockDisplay = counting ? elapsed : remaining;

  const interval = clockIsOurs && currentBlock.mode === 'emom' ? blockInterval(blockTimer) : null;
  const roundsDone = completedRounds(entries.filter((e) => e.exercise));

  const scrimVisible = showAmrapScrim({
    mode: currentBlock.mode,
    clockIsOurs,
    dismissed: args.scrimDismissed,
  });
  const canFinish = hasRecordedWork({
    completedSets: args.completedSets,
    activeBlockKey: blockTimer.blockKey,
    finishedBlockCount: Object.keys(blockTimes).length,
  });
  const preStart = isPreStart({ mode: currentBlock.mode, clockIsOurs, roundsDone });

  // Rounds split into "banked" and "the one you are in". Banked rounds collapse
  // to a line each; only the open round needs its controls on screen. Twenty
  // rounds of Cindy is otherwise sixty rows to scroll past to reach the button.
  const deepest = Math.max(0, ...entries.map((e) => e.exercise?.sets.length ?? 0));
  // Only a round every member finished collapses to a line. A partial round
  // stays open below, showing what landed and what is outstanding — banking it
  // too would print the same round number twice.
  const loggedRounds = Array.from({ length: deepest }, (_, i) => i).filter((round) =>
    entries.every(({ exercise }) => exercise?.sets[round]?.logged)
  );
  const openRoundIndex =
    Array.from({ length: deepest }, (_, i) => i).find((round) =>
      entries.some(({ exercise }) => exercise?.sets[round] && !exercise.sets[round].logged)
    ) ?? null;

  // The single-movement quick ladder. A timed block leads with its own
  // prescription so the common tap is the prescribed one rather than whichever
  // generic number happens to sit closest.
  const singleTarget = currentTimed ? targetRepCount(currentExercise?.targetReps) : null;
  const quickReps =
    singleTarget !== null && !GENERIC_REPS.includes(singleTarget)
      ? [singleTarget, ...GENERIC_REPS.slice(0, 3)]
      : GENERIC_REPS;

  // The one-tap path only exists when every movement has a number to log. A
  // circuit member whose reps read "max" has no prescription to fire.
  const roundFullyPrescribed =
    openRoundIndex !== null &&
    entries.every(({ exercise }) => targetRepCount(exercise?.targetReps) !== null);

  // Navigation moves by BLOCK, not by exercise. Stepping into the middle of a
  // circuit would show one movement of a round you are working through as a
  // whole, and "Next: Push-ups" is a lie when the push-ups are already on
  // screen.
  const groups = groupIntoBlocks(exercises, blocks);
  const groupIndex = Math.max(
    0,
    groups.findIndex((g) => g.entries.some((e) => e.index === currentExerciseIndex))
  );
  const isLastGroup = groupIndex >= groups.length - 1;
  const footerTabs = groups.flatMap((group) => {
    const first = group.entries[0];
    if (!first?.exercise) return [];
    return [
      {
        key: first.exercise.id,
        label: group.entries.length > 1 ? 'Circuit' : (first.exercise.name ?? 'Exercise'),
        completed: group.entries.every((e) => e.exercise?.completed),
        targetIndex: first.index,
      },
    ];
  });
  const nextGroup = groups[groupIndex + 1];
  const nextGroupLabel =
    nextGroup && nextGroup.entries.length > 1
      ? 'Circuit'
      : (nextGroup?.entries[0]?.exercise?.name ?? '');

  return {
    /** Blocks in workout order. The nav handlers step through these. */
    groups,
    currentExercise,
    currentBlock,
    currentTimed,
    entries,
    isCircuit,
    currentKey,
    clockIsOurs,
    clockRunning,
    clockPaused,
    clockFinished,
    clockDisplay,
    counting,
    elapsed,
    interval,
    roundsDone,
    scrimVisible,
    canFinish,
    preStart,
    loggedRounds,
    openRoundIndex,
    singleTarget,
    quickReps,
    roundFullyPrescribed,
    groupIndex,
    isLastGroup,
    footerTabs,
    nextGroupLabel,
  };
}

export type SessionView = ReturnType<typeof deriveSessionView>;
