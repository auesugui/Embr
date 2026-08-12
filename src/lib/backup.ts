// =============================================================================
// Backup — export / restore the full local data set
// =============================================================================
// The app is offline-first: every workout lives in AsyncStorage on one device
// and nowhere else. On the web build that means localStorage, which iOS may
// evict — so without an export, a browser storage sweep silently costs you
// every workout you ever logged. This is the insurance.
//
// It snapshots raw storage values rather than reaching into each Zustand store.
// That keeps it independent of store internals: a backup taken today still
// restores after a store refactor, because the persisted key/value shape is the
// contract, not the in-memory state. Values are copied verbatim (they're
// already JSON strings) and never re-parsed on export, so a store the backup
// doesn't understand still round-trips intact.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/utils/storage';

/** Bumped only if the envelope changes — not when a store's own shape does. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * Every persisted slice worth carrying.
 *
 * The pet, player-FP, and tower keys used to be in here — a backup was a
 * backup, game layer included. Those subsystems are gone (ADR-0014 / ADR-0015),
 * so they're gone from this list too.
 *
 * That has a deliberate side effect on OLD backup files, which still contain
 * those keys: `restoreBackup` filters incoming entries against this list, so
 * the dead slices are dropped on the way in rather than resurrected as orphan
 * blobs. Old files still restore — they just restore the parts that still mean
 * something.
 */
export const BACKUP_KEYS: readonly string[] = [
  STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE,
  STORAGE_KEYS.PR.FULL_STATE,
  STORAGE_KEYS.BASELINE.FULL_STATE,
  STORAGE_KEYS.PERSONAL_TEMPLATES.FULL_STATE,
  STORAGE_KEYS.WEIGHT_HISTORY.FULL_STATE,
  STORAGE_KEYS.SETTINGS.FULL_STATE,
  STORAGE_KEYS.PLAYER.FULL_STATE,
  STORAGE_KEYS.STREAK.FULL_STATE,
  STORAGE_KEYS.SCHEMA_VERSION,
];

/**
 * The `app` tag files are written with. Old files say 'ironquest' and MUST keep
 * restoring — a rename that quietly invalidates every existing backup is how
 * you lose data with a cosmetic change.
 */
export const BACKUP_APP_ID = 'embr';
const ACCEPTED_APP_IDS = new Set(['embr', 'ironquest']);

export interface BackupFile {
  app: 'embr' | 'ironquest';
  formatVersion: number;
  exportedAt: string;
  /** key -> raw persisted string. Keys absent from storage are omitted. */
  data: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export async function createBackup(now: number = Date.now()): Promise<BackupFile> {
  const pairs = await AsyncStorage.multiGet([...BACKUP_KEYS]);

  const data: Record<string, string> = {};
  for (const [key, value] of pairs) {
    // multiGet returns null for keys that were never written. Omitting them
    // (rather than storing null) keeps restore's "only touch what's present"
    // semantics simple — see restoreBackup.
    if (value !== null) data[key] = value;
  }

  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    data,
  };
}

/** `embr-backup-2026-08-11.json` — sorts chronologically in a file list. */
export function backupFilename(appName: string, now: number = Date.now()): string {
  const date = new Date(now).toISOString().slice(0, 10);
  return `${appName.toLowerCase()}-backup-${date}.json`;
}

// -----------------------------------------------------------------------------
// Import
// -----------------------------------------------------------------------------

export class BackupParseError extends Error {}

/**
 * Validate an untrusted file into a BackupFile. Pure — no storage access — so
 * the failure modes are unit-testable and restore never half-applies a file it
 * couldn't fully read.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupParseError("That file isn't valid JSON.");
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new BackupParseError("That file doesn't look like a backup.");
  }

  const candidate = raw as Partial<BackupFile>;

  if (typeof candidate.app !== 'string' || !ACCEPTED_APP_IDS.has(candidate.app)) {
    throw new BackupParseError('That backup was made by a different app.');
  }

  // Newer files may carry an envelope this build can't read. Refuse rather than
  // guess — a partial restore is worse than a clear failure.
  if (
    typeof candidate.formatVersion !== 'number' ||
    candidate.formatVersion > BACKUP_FORMAT_VERSION
  ) {
    throw new BackupParseError('That backup was made by a newer version of the app.');
  }

  const data = candidate.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new BackupParseError('That backup is missing its data.');
  }

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      throw new BackupParseError(`Backup entry "${key}" is corrupted.`);
    }
  }

  return {
    app: candidate.app as BackupFile['app'],
    formatVersion: candidate.formatVersion,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    data: data as Record<string, string>,
  };
}

/**
 * Overwrite local storage with the backup's contents and report how many keys
 * were written. Keys the backup doesn't carry are left alone rather than
 * cleared — restoring a partial backup shouldn't wipe slices it never held.
 *
 * Callers must reload the app afterwards: the Zustand stores hydrated at boot
 * and won't notice storage changing underneath them.
 */
export async function restoreBackup(backup: BackupFile): Promise<number> {
  const entries = Object.entries(backup.data).filter(([key]) => BACKUP_KEYS.includes(key));
  if (entries.length === 0) return 0;

  await AsyncStorage.multiSet(entries);
  return entries.length;
}
