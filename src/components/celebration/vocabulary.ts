// =============================================================================
// Embr Celebration Vocabulary (issue #40 / audit §5.6)
// =============================================================================
// ONE shared animation language for every moment worth marking, so they're
// instantly recognizable: accent flash + haptic burst + spring settle. The
// `settle` spring is deliberately shared all the way down to button presses
// (see components/ui/PressableScale) — a press and a celebration should land
// with the same physics.
// Ceremony tiers (avatar brief §8): micro = PR gold flash, minor = gear
// materializes (Phase: gear system), major = full evolution reveal.

import { Easing } from 'react-native-reanimated';

import { roles } from '@/theme';

export const CELEBRATION = {
  // Gold flash (micro tier)
  flash: {
    // Was a hardcoded '#FBBF24' — Tailwind gold, the last stray hex outside the
    // theme. Reads from the active palette now, so it's correct in dark too.
    color: roles.accent,
    inMs: 120,
    outMs: 700,
  },

  // Spring settle — the shared "landing" for any celebrated element
  settle: {
    damping: 12,
    stiffness: 180,
    mass: 0.8,
  },

  // Sequential reveal (summary breakdown lines)
  reveal: {
    staggerMs: 260,
    durationMs: 360,
    easing: Easing.out(Easing.cubic),
    translateY: 14,
  },

  // Rolling number count-up
  countUp: {
    durationMs: 900,
  },

  // Major tier: evolution ceremony (Zelda-style — time spent deliberately)
  ceremony: {
    minHoldMs: 3200, // continue button unlocks after this
    glowInMs: 700,
    spriteInMs: 900,
  },
} as const;

export const STAGE_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Shard',
  2: 'Form',
  3: 'Prime',
  4: 'Apex',
};
