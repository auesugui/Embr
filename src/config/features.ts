// =============================================================================
// IronQuest Feature Flags
// =============================================================================
// `GAMIFICATION_ENABLED` is the seam between the tracker and the game layer.
// Off, the app is a plain workout tracker: no Forge Points, no pet, no tower,
// no onboarding wizard. Everything the tracker owns (sessions, templates,
// history, PRs, streaks, units) stays untouched.
//
// Build-time, not runtime: Expo inlines `EXPO_PUBLIC_*` at bundle time, so the
// off build genuinely never renders the game layer rather than hiding it behind
// a toggle a stray tap could flip mid-dogfood.
//
//   npm run web            → gamified (default)
//   npm run web:tracker    → tracker-only
//
// Streaks stay on both sides of the flag — a streak is a tracker feature (Hevy,
// Strong, and Whoop all have one); Spirit FP is the gamified part and that goes.

/**
 * Values that read as "off" in `EXPO_PUBLIC_GAMIFICATION`. Anything else —
 * including unset — leaves the game layer on, so the default build is the full
 * IronQuest experience and the tracker build is the deliberate opt-out.
 */
const OFF_VALUES = new Set(['off', 'false', '0', 'no']);

export const GAMIFICATION_ENABLED = !OFF_VALUES.has(
  (process.env.EXPO_PUBLIC_GAMIFICATION ?? '').trim().toLowerCase()
);

/**
 * Product name shown in chrome (tab titles, About). The tracker build isn't
 * "IronQuest" — calling it that in the UI would undercut the whole point of
 * finding out whether the plain tracker stands on its own.
 */
export const APP_NAME = GAMIFICATION_ENABLED ? 'IronQuest' : 'Ironlog';
