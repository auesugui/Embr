// =============================================================================
// Theme boot — document canvas and status bar colour
// =============================================================================
// The bug this pins: on a dark launch the whole app rendered dark, but the top
// safe area and the strip below the tab bar stayed light, and iOS drew the
// status bar as a light gradient with black text.
//
// Two causes, both silent:
//   1. `app/+html.tsx` set `background-color` on `html, body`, and the boot
//      script only repaints `document.documentElement`. A background on body
//      paints OVER the html canvas, so the light body won everywhere the app
//      itself didn't paint.
//   2. `theme-color` was a single hardcoded light value. iOS tints a standalone
//      home-screen app's status bar with it.
//
// Neither shows up in a normal browser at desktop size, which is why it shipped.
// These assertions are cheap and they fail loudly if either comes back.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { darkRoles, lightRoles } from '../colors';
import { DOCUMENT_BACKGROUND, WEB_THEME_BOOT_SCRIPT } from '../theme-boot';

const htmlShellSource = readFileSync(resolve(process.cwd(), 'app/+html.tsx'), 'utf8');

/**
 * Just the CSS inside the `BASE_STYLE` template literal.
 *
 * Asserting against the whole file matches the prose too — the comment above
 * BASE_STYLE quotes the broken `html, body { background-color: ... }` rule by
 * name, which is exactly what these tests look for. Read the rule, not the
 * explanation of the rule.
 */
const baseStyle = (() => {
  const match = htmlShellSource.match(/const BASE_STYLE = `([\s\S]*?)`;/);
  if (!match) throw new Error('BASE_STYLE template literal not found in app/+html.tsx');
  return match[1];
})();

describe('DOCUMENT_BACKGROUND', () => {
  // theme-boot cannot import colors.ts — colors.ts imports resolveInitialTheme
  // from theme-boot, so the dependency only runs one way and these hexes are
  // hand-copied. That makes drift possible and invisible. This is the check.
  it('matches roles.surface in both palettes', () => {
    expect(DOCUMENT_BACKGROUND.light).toBe(lightRoles.surface);
    expect(DOCUMENT_BACKGROUND.dark).toBe(darkRoles.surface);
  });

  it('has two visibly different values', () => {
    expect(DOCUMENT_BACKGROUND.light).not.toBe(DOCUMENT_BACKGROUND.dark);
  });
});

describe('WEB_THEME_BOOT_SCRIPT', () => {
  it('paints the html element, which is the canvas', () => {
    expect(WEB_THEME_BOOT_SCRIPT).toContain('documentElement.style.backgroundColor');
  });

  it('carries both resolved backgrounds', () => {
    expect(WEB_THEME_BOOT_SCRIPT).toContain(DOCUMENT_BACKGROUND.dark);
    expect(WEB_THEME_BOOT_SCRIPT).toContain(DOCUMENT_BACKGROUND.light);
  });

  // The static markup ships a media-scoped pair for the system case. Those are
  // wrong whenever the user has picked light or dark explicitly against their
  // OS setting, so the script has to replace them rather than add to them.
  it('replaces the theme-color meta rather than leaving the static pair', () => {
    expect(WEB_THEME_BOOT_SCRIPT).toContain('meta[name="theme-color"]');
    expect(WEB_THEME_BOOT_SCRIPT).toContain('removeChild');
    expect(WEB_THEME_BOOT_SCRIPT).toContain('appendChild');
  });

  it('never throws, because it runs before everything', () => {
    expect(WEB_THEME_BOOT_SCRIPT).toContain('try {');
    expect(WEB_THEME_BOOT_SCRIPT).toContain('catch');
  });
});

describe('app/+html.tsx', () => {
  // The regression itself. `html, body { background-color: ... }` is the exact
  // shape that broke it.
  it('does not give body an opaque background', () => {
    expect(baseStyle).not.toMatch(/html,\s*body\s*\{[^}]*background-color/);

    const bodyRule = baseStyle.match(/\bbody\s*\{([^}]*)\}/);
    expect(bodyRule).not.toBeNull();
    expect(bodyRule?.[1]).toContain('background-color: transparent');
  });

  it('paints the html element with the light default before the script runs', () => {
    expect(baseStyle).toMatch(
      /\bhtml\s*\{[^}]*background-color:\s*\$\{DOCUMENT_BACKGROUND\.light\}/
    );
  });

  it('ships a media-scoped theme-color for each scheme', () => {
    expect(htmlShellSource).toContain('media="(prefers-color-scheme: light)"');
    expect(htmlShellSource).toContain('media="(prefers-color-scheme: dark)"');
  });

  // Three hand-copied hexes is how they drift; the shell reads the constants.
  it('does not hardcode a palette hex of its own', () => {
    expect(htmlShellSource).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  // The script rewrites the metas by querying the DOM, so it has to be parsed
  // after them. lastIndexOf skips the import at the top of the file.
  it('injects the boot script after the theme-color metas', () => {
    expect(htmlShellSource.lastIndexOf('WEB_THEME_BOOT_SCRIPT')).toBeGreaterThan(
      htmlShellSource.lastIndexOf('prefers-color-scheme: dark')
    );
  });
});
