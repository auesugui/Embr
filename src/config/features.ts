// =============================================================================
// Embr Feature Flags
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
 * Product name shown in chrome (tab titles, About).
 *
 * The tracker build is now **Embr** (ADR-0013) — a real identity rather than
 * the placeholder "Ironlog" name it carried while it was just "IronQuest with
 * the game turned off". The gamified build keeps its old name; it's inert, and
 * collapsing the flag entirely is a separate pass.
 */
export const APP_NAME = GAMIFICATION_ENABLED ? 'IronQuest' : 'Embr';
