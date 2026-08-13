// =============================================================================
// IronQuest Core Types
// =============================================================================

// -----------------------------------------------------------------------------
// Pet Types
// -----------------------------------------------------------------------------

// Phase 2 (issue #33): migrated from the 5-type exploration set to the resolved
// Q1 3-type taxonomy. Type triangle (cyclic): Ferro → Flux → Terra → Ferro.
// Advantage: 1.3× damage dealt / 0.8× taken. See docs/04-pet-system/pet-types.md.
export type PetType = 'ferro' | 'flux' | 'terra';

export type StatType = 'power' | 'guard' | 'speed' | 'vigor' | 'focus' | 'spirit';

export type FPType = StatType | 'generic';

export interface PetStats {
  power: number;
  guard: number;
  speed: number;
  vigor: number;
  focus: number;
  spirit: number;
}

export interface EvolutionState {
  stage: 1 | 2 | 3 | 4;
  evoXP: number;
}

export interface PetCare {
  hunger: number; // 0-1
  mood: number; // 0-1
  lastFed: number; // timestamp
}

export interface Pet {
  id: string;
  stats: PetStats;
  evolution: EvolutionState;
  care: PetCare;
  type: PetType;
  visualSeed: number;
  abilities: string[];
  cosmetics: string[];
}

// -----------------------------------------------------------------------------
// Player Types
// -----------------------------------------------------------------------------

export interface FPBalances {
  generic: number;
  power: number;
  guard: number;
  speed: number;
  vigor: number;
  focus: number;
  spirit: number;
}

export interface StreakData {
  current: number;
  longest: number;
  lastWorkoutDate: string | null; // ISO date string
}

export interface PlayerProfile {
  name: string;
  avatar: string | null;
  createdAt: string;
}

export interface Player {
  id: string;
  profile: PlayerProfile;
  fp: FPBalances;
  streak: StreakData;
  achievements: string[];
}

// -----------------------------------------------------------------------------
// Workout Types
// -----------------------------------------------------------------------------

export type SessionIntent = 'normal' | 'deload' | 'tempo' | 'pause' | 'drop_set' | 'rest_pause';

export type WorkoutType =
  | 'lifting'
  | 'cardio_liss'
  | 'cardio_hiit'
  | 'cardio_hybrid'
  | 'cardio_sport';

export interface LoggedSet {
  reps: number | null;
  weight: number | null;
  logged: boolean;
  isPR: boolean;
  isRepPR: boolean;
}

/**
 * How an exercise's work is bounded.
 *
 * - `sets`   — the classic scheme: a fixed number of sets at a rep target.
 * - `amrap`  — as many reps/rounds as possible inside a time window. The set
 *              count is open-ended (a new row appears as you log), and the
 *              exercise ends when `durationSeconds` runs out, not when a
 *              planned set count is hit.
 *
 * Optional on Exercise/TemplateExercise: absent means `sets`. Every workout
 * logged before AMRAP existed omits it, and backups of those must keep
 * restoring unchanged — so this is read defensively everywhere via
 * `isAmrap()` (src/lib/amrap.ts) rather than compared directly.
 */
export type ExerciseMode = 'sets' | 'amrap';

/**
 * How a *block* of work is bounded.
 *
 * - `sets`         — the classic scheme: a fixed number of sets at a rep target.
 * - `amrap_rounds` — fixed reps per movement, as many rounds as possible before
 *                    the clock runs out. "5 pull-ups / 10 push-ups / 15 squats,
 *                    AMRAP 20 min" is this.
 * - `amrap_reps`   — one movement, no rep target, as many reps as possible in
 *                    the window. This is what `ExerciseMode: 'amrap'` meant.
 * - `for_time`     — fixed rounds at fixed reps, clock counts UP, optional cap.
 * - `emom`         — every minute on the minute: one interval of work, then
 *                    whatever is left of the interval is rest.
 *
 * Read through `resolveBlock` (src/lib/blocks.ts), never compared directly.
 */
export type BlockMode = 'sets' | 'amrap_rounds' | 'amrap_reps' | 'for_time' | 'emom';

/**
 * The clock and round plan shared by one or more exercises.
 *
 * Kept in a side list rather than nesting the exercises inside it. `Exercise[]`
 * on a WorkoutLog is the only irreplaceable slice in storage, and reshaping it
 * would break every stored workout and every exported backup. Membership is a
 * key (`Exercise.blockId`), so both sides stay flat and both fields are
 * optional additions.
 */
export interface WorkoutBlock {
  id: string;
  mode: BlockMode;
  /** Window for the AMRAP modes; the cap for `for_time` (absent/0 = uncapped). */
  durationSeconds?: number;
  /** EMOM only: seconds per interval. Defaults to 60. */
  intervalSeconds?: number;
  /** Planned rounds for `for_time`; interval count for `emom`. */
  rounds?: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  sets: LoggedSet[];
  restSeconds: number;
  completed: boolean;
  /**
   * @deprecated Pre-block AMRAP, kept so sessions and logs written by the first
   * AMRAP pass still load. `resolveBlock` reads it as a one-member `amrap_reps`
   * block. New records carry `blockId` instead.
   */
  mode?: ExerciseMode;
  /** Legacy companion to `mode`. See the note above. */
  durationSeconds?: number;
  /** Which block this exercise belongs to. Absent means a plain set scheme. */
  blockId?: string;
  /**
   * The prescribed reps carried over from the template (`'5'`, `'8-12'`).
   *
   * A set scheme never needed this — you read it off the template beforehand
   * and the session just counts sets. A circuit does: "5 pull-ups, 10 push-ups,
   * 15 squats" IS the prescription, and it has to be on screen and one tap away
   * while the clock runs. Absent on every session logged before blocks existed.
   */
  targetReps?: string;
}

