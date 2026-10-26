// =============================================================================
// IronQuest Workout Store - Active Session, Exercises, Rest Timer
// =============================================================================

import { clampIntervalSeconds } from '@/lib/blocks';
import type { BlockMode, Exercise, SessionIntent, WorkoutBlock } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';
import { create } from 'zustand';
import { usePRStore } from './prStore';
import { useSettingsStore } from './settingsStore';
import { useWeightHistoryStore } from './weightHistoryStore';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * The between-sets rest timer.
 *
 * ONE ANCHOR, EVERYTHING ELSE DERIVED — the same discipline as the block clock
 * below. The stored fact is `endsAt`, a wall-clock instant; remaining time is
 * computed from it on read. It used to count one-second ticks, which meant a
 * backgrounded tab handed back rest that had already passed, and a reload lost
 * the timer entirely. Anchored, a rest that ran out while you were away comes
 * back finished, and ±15s is arithmetic on one number.
 *
 * EXACT IN MILLISECONDS, ROUNDED ONLY TO BE READ. Pausing 20.5 seconds into a
 * 90-second rest banks 69.5 seconds, not 70. Writing back the number on screen
 * would hand you up to a second of rest on every pause, resume and ±15s, and
 * it compounds: the display rounds up, so ten pauses can buy ten seconds.
 *
 * Nothing rings while the app is in the background. A PWA cannot wake itself
 * without a push server, and Embr has no backend.
 */
export interface RestTimerState {
  /**
   * Seconds the arc is measured against. Grown by +15s along with the
   * remaining time, so the arc tracks the number instead of passing full.
   */
  duration: number;
  /** ms epoch the rest ends. Null while paused, and while none is running. */
  endsAt: number | null;
  /** Milliseconds left, banked when there is no anchor to read. Exact. */
  remainingMs: number;
  /** Last derived whole seconds, for rendering only. Never read as truth. */
  remaining: number;
  /** Counting down. False while paused, and once the rest has run out. */
  running: boolean;
  paused: boolean;
}

/**
 * The clock behind a timed block — AMRAP, for-time, or EMOM.
 *
 * ONE ANCHOR, EVERYTHING ELSE DERIVED. The only stored facts are when the
 * current run segment started (`runStartedAt`, wall clock) and how much time
 * had accumulated before it (`elapsedBeforePause`). Remaining time, the EMOM
 * interval you are in, and the count-up total are all computed from those two
 * on read.
 *
 * That is deliberate. A tick-counted clock silently pauses for exactly as long
 * as the app is not running, which is the one thing a 20-minute window must
 * never do — a backgrounded tab or a reload would hand back time that has
 * already gone. Anchoring to the wall clock means a window that expired while
 * the app was closed comes back finished.
 *
 * `elapsed` is still stored so the UI has something to render before the first
 * tick lands, but it is never the source of truth.
 */
export interface BlockTimerState {
  /** Which block the clock belongs to (see `blockKey`); null when none runs. */
  blockKey: string | null;
  mode: BlockMode;
  /** Planned length in seconds. Zero means uncapped, which only `for_time` is. */
  duration: number;
  /** EMOM cadence. Populated for every mode, meaningful only for EMOM. */
  intervalSeconds: number;
  /** Seconds banked before the current run segment. */
  elapsedBeforePause: number;
  /** ms epoch the current run segment started. Null while paused or stopped. */
  runStartedAt: number | null;
  /** Last derived elapsed, for first paint only. Never read as truth. */
  elapsed: number;
  running: boolean;
  paused: boolean;
  /** Set once when a count-up block is finished, so the time stops moving. */
  finishedElapsed: number | null;
}

interface WorkoutState {
  // Session state
  active: boolean;
  templateId: string | null;
  /** The template day being run, so the log can record which workout this was. */
  dayKey: string | null;
  /** What to call this workout, snapshotted here and written onto the log. */
  workoutName: string | null;
  startedAt: number | null;
  currentExerciseIndex: number;
  exercises: Exercise[];
  intent: SessionIntent;
  gymRushActive: boolean;
  /** Clocks referenced by `exercises[].blockId`. Empty on a plain session. */
  blocks: WorkoutBlock[];
  /** Finish times for completed `for_time` blocks, keyed by block key. */
  blockTimes: Record<string, number>;

