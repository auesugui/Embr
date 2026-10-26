// =============================================================================
// Backup — export / parse / restore
// =============================================================================
// The parse tests carry the weight: a backup file is untrusted input, and the
// failure that actually costs data is a malformed file half-applying over good
// storage. Every rejection path is asserted, and restore is checked for not
// clearing keys the file didn't carry.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/utils/storage';
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
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockMultiGet = AsyncStorage.multiGet as jest.Mock;
const mockMultiSet = AsyncStorage.multiSet as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

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
  mockSetItem.mockResolvedValue(undefined);
  // Default: nothing already on the device.
  mockGetItem.mockResolvedValue(null);
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

  it('round-trips logs with and without the workout identity (#80)', async () => {
    // Two logs in one file: one written after #80, carrying the template id and
    // the day key, and one written before it, carrying neither. A restore must
    // hand both back byte-for-byte, so the older log keeps reading as a log
    // with no comparison rather than one with a guessed match.
    const historyBlob = JSON.stringify({
      logs: [
        {
          id: 'w2',
          timestamp: '2026-10-23T18:00:00.000Z',
          claimedAt: '2026-10-23T18:05:00.000Z',
          exercises: [],
          durationSeconds: 1800,
          streakDays: 3,
          sessionIntent: 'normal',
          templateId: 'ppl_6day',
          dayKey: 'ppl_push_a',
          workoutName: 'Push A',
        },
        {
          id: 'w1',
          timestamp: '2026-09-01T18:00:00.000Z',
          claimedAt: '2026-09-01T18:05:00.000Z',
          exercises: [],
          durationSeconds: 1500,
          streakDays: 1,
          sessionIntent: 'normal',
        },
      ],
    });

    mockMultiGet.mockResolvedValue([['workout_history.full_state', historyBlob]]);
    const exported = await createBackup(FIXED_NOW);

    await restoreBackup(parseBackup(JSON.stringify(exported)));

    const entries = mockMultiSet.mock.calls[0][0];
    expect(entries).toContainEqual(['workout_history.full_state', historyBlob]);

    const restored = JSON.parse(
      (entries as Array<[string, string]>).find(
        ([key]) => key === 'workout_history.full_state'
      )?.[1] as string
    );
    expect(restored.logs[0]).toMatchObject({
      templateId: 'ppl_6day',
      dayKey: 'ppl_push_a',
      workoutName: 'Push A',
    });
    expect(restored.logs[1]).not.toHaveProperty('templateId');
    expect(restored.logs[1]).not.toHaveProperty('dayKey');
    expect(restored.logs[1]).not.toHaveProperty('workoutName');
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

// -----------------------------------------------------------------------------
// A new persisted slice is left out of backups unless someone remembers to add
// it, and nothing else notices. This makes the choice explicit: every slice is
// backed up or named here with the reason it is not.

const NOT_BACKED_UP: Record<string, string> = {
  'pet.full_state': 'game layer, removed (ADR-0014)',
  'player.fp.full_state': 'FP engine, removed (ADR-0015)',
  'tower.full_state': 'game layer, removed (ADR-0014)',
  'session.full_state': 'the live session in progress, not a record',
};

describe('backup coverage', () => {
  const slices = Object.values(STORAGE_KEYS).flatMap((group) =>
    typeof group === 'object' && 'FULL_STATE' in group ? [group.FULL_STATE as string] : []
  );

  it.each(slices)('%s is backed up or listed as not backed up', (key) => {
    expect(BACKUP_KEYS.includes(key) || key in NOT_BACKED_UP).toBe(true);
  });

  it('lists nothing as not backed up that is backed up', () => {
    expect(Object.keys(NOT_BACKED_UP).filter((key) => BACKUP_KEYS.includes(key))).toEqual([]);
  });
});

describe('custom exercises', () => {
  it('carries them, since templates refer to them only by id', async () => {
    const custom = JSON.stringify({ exercises: [{ id: 'custom-goblet-squat' }] });

    (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(
      BACKUP_KEYS.map((k) => [k, k === 'custom_exercises.full_state' ? custom : null])
    );

    const backup = await createBackup(0);

    expect(backup.data['custom_exercises.full_state']).toBe(custom);
  });
});

describe('weekly goal', () => {
  it('carries the settings slice, which is where the goal and the prompt flag live', () => {
    expect(BACKUP_KEYS).toContain('settings.full_state');
  });

  it('round-trips the goal history and the prompt flag verbatim', async () => {
    const settings = JSON.stringify({
      units: 'lb',
      weeklyGoals: [
        { week: '2026-09-28', days: 4 },
        { week: '2026-10-19', days: 6 },
      ],
      goalPromptSeen: true,
    });

    (AsyncStorage.multiGet as jest.Mock).mockResolvedValueOnce(
      BACKUP_KEYS.map((k) => [k, k === 'settings.full_state' ? settings : null])
    );

    const backup = await createBackup(0);
    expect(backup.data['settings.full_state']).toBe(settings);

    await restoreBackup(parseBackup(JSON.stringify(backup)));
    const written = mockMultiSet.mock.calls[0][0] as [string, string][];
    expect(written).toContainEqual(['settings.full_state', settings]);
  });

  it('restores a pre-#78 settings blob that has neither field', async () => {
    // The fields are absent rather than empty, which the store reads as the
    // default goal of 3 — see settingsStore's hydrate test.
    const legacySettings = '{"theme":"dark","haptics":false,"units":"kg"}';
    const legacy = validBackup({
      app: 'ironquest',
      data: { 'settings.full_state': legacySettings },
    });

    await expect(restoreBackup(parseBackup(JSON.stringify(legacy)))).resolves.toBe(1);

    const written = mockMultiSet.mock.calls[0][0] as [string, string][];
    expect(written).toContainEqual(['settings.full_state', legacySettings]);
    expect(JSON.parse(written[0][1]).weeklyGoals).toBeUndefined();
    // Carried settings replace the device's wholesale; nothing to read or clear.
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // A backup with NO settings entry at all
  //
  // Omitted keys are normally left alone, and that is right for every slice
  // except this one: the goal list scores the history being restored. Landing
  // an old export on a device set to 6 would judge weeks that never knew about
  // that number against it.
  //
  // The reset rides in the SAME multiSet as the restored entries. A second
  // write after the batch could reject on its own, and then the history would
  // already be replaced while the caller reported a failure and never offered
  // the reload — the next save would put the stale in-memory logs back over it.
  // ---------------------------------------------------------------------------

  const historyOnly = () =>
    parseBackup(
      JSON.stringify(
        validBackup({ app: 'ironquest', data: { 'workout_history.full_state': '{"logs":[]}' } })
      )
    );

  it('clears the device goal list when the backup carries no settings', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        theme: 'dark',
        haptics: false,
        units: 'kg',
        goalPromptSeen: true,
        weeklyGoals: [{ week: '2026-10-19', days: 6 }],
      })
    );

    await expect(restoreBackup(historyOnly())).resolves.toBe(1);

    // One write, carrying both the restored history and the reset settings.
    expect(mockMultiSet).toHaveBeenCalledTimes(1);
    expect(mockSetItem).not.toHaveBeenCalled();

    const written = mockMultiSet.mock.calls[0][0] as [string, string][];
    expect(written[0]).toEqual(['workout_history.full_state', '{"logs":[]}']);
    expect(written[1][0]).toBe('settings.full_state');
    expect(JSON.parse(written[1][1])).toEqual({
      theme: 'dark',
      haptics: false,
      units: 'kg',
      goalPromptSeen: true,
      weeklyGoals: [],
    });
  });

  it('writes nothing extra when the device has no settings of its own', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(restoreBackup(historyOnly())).resolves.toBe(1);
    expect(mockMultiSet.mock.calls[0][0]).toEqual([['workout_history.full_state', '{"logs":[]}']]);
  });

  it('leaves a device already on the default alone', async () => {
    mockGetItem.mockResolvedValue('{"units":"lb","weeklyGoals":[]}');
    await restoreBackup(historyOnly());
    expect(mockMultiSet.mock.calls[0][0]).toEqual([['workout_history.full_state', '{"logs":[]}']]);
  });

  it('leaves settings it cannot read exactly as they are', async () => {
    mockGetItem.mockResolvedValue('{not json');
    await expect(restoreBackup(historyOnly())).resolves.toBe(1);
    expect(mockMultiSet.mock.calls[0][0]).toEqual([['workout_history.full_state', '{"logs":[]}']]);
  });

  // ---------------------------------------------------------------------------
  // Failure ordering
  //
  // Half a restore is the worst outcome: the history is gone, the caller says
  // it failed, and nothing reloads, so the stores still hold the old logs and
  // the next save writes them back over what was just restored. Everything that
  // can reject therefore happens before the one write.
  // ---------------------------------------------------------------------------

  it('writes nothing at all when the settings read fails', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(restoreBackup(historyOnly())).rejects.toThrow('storage unavailable');

    expect(mockMultiSet).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('does not follow a failed batch with a second write', async () => {
    mockGetItem.mockResolvedValue('{"units":"lb","weeklyGoals":[{"week":"2026-10-19","days":6}]}');
    mockMultiSet.mockRejectedValue(new Error('quota exceeded'));

    await expect(restoreBackup(historyOnly())).rejects.toThrow('quota exceeded');

    expect(mockMultiSet).toHaveBeenCalledTimes(1);
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

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
