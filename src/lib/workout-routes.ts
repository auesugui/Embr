// =============================================================================
// Where tapping a workout should take you
// =============================================================================
// One rule, extracted from the home screen so it can be asserted rather than
// eyeballed: what a tap on one of YOUR OWN workouts does.
//
// The rule is about how much is left to decide. A workout you built is one
// you've already chosen — the only thing left is to train, so the tap goes to
// the screen with the Start button on it. A multi-day program still has a real
// question attached (which day am I running?), so that one stops at the picker.
//
// Built-in templates are NOT routed through here. Tapping one of those is
// browsing someone else's program, where the description IS the point.

/** The template detail / day-picker screen. */
export const templateDetailRoute = (templateId: string): string =>
  `/workout/template/${templateId}`;

/** The pre-session screen for one day of a template. */
export const loadoutRoute = (templateId: string, dayIndex: number): string =>
  `/workout/loadout?templateId=${templateId}&dayIndex=${dayIndex}`;

/**
 * Where a tap on one of the user's own workouts goes.
 *
 * `dayCount` of 1 (or a malformed 0 — a template that somehow lost its days)
 * goes straight to the loadout for day 0. Anything higher goes to the picker.
 */
export function ownWorkoutRoute(templateId: string, dayCount: number): string {
  return dayCount > 1 ? templateDetailRoute(templateId) : loadoutRoute(templateId, 0);
}