  // Rest timer
  restTimer: RestTimerState;

  // Timed block (one at a time — you can only be inside one block)
  blockTimer: BlockTimerState;
}

interface WorkoutActions {
  // Session lifecycle
  startSession: (
    templateId: string,
    exercises: Exercise[],
    intent?: SessionIntent,
    blocks?: WorkoutBlock[],
    /**
     * Which day of the template this is: its id, and what to call it. Omitted
     * by callers that have no day to name.
     */
    day?: { key: string; name: string }
  ) => void;
  endSession: () => void;
  cancelSession: () => void;

  // Exercise flow
  logSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  /** Append an empty set row. AMRAP rounds are open-ended, so the UI grows the list as you log. */
  addSet: (exerciseIndex: number) => void;
  /** Append an empty row to every member of a block, opening the next round. */
  openRound: (exerciseIndexes: number[]) => void;
  /**
   * Log a whole round at once and open the next.
   *
   * A circuit is worked as a unit — you do the pull-ups, push-ups and squats,
   * then you have finished a round. Logging it movement by movement means three
   * taps for something you did as one thing, so this is the primary path and
   * per-movement logging is the exception for a partial round.
   */
  logRound: (
    rows: Array<{ exerciseIndex: number; setIndex: number; reps: number; weight?: number }>,
    /**
     * Every member of the block, not just the ones being logged.
     *
     * The next round has to open for all of them. A movement logged earlier in
     * a partial round is not in `rows`, and growing only what `rows` touched
     * would leave it a round behind the rest of the circuit.
     */
    memberIndexes?: number[],
    /**
     * Whether finishing this round should open another.
     *
     * True for the AMRAP modes, where the clock decides when to stop. False for
     * `for_time` and `emom`, which have a planned round count — offering a
     * round beyond it invites logging work the programme never asked for.
     */
    openNext?: boolean
  ) => void;
  editSet: (exerciseIndex: number, setIndex: number, reps: number, weight?: number) => void;
  clearSet: (exerciseIndex: number, setIndex: number) => void;
  completeExercise: (exerciseIndex: number) => void;
  nextExercise: () => void;
  previousExercise: () => void;
  setCurrentExercise: (index: number) => void;

  // Rest timer
  startRestTimer: (duration: number) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  resetRestTimer: () => void;
  tickRestTimer: () => void;
  /**
   * Add or remove rest, in seconds. Session-only — it moves this timer and
   * writes nothing beyond the session state that already persists.
   */
  adjustRestTimer: (delta: number) => void;

  // Timed block
  startBlockTimer: (
    blockKey: string,
    options: { mode: BlockMode; duration: number; intervalSeconds?: number }
  ) => void;
  pauseBlockTimer: () => void;
  resumeBlockTimer: () => void;
  resetBlockTimer: () => void;
  tickBlockTimer: () => void;
  /** Stop a count-up block and record its finishing time. */
  finishBlockTimer: () => void;

  // Modifiers
  toggleGymRush: () => void;
  setIntent: (intent: SessionIntent) => void;

  // Getters (for deriving state)
  getCurrentExercise: () => Exercise | null;
  getCompletedSets: () => number;
  getTotalReps: () => number;

  // Hydration
  hydrate: () => Promise<void>;
  reset: () => void;
}

type WorkoutStore = WorkoutState & WorkoutActions;

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialRestTimer: RestTimerState = {
  duration: 90,
  endsAt: null,
  remainingMs: 0,
  remaining: 0,
  running: false,
  paused: false,
};

const initialBlockTimer: BlockTimerState = {
  blockKey: null,
  mode: 'sets',
  duration: 0,
  intervalSeconds: 60,
  elapsedBeforePause: 0,
  runStartedAt: null,
  elapsed: 0,
  running: false,
  paused: false,
  finishedElapsed: null,
};

