// =============================================================================
// Block helpers
// =============================================================================
// `blockId` and `mode` are optional everywhere they appear, and every workout
// logged before blocks existed omits both. These tests pin the readings that
// stored data depends on:
//
//   absent        -> a plain set scheme
//   mode 'amrap'  -> the pre-block one-movement AMRAP, i.e. `amrap_reps`
//   dangling id   -> a set scheme, not a timed block with no clock
//
// Getting any of the three backwards reclassifies stored history the moment it
// loads, and there is no backend to reconcile against.

import type { WorkoutBlock } from '@/types';
import {
  DEFAULT_AMRAP_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  MAX_AMRAP_SECONDS,
  MIN_AMRAP_SECONDS,
  allowsMultipleMembers,
  blockReps,
  clampIntervalSeconds,
  clampRounds,
  completedRounds,
  countsUp,
  describeBlock,
  describeScheme,
  formatAmrapWindow,
  formatClock,
  groupIntoBlocks,
  hasRepTargets,
  isOpenEnded,
  isTimed,
  normalizeMode,
  resolveBlock,
  resolveBlockRecord,
  roundLabel,
  usesRestTimer,
} from '../blocks';

const set = (logged: boolean, reps: number | null = null) => ({
  logged,
  reps,
  weight: null,
  isPR: false,
  isRepPR: false,
});

describe('normalizeMode', () => {
  it('reads the pre-block spelling as amrap_reps', () => {
    expect(normalizeMode('amrap')).toBe('amrap_reps');
  });

  it('passes through the current modes', () => {
    expect(normalizeMode('amrap_rounds')).toBe('amrap_rounds');
    expect(normalizeMode('for_time')).toBe('for_time');
    expect(normalizeMode('emom')).toBe('emom');
  });

  it('falls back to sets rather than throwing on junk from a restored file', () => {
    expect(normalizeMode(undefined)).toBe('sets');
    expect(normalizeMode('tabata')).toBe('sets');
  });
});

describe('resolveBlock', () => {
  it('treats an exercise with no block and no mode as a set scheme', () => {
    expect(resolveBlock({}, undefined).mode).toBe('sets');
    expect(resolveBlock(undefined, undefined).mode).toBe('sets');
    expect(resolveBlock(null, [])).toEqual(expect.objectContaining({ mode: 'sets', id: null }));
  });

  it('reads a legacy per-exercise amrap as a one-member amrap_reps block', () => {
    const resolved = resolveBlock({ mode: 'amrap', durationSeconds: 900 }, undefined);
    expect(resolved.mode).toBe('amrap_reps');
    expect(resolved.durationSeconds).toBe(900);
    expect(resolved.id).toBeNull();
  });

  it('gives a legacy amrap with no duration a usable window', () => {
    expect(resolveBlock({ mode: 'amrap' }, undefined).durationSeconds).toBe(DEFAULT_AMRAP_SECONDS);
  });

  it('resolves an explicit block id against the block list', () => {
    const blocks: WorkoutBlock[] = [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 }];
    const resolved = resolveBlock({ blockId: 'b1' }, blocks);
    expect(resolved.mode).toBe('amrap_rounds');
    expect(resolved.durationSeconds).toBe(1200);
  });

  it('falls back to a set scheme when the block id points at nothing', () => {
    // A half-restored backup or a deleted block must not leave an exercise in a
    // timed mode with no clock behind it.
    expect(resolveBlock({ blockId: 'gone' }, []).mode).toBe('sets');
  });

  it('prefers an explicit block over a stale legacy mode on the same record', () => {
    const blocks: WorkoutBlock[] = [{ id: 'b1', mode: 'emom', rounds: 12 }];
    expect(resolveBlock({ blockId: 'b1', mode: 'amrap' }, blocks).mode).toBe('emom');
  });
});

