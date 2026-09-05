// =============================================================================
// Own-workout routing
// =============================================================================
// The home screen's whole complaint was that starting a workout you'd already
// built took three taps through a read-only page. These assert the shortcut
// stays a shortcut, and that a multi-day program still gets its day picker.

import { loadoutRoute, ownWorkoutRoute, templateDetailRoute } from '../workout-routes';

describe('ownWorkoutRoute', () => {
  it('sends a single-day workout straight to the start screen', () => {
    expect(ownWorkoutRoute('abc', 1)).toBe('/workout/loadout?templateId=abc&dayIndex=0');
  });

  it('sends a multi-day program to the day picker, where the choice is real', () => {
    expect(ownWorkoutRoute('ppl', 6)).toBe('/workout/template/ppl');
    expect(ownWorkoutRoute('ul', 2)).toBe('/workout/template/ul');
  });

  it('treats a day-less template as single-day rather than routing nowhere', () => {
    // Shouldn't happen — but a template that lost its days should still land on
    // a screen that renders, not on a picker with nothing to pick.
    expect(ownWorkoutRoute('broken', 0)).toBe('/workout/loadout?templateId=broken&dayIndex=0');
  });
});

describe('route builders', () => {
  it('builds the detail route', () => {
    expect(templateDetailRoute('x')).toBe('/workout/template/x');
  });

  it('builds a loadout route for a specific day', () => {
    expect(loadoutRoute('x', 3)).toBe('/workout/loadout?templateId=x&dayIndex=3');
  });
});
