// =============================================================================
// Backup — export / parse / restore
// =============================================================================
// The parse tests carry the weight: a backup file is untrusted input, and the
// failure that actually costs data is a malformed file half-applying over good
// storage. Every rejection path is asserted, and restore is checked for not
// clearing keys the file didn't carry.

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BACKUP_FORMAT_VERSION,
  BACKUP_KEYS,
  type BackupFile,
  BackupParseError,
  backupFilename,
  createBackup,
  parseBackup,
  restoreBackup,
} from '../backup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}));

const mockMultiGet = AsyncStorage.multiGet as jest.Mock;
const mockMultiSet = AsyncStorage.multiSet as jest.Mock;

const FIXED_NOW = Date.UTC(2026, 7, 10, 15, 0, 0); // 2026-08-10

const validBackup = (overrides: Partial<BackupFile> = {}): BackupFile => ({
  app: 'ironquest',
  formatVersion: BACKUP_FORMAT_VERSION,
  exportedAt: '2026-08-10T15:00:00.000Z',
  data: { 'workout_history.full_state': '{"logs":[]}' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMultiSet.mockResolvedValue(undefined);
});

describe('createBackup', () => {
  it('collects persisted values and omits keys that were never written', async () => {
    mockMultiGet.mockResolvedValue([
      ['workout_history.full_state', '{"logs":[1]}'],
      ['pr.full_state', null],
      ['settings.full_state', '{"units":"kg"}'],
    ]);

    const backup = await createBackup(FIXED_NOW);

    expect(backup.app).toBe('embr');
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.exportedAt).toBe('2026-08-10T15:00:00.000Z');
    expect(backup.data).toEqual({
      'workout_history.full_state': '{"logs":[1]}',
      'settings.full_state': '{"units":"kg"}',
    });
    expect(backup.data['pr.full_state']).toBeUndefined();
  });

  it('copies values verbatim rather than re-serializing them', async () => {
    // A slice this build doesn't understand must still round-trip byte-for-byte.
    const opaque = '{"some":"future shape","n":1e30}';
    mockMultiGet.mockResolvedValue([['pet.full_state', opaque]]);

    const backup = await createBackup(FIXED_NOW);

    expect(backup.data['pet.full_state']).toBe(opaque);
  });
});

describe('backupFilename', () => {
  it('is date-stamped and lowercased', () => {
    expect(backupFilename('Ironlog', FIXED_NOW)).toBe('ironlog-backup-2026-08-10.json');
    expect(backupFilename('IronQuest', FIXED_NOW)).toBe('ironquest-backup-2026-08-10.json');
  });
});

describe('parseBackup', () => {
  it('accepts a well-formed file', () => {
    const parsed = parseBackup(JSON.stringify(validBackup()));
    expect(parsed.data['workout_history.full_state']).toBe('{"logs":[]}');
  });

  it('rejects non-JSON', () => {
    expect(() => parseBackup('not json at all')).toThrow(BackupParseError);
  });

  it.each(['null', '"a string"', '42', '[]'])('rejects non-object JSON: %s', (text) => {
    expect(() => parseBackup(text)).toThrow(BackupParseError);
  });

  it('rejects a file from another app', () => {
    const foreign = { ...validBackup(), app: 'someotherapp' };
    expect(() => parseBackup(JSON.stringify(foreign))).toThrow(/different app/);
  });

  // ---------------------------------------------------------------------------
  // Backward compatibility with pre-Embr backups (ADR-0015)
  //
  // This is the group that matters. The app has no backend: a backup file is
  // the only copy of a workout history that isn't sitting in one browser's
  // localStorage. A rename or a schema cleanup that quietly makes old files
  // un-restorable destroys data while every test still passes.
  // ---------------------------------------------------------------------------

  it('still accepts backups written when the app was called ironquest', () => {
    const legacy = { ...validBackup(), app: 'ironquest' };
    const parsed = parseBackup(JSON.stringify(legacy));

    expect(parsed.app).toBe('ironquest');
    expect(parsed.data['workout_history.full_state']).toBe('{"logs":[]}');
  });

  it('accepts backups written under the new name', () => {
    const current = { ...validBackup(), app: 'embr' };
    expect(parseBackup(JSON.stringify(current)).app).toBe('embr');
  });

  it('restores a legacy file that carries FP and pet slices, dropping the dead ones', async () => {
    // Shaped like a real pre-ADR-0014 export: tracker data alongside game data,
    // and workout logs still carrying totalFP / fpEarned on each entry.
    const legacy = validBackup({
      app: 'ironquest',
      data: {
        'workout_history.full_state': JSON.stringify({
          logs: [{ id: 'w1', claimedAt: '2026-07-01T00:00:00.000Z', totalFP: 250, fpEarned: {} }],
        }),
        'pr.full_state': '{"records":{}}',
        'player.full_state': '{"totalWorkouts":12}',
        // Dead slices — must not be written back to storage.
        'pet.full_state': '{"id":"pet_1","evolutionStage":3}',
        'player.fp.full_state': '{"generic":9001}',
        'tower.full_state': '{"currentFloor":4}',
      },
    });

    const parsed = parseBackup(JSON.stringify(legacy));
    const written = await restoreBackup(parsed);

    const keys = mockMultiSet.mock.calls[0][0].map(([k]: [string, string]) => k);

    // The tracker slices survive...
    expect(keys).toContain('workout_history.full_state');
    expect(keys).toContain('pr.full_state');
    expect(keys).toContain('player.full_state');

    // ...and the game layer's slices are dropped rather than resurrected.
    expect(keys).not.toContain('pet.full_state');
    expect(keys).not.toContain('player.fp.full_state');
    expect(keys).not.toContain('tower.full_state');

    expect(written).toBe(3);
  });

  it('preserves legacy per-log FP fields verbatim inside the history blob', async () => {
    // The migration deliberately does NOT rewrite workout history to strip
    // totalFP / fpEarned. Restoring must pass the blob through untouched — the
    // one slice that is genuinely irreplaceable should never be edited in
    // flight to tidy up fields nothing reads.
    const historyBlob = JSON.stringify({
      logs: [{ id: 'w1', claimedAt: '2026-07-01T00:00:00.000Z', totalFP: 250 }],
    });
    const legacy = validBackup({
      app: 'ironquest',
      data: { 'workout_history.full_state': historyBlob },
    });

    await restoreBackup(parseBackup(JSON.stringify(legacy)));

    const entries = mockMultiSet.mock.calls[0][0];
    expect(entries).toContainEqual(['workout_history.full_state', historyBlob]);
  });

  it('rejects a newer format version rather than guessing at it', () => {
    const future = validBackup({ formatVersion: BACKUP_FORMAT_VERSION + 1 });
    expect(() => parseBackup(JSON.stringify(future))).toThrow(/newer version/);
  });

  it('rejects a missing or non-object data block', () => {
    for (const data of [undefined, null, 'nope', [] as unknown]) {
      const broken = { ...validBackup(), data };
      expect(() => parseBackup(JSON.stringify(broken))).toThrow(BackupParseError);
    }
  });

  it('rejects a non-string entry rather than restoring it', () => {
    const broken = { ...validBackup(), data: { 'pr.full_state': { not: 'a string' } } };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/corrupted/);
  });

  it('tolerates a missing exportedAt', () => {
    const noDate = validBackup();
    // biome-ignore lint/performance/noDelete: exercising the absent-field path
    delete (noDate as Partial<BackupFile>).exportedAt;
    expect(parseBackup(JSON.stringify(noDate)).exportedAt).toBe('');
  });
});

