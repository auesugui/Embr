// =============================================================================
// Embr App Config
// =============================================================================
//
// `GAMIFICATION_ENABLED` used to live here — a build-time flag (ADR-0012) that
// switched the app between IronQuest, a gamified tracker with a pet and a
// battle tower, and Ironlog, the plain tracker underneath it. It existed to
// answer one question through use: is the pet the friction or the point?
//
// The question got answered by decision instead (ADR-0013): the game layer
// isn't being built or used. ADR-0014 removed it. There's one app now.
//
// Nothing replaces the flag. If a game layer ever returns it returns as a
// feature with its own design, not as a branch inside every screen — the flag's
// real cost was that every new surface had to remember to gate itself, and the
// failure mode when one didn't was silent.
// =============================================================================

/** Product name shown in chrome (tab titles, About). */
export const APP_NAME = 'Embr';
