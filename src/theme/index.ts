// =============================================================================
// Embr Theme - Main Export
// =============================================================================
//
// `roles` is the API. `colors` is the deprecated IronQuest shape, kept alive
// until the Phase 2 mechanical pass finishes migrating call sites (ADR-0013).
// =============================================================================

import colors, {
  ACTIVE_THEME,
  type ColorRoles,
  type ThemeName,
  type colors as colorsType,
  darkRoles,
  ember,
  lightRoles,
  roles,
  sand,
  themes,
} from './colors';
import { type Fonts, type UiFontSource, fonts, getFontMap } from './fonts';
import {
  type Layout,
  type Radius,
  type Shadows,
  type Spacing,
  type TouchTarget,
  layout,
  radius,
  shadows,
  spacing,
  touchTarget,
} from './spacing';
import {
  type FontSize,
  type TextStyle,
  displayFamilies,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  textStyles,
} from './typography';

export const theme = {
  roles,
  activeTheme: ACTIVE_THEME,
  fonts,
  colors,
  spacing,
  layout,
  touchTarget,
  radius,
  shadows,
  fontFamilies,
  fontSizes,
  lineHeights,
  fontWeights,
  textStyles,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colorsType;

// Re-export individual modules
export { roles, ACTIVE_THEME, lightRoles, darkRoles, themes, ember, sand };
export { fonts, getFontMap };
export { colors, spacing, layout, touchTarget, radius, shadows };
export { fontFamilies, displayFamilies, fontSizes, lineHeights, fontWeights, textStyles };

// Type exports
export type { Spacing, Layout, TouchTarget, Radius, Shadows };
export type { FontSize, TextStyle };
export type { ColorRoles, ThemeName, Fonts, UiFontSource };

export default theme;
