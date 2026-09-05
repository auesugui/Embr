// =============================================================================
// Session view rules
// =============================================================================
// The reported problem was a screen with five competing CTAs whose only
// sensible next action was one of them, and a Finish button on a workout that
// had not started. These pin the three rules that fixed it.

import { hasRecordedWork, isPreStart, showAmrapScrim } from '../session-view';

describe('showAmrapScrim', () => {
  it('covers the screen while an AMRAP clock is running', () => {
    expect(showAmrapScrim({ mode: 'amrap_rounds', clockIsOurs: true, dismissed: false })).toBe(
      true
    );
    expect(showAmrapScrim({ mode: 'amrap_reps', clockIsOurs: true, dismissed: false })).toBe(true);
  });

  it('leaves the other timed modes alone', () => {
    // EMOM needs its interval clock and for_time needs its ladder; neither is
    // a screen with nothing to say but the round count.
    expect(showAmrapScrim({ mode: 'emom', clockIsOurs: true, dismissed: false })).toBe(false);
    expect(showAmrapScrim({ mode: 'for_time', clockIsOurs: true, dismissed: false })).toBe(false);
    expect(showAmrapScrim({ mode: 'sets', clockIsOurs: true, dismissed: false })).toBe(false);
  });

  it('stays away until the clock is this block’s', () => {
    expect(showAmrapScrim({ mode: 'amrap_rounds', clockIsOurs: false, dismissed: false })).toBe(
      false
    );
  });

  it('stays down once dismissed to log a partial round', () => {
    expect(showAmrapScrim({ mode: 'amrap_rounds', clockIsOurs: true, dismissed: true })).toBe(
      false
    );
  });
});

describe('isPreStart', () => {
  it('is true for an untouched AMRAP', () => {
    expect(isPreStart({ mode: 'amrap_rounds', clockIsOurs: false, roundsDone: 0 })).toBe(true);
  });

  it('is false once the clock is running', () => {
    expect(isPreStart({ mode: 'amrap_rounds', clockIsOurs: true, roundsDone: 0 })).toBe(false);
  });

  it('is false once rounds exist, even with no clock', () => {
    // Reset clock, banked rounds: the work happened, so the logging surface
    // must not disappear underneath it.
    expect(isPreStart({ mode: 'amrap_rounds', clockIsOurs: false, roundsDone: 3 })).toBe(false);
  });

  it('never applies to a set scheme', () => {
    expect(isPreStart({ mode: 'sets', clockIsOurs: false, roundsDone: 0 })).toBe(false);
  });
});

describe('hasRecordedWork', () => {
  it('is false for a workout that was opened and not started', () => {
    expect(hasRecordedWork({ completedSets: 0, activeBlockKey: null, finishedBlockCount: 0 })).toBe(
      false
    );
  });

  it('is true once a set is logged, with no clock involved', () => {
    // The lifting path: no block timer exists, so this is what keeps Finish on
    // screen for an ordinary sets session.
    expect(hasRecordedWork({ completedSets: 1, activeBlockKey: null, finishedBlockCount: 0 })).toBe(
      true
    );
  });

  it('is true the moment a clock starts, before any round lands', () => {
    expect(
      hasRecordedWork({ completedSets: 0, activeBlockKey: 'block-0', finishedBlockCount: 0 })
    ).toBe(true);
  });

  it('is true for a finished block whose clock has been cleared', () => {
    expect(hasRecordedWork({ completedSets: 0, activeBlockKey: null, finishedBlockCount: 1 })).toBe(
      true
    );
  });
});