const initialState: WorkoutState = {
  active: false,
  templateId: null,
  dayKey: null,
  workoutName: null,
  startedAt: null,
  currentExerciseIndex: 0,
  exercises: [],
  intent: 'normal',
  gymRushActive: false,
  blocks: [],
  blockTimes: {},
  restTimer: initialRestTimer,
  blockTimer: initialBlockTimer,
};

/**
 * Milliseconds left on the rest timer, from its anchor rather than a tick
 * count. This is the exact value, and the only one a write may re-anchor from.
 *
 * A paused or finished timer has no anchor to read, so the banked
 * `remainingMs` is the answer. `now` is required: the one caller that is a
 * screen renders for the length of a whole rest.
 */
export const restRemainingMs = (timer: RestTimerState, now: number): number => {
  if (timer.endsAt === null) return Math.max(0, timer.remainingMs);
  return Math.max(0, timer.endsAt - now);
};

/**
 * The same thing as the screen reads it: whole seconds, rounded up so the last
 * fraction of a second still shows 0:01. Display only — rounding here and then
 * storing the result is what buys unearned rest.
 */
export const restRemaining = (timer: RestTimerState, now: number): number =>
  Math.ceil(restRemainingMs(timer, now) / 1000);

/**
 * Whether the rest overlay is up: counting, paused, or run out and waiting for
 * the tap that closes it. One rule, because the screen and the restore path
 * must agree on when a rest exists.
 */
export const restIsUp = (timer: RestTimerState): boolean => timer.endsAt !== null || timer.paused;

/**
 * Seconds of work the clock has seen, from the wall clock rather than ticks.
 *
 * Frozen once a count-up block is finished — otherwise the recorded time would
 * keep climbing while you look at it.
 */
export const blockElapsed = (timer: BlockTimerState, now = Date.now()): number => {
  if (timer.finishedElapsed !== null) return timer.finishedElapsed;
  if (!timer.running || timer.runStartedAt === null) return timer.elapsedBeforePause;
  return timer.elapsedBeforePause + Math.max(0, (now - timer.runStartedAt) / 1000);
};

/** Seconds left on a countdown block. Zero for an uncapped block. */
export const blockRemaining = (timer: BlockTimerState, now = Date.now()): number => {
  if (timer.duration <= 0) return 0;
  return Math.max(0, Math.ceil(timer.duration - blockElapsed(timer, now)));
};

/**
 * Which EMOM interval the clock is in, and how much of it is left.
 *
 * Intervals are derived from total elapsed rather than counted, for the same
 * reason the rest of the clock is: a backgrounded tab must not fall behind the
 * minute it is actually on.
 */
export const blockInterval = (
  timer: BlockTimerState,
  now = Date.now()
): { index: number; remaining: number } => {
  const size = Math.max(1, timer.intervalSeconds);
  const elapsed = blockElapsed(timer, now);
  return {
    index: Math.floor(elapsed / size),
    remaining: Math.max(0, Math.ceil(size - (elapsed % size))),
  };
};

const emptySet = () => ({
  reps: null,
  weight: null,
  logged: false,
  isPR: false,
  isRepPR: false,
});

// Helper to persist session state
const persistSession = async (state: Partial<WorkoutState>) => {
  await appStorage.setJSON(STORAGE_KEYS.SESSION.FULL_STATE, state);
};

/**
 * The pre-anchor rest timer, still sitting in any session saved before it, and
 * the seconds-only bank of the pass between the two.
 */
type LegacyRestTimerState = Omit<RestTimerState, 'endsAt' | 'remainingMs'> & {
  endsAt?: number | null;
  remainingMs?: number;
};

/**
 * Rebuild the rest timer from persisted state.
 *
 * A session saved before the timer had an anchor carries a tick-counted
 * `remaining` and no way to tell how much of it went by while the app was
 * closed. Those sessions dropped the rest timer on every reload anyway, so one
 * comes back with no rest running rather than with invented time.
 */
