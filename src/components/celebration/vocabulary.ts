// =============================================================================
// Embr Celebration Vocabulary (issue #40 / audit §5.6)
// =============================================================================
// ONE shared animation language for every moment worth marking, so they're
// instantly recognizable: accent flash + haptic burst + spring settle. The
// `settle` spring is deliberately shared all the way down to button presses
// (see components/ui/PressableScale) — a press and a celebration should land
// with the same physics.
// The evolution-ceremony tier went with the game layer (ADR-0014). What
// survives is the vocabulary the tracker actually uses: flash, settle, reveal,
// count-up — plus the press feedback in components/ui/PressableScale, which
// shares `settle` on purpose.

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
} as const;