describe('restoreBackup', () => {
  it('writes recognized keys and reports the count', async () => {
    const backup = validBackup({
      data: {
        'workout_history.full_state': '{"logs":[]}',
        'pr.full_state': '{"records":[]}',
      },
    });

    await expect(restoreBackup(backup)).resolves.toBe(2);
    expect(mockMultiSet).toHaveBeenCalledWith(
      expect.arrayContaining([
        ['workout_history.full_state', '{"logs":[]}'],
        ['pr.full_state', '{"records":[]}'],
      ])
    );
  });

  it('ignores keys outside the known set', async () => {
    const backup = validBackup({
      data: { 'workout_history.full_state': '{}', 'evil.injected_key': 'payload' },
    });

    await expect(restoreBackup(backup)).resolves.toBe(1);
    const written = mockMultiSet.mock.calls[0][0] as [string, string][];
    expect(written.map(([k]) => k)).toEqual(['workout_history.full_state']);
  });

  it('writes nothing when there is nothing recognizable', async () => {
    await expect(restoreBackup(validBackup({ data: {} }))).resolves.toBe(0);
    expect(mockMultiSet).not.toHaveBeenCalled();
  });

  it('leaves untouched slices alone (partial restore never wipes)', async () => {
    // Only history is carried; PRs must not be cleared as a side effect.
    const backup = validBackup({ data: { 'workout_history.full_state': '{}' } });

    await restoreBackup(backup);

    const written = mockMultiSet.mock.calls[0][0] as [string, string][];
    expect(written.map(([k]) => k)).not.toContain('pr.full_state');
  });
});

// -----------------------------------------------------------------------------
// The avatar rides along
// -----------------------------------------------------------------------------
// A profile photo lives inside the player slice, so it is carried by the same
// key as the streak and the name. That is currently an accident of the key
// list rather than a decision anyone wrote down — this test makes it a
// decision. A restore that loses your face is a bug report.

describe('profile avatar', () => {
  it('carries the player slice, which is where the avatar lives', () => {
    expect(BACKUP_KEYS).toContain('player.full_state');
  });

  it('round-trips a stored avatar verbatim', async () => {
    const avatar = 'data:image/jpeg;base64,YWJj';
    const player = JSON.stringify({ profile: { name: 'A', avatar, createdAt: 'x' } });

    (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(
      BACKUP_KEYS.map((k) => [k, k === 'player.full_state' ? player : null])
    );

    const backup = await createBackup(0);

    expect(backup.data['player.full_state']).toBe(player);
    expect(JSON.parse(backup.data['player.full_state']).profile.avatar).toBe(avatar);
  });
});
