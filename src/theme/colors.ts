// =============================================================================
// Embr Color System
// =============================================================================
//
// Replaces the Tailwind slate + amber ramps that shipped with IronQuest. Those
// were defaults nobody chose, and "looks AI-generated" was the complaint.
//
// Structure (ADR-0013):
//   1. Raw ramps      — ember + warm neutrals. Never consumed directly by screens.
//   2. Semantic roles — `surface`, `textPrimary`, `accent`, … the real API.
//   3. Theme palettes — `lightRoles` / `darkRoles`, same shape.
//   4. Legacy alias   — the old `colors.*` shape, mapped onto LIGHT roles so the
//                       existing ~40 screens render correctly before the Phase 2
//                       mechanical pass migrates them. DEPRECATED. Delete when
//                       the last call site is gone.
//
// Light ships first. Dark is built theme-ready here but tuned in a later pass.
// =============================================================================

import { resolveInitialTheme } from './theme-boot';

// -----------------------------------------------------------------------------
// 1. Raw ramps
// -----------------------------------------------------------------------------

/**
 * Ember — muted terracotta-orange. Deliberately NOT Tailwind amber (#F59E0B):
 * desaturated, warmer, and reads as a chosen brand color rather than a default.
 */
export const ember = {
  50: '#FDF4F0',
  100: '#FAE6DC',
  200: '#F4CBB8',
  300: '#ECA88B',
  400: '#E28460',
  500: '#D4633C', // primary accent — fills, active states
  600: '#B94E2B', // accent text on light (passes AA at small sizes)
  700: '#963E22',
  800: '#75321D',
  900: '#5A2818',
} as const;

/**
 * Warm neutrals. Slate is blue-gray and is half the AI tell; these carry a warm
 * cast so the Finch surfaces don't read clinical.
 */
export const sand = {
  0: '#FFFFFF',
  50: '#FBF9F7',
  100: '#F5F1ED',
  200: '#E9E3DC',
  300: '#D9D1C8',
  400: '#B5AAA0',
  500: '#8C8179',
  600: '#6B615A',
  700: '#4E4640',
  800: '#332D29',
  900: '#1F1B18',
} as const;

/** Status colors, desaturated to sit alongside the warm neutrals. */
const status = {
  success: '#3F8F5F',
  warning: '#C08A2E',
  error: '#C2483C',
  info: '#4A6FA5',
} as const;

const statusDark = {
  success: '#5FB07F',
  warning: '#D9A754',
  error: '#DB6B5E',
  info: '#7093C4',
} as const;

// -----------------------------------------------------------------------------
// 2 + 3. Semantic roles
// -----------------------------------------------------------------------------

export const lightRoles = {
  // Surfaces
  //
  // On the old dark palette, raised cards separated from the background for
  // free (#1E293B on #0F172A). On light they don't — so the app background sits
  // a full step down from white rather than a hair below it. Hevy does the same
  // thing: warm-gray canvas, white cards. This is what stops every screen from
  // needing a hand-added border.
  surface: sand[100], // app background
  surfaceRaised: sand[0], // cards, sheets
  surfaceSunken: sand[200], // inputs, wells, pressed states
  surfaceInverse: sand[900],

  // Lines
  border: sand[200],
  borderStrong: sand[300],
  divider: sand[200],

  // Text
  textPrimary: sand[900],
  textSecondary: sand[700],
  textTertiary: sand[600],
  textMuted: sand[500],
  textInverse: sand[0],

  // Accent — exactly one
  accent: ember[500],
  accentText: ember[600], // accent as *text* on light surfaces
  accentSubtle: ember[100], // tinted backgrounds
  accentMuted: ember[200],
  onAccent: sand[0], // text/icons on an accent fill

  // Status
  ...status,

  // Scrims
  overlay: 'rgba(31, 27, 24, 0.45)',
} as const;

export const darkRoles = {
  // Warm dark, not blue-slate.
  surface: '#16120F',
  surfaceRaised: '#211C18',
  surfaceSunken: '#100D0B',
  surfaceInverse: sand[50],

  border: '#322A24',
  borderStrong: '#453B33',
  divider: '#322A24',

  textPrimary: '#F7F3EF',
  textSecondary: '#D6CCC3',
  textTertiary: '#A99E94',
  textMuted: '#7D736B',
  textInverse: sand[900],

  accent: ember[400], // lifted for contrast on dark
  accentText: ember[300],
  accentSubtle: '#2E211A',
  accentMuted: '#3D2B21',
  onAccent: sand[900],

  ...statusDark,

  overlay: 'rgba(10, 8, 7, 0.6)',
} as const;

