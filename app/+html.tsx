// =============================================================================
// Web Root HTML — PWA shell for the home-screen install
// =============================================================================
// Expo Router renders every web route inside this document at export time. It
// runs in Node during `expo export -p web`, never in the browser, so anything
// here must be static markup — no hooks, no browser globals.
//
// Why it exists: iOS only treats a site as an app (fullscreen, real icon, own
// task-switcher card) when these tags are present. Without them, "Add to Home
// Screen" produces a bookmark that opens in Safari chrome with a screenshot for
// an icon — which is not a thing anyone dogfoods for three weeks.

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { APP_NAME } from '@/config';
import { WEB_THEME_BOOT_SCRIPT } from '@/theme/theme-boot';

const THEME_COLOR = '#F5F1ED';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* viewport-fit=cover lets the app paint under the notch and home
            indicator; SafeAreaProvider already insets the content. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />

        <title>{APP_NAME}</title>
        <meta name="description" content={`${APP_NAME} — workout tracker`} />

        {/* --- PWA --- */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="color-scheme" content="light dark" />

        {/* iOS ignores the manifest's display mode; these are what actually
            make the home-screen launch fullscreen. `apple-mobile-web-app-
            capable` is the deprecated-but-still-required-on-iOS twin of
            `mobile-web-app-capable`, so both ship. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

        {/* Disable body scrolling on web so ScrollView components behave like
            they do on native. Required by expo-router's web setup. */}
        <ScrollViewStyleReset />

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a module-level
            constant with no user input — the documented expo-router way to inject
            critical CSS into the static HTML shell */}
        <style dangerouslySetInnerHTML={{ __html: BASE_STYLE }} />

        {/* Theme boot. Must be blocking and must come before the bundle: the app
            bakes colors into StyleSheet.create at module scope, so the palette
            has to be decided before the first style module evaluates. This also
            paints the correct document background immediately, which is why the
            pre-hydration shell is transparent on web — server and client HTML
            stay identical, and dark users don't get a white flash.
            See src/theme/theme-boot.ts. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: module-level
            constant, no user input — the only hook that runs before the bundle */}
        <script dangerouslySetInnerHTML={{ __html: WEB_THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Painted before the JS bundle boots. THEME_COLOR is the light background; the
// boot script overrides it inline when the resolved theme is dark. Overscroll is
// pinned too — rubber-banding the whole document is the tell that gives away a
// web app running fullscreen.
const BASE_STYLE = `
html, body {
  background-color: ${THEME_COLOR};
  overscroll-behavior-y: none;
}
body {
  -webkit-tap-highlight-color: transparent;
}
`;
