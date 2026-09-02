// =============================================================================
// Route Titles — single source of truth for root-Stack screen titles
// =============================================================================
// Issue #24 (A2): every root-Stack route must show a human-readable title, never
// the raw route path (e.g. "workout/template/[id]"). Centralizing them here lets
// the regression test (src/__tests__/routeTitles.unit.test.ts) assert that no
// title equals its route key, so a future regression to a raw path fails CI.
//
// Notes:
//  - `workout/template/[id]` is given a static fallback ("Template"); the screen
//    itself overrides it reactively with "${templateName} · Day ${n}" via
//    navigation.setOptions once the template resolves.
//  - `workout/template-edit/[id]` is also self-declared inside the screen; the
//    value here is kept in sync as the canonical string.

// "Loadout" and "Session" were game vocabulary that leaked into the tracker
// build: this map isn't flag-aware, so the gamified copy showed up on a screen
// that had nothing to do with the game layer (ADR-0013).
export const ROUTE_TITLES = {
  'workout/loadout': 'Start Workout',
  'workout/summary': 'Workout Summary',
  'workout/session': 'Workout',
  'workout/template/[id]': 'Template',
  'workout/template-edit/[id]': 'Edit Template',
} as const;
// `(tabs)/dev` lived here for the __DEV__-only dev panel. The panel is gone,
// and with it the route, the screen, and src/components/dev.

export type RouteTitleName = keyof typeof ROUTE_TITLES;

/**
 * True when a candidate string looks like a raw route path rather than a human
 * title. Used by the regression test and (defensively) anywhere that wants to
 * sanity-check a title before rendering. Raw indicators: a "/" (nested path),
 * "[" / "]" (dynamic segments), or the string being identical to a route key.
 */
export function isRawRoutePath(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return true;
  if (Object.prototype.hasOwnProperty.call(ROUTE_TITLES, value)) return true;
  return value.includes('/') || value.includes('[') || value.includes(']');
}
