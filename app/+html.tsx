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
import { DOCUMENT_BACKGROUND, WEB_THEME_BOOT_SCRIPT } from '@/theme/theme-boot';

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

        {/* theme-color is what iOS tints the status bar with in a standalone
            home-screen app. A single light value here is what made the status
            bar read as a light gradient with black text sitting above a dark
            app. The pair below covers the system case at parse time, with no
            JS timing to get wrong; the boot script then replaces both with the
            resolved colour so an explicit light/dark override still wins. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={DOCUMENT_BACKGROUND.light}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={DOCUMENT_BACKGROUND.dark}
        />
        <meta name="color-scheme" content="light dark" />

        {/* iOS ignores the manifest's display mode; these are what actually
            make the home-screen launch fullscreen. `apple-mobile-web-app-
            capable` is the deprecated-but-still-required-on-iOS twin of
            `mobile-web-app-capable`, so both ship. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/* `default`, NOT `black-translucent`. Measured on an iPhone 15/16
            (393x852, 59px top inset), launched from the home screen:

              black-translucent   screen 852, innerHeight 793, inset-top 59
              default             screen 852, innerHeight 793, inset-top 0
                                  ...but positioned below the status bar
                                  instead of at y=0.

            Both give the page 793px. The difference is where those 793px sit.
            `black-translucent` puts the view at y=0 so content paints under
            the status bar — and the 59px iOS withholds lands at the BOTTOM,
            outside the layout viewport. Nothing can be placed there: it isn't
            padding to shrink, it's screen the page doesn't own. It showed as
            dead space below the tab bar, and before the canvas was fixed, as
            a light band in dark mode.

            `default` positions the view below the status bar, so 59 + 793
            lands exactly on the screen bottom. iOS draws the status bar itself
            and tints it with theme-color, which the boot script already keeps
            in step with the palette.

            Consequence: `safe-area-inset-top` is 0 now, because nothing
            overlaps the top any more. The `insets.top + spacing[n]` in
            session, summary, and onboarding collapse to just the spacing,
            which is correct — iOS reserved the status bar for us. Don't
            "restore" black-translucent to get the inset back. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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

// Painted before the JS bundle boots. The light value is the pre-script
// default; the boot script overrides the <html> inline style when the resolved
// theme is dark.
//
// The background lives on <html> ALONE, and body is explicitly transparent.
// This used to say `html, body { background-color: ... }`, and the boot script
// only repaints `document.documentElement` — so on a dark launch the body kept
// its light background and painted straight over the dark html canvas. It
// showed up anywhere the app itself didn't paint: the top safe area above the
// header, and the strip below the tab bar on a device with a home indicator.
// A background on body wins over the canvas; don't put one back.
//
// Overscroll is pinned too — rubber-banding the whole document is the tell
// that gives away a web app running fullscreen.
const BASE_STYLE = `
html {
  background-color: ${DOCUMENT_BACKGROUND.light};
  overscroll-behavior-y: none;
}
body {
  background-color: transparent;
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}
`;
