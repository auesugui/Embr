// =============================================================================
// Embr Font System
// =============================================================================
//
// Two faces, deliberately chosen. Neither is Inter — Inter/Geist is the default
// every AI-generated app ships with, and "unowned" was the whole complaint.
//
//   UI + data   — geometric-humanist sans, tabular figures. Hevy register.
//   Display     — warm serif, used ONLY for emotional moments (home greeting,
//                 summary headline). Finch register.
//
// The Hevy/Finch surface seam (ADR-0013) expressed in type.
//
// -----------------------------------------------------------------------------
// SWAPPING THE UI FACE TO SATOSHI / GENERAL SANS
// -----------------------------------------------------------------------------
// Satoshi and General Sans are Fontshare faces with no npm package. To use one:
//
//   1. Download from fontshare.com (Regular / Medium / Semibold / Bold).
//   2. Drop the .otf files in `assets/fonts/` using the filenames in
//      FONTSHARE_ASSETS below.
//   3. Flip UI_FONT_SOURCE to 'fontshare' and set FONTSHARE_FAMILY.
//
// Nothing else in the codebase changes — everything reads `fonts.*`.
// =============================================================================

import type { FontSource } from 'expo-font';

export type UiFontSource = 'google' | 'fontshare';

/** Flip to 'fontshare' after dropping the .otf files in assets/fonts/. */
export const UI_FONT_SOURCE: UiFontSource = 'google';

/** Which Fontshare family the assets below represent. Cosmetic until source flips. */
export const FONTSHARE_FAMILY = 'Satoshi';

// -----------------------------------------------------------------------------
// Family names — what StyleSheet actually receives
// -----------------------------------------------------------------------------

const GOOGLE_UI = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

const FONTSHARE_UI = {
  regular: `${FONTSHARE_FAMILY}-Regular`,
  medium: `${FONTSHARE_FAMILY}-Medium`,
  semibold: `${FONTSHARE_FAMILY}-Semibold`,
  bold: `${FONTSHARE_FAMILY}-Bold`,
} as const;

const DISPLAY = {
  regular: 'Fraunces_400Regular',
  semibold: 'Fraunces_600SemiBold',
  bold: 'Fraunces_700Bold',
} as const;

// Taken as a parameter rather than read from the module const, so TypeScript
// doesn't narrow UI_FONT_SOURCE to its initializer and flag the other branch as
// unreachable — the whole point is that the branch is meant to be flipped.
function selectUiFamilies(source: UiFontSource) {
  return source === 'fontshare' ? FONTSHARE_UI : GOOGLE_UI;
}

export const fonts = {
  ui: selectUiFamilies(UI_FONT_SOURCE),
  display: DISPLAY,
} as const;

// -----------------------------------------------------------------------------
// Loader map — consumed by useFonts() in app/_layout.tsx
// -----------------------------------------------------------------------------

/**
 * Fontshare .otf files.
 *
 * These `require`s are commented out on purpose. Metro resolves require() paths
 * statically at bundle time — it does not care that this function is never
 * called — so referencing font files that aren't in the repo yet fails the
 * bundle outright. Uncomment as step 3 of the swap, once the files exist.
 */
function fontshareAssets(): Record<string, FontSource> {
  throw new Error(
    `UI_FONT_SOURCE is 'fontshare' but the ${FONTSHARE_FAMILY} font files are not wired up. ` +
      'Download them from fontshare.com into assets/fonts/, then uncomment the requires ' +
      'in src/theme/fonts.ts → fontshareAssets().'
  );

  // return {
  //   [FONTSHARE_UI.regular]: require('../../assets/fonts/Satoshi-Regular.otf'),
  //   [FONTSHARE_UI.medium]: require('../../assets/fonts/Satoshi-Medium.otf'),
  //   [FONTSHARE_UI.semibold]: require('../../assets/fonts/Satoshi-Semibold.otf'),
  //   [FONTSHARE_UI.bold]: require('../../assets/fonts/Satoshi-Bold.otf'),
  // };
}

/**
 * Google-hosted faces come pre-mapped from their packages; Fontshare faces are
 * local assets. Returns the map to hand to `useFonts`.
 */
export function getFontMap(source: UiFontSource = UI_FONT_SOURCE): Record<string, FontSource> {
  const jakarta = require('@expo-google-fonts/plus-jakarta-sans');
  const fraunces = require('@expo-google-fonts/fraunces');

  const display = {
    [DISPLAY.regular]: fraunces.Fraunces_400Regular,
    [DISPLAY.semibold]: fraunces.Fraunces_600SemiBold,
    [DISPLAY.bold]: fraunces.Fraunces_700Bold,
  };

  if (source === 'fontshare') {
    return { ...fontshareAssets(), ...display };
  }

  return {
    [GOOGLE_UI.regular]: jakarta.PlusJakartaSans_400Regular,
    [GOOGLE_UI.medium]: jakarta.PlusJakartaSans_500Medium,
    [GOOGLE_UI.semibold]: jakarta.PlusJakartaSans_600SemiBold,
    [GOOGLE_UI.bold]: jakarta.PlusJakartaSans_700Bold,
    ...display,
  };
}

export type Fonts = typeof fonts;
export default fonts;