const restoreRestTimer = (
  stored: LegacyRestTimerState | undefined,
  now: number
): RestTimerState => {
  if (!stored || stored.endsAt === undefined) return initialRestTimer;

  const timer: RestTimerState = {
    ...stored,
    endsAt: stored.endsAt,
    // A bank saved in whole seconds converts to the same instant it displayed,
    // which is the most that shape ever knew. Nothing is gained on the way in.
    remainingMs: stored.remainingMs ?? stored.remaining * 1000,
  };

  // No anchor: paused, or no rest at all. The banked time is the truth.
  if (timer.endsAt === null) {
    return { ...timer, remaining: restRemaining(timer, now), running: false };
  }

  // A rest that ran out while the app was away comes back ready for the tap
  // that closes it, not running with time that no longer exists.
  const remainingMs = restRemainingMs(timer, now);
  return {
    ...timer,
    remainingMs,
    remaining: Math.ceil(remainingMs / 1000),
    running: remainingMs > 0,
  };
};

/** The pre-block clock shape, still sitting in any session saved by that pass. */
interface LegacyAmrapTimerState {
  exerciseIndex: number | null;
  duration: number;
  remaining: number;
  running: boolean;
  paused: boolean;
  endsAt: number | null;
}

/**
 * Rebuild a block clock from persisted state.
 *
 * Three cases, in order:
 *
 * 1. Sessions saved before any timed work existed have neither field — those
 *    load as "no clock running".
 * 2. Sessions saved by the first AMRAP pass have `amrapTimer`, keyed by
 *    exercise index. Those are carried across rather than dropped: someone
 *    mid-window when the app updates should not lose the window.
 * 3. Everything else has `blockTimer`.
 *
 * Because elapsed time is anchored to the wall clock, a window that ran out
 * while the app was closed comes back finished rather than resuming with time
 * that no longer exists.
 */
