// =============================================================================
// Cardio summary tests — saved cardio entries stay readable in History
// =============================================================================

import { describe, expect, it } from '@jest/globals';
import { describeCardio } from '../cardio';

describe('describeCardio', () => {
  it('joins duration, distance, and RPE', () => {
    expect(
      describeCardio({ durationSeconds: 1800, distance: 3.1, distanceUnit: 'mi', rpe: 6 })
    ).toBe('30m · 3.1 mi · RPE 6');
  });

  it('shows only what was recorded', () => {
    expect(describeCardio({ durationSeconds: 1800 })).toBe('30m');
  });

  it('keeps the seconds when there are some', () => {
    expect(describeCardio({ durationSeconds: 150 })).toBe('2m 30s');
  });
});
