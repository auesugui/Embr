// =============================================================================
// Embr Cardio Tests
// =============================================================================
// The activity suggestions and the one-line summary shown in history.

import { describe, expect, it } from '@jest/globals';

import { describeCardio, suggestCardio } from '../cardio';

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

describe('suggestCardio', () => {
  it('offers nothing for a blank query', () => {
    expect(suggestCardio('   ')).toEqual([]);
  });

  it('lists names that start with the query before names that only contain it', () => {
    expect(suggestCardio('r').slice(0, 2)).toEqual(['Run', 'Row']);
  });

  it('leaves out the exact name, since it is already typed', () => {
    expect(suggestCardio('Run')).not.toContain('Run');
  });

  it('caps the list at the limit', () => {
    expect(suggestCardio('e', 2)).toHaveLength(2);
  });
});
