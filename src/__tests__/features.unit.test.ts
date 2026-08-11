// =============================================================================
// Feature flag — GAMIFICATION_ENABLED resolution
// =============================================================================
// The flag is a module-level constant read at import time, so each case has to
// reset the module registry after setting the env var. The default matters most:
// an unset / typo'd value must leave the game layer ON, so a bad env string can
// never silently ship the tracker build to someone expecting IronQuest.

describe('GAMIFICATION_ENABLED', () => {
  const original = process.env.EXPO_PUBLIC_GAMIFICATION;

  afterEach(() => {
    if (original === undefined) {
      // biome-ignore lint/performance/noDelete: unsetting the var is the state under test — assigning undefined would leave the key present as the string "undefined"
      delete process.env.EXPO_PUBLIC_GAMIFICATION;
    } else {
      process.env.EXPO_PUBLIC_GAMIFICATION = original;
    }
    jest.resetModules();
  });

  const load = (value?: string) => {
    if (value === undefined) {
      // biome-ignore lint/performance/noDelete: see above — the unset case is a real permutation
      delete process.env.EXPO_PUBLIC_GAMIFICATION;
    } else {
      process.env.EXPO_PUBLIC_GAMIFICATION = value;
    }
    jest.resetModules();
    // biome-ignore lint/suspicious/noExplicitAny: fresh require per env permutation
    return require('../config/features') as any;
  };

  it('defaults to enabled when the env var is unset', () => {
    expect(load().GAMIFICATION_ENABLED).toBe(true);
  });

  it.each(['off', 'false', '0', 'no', 'OFF', ' Off '])('treats %p as disabled', (value) => {
    expect(load(value).GAMIFICATION_ENABLED).toBe(false);
  });

  it.each(['on', 'true', '1', '', 'yes', 'nope'])('leaves %p enabled', (value) => {
    expect(load(value).GAMIFICATION_ENABLED).toBe(true);
  });

  it('renames the app in the tracker build', () => {
    expect(load('off').APP_NAME).toBe('Ironlog');
    expect(load().APP_NAME).toBe('IronQuest');
  });
});
