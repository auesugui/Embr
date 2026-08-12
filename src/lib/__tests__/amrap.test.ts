// =============================================================================
// AMRAP helpers
// =============================================================================
// `mode` is optional everywhere it appears, and every workout logged before
// AMRAP existed omits it. These tests pin the "absent means sets" reading —
// getting it backwards would reclassify a decade of stored history as timed
// blocks the moment it loads.

import {
  DEFAULT_AMRAP_SECONDS,
  MAX_AMRAP_SECONDS,
  MIN_AMRAP_SECONDS,
  amrapDuration,
  clampAmrapSeconds,
  describeScheme,
  formatAmrapWindow,
  formatClock,
  isAmrap,
} from '../amrap';

describe('isAmrap', () => {
  it('treats a missing mode as a set scheme', () => {
    expect(isAmrap({ sets: 3, reps: '8-12' } as never)).toBe(false);
    expect(isAmrap(undefined)).toBe(false);
    expect(isAmrap(null)).toBe(false);
  });

  it('is true only for an explicit amrap mode', () => {
    expect(isAmrap({ mode: 'amrap' })).toBe(true);
    expect(isAmrap({ mode: 'sets' })).toBe(false);
  });
});

describe('amrapDuration', () => {
  it('falls back to the default window when none was stored', () => {
    expect(amrapDuration({ mode: 'amrap' })).toBe(DEFAULT_AMRAP_SECONDS);
  });

  it('clamps a stored window into the supported range', () => {
    expect(amrapDuration({ mode: 'amrap', durationSeconds: 1 })).toBe(MIN_AMRAP_SECONDS);
    expect(amrapDuration({ mode: 'amrap', durationSeconds: 10 ** 9 })).toBe(MAX_AMRAP_SECONDS);
  });

  it('survives a corrupted value rather than returning a zero-length window', () => {
    expect(amrapDuration({ mode: 'amrap', durationSeconds: Number.NaN })).toBe(
      DEFAULT_AMRAP_SECONDS
    );
  });
});

describe('clampAmrapSeconds', () => {
  it('rounds to whole seconds inside the range', () => {
    expect(clampAmrapSeconds(600.4)).toBe(600);
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

describe('describeScheme', () => {
  it('describes a set scheme', () => {
    expect(describeScheme({ sets: 4, reps: '6-10' })).toBe('4 sets × 6-10');
  });

  it('describes an AMRAP block by its window, not its set count', () => {
    expect(
      describeScheme({ mode: 'amrap', durationSeconds: 20 * 60, sets: 3, reps: 'AMRAP' })
    ).toBe('AMRAP · 20 min');
  });
});
