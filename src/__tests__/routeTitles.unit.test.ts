// =============================================================================
// Regression test — Issue #24 (A2): no raw route paths as screen titles
// =============================================================================
// Guards against the original defect: root-Stack headers literally reading
// "workout/template/[id]", "workout/loadout", etc. The rule: a title may never
// equal its route key, and may never contain route-path characters ("/", "[",
// "]"). If someone re-introduces a raw path in ROUTE_TITLES, this fails.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTE_TITLES, isRawRoutePath } from '@/navigation/routeTitles';

describe('ROUTE_TITLES (issue #24 A2)', () => {
  it('covers the routes that previously rendered raw paths', () => {
    // Every route called out in the issue must have an explicit title.
    // NOTE: check keys directly rather than jest's `toHaveProperty`, because a
    // route key like "workout/template/[id]" is parsed by toHaveProperty as a
    // nested object path (dots / bracket-index), not a literal flat key.
    const required = [
      'workout/loadout',
      'workout/summary',
      'workout/session',
      'workout/template/[id]',
    ] as const;
    for (const route of required) {
      expect(Object.prototype.hasOwnProperty.call(ROUTE_TITLES, route)).toBe(true);
      expect(ROUTE_TITLES[route]).toBeTruthy();
    }
  });

  it('uses human-readable strings (not raw route paths)', () => {
    const entries = Object.entries(ROUTE_TITLES);
    expect(entries.length).toBeGreaterThan(0);

    for (const [routeName, title] of entries) {
      // The headline assertion: title must not equal the route name.
      expect(title).not.toBe(routeName);

      // Titles must be non-empty and free of route-path characters.
      expect(typeof title).toBe('string');
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toMatch(/\//);
      expect(title).not.toMatch(/\[/);
      expect(title).not.toMatch(/\]/);

      // isRawRoutePath is the inverse guard — every published title must pass it.
      expect(isRawRoutePath(title)).toBe(false);
    }
  });

  it('matches the expected human titles', () => {
    // "Loadout"/"Session" were game vocabulary leaking into the tracker build —
    // this map isn't flag-aware, so both showed regardless of the flag (ADR-0013).
    expect(ROUTE_TITLES['workout/loadout']).toBe('Start Workout');
    expect(ROUTE_TITLES['workout/summary']).toBe('Workout Summary');
    expect(ROUTE_TITLES['workout/session']).toBe('Workout');
  });

  it('has no dev panel route', () => {
    // The __DEV__-only dev panel was removed along with its route and
    // src/components/dev. A title reappearing here means the panel came back.
    expect(ROUTE_TITLES).not.toHaveProperty('(tabs)/dev');
  });

  it('is wired into the root layout (not bypassed by hardcoded strings)', () => {
    // If the layout stopped importing ROUTE_TITLES, the config could drift from
    // what the app actually renders. Requiring the import keeps them coupled.
    const layoutPath = resolve(process.cwd(), 'app/_layout.tsx');
    const layoutSource = readFileSync(layoutPath, 'utf8');
    expect(layoutSource).toContain('ROUTE_TITLES');
  });
});

describe('isRawRoutePath', () => {
  it('flags route paths and route keys as raw', () => {
    expect(isRawRoutePath('workout/template/[id]')).toBe(true);
    expect(isRawRoutePath('workout/summary')).toBe(true);
    expect(isRawRoutePath('some/nested/path')).toBe(true);
    expect(isRawRoutePath('dynamic-[id]')).toBe(true);
  });

  it('accepts human-readable titles', () => {
    expect(isRawRoutePath('Loadout')).toBe(false);
    expect(isRawRoutePath('Workout Summary')).toBe(false);
    expect(isRawRoutePath('Session')).toBe(false);
  });

  it('rejects empty / non-strings', () => {
    expect(isRawRoutePath('')).toBe(true);
    expect(isRawRoutePath(undefined as unknown as string)).toBe(true);
  });
});