const restoreBlockTimer = (
  stored: BlockTimerState | undefined,
  legacy: LegacyAmrapTimerState | undefined
): BlockTimerState => {
  if (!stored?.blockKey) {
    if (!legacy || legacy.exerciseIndex === null) return initialBlockTimer;

    // The old clock stored `endsAt`; the new one stores where the run began.
    // Recover the anchor by subtracting the time that was left from the total.
    const consumed = Math.max(0, legacy.duration - legacy.remaining);
    return {
      ...initialBlockTimer,
      blockKey: `exercise:${legacy.exerciseIndex}`,
      mode: 'amrap_reps',
      duration: legacy.duration,
      elapsedBeforePause: consumed,
      runStartedAt: legacy.running && legacy.endsAt ? legacy.endsAt - legacy.duration * 1000 : null,
      elapsed: consumed,
      running: legacy.running,
      paused: legacy.paused,
    };
  }

  const elapsed = blockElapsed(stored);

  // A countdown that ran out while the app was closed comes back stopped, not
  // running with time it no longer has.
  if (stored.duration > 0 && stored.mode !== 'for_time' && elapsed >= stored.duration) {
    return {
      ...stored,
      elapsedBeforePause: stored.duration,
      runStartedAt: null,
      elapsed: stored.duration,
      running: false,
      paused: false,
    };
  }

  return { ...stored, elapsed };
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  ...initialState,

  // Session lifecycle
  startSession: (templateId, exercises, intent = 'normal', blocks = [], day = undefined) => {
    const startedAt = Date.now();

    const newState: WorkoutState = {
      ...initialState,
      active: true,
      templateId,
      dayKey: day?.key ?? null,
      workoutName: day?.name ?? null,
      startedAt,
      currentExerciseIndex: 0,
      exercises,
      intent,
      gymRushActive: false,
      blocks,
    };

    set(newState);
    persistSession(newState).catch(console.warn);
  },

  endSession: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.SESSION.FULL_STATE).catch(console.warn);
  },

  cancelSession: () => {
    get().endSession();
  },

  // Exercise flow
  logSet: (exerciseIndex, setIndex, reps, weight = undefined) => {
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      // Check for PR before recording
      let isPR = false;
      let isRepPR = false;

      if (weight !== undefined && weight !== null && weight > 0 && exercise.id) {
        // PRs compare within the unit the set was logged in (issue #42).
        const unit = useSettingsStore.getState().units;
        const prResult = usePRStore.getState().recordPR(exercise.id, weight, reps, unit);
        isPR = prResult.isWeightPR;
        isRepPR = prResult.isRepPR;
      }

      sets[setIndex] = {
        reps,
        weight: weight ?? null,
        logged: true,
        isPR,
        isRepPR,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);

      // Save weight to history if weight is provided
      if (weight !== undefined && weight !== null) {
        const exerciseData = state.exercises[exerciseIndex];
        if (exerciseData?.id) {
          useWeightHistoryStore
            .getState()
            .saveWeight(exerciseData.id, weight, useSettingsStore.getState().units);
        }
      }

      return { exercises };
    });
  },

  editSet: (exerciseIndex, setIndex, reps, weight = undefined) => {
    // Same as logSet but without triggering side effects (like rest timer)
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        reps,
        weight: weight ?? null,
        logged: true,
        isPR: false,
        isRepPR: false,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);

      // Keep weight history fresh so next session auto-fills the edited value
      if (weight !== undefined && weight !== null) {
        const exerciseData = state.exercises[exerciseIndex];
        if (exerciseData?.id) {
          useWeightHistoryStore
            .getState()
            .saveWeight(exerciseData.id, weight, useSettingsStore.getState().units);
        }
      }

      return { exercises };
    });
  },

  clearSet: (exerciseIndex, setIndex) => {
    set((state) => {
      const exercises = [...state.exercises];
      const exercise = { ...exercises[exerciseIndex] };
      const sets = [...exercise.sets];

      sets[setIndex] = {
        reps: 0,
        weight: null,
        logged: false,
        isPR: false,
        isRepPR: false,
      };

      exercise.sets = sets;
      exercises[exerciseIndex] = exercise;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  addSet: (exerciseIndex) => {
    set((state) => {
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      const exercises = [...state.exercises];
      exercises[exerciseIndex] = { ...exercise, sets: [...exercise.sets, emptySet()] };

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  /**
   * Open the next round of a block.
   *
   * A round spans every member, so the rows have to grow together — appending
   * to one movement at a time would let round 3 of the squats exist while the
   * pull-ups are still on round 2, and the round index is what pairs them.
   */
  openRound: (exerciseIndexes) => {
    set((state) => {
      const exercises = [...state.exercises];
      let changed = false;

      for (const index of exerciseIndexes) {
        const exercise = exercises[index];
        if (!exercise) continue;
        // Only grow a member that has no room left, so re-opening a round that
        // is already open is a no-op rather than a stack of blank rows.
        if (exercise.sets.some((s) => !s.logged)) continue;
        exercises[index] = { ...exercise, sets: [...exercise.sets, emptySet()] };
        changed = true;
      }

      if (!changed) return state;

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  logRound: (rows, memberIndexes, openNext = true) => {
    if (rows.length === 0) return;

    set((state) => {
      const exercises = [...state.exercises];
      const unit = useSettingsStore.getState().units;
      const weightsToSave: Array<{ id: string; weight: number }> = [];
      const touched: number[] = [];

      for (const { exerciseIndex, setIndex, reps, weight } of rows) {
        const source = exercises[exerciseIndex];
        if (!source?.sets[setIndex]) continue;

        let isPR = false;
        let isRepPR = false;

        if (weight !== undefined && weight !== null && weight > 0 && source.id) {
          // PRs compare within the unit the set was logged in (issue #42).
          const result = usePRStore.getState().recordPR(source.id, weight, reps, unit);
          isPR = result.isWeightPR;
          isRepPR = result.isRepPR;
          weightsToSave.push({ id: source.id, weight });
        }

        const sets = [...source.sets];
        sets[setIndex] = { reps, weight: weight ?? null, logged: true, isPR, isRepPR };
        exercises[exerciseIndex] = { ...source, sets };
        touched.push(exerciseIndex);
      }

      // Open the next round in the same transaction. Doing it as a follow-up
      // call would persist the session twice and let a reload land between the
      // logged round and the row that follows it.
      //
      // Every member grows, not just the ones logged here: in a partial round
      // some movements were already banked, and they are not in `rows`.
      const toGrow = openNext ? (memberIndexes ?? touched) : [];
      for (const index of toGrow) {
        const exercise = exercises[index];
        if (!exercise || exercise.sets.some((s) => !s.logged)) continue;
        exercises[index] = { ...exercise, sets: [...exercise.sets, emptySet()] };
      }

      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);

      for (const { id, weight } of weightsToSave) {
        useWeightHistoryStore.getState().saveWeight(id, weight, unit);
      }

      return { exercises };
    });
  },

  completeExercise: (exerciseIndex) => {
    set((state) => {
      const exercises = [...state.exercises];
      exercises[exerciseIndex] = {
        ...exercises[exerciseIndex],
        completed: true,
      };
      const newState = { ...state, exercises };
      persistSession(newState).catch(console.warn);
      return { exercises };
    });
  },

  nextExercise: () => {
    set((state) => {
      const nextIndex = Math.min(state.currentExerciseIndex + 1, state.exercises.length - 1);
      return { currentExerciseIndex: nextIndex };
    });
  },

  previousExercise: () => {
    set((state) => {
      const prevIndex = Math.max(state.currentExerciseIndex - 1, 0);
      return { currentExerciseIndex: prevIndex };
    });
  },

  setCurrentExercise: (index) => {
    set((state) => {
      if (index >= 0 && index < state.exercises.length) {
        return { currentExerciseIndex: index };
      }
      return state;
    });
  },

  // Rest timer
  //
  // Persisted with the session, like the block clock: a rest routinely outlives
  // a reload or a trip to another app, and the anchor is what makes coming back
  // to the true remaining time possible.
  startRestTimer: (duration) => {
    const safeDuration = Math.max(0, Math.round(duration));
    set((state) => {
      // No rest prescribed means no overlay at all, rather than one that opens
      // already finished and has to be tapped away.
      const restTimer: RestTimerState =
        safeDuration === 0
          ? initialRestTimer
          : {
              duration: safeDuration,
              endsAt: Date.now() + safeDuration * 1000,
              remainingMs: safeDuration * 1000,
              remaining: safeDuration,
              running: true,
              paused: false,
            };
      persistSession({ ...state, restTimer }).catch(console.warn);
      return { restTimer };
    });
  },

  pauseRestTimer: () => {
    set((state) => {
      const timer = state.restTimer;
      if (!timer.running) return state;
      // Bank what is left to the millisecond, then drop the anchor — resume
      // re-anchors from the bank, so a pause costs nothing and gives nothing.
      const remainingMs = restRemainingMs(timer, Date.now());
      const restTimer: RestTimerState = {
        ...timer,
        remainingMs,
        remaining: Math.ceil(remainingMs / 1000),
        endsAt: null,
        running: false,
        paused: true,
      };
      persistSession({ ...state, restTimer }).catch(console.warn);
      return { restTimer };
    });
  },

  resumeRestTimer: () => {
    set((state) => {
      const timer = state.restTimer;
      if (!timer.paused) return state;
      const remainingMs = restRemainingMs(timer, Date.now());
      const restTimer: RestTimerState = {
        ...timer,
        endsAt: Date.now() + remainingMs,
        running: remainingMs > 0,
        paused: false,
      };
      persistSession({ ...state, restTimer }).catch(console.warn);
      return { restTimer };
    });
  },

  resetRestTimer: () => {
    set((state) => {
      persistSession({ ...state, restTimer: initialRestTimer }).catch(console.warn);
      return { restTimer: initialRestTimer };
    });
  },

  tickRestTimer: () => {
    set((state) => {
      const timer = state.restTimer;
      if (!timer.running || timer.endsAt === null) return state;

      const remaining = restRemaining(timer, Date.now());

      // Out of time. The anchor stays so the overlay knows a rest is up and
      // offers "Tap to continue" rather than closing itself.
      if (remaining === 0) {
        const restTimer: RestTimerState = {
          ...timer,
          remainingMs: 0,
          remaining: 0,
          running: false,
        };
        persistSession({ ...state, restTimer }).catch(console.warn);
        return { restTimer };
      }

      // Re-render only on a whole-second change; this fires more often than
      // the number it is driving changes.
      if (remaining === timer.remaining) return state;
      return { restTimer: { ...timer, remaining } };
    });
  },

  adjustRestTimer: (delta) => {
    set((state) => {
      const timer = state.restTimer;
      if (!restIsUp(timer)) return state;

      const now = Date.now();
      // At zero every control has cleared, so there is nothing to adjust.
      if (restRemainingMs(timer, now) === 0) return state;

      // The anchor moves by the adjustment, never by a rounded remainder. A
      // running rest shifts its end, a paused one shifts its bank; both floor
      // at zero rather than going negative.
      const deltaMs = delta * 1000;
      const endsAt = timer.endsAt === null ? null : Math.max(now, timer.endsAt + deltaMs);
      const remainingMs = endsAt === null ? Math.max(0, timer.remainingMs + deltaMs) : endsAt - now;

      const restTimer: RestTimerState = {
        ...timer,
        // Added time grows the ring's total as well, so the arc can never pass
        // full. Removing time leaves the total alone and the arc just shrinks.
        duration: delta > 0 ? timer.duration + delta : timer.duration,
        endsAt,
        remainingMs,
        remaining: Math.ceil(remainingMs / 1000),
        running: !timer.paused && remainingMs > 0,
      };
      persistSession({ ...state, restTimer }).catch(console.warn);
      return { restTimer };
    });
  },

  // Timed block
  //
  // Persisted with the session (unlike the rest timer) because a 20-minute
  // block routinely outlives a reload, and coming back to a stopped clock
  // mid-block would lose the only thing bounding the work.
  startBlockTimer: (blockKey, { mode, duration, intervalSeconds }) => {
    const safeDuration = Math.max(0, Math.round(duration));
    set((state) => {
      const blockTimer: BlockTimerState = {
        ...initialBlockTimer,
        blockKey,
        mode,
        duration: safeDuration,
        intervalSeconds: clampIntervalSeconds(intervalSeconds ?? 60),
        // A count-up block has no duration to run out, so it starts regardless.
        running: safeDuration > 0 || mode === 'for_time',
        runStartedAt: Date.now(),
      };
      persistSession({ ...state, blockTimer }).catch(console.warn);
      return { blockTimer };
    });
  },

  pauseBlockTimer: () => {
    set((state) => {
      const timer = state.blockTimer;
      if (!timer.running) return state;
      // Bank the elapsed time, then drop the anchor — resume re-anchors it.
      const blockTimer: BlockTimerState = {
        ...timer,
        elapsedBeforePause: blockElapsed(timer),
        elapsed: blockElapsed(timer),
        runStartedAt: null,
        running: false,
        paused: true,
      };
      persistSession({ ...state, blockTimer }).catch(console.warn);
      return { blockTimer };
    });
  },

  resumeBlockTimer: () => {
    set((state) => {
      const timer = state.blockTimer;
      if (!timer.paused || timer.finishedElapsed !== null) return state;
      if (
        timer.duration > 0 &&
        timer.mode !== 'for_time' &&
        timer.elapsedBeforePause >= timer.duration
      ) {
        return state;
      }
      const blockTimer: BlockTimerState = {
        ...timer,
        running: true,
        paused: false,
        runStartedAt: Date.now(),
      };
      persistSession({ ...state, blockTimer }).catch(console.warn);
      return { blockTimer };
    });
  },

  resetBlockTimer: () => {
    set((state) => {
      persistSession({ ...state, blockTimer: initialBlockTimer }).catch(console.warn);
      return { blockTimer: initialBlockTimer };
    });
  },

  finishBlockTimer: () => {
    set((state) => {
      const timer = state.blockTimer;
      if (!timer.blockKey || timer.finishedElapsed !== null) return state;

      const finished = Math.round(blockElapsed(timer));
      const blockTimer: BlockTimerState = {
        ...timer,
        finishedElapsed: finished,
        elapsed: finished,
        elapsedBeforePause: finished,
        runStartedAt: null,
        running: false,
        paused: false,
      };
      // The finishing time is the whole point of a count-up block and cannot be
      // recomputed from the set rows, so it is recorded on the session now.
      const blockTimes = { ...state.blockTimes, [timer.blockKey]: finished };
      persistSession({ ...state, blockTimer, blockTimes }).catch(console.warn);
      return { blockTimer, blockTimes };
    });
  },

  tickBlockTimer: () => {
    set((state) => {
      const timer = state.blockTimer;
      if (!timer.running || timer.paused || timer.runStartedAt === null) return state;

      const elapsed = blockElapsed(timer);

      // A count-up block has nothing to run out; it ends when the work does.
      const uncapped = timer.duration <= 0 || timer.mode === 'for_time';

      if (!uncapped && elapsed >= timer.duration) {
        // The window closed. Keep blockKey so the UI can say which block
        // finished; stop the clock so nothing keeps ticking past zero.
        const blockTimer: BlockTimerState = {
          ...timer,
          elapsedBeforePause: timer.duration,
          elapsed: timer.duration,
          runStartedAt: null,
          running: false,
          paused: false,
        };
        persistSession({ ...state, blockTimer }).catch(console.warn);
        return { blockTimer };
      }

      // Re-render only on a whole-second change; the clock is read to the
      // second and this ticks more often than that.
      if (Math.floor(elapsed) === Math.floor(timer.elapsed)) return state;
      return { blockTimer: { ...timer, elapsed } };
    });
  },

  // Modifiers
  toggleGymRush: () => {
    set((state) => ({ gymRushActive: !state.gymRushActive }));
  },

  setIntent: (intent) => {
    set({ intent });
  },

  // Getters
  getCurrentExercise: () => {
    const state = get();
    if (!state.active || state.exercises.length === 0) {
      return null;
    }
    return state.exercises[state.currentExerciseIndex] ?? null;
  },

  getCompletedSets: () => {
    const state = get();
    return state.exercises.flatMap((e) => e.sets.filter((s) => s.logged)).length;
  },

  getTotalReps: () => {
    const state = get();
    return state.exercises
      .flatMap((e) => e.sets.filter((s) => s.logged))
      .reduce((sum, s) => sum + (s.reps || 0), 0);
  },

  // Hydration
  hydrate: async () => {
    try {
      const stored = await appStorage.getJSON<
        Partial<WorkoutState> & { amrapTimer?: LegacyAmrapTimerState }
      >(STORAGE_KEYS.SESSION.FULL_STATE);
      if (stored?.active) {
        set({
          active: stored.active,
          templateId: stored.templateId ?? null,
          // Sessions persisted before #80 carry no day, and resume without one.
          dayKey: stored.dayKey ?? null,
          workoutName: stored.workoutName ?? null,
          startedAt: stored.startedAt ?? null,
          currentExerciseIndex: stored.currentExerciseIndex ?? 0,
          exercises: stored.exercises ?? [],
          intent: stored.intent ?? 'normal',
          gymRushActive: stored.gymRushActive ?? false,
          blocks: stored.blocks ?? [],
          blockTimes: stored.blockTimes ?? {},
          restTimer: restoreRestTimer(stored.restTimer, Date.now()),
          blockTimer: restoreBlockTimer(stored.blockTimer, stored.amrapTimer),
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate workout store:', error);
    }
  },

  reset: () => {
    set(initialState);
    appStorage.delete(STORAGE_KEYS.SESSION.FULL_STATE).catch(console.warn);
  },
}));

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const selectSessionDuration = (state: WorkoutStore) => {
  if (!state.startedAt) return 0;
  return Math.floor((Date.now() - state.startedAt) / 1000 / 60);
};

export const selectExerciseProgress = (state: WorkoutStore) => {
  const completed = state.exercises.filter((e) => e.completed).length;
  const total = state.exercises.length;
  return { completed, total, percentage: total > 0 ? completed / total : 0 };
};

export const selectIsRestTimerComplete = (state: WorkoutStore) => {
  return state.restTimer.remaining === 0 && !state.restTimer.running;
};
