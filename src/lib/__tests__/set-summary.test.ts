// =============================================================================
// Set summarising
// =============================================================================
// The reported problem was nine identical rows per movement on the history
// screen. These pin what replaces them — and, more importantly, pin the case
// where collapsing would LOSE something: varied sets keep their numbers.

import type { LoggedSet } from '@/types';
import { summarizeSets } from '../set-summary';

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 5,
  weight: null,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...over,
});

const opts = { units: 'lb' as const, unitLabel: 'Round' as const };
const setOpts = { units: 'lb' as const, unitLabel: 'Set' as const };

describe('summarizeSets', () => {
  it('collapses identical rounds to one line', () => {
    const summary = summarizeSets(
      Array.from({ length: 9 }, () => set()),
      opts
    );
    expect(summary).toEqual({ headline: '9 rounds × 5 reps · 45 total' });
  });

  it('collapses identical weighted sets, keeping the load', () => {
    const summary = summarizeSets(
      Array.from({ length: 3 }, () => set({ weight: 135 })),
      setOpts
    );
    expect(summary).toEqual({ headline: '3 sets × 135 lb × 5 · 15 total' });
  });

  it('keeps every number when the sets differ', () => {
    // The whole point of the caveat: on a lifting session the per-set weights
    // ARE the record, so they must survive the collapse.
    const summary = summarizeSets(
      [set({ weight: 135 }), set({ weight: 155 }), set({ weight: 175, reps: 3 })],
      setOpts
    );
    expect(summary).toEqual({
      headline: '3 sets · 13 reps',
      detail: '135×5 · 155×5 · 175×3',
    });
  });

  it('keeps varied bodyweight rounds as a compact list', () => {
    const summary = summarizeSets([set(), set(), set({ reps: 4 }), set({ reps: 3 })], opts);
    expect(summary).toEqual({ headline: '4 rounds · 17 reps', detail: '5 · 5 · 4 · 3' });
  });

  it('does not multiply a single entry by one', () => {
    expect(summarizeSets([set()], opts)).toEqual({ headline: '5 reps' });
    expect(summarizeSets([set({ weight: 225, reps: 1 })], setOpts)).toEqual({
      headline: '225 lb × 1',
    });
  });

  it('ignores unlogged rows', () => {
    const summary = summarizeSets([set(), set(), set({ logged: false, reps: null })], opts);
    expect(summary).toEqual({ headline: '2 rounds × 5 reps · 10 total' });
  });

  it('returns null when nothing was logged', () => {
    expect(summarizeSets([set({ logged: false })], opts)).toBeNull();
    expect(summarizeSets([], opts)).toBeNull();
  });

  it('carries a rep PR through the collapse', () => {
    // The PR is a fact about the movement, not about which row it landed on.
    const summary = summarizeSets([set(), set({ isRepPR: true })], opts);
    expect(summary?.headline).toBe('2 rounds × 5 reps · 10 total · rep PR');
  });

  it('singularises a lone round', () => {
    const summary = summarizeSets([set({ reps: 8 }), set({ reps: 7 })], opts);
    expect(summary?.headline).toContain('2 rounds');
    expect(summarizeSets([set({ reps: 8 })], opts)?.headline).not.toContain('rounds');
  });

  it('treats a zero weight as bodyweight rather than a load', () => {
    // logSet stores 0 for "no weight" on some paths; "0 lb × 5" is not a fact.
    const summary = summarizeSets([set({ weight: 0 }), set({ weight: 0 })], opts);
    expect(summary).toEqual({ headline: '2 rounds × 5 reps · 10 total' });
  });
});