export interface WorkoutSession {
  active: boolean;
  templateId: string | null;
  startedAt: number | null;
  currentExerciseIndex: number;
  exercises: Exercise[];
  intent: SessionIntent;
  gymRushActive: boolean;
  /** Blocks referenced by `exercises[].blockId`. Absent on pre-block sessions. */
  blocks?: WorkoutBlock[];
}

/**
 * A persisted record of a finished workout session.
 *
 * Created at session finish (BEFORE navigation to the summary) and updated
 * once. `claimedAt` is the idempotency key: null until saved, an ISO timestamp
 * after. The save path must no-op
 * when `claimedAt` is already set — this is what kills the URL-replay
 * double-claim exploit (issue #16 / audit C1).
 *
 * `streakDays` is snapshotted at finish time so the summary renders the same
 * same streak on reload that it did the first time.
 */
export interface WorkoutLog {
  id: string;
  timestamp: string; // ISO — when the session was finished
  exercises: Exercise[];
  durationSeconds: number;
  streakDays: number; // streak snapshot at finish time
  sessionIntent: SessionIntent;
  /**
   * Idempotency key: null until the workout is saved, ISO timestamp once saved.
   *
   * Named for the deleted "claim rewards" flow (ADR-0014). It is NOT game-layer
   * state — it's what stops a URL replay from saving the same workout twice
   * (issue #16 / audit C1). The name persists because the field does: renaming
   * it means migrating stored history for no functional gain.
   */
  claimedAt: string | null;
  /**
   * Blocks referenced by `exercises[].blockId`.
   *
   * Optional, and absent on every log written before blocks existed — those
   * read back as plain set schemes, which is what they were. History and the
   * summary must never require this field (Export or it's gone).
   */
  blocks?: WorkoutBlock[];
  /**
   * `for_time` only: the elapsed seconds when the block was finished, per block
   * id. A count-up block's whole point is the finishing time, and it cannot be
   * recomputed from the set rows after the fact.
   */
  blockTimes?: Record<string, number>;
}

export interface PRRecord {
  exerciseId: string;
  type: 'weight' | 'rep';
  value: number;
}

// -----------------------------------------------------------------------------
// Tower Types
// -----------------------------------------------------------------------------

export interface TowerAttempts {
  remaining: number;
  lastResetDate: string;
}

export interface BattleState {
  inProgress: boolean;
  turn: number;
  playerHP: number;
  enemyHP: number;
  log: BattleLogEntry[];
}

export interface BattleLogEntry {
  turn: number;
  attacker: 'player' | 'enemy';
  action: 'attack' | 'ability' | 'miss' | 'crit';
  damage?: number;
  type: 'normal' | 'advantage' | 'disadvantage';
}

export interface TowerProgress {
  id: string;
  playerId: string;
  currentFloor: number;
  bestFloor: number;
  attempts: TowerAttempts;
  bossKills: number;
  battle: BattleState | null;
}

// -----------------------------------------------------------------------------
// Template Types
// -----------------------------------------------------------------------------

export interface ExerciseTemplate {
  id: string;
  name: string;
  muscleGroups: string[];
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: ExerciseTemplate[];
}

// -----------------------------------------------------------------------------
// Achievement Types
// -----------------------------------------------------------------------------

export interface Achievement {
  id: string;
  playerId: string;
  achievementId: string;
  unlockedAt: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'workout' | 'pet' | 'tower' | 'streak' | 'special';
  hidden: boolean;
}

// -----------------------------------------------------------------------------
// Settings Types
// -----------------------------------------------------------------------------

export interface NotificationSettings {
  streakReminder: boolean;
  petHunger: boolean;
  weeklySummary: boolean;
}

// The unit a weight was logged in. Values are never converted between units —
// a 100 lb entry and a 100 kg entry are different facts (issue #42).
export type WeightUnit = 'lb' | 'kg';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  haptics: boolean;
  notifications: NotificationSettings;
  units: WeightUnit;
  reducedMotion: boolean;
}

// -----------------------------------------------------------------------------
// Weight History Types
// -----------------------------------------------------------------------------

export interface WeightHistoryEntry {
  weight: number;
  timestamp: string;
  // Absent on pre-#42 entries, which were all logged in lb.
  unit?: WeightUnit;
}

export interface ExerciseWeightHistory {
  exerciseId: string;
  lastWeight: number | null;
  // Unit of lastWeight; absent on pre-#42 history (lb).
  lastUnit?: WeightUnit;
  recentWeights: WeightHistoryEntry[];
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
