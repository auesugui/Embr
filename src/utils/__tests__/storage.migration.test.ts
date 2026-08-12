// =============================================================================
// Storage migration tests
// =============================================================================
// `migrateStorage` runs on every launch, before any store hydrates, and it is
// the only code in the app that deletes user data outright. It gets tests.
//
// The v2 migration (ADR-0015) drops the game layer's storage namespaces. The
// risk it has to be pinned against is scope creep: deleting one key too many
// here costs someone their training history, and nothing else in the app would
// notice or complain.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();
const mockMultiRemove = jest.fn<(keys: string[]) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockGetItem(k),
    setItem: (k: string, v: string) => mockSetItem(k, v),
    multiRemove: (keys: string[]) => mockMultiRemove(keys),
  },
}));

import { STORAGE_KEYS, migrateStorage } from '../storage';

/** Every key the migration is allowed to touch. */
const removedKeys = () => (mockMultiRemove.mock.calls[0]?.[0] ?? []) as string[];

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
  mockMultiRemove.mockResolvedValue(undefined);
});

describe('migrateStorage — v2 (game layer removal)', () => {
  it('runs on a v1 install and stamps the new schema version', async () => {
    mockGetItem.mockResolvedValue('1');

    await migrateStorage();

    expect(mockMultiRemove).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.SCHEMA_VERSION, '2');
  });

  it('runs on a fresh install (no version stamped yet)', async () => {
    mockGetItem.mockResolvedValue(null);

    await migrateStorage();

    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEYS.SCHEMA_VERSION, '2');
  });

  it('is a no-op once already migrated — does not delete on every launch', async () => {
    mockGetItem.mockResolvedValue('2');

    await migrateStorage();

    expect(mockMultiRemove).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('removes the pet, player-FP, and tower namespaces', async () => {
    mockGetItem.mockResolvedValue('1');

    await migrateStorage();
    const removed = removedKeys();

    expect(removed).toContain(STORAGE_KEYS.PET.FULL_STATE);
    expect(removed).toContain(STORAGE_KEYS.PET_STATS.POWER);
    expect(removed).toContain(STORAGE_KEYS.PLAYER_FP.FULL_STATE);
    expect(removed).toContain(STORAGE_KEYS.TOWER.FULL_STATE);
  });

  // This is the test that actually earns its keep. Everything above checks the
  // migration does its job; this checks it doesn't do anyone else's.
  it('never touches a slice that still holds real user data', async () => {
    mockGetItem.mockResolvedValue('1');

    await migrateStorage();
    const removed = removedKeys();

    const mustSurvive = [
      STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE,
      STORAGE_KEYS.PR.FULL_STATE,
      STORAGE_KEYS.BASELINE.FULL_STATE,
      STORAGE_KEYS.PERSONAL_TEMPLATES.FULL_STATE,
      STORAGE_KEYS.WEIGHT_HISTORY.FULL_STATE,
      STORAGE_KEYS.SETTINGS.FULL_STATE,
      STORAGE_KEYS.PLAYER.FULL_STATE,
      STORAGE_KEYS.STREAK.FULL_STATE,
      STORAGE_KEYS.SESSION.FULL_STATE,
      STORAGE_KEYS.SCHEMA_VERSION,
    ];

    for (const key of mustSurvive) {
      expect(removed).not.toContain(key);
    }
  });

  it('leaves workout history alone entirely — no key of its namespace is removed', async () => {
    mockGetItem.mockResolvedValue('1');

    await migrateStorage();

    expect(removedKeys().some((k) => k.startsWith('workout_history'))).toBe(false);
  });
});
