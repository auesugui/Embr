// =============================================================================
// Theme Boot — resolve the active palette before any styles are created
// =============================================================================
//
// Embr bakes colors into `StyleSheet.create` at module scope, the way the app
// was already written. That's fast and simple, but it means the palette has to
// be decided BEFORE the first style module is imported — not after the settings
// store hydrates, which is async and happens far too late.
//
// So the resolution order is:
//
//   web     `app/+html.tsx` ships a tiny blocking <script> that reads the
//           persisted setting straight out of localStorage (AsyncStorage's web
//           backend stores raw, unprefixed keys) and parks the answer on
//           `window.__EMBR_THEME__` before the bundle loads. We read that.
//   native  no pre-bundle hook exists, so we fall back to the OS appearance.
//           A persisted override lands on the next launch, not this one.
//
// Consequence, stated plainly: changing the theme setting requires an app
// reload to take effect. `reloadApp()` from '@/lib/backup-file' does it, and
// the settings row says so. The alternative — a provider plus `useMemo`d styles
// in every screen and component — is a real refactor for a setting that gets
// touched roughly never.
// =============================================================================

import { Appearance, Platform } from 'react-native';

export type ResolvedTheme = 'light' | 'dark';

/** Key the settings store persists under (see STORAGE_KEYS.SETTINGS.FULL_STATE). */
export const SETTINGS_STORAGE_KEY = 'settings.full_state';

/** Global the web boot script writes to. Kept in one place so both ends agree. */
export const THEME_GLOBAL = '__EMBR_THEME__';

/**
 * The document background for each palette — `roles.surface`, by value.
 *
 * These duplicate `lightRoles.surface` (`sand[100]`) and `darkRoles.surface` in
 * `colors.ts`, and they cannot import them: `colors.ts` imports
 * `resolveInitialTheme` from this file, so the dependency only runs one way.
 * They were previously written out a third time in `app/+html.tsx` as well.
 * Three hand-copied hexes that must agree is how they drift, so both other
 * places now read these. If `roles.surface` changes, change it here too.
 */
export const DOCUMENT_BACKGROUND = {
  light: '#F5F1ED',
  dark: '#16120F',
} as const;

/**
 * The blocking script injected into the web document head.
 *
 * Deliberately dependency-free and wrapped in try/catch: it runs before
 * anything else, and a throw here would take the whole page with it. Falls
 * silently back to light, which is the default anyway.
 */
export const WEB_THEME_BOOT_SCRIPT = `
(function () {
  try {
    var theme = 'light';
    var raw = window.localStorage.getItem('${SETTINGS_STORAGE_KEY}');
    var stored = raw ? (JSON.parse(raw) || {}).theme : 'system';
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
    window.${THEME_GLOBAL} = theme;

    var color = theme === 'dark'
      ? '${DOCUMENT_BACKGROUND.dark}'
      : '${DOCUMENT_BACKGROUND.light}';

    // Paint the document background immediately so there's no light flash
    // before React mounts. The pre-hydration shell is transparent on web for
    // exactly this reason — and because server and client must agree on it.
    //
    // This paints <html> only. <body> must NOT carry a background of its own:
    // a background on body paints OVER the html canvas, so a light body under
    // a dark app showed through everywhere the app didn't paint — the top
    // safe area and the strip below the tab bar. app/+html.tsx keeps body
    // transparent for this reason.
    document.documentElement.style.backgroundColor = color;

    // theme-color drives the iOS status bar in a standalone home-screen app:
    // a light value there is why the status bar read as a light gradient with
    // black text over a dark app. The static markup ships a media-scoped pair
    // for the no-JS and system cases; this replaces them with the actually
    // resolved colour, which is the only thing that also honours an explicit
    // light/dark override that disagrees with the OS setting.
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      metas[i].parentNode.removeChild(metas[i]);
    }
    var meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    document.head.appendChild(meta);
  } catch (e) {
    window.${THEME_GLOBAL} = 'light';
  }
})();
`.trim();

/**
 * Which palette this launch runs in. Called once, at colors.ts module init.
 *
 * During static web export this runs in Node, where there is no window — it
 * returns 'light' there, which is correct: the exported HTML is theme-neutral
 * and the boot script fixes up the real background before React mounts.
 */
export function resolveInitialTheme(): ResolvedTheme {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return 'light';
    const fromBoot = (window as unknown as Record<string, unknown>)[THEME_GLOBAL];
    return fromBoot === 'dark' ? 'dark' : 'light';
  }

  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}
