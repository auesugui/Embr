// =============================================================================
// IronQuest Storage Utility - AsyncStorage only (works in Expo Go)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
export const STORAGE_KEYS = {
  // Pet stats
  PET_STATS: {
    POWER: 'pet.stats.power',
    GUARD: 'pet.stats.guard',
    SPEED: 'pet.stats.speed',
    VIGOR: 'pet.stats.vigor',
    FOCUS: 'pet.stats.focus',
    SPIRIT: 'pet.stats.spirit',
  },
  // Pet state
  PET: {
    HUNGER: 'pet.hunger',
    MOOD: 'pet.mood',
    EVOLUTION_STAGE: 'pet.evolution_stage',
    EVO_XP: 'pet.evo_xp',
    TYPE: 'pet.type',
    VISUAL_SEED: 'pet.visual_seed',
    ABILITIES: 'pet.abilities',
    COSMETICS: 'pet.cosmetics',
    FULL_STATE: 'pet.full_state',
  },
  // Player FP
  PLAYER_FP: {
    GENERIC: 'player.fp.generic',
    POWER: 'player.fp.power',
    GUARD: 'player.fp.guard',
    SPEED: 'player.fp.speed',
    VIGOR: 'player.fp.vigor',
    FOCUS: 'player.fp.focus',
    SPIRIT: 'player.fp.spirit',
    FULL_STATE: 'player.fp.full_state',
  },
  // Player streak
  STREAK: {
    CURRENT: 'streak.current',
    LONGEST: 'streak.longest',
    LAST_WORKOUT: 'streak.last_workout',
    FULL_STATE: 'streak.full_state',
  },
  // Session
  SESSION: {
    ACTIVE: 'session.active',
    TEMPLATE_ID: 'session.template_id',
    STARTED_AT: 'session.started_at',
    FULL_STATE: 'session.full_state',
  },
  // Settings
  SETTINGS: {
    THEME: 'settings.theme',
    HAPTICS: 'settings.haptics',
    NOTIFICATIONS: 'settings.notifications',
    UNITS: 'settings.units',
    REDUCED_MOTION: 'settings.reduced_motion',
    FULL_STATE: 'settings.full_state',
  },
  // Tower
  TOWER: {
    CURRENT_FLOOR: 'tower.current_floor',
    BEST_FLOOR: 'tower.best_floor',
    ATTEMPTS_REMAINING: 'tower.attempts_remaining',
    LAST_RESET: 'tower.last_reset',
    FULL_STATE: 'tower.full_state',
  },
  // Weight History
  WEIGHT_HISTORY: {
    FULL_STATE: 'weight_history.full_state',
  },
  // Player profile
  PLAYER: {
    PROFILE: 'player.profile',
    ACHIEVEMENTS: 'player.achievements',
    FULL_STATE: 'player.full_state',
  },
  // Personal Records
  PR: {
    FULL_STATE: 'pr.full_state',
  },
  // Per-exercise baseline (Personal Baseline relative FP scaling)
  BASELINE: {
    FULL_STATE: 'baseline.full_state',
  },
  // Personal (custom) workout templates — duplicated/edited copies of built-ins
  PERSONAL_TEMPLATES: {
    FULL_STATE: 'personal_templates.full_state',
  },
  // Workout history — persisted WorkoutLog records (idempotent FP claim)
  WORKOUT_HISTORY: {
    FULL_STATE: 'workout_history.full_state',
  },
  // Misc
  SCHEMA_VERSION: 'schema_version',
} as const;

// AsyncStorage Keys (for history/bulk data)
export const ASYNC_KEYS = {
  WORKOUT_HISTORY: '@workout_history',
  PERSONAL_BASELINES: '@personal_baselines',
  TEMPLATES: '@templates',
} as const;

// =============================================================================
// Unified Storage API (AsyncStorage only - works in Expo Go)
// =============================================================================

export const appStorage = {
  // Getters
  getString: async (key: string): Promise<string | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value ?? undefined;
  },

  getNumber: async (key: string): Promise<number | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value ? Number.parseFloat(value) : undefined;
  },

  getBoolean: async (key: string): Promise<boolean | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value === 'true' ? true : value === 'false' ? false : undefined;
  },

  getJSON: async <T>(key: string): Promise<T | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  },

  // Setters
  setString: async (key: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(key, value);
  },

  setNumber: async (key: string, value: number): Promise<void> => {
    await AsyncStorage.setItem(key, String(value));
  },

  setBoolean: async (key: string, value: boolean): Promise<void> => {
    await AsyncStorage.setItem(key, value ? 'true' : 'false');
  },

  setJSON: async <T>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  // Delete
  delete: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },

  // Clear all
  clearAll: async (): Promise<void> => {
    await AsyncStorage.clear();
  },

  // Check exists
  contains: async (key: string): Promise<boolean> => {
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  },
};

// =============================================================================
// Storage Migration
// =============================================================================

const SCHEMA_VERSION = 2;

/**
 * Keys written by the deleted game layer (ADR-0014 / ADR-0015). Nothing reads
 * them; on an existing install they'd otherwise sit in storage forever.
 */
const DEAD_GAME_KEYS: readonly string[] = [
  ...Object.values(STORAGE_KEYS.PET_STATS),
  ...Object.values(STORAGE_KEYS.PET),
  ...Object.values(STORAGE_KEYS.PLAYER_FP),
  ...Object.values(STORAGE_KEYS.TOWER),
];

export const migrateStorage = async (): Promise<void> => {
  const currentVersion = (await appStorage.getNumber(STORAGE_KEYS.SCHEMA_VERSION)) ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    if (currentVersion < 2) {
      // v2 — drop the game layer's storage.
      //
      // This deletes whole dead namespaces (pet, pet stats, player FP, tower).
      // It deliberately does NOT rewrite `workout_history`: those logs may
      // still carry `totalFP` / `fpEarned` from before the engine was removed,
      // and rewriting the one irreplaceable slice of user data to strip two
      // fields nothing reads is risk without benefit. Extra keys on a stored
      // object are inert — the type no longer declares them, the app never
      // touches them, and they cost a few bytes.
      await AsyncStorage.multiRemove([...DEAD_GAME_KEYS]);
    }

    await appStorage.setNumber(STORAGE_KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
  }
};