/**
 * Both palettes are `as const`, so their inferred types are literal hex strings
 * and structurally incompatible with each other. Widen the values to `string`
 * while keeping the key set exact — that's what makes the two palettes
 * interchangeable and a missing key in one of them a compile error.
 */
export type ColorRoles = { readonly [K in keyof typeof lightRoles]: string };

export const themes = { light: lightRoles, dark: darkRoles } as const;
export type ThemeName = keyof typeof themes;

/**
 * The active palette for this launch.
 *
 * Resolved at module init — before any `StyleSheet.create` in the app runs —
 * because styles bake their colors in at import time. See `theme-boot.ts` for
 * how the answer is known that early, and why changing the setting needs a
 * reload rather than re-rendering.
 */
export const ACTIVE_THEME: ThemeName = resolveInitialTheme();

export const roles: ColorRoles = themes[ACTIVE_THEME];

// -----------------------------------------------------------------------------
// 4. Legacy alias — DEPRECATED
// -----------------------------------------------------------------------------
//
// The old IronQuest shape, remapped onto the ACTIVE roles. This exists so the
// app renders in the new palette *immediately*, without a 40-file edit landing
// in the same commit as the foundation. Remaining call sites migrate to
// `roles.*` opportunistically; this block is deleted when the last one is gone.
//
// It tracks `roles`, not `lightRoles` — otherwise every screen still on the
// legacy names would stay stubbornly light in dark mode, which is exactly the
// kind of half-themed UI that reads as broken.
//
// Values stay 6-digit hex because ~12 call sites build alpha variants by string
// concatenation (`colors.reward.fp + '22'`). Don't switch these to rgba().
// -----------------------------------------------------------------------------

export const colors = {
  /** @deprecated use `roles.accent*` / the `ember` ramp */
  primary: ember,

  /** @deprecated use `roles.surface*` */
  background: {
    primary: roles.surface,
    secondary: roles.surfaceRaised,
    tertiary: roles.surfaceSunken,
    surface: roles.surfaceRaised,
    elevated: roles.surfaceRaised,
  },

  /** @deprecated use `roles.text*` */
  text: {
    primary: roles.textPrimary,
    secondary: roles.textSecondary,
    tertiary: roles.textTertiary,
    muted: roles.textMuted,
    inverse: roles.textInverse,
  },

  /**
   * @deprecated GAME LAYER ONLY — RPG stat axes.
   * These must not appear on tracker surfaces. Phase 2 strips them from the
   * difficulty badges in `TemplateCard.tsx`, which is the leak that put six
   * decorative colors on a tracker screen.
   */
  stats: {
    power: '#EF4444',
    guard: '#3B82F6',
    speed: '#22C55E',
    vigor: '#A16207',
    focus: '#8B5CF6',
    spirit: '#FEF08A',
  },

  /** @deprecated use `roles.accent` — all three collapse to the single accent */
  reward: {
    fp: roles.accent,
    pr: roles.accent,
    streak: roles.accent,
  },

  /**
   * @deprecated GAME LAYER ONLY — pet element colors.
   * `types.flux` (#A855F7 neon purple) currently tints "Custom" badges on
   * tracker surfaces. Phase 2 removes those call sites.
   */
  types: {
    ferro: '#94A3B8',
    terra: '#22C55E',
    flux: '#A855F7',
  },

  /** @deprecated use `roles.success` / `.warning` / `.error` / `.info` */
  semantic: {
    success: roles.success,
    warning: roles.warning,
    error: roles.error,
    info: roles.info,
  },

  /** @deprecated map onto `roles.*` at the call site */
  timer: {
    resting: roles.info,
    approaching: ember[400],
    ready: roles.accent,
    overrun: roles.textMuted,
    paused: roles.textTertiary,
    transition: roles.accentText,
  },

  /** @deprecated use `roles.border` / `.surface*` / `.textMuted` */
  ui: {
    border: roles.border,
    borderLight: roles.borderStrong,
    divider: roles.divider,
    overlay: roles.overlay,
    card: roles.surfaceRaised,
    input: roles.surfaceSunken,
    placeholder: roles.textMuted,
  },

  /** @deprecated use `roles.error` */
  danger: {
    light: '#E39189',
    DEFAULT: roles.error,
    dark: '#9A362C',
  },
} as const;

export type ColorTheme = typeof colors;
export default colors;