describe('resolveBlockRecord', () => {
  it('clamps a stored window into the supported range', () => {
    expect(
      resolveBlockRecord({ id: 'b', mode: 'amrap_rounds', durationSeconds: 1 }).durationSeconds
    ).toBe(MIN_AMRAP_SECONDS);
    expect(
      resolveBlockRecord({ id: 'b', mode: 'amrap_rounds', durationSeconds: 10 ** 9 })
        .durationSeconds
    ).toBe(MAX_AMRAP_SECONDS);
  });

  it('survives a corrupted window rather than returning a zero-length one', () => {
    expect(
      resolveBlockRecord({ id: 'b', mode: 'amrap_reps', durationSeconds: Number.NaN })
        .durationSeconds
    ).toBe(DEFAULT_AMRAP_SECONDS);
  });

  it('lets for_time be uncapped, unlike the AMRAP modes', () => {
    // Zero means "no cap, the clock just runs" — clamping it up to the minimum
    // window would invent a time limit the user never set.
    expect(resolveBlockRecord({ id: 'b', mode: 'for_time' }).durationSeconds).toBe(0);
    expect(
      resolveBlockRecord({ id: 'b', mode: 'for_time', durationSeconds: 600 }).durationSeconds
    ).toBe(600);
  });

  it('defaults an EMOM interval to one minute', () => {
    expect(resolveBlockRecord({ id: 'b', mode: 'emom' }).intervalSeconds).toBe(
      DEFAULT_INTERVAL_SECONDS
    );
  });
});

describe('mode predicates', () => {
  it('counts only for_time upward', () => {
    expect(countsUp('for_time')).toBe(true);
    expect(countsUp('amrap_rounds')).toBe(false);
    expect(countsUp('emom')).toBe(false);
  });

  it('treats only the AMRAP modes as open-ended', () => {
    expect(isOpenEnded('amrap_rounds')).toBe(true);
    expect(isOpenEnded('amrap_reps')).toBe(true);
    expect(isOpenEnded('for_time')).toBe(false);
    expect(isOpenEnded('emom')).toBe(false);
  });

  it('keeps amrap_reps single-movement', () => {
    // "As many reps as possible" has no meaning spread over three exercises —
    // that is amrap_rounds.
    expect(allowsMultipleMembers('amrap_reps')).toBe(false);
    expect(allowsMultipleMembers('amrap_rounds')).toBe(true);
    expect(allowsMultipleMembers('for_time')).toBe(true);
    expect(allowsMultipleMembers('emom')).toBe(true);
  });

  it('drops the rep target only for amrap_reps', () => {
    expect(hasRepTargets('amrap_reps')).toBe(false);
    expect(hasRepTargets('amrap_rounds')).toBe(true);
  });

  it('runs the rest timer only for set schemes', () => {
    expect(usesRestTimer('sets')).toBe(true);
    expect(usesRestTimer('emom')).toBe(false);
  });

  it('treats everything but sets as timed', () => {
    expect(isTimed('sets')).toBe(false);
    expect(isTimed('for_time')).toBe(true);
  });
});

describe('clamping', () => {
  it('bounds the EMOM interval', () => {
    expect(clampIntervalSeconds(5)).toBe(30);
    expect(clampIntervalSeconds(10 ** 6)).toBe(600);
    expect(clampIntervalSeconds(Number.NaN)).toBe(DEFAULT_INTERVAL_SECONDS);
  });

  it('bounds the round count', () => {
    expect(clampRounds(0)).toBe(1);
    expect(clampRounds(1000)).toBe(99);
  });
});

describe('groupIntoBlocks', () => {
  const blocks: WorkoutBlock[] = [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 }];

  it('keeps a lone exercise as its own entry', () => {
    const grouped = groupIntoBlocks([{}, {}], blocks);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].entries).toHaveLength(1);
  });

  it('collapses block members into one entry at the first member position', () => {
    const grouped = groupIntoBlocks(
      [{ blockId: 'b1' }, { blockId: 'b1' }, { blockId: 'b1' }, {}],
      blocks
    );
    expect(grouped).toHaveLength(2);
    expect(grouped[0].block.mode).toBe('amrap_rounds');
    expect(grouped[0].entries.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(grouped[1].entries[0].index).toBe(3);
  });

  it('preserves the original index so the stores can still address exercises', () => {
    // The session logs against a flat index. Grouping is a render concern and
    // must not renumber anything.
    const grouped = groupIntoBlocks([{}, { blockId: 'b1' }, { blockId: 'b1' }], blocks);
    expect(grouped[1].entries.map((e) => e.index)).toEqual([1, 2]);
  });

  it('groups non-adjacent members, which a hand-edited file can produce', () => {
    const grouped = groupIntoBlocks([{ blockId: 'b1' }, {}, { blockId: 'b1' }], blocks);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].entries.map((e) => e.index)).toEqual([0, 2]);
  });
});

