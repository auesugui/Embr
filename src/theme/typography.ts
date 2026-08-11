// =============================================================================
// Embr Typography System
// =============================================================================
//
// Was: all four weights set to the literal string 'System', with `expo-font`
// installed and never called. That's why the app had no typographic identity.
//
// Now: a real UI face for everything, and a warm serif reserved for display
// moments. See `fonts.ts` for the faces and the Fontshare swap procedure.
// =============================================================================

import type { TextStyle as RNTextStyle } from 'react-native';
import { fonts } from './fonts';

export const fontFamilies = {
  regular: fonts.ui.regular,
  medium: fonts.ui.medium,
  semibold: fonts.ui.semibold,
  bold: fonts.ui.bold,
} as const;

/**
 * Display face — Finch register only. Home greeting, summary headline.
 * Do not use on session, history, or template-edit; those are Hevy register.
 */
export const displayFamilies = {
  regular: fonts.display.regular,
  semibold: fonts.display.semibold,
  bold: fonts.display.bold,
} as const;

export const fontSizes = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

// Pre-configured text styles - properly typed for React Native
export const textStyles: Record<string, RNTextStyle> = {
  hero: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes['6xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['6xl'] * lineHeights.tight,
  },

  h1: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
  },
  h2: {
    fontFamily: fontFamilies.semibold,
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['3xl'] * lineHeights.tight,
  },
  h3: {
    fontFamily: fontFamilies.semibold,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['2xl'] * lineHeights.tight,
  },
  h4: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.xl * lineHeights.normal,
  },

  body: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.md * lineHeights.normal,
  },
  bodyLarge: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.lg * lineHeights.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },

  label: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  labelLarge: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.md * lineHeights.normal,
  },

  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.xs * lineHeights.normal,
  },
  captionSmall: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes['2xs'],
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes['2xs'] * lineHeights.normal,
  },

  number: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['2xl'] * lineHeights.tight,
    fontVariant: ['tabular-nums'],
  },
  numberLarge: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    fontVariant: ['tabular-nums'],
  },
  numberSmall: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.lg * lineHeights.tight,
    fontVariant: ['tabular-nums'],
  },

  button: {
    fontFamily: fontFamilies.semibold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.normal,
  },
  buttonLarge: {
    fontFamily: fontFamilies.semibold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.normal,
  },
  buttonSmall: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },

  // ---------------------------------------------------------------------------
  // Display — Finch register. Home greeting, summary headline. Nowhere else.
  // ---------------------------------------------------------------------------
  displayLarge: {
    fontFamily: displayFamilies.semibold,
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
  },
  display: {
    fontFamily: displayFamilies.semibold,
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['3xl'] * lineHeights.tight,
  },
  displaySmall: {
    fontFamily: displayFamilies.regular,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes['2xl'] * lineHeights.tight,
  },
};

export type FontSize = typeof fontSizes;
export type TextStyle = typeof textStyles;
