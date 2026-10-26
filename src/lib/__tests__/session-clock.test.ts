// =============================================================================
// Session clock — the elapsed readout in the session header (issue #81)
// =============================================================================

import { formatElapsed, sessionElapsed } from '../session-clock';

describe('sessionElapsed', () => {
  it('counts wall-clock seconds from the anchor', () => {
    expect(sessionElapsed(1_000_000, 1_000_000 + 1458 * 1000)).toBe(1458);
  });

  // The whole point of the anchor: no ticks were delivered while the tab was
  // suspended, and the clock still comes back right.
  it('is right across a gap with no ticks', () => {
    expect(sessionElapsed(1_000_000, 1_000_000 + 40 * 60 * 1000)).toBe(2400);
  });

  it('is zero with no session, and never negative', () => {
    expect(sessionElapsed(null, 1_000_000)).toBe(0);
    expect(sessionElapsed(1_000_000, 999_000)).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('reads as minutes and seconds under an hour', () => {
    expect(formatElapsed(1458)).toBe('24:18');
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(3599)).toBe('59:59');
  });

  it('adds the hour from one hour', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
    expect(formatElapsed(4324)).toBe('1:12:04');
    expect(formatElapsed(7384)).toBe('2:03:04');
  });
});