describe('completedRounds', () => {
  const entries = (...rows: boolean[][]) =>
    rows.map((sets) => ({ exercise: { sets: sets.map((l) => set(l)) } }));

  it('counts a round only when every member logged it', () => {
    // Two full rounds and a partial third is two rounds — the same way it is
    // scored in the gym.
    expect(completedRounds(entries([true, true, true], [true, true, false]))).toBe(2);
  });

  it('is zero before the first round closes', () => {
    expect(completedRounds(entries([true], [false]))).toBe(0);
  });

  it('stops at the first gap rather than counting later rounds', () => {
    expect(completedRounds(entries([true, false, true], [true, false, true]))).toBe(1);
  });

  it('is zero for an empty block', () => {
    expect(completedRounds([])).toBe(0);
  });
});

describe('blockReps', () => {
  it('sums only logged reps across every member', () => {
    expect(
      blockReps([
        { exercise: { sets: [set(true, 5), set(true, 5), set(false, 5)] } },
        { exercise: { sets: [set(true, 10)] } },
      ])
    ).toBe(20);
  });
});

describe('formatAmrapWindow', () => {
  it('renders sub-hour windows in minutes', () => {
    expect(formatAmrapWindow(20 * 60)).toBe('20 min');
  });

  it('renders longer windows in hours and minutes', () => {
    expect(formatAmrapWindow(60 * 60)).toBe('1h');
    expect(formatAmrapWindow(65 * 60)).toBe('1h 05m');
  });
});

describe('formatClock', () => {
  it('pads seconds and never goes negative', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('describeBlock', () => {
  const resolve = (block: WorkoutBlock) => describeBlock(resolveBlockRecord(block));

  it('describes each timed mode in its own terms', () => {
    expect(resolve({ id: 'b', mode: 'amrap_rounds', durationSeconds: 1200 })).toBe(
      'AMRAP · 20 min'
    );
    expect(resolve({ id: 'b', mode: 'amrap_reps', durationSeconds: 300 })).toBe('AMRAP · 5 min');
    expect(resolve({ id: 'b', mode: 'for_time', rounds: 3 })).toBe('3 rounds for time');
    expect(resolve({ id: 'b', mode: 'for_time', rounds: 3, durationSeconds: 900 })).toBe(
      '3 rounds for time · cap 15 min'
    );
    expect(resolve({ id: 'b', mode: 'emom', rounds: 12 })).toBe('EMOM 12 × 1:00');
  });

  it('says nothing for a set scheme — the row already describes itself', () => {
    expect(resolve({ id: 'b', mode: 'sets' })).toBe('');
  });
});

describe('describeScheme', () => {
  it('describes a set scheme', () => {
    expect(describeScheme({ sets: 4, reps: '6-10' })).toBe('4 sets × 6-10');
  });

  it('describes a legacy AMRAP exercise by its window', () => {
    expect(
      describeScheme({ mode: 'amrap', durationSeconds: 20 * 60, sets: 3, reps: 'AMRAP' })
    ).toBe('AMRAP · 20 min');
  });

  it('describes a member of a rounds block by its rep target alone', () => {
    // The block header carries the clock, so the row must not repeat it.
    const blocks: WorkoutBlock[] = [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 }];
    expect(describeScheme({ blockId: 'b1', sets: 1, reps: '5' }, blocks)).toBe('5 reps');
  });

  it('prescribes a held movement in seconds', () => {
    expect(describeScheme({ exerciseId: 'plank', sets: 3, reps: '30-60' })).toBe('3 sets × 30-60s');
  });

  it('prescribes a held movement in seconds inside a rounds block too', () => {
    const blocks: WorkoutBlock[] = [{ id: 'b1', mode: 'amrap_rounds', durationSeconds: 1200 }];
    expect(
      describeScheme({ exerciseId: 'plank', blockId: 'b1', sets: 1, reps: '30' }, blocks)
    ).toBe('30s');
  });

  it('leaves a counted movement reading exactly as it did', () => {
    expect(describeScheme({ exerciseId: 'bodyweight_squat', sets: 4, reps: '6-10' })).toBe(
      '4 sets × 6-10'
    );
  });
});

describe('roundLabel', () => {
  it('calls a row a round inside a timed block and a set otherwise', () => {
    expect(roundLabel('amrap_rounds', 2)).toBe('Round 3');
    expect(roundLabel('sets', 2)).toBe('Set 3');
  });
});
