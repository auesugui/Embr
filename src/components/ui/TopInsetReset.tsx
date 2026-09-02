// =============================================================================
// TopInsetReset — zero the top safe-area inset on web
// =============================================================================
// On web the status bar is never ours to pad for, so `insets.top` must be 0.
//
// Embr sets `apple-mobile-web-app-status-bar-style: default` (see the long
// note in `app/+html.tsx`). That makes iOS position the standalone web view
// BELOW the status bar, which is what stopped the page from being 59px shorter
// than the screen. But iOS keeps reporting `env(safe-area-inset-top)` as 59
// anyway — for an overlap that no longer exists.
//
// So every consumer of `insets.top` double-counted it: React Navigation's
// header padded 59px for a status bar iOS had already reserved, and so did the
// session, summary, and onboarding screens. Measured as ~66px of dead space
// above the "Workouts" title.
//
// Fixing it at each call site means four places that must all remember, and a
// fifth the next time someone adds a screen. This does it once, at the root,
// by re-providing the inset context with `top: 0`. React Navigation reads
// `useSafeAreaInsets` for its default `headerStatusBarHeight`, so the header
// is covered by the same override.
//
// `bottom` is untouched and must stay that way — the home indicator is a real
// overlap, it reports 34, and the tab bar spends it correctly.
//
// Native is left alone: there, `insets.top` is a genuine overlap. This only
// ships as a PWA today (CLAUDE.md), but the guard keeps an Expo Go dev run
// honest rather than silently wrong.

import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

export function TopInsetReset({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  const corrected = useMemo(
    () => (Platform.OS === 'web' ? { ...insets, top: 0 } : insets),
    [insets]
  );

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <SafeAreaInsetsContext.Provider value={corrected}>{children}</SafeAreaInsetsContext.Provider>
  );
}
