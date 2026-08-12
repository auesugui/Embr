// =============================================================================
// IronQuest Exercise Database
// =============================================================================
// Seeded database of common exercises with muscle groups and FP type mappings.
// This is the source of truth for all exercises in the app.

import type { StatType } from '@/types';

// -----------------------------------------------------------------------------
// Muscle Group Types
// -----------------------------------------------------------------------------

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps';

export type MovementPattern =
  | 'push_horizontal'
  | 'push_vertical'
  | 'pull_horizontal'
  | 'pull_vertical'
  | 'hinge'
  | 'squat'
  | 'lunge'
  | 'core'
  | 'isolation';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'band';

// -----------------------------------------------------------------------------
// Typed-FP Distribution
// -----------------------------------------------------------------------------
//
// Each exercise carries a weighted `fpDistribution` describing how the FP it
// earns splits across the five trainable stat types (power/guard/speed/vigor/
// focus). Spirit is NEVER produced by an exercise — it is streak-only per the
// Core Design Rule, so it must not appear in any entry below.
//
// Weights are fractions of 1.0 and SHOULD sum to ~1.0:
//   - Compound lifts: primary mover gets ≥ 0.7 (we standardize on 0.8 / 0.2).
//     This is the C5 fix (audit 2026-07): the old equal-weight `['power','focus']`
//     arrays leaked the secondary type into every push/pull compound and made
//     every template's radar converge on a Focus-heavy shape. The primary mover
//     must emit dominantly so a pet reflects its owner's training split.
//   - Isolation lifts: a single type at 1.0 (e.g. bicep curl = focus 1.0).
//
// `calculateDayFPDistribution` (templates.ts) reads this field directly — it is
// load-bearing for the radar charts on template cards, NOT decorative.
// -----------------------------------------------------------------------------

export type FPDistribution = Partial<Record<StatType, number>>;

// -----------------------------------------------------------------------------
// Exercise Definition
// -----------------------------------------------------------------------------

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  primaryMuscle: MuscleGroup;
  movementPattern: MovementPattern;
  equipment: Equipment[];
  defaultSets: number;
  defaultReps: string; // e.g., "8-12", "5x5", "10-15"
  defaultRestSeconds: number;
  isCompound: boolean;
  /**
   * @deprecated INERT since ADR-0015. Nothing reads this.
   *
   * A weighted muscle→stat split (primary mover ≥ 0.7) that fed the FP engine's
   * typed distribution and the template radar charts. Both are deleted.
   *
   * Kept rather than stripped from all ~60 exercise entries because it is
   * hand-tuned data, not code: it encodes which muscles each lift actually
   * emphasizes, which is the expensive part to reproduce and is plausibly
   * useful again (per-muscle volume tracking is a normal tracker feature).
   * Deleting it would be a large mechanical edit to the exercise database —
   * the app's most load-bearing static data — for a few kilobytes.
   */
  fpDistribution: FPDistribution;
}

// -----------------------------------------------------------------------------
// Exercise Database
// -----------------------------------------------------------------------------

export const EXERCISE_DATABASE: ExerciseDefinition[] = [
  // =========== PUSH (Chest, Shoulders, Triceps) ===========
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    primaryMuscle: 'chest',
    movementPattern: 'push_horizontal',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '6-10',
    defaultRestSeconds: 180,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'incline_dumbbell_press',
    name: 'Incline Dumbbell Press',
    muscleGroups: ['chest', 'shoulders'],
    primaryMuscle: 'chest',
    movementPattern: 'push_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'dumbbell_flyes',
    name: 'Dumbbell Flyes',
    muscleGroups: ['chest'],
    primaryMuscle: 'chest',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { power: 1.0 },
  },
  {
    id: 'cable_crossover',
    name: 'Cable Crossover',
    muscleGroups: ['chest'],
    primaryMuscle: 'chest',
    movementPattern: 'isolation',
    equipment: ['cable'],
    defaultSets: 3,
    defaultReps: '12-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { power: 1.0 },
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    muscleGroups: ['shoulders', 'triceps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'push_vertical',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '6-10',
    defaultRestSeconds: 180,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    muscleGroups: ['shoulders', 'triceps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'push_vertical',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'lateral_raises',
    name: 'Lateral Raises',
    muscleGroups: ['shoulders'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '12-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'front_raises',
    name: 'Front Raises',
    muscleGroups: ['shoulders'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '10-12',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'rear_delt_flyes',
    name: 'Rear Delt Flyes',
    muscleGroups: ['shoulders'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '12-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'tricep_pushdowns',
    name: 'Tricep Pushdowns',
    muscleGroups: ['triceps'],
    primaryMuscle: 'triceps',
    movementPattern: 'isolation',
    equipment: ['cable'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'skull_crushers',
    name: 'Skull Crushers',
    muscleGroups: ['triceps'],
    primaryMuscle: 'triceps',
    movementPattern: 'isolation',
    equipment: ['barbell', 'dumbbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'dips',
    name: 'Dips',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    primaryMuscle: 'chest',
    movementPattern: 'push_horizontal',
    equipment: ['bodyweight', 'machine'],
    defaultSets: 3,
    defaultReps: '8-15',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'push_ups',
    name: 'Push-ups',
    muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
    primaryMuscle: 'chest',
    movementPattern: 'push_horizontal',
    equipment: ['bodyweight'],
    defaultSets: 3,
    defaultReps: '10-20',
    defaultRestSeconds: 60,
    isCompound: true,
    // Mirrors the bench press split (the same horizontal press pattern), with a
    // slice of vigor for the braced plank position the movement is done in.
    fpDistribution: { power: 0.7, focus: 0.2, vigor: 0.1 },
  },

  // =========== PULL (Back, Biceps, Traps) ===========
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroups: ['back', 'hamstrings', 'glutes', 'traps'],
    primaryMuscle: 'back',
    movementPattern: 'hinge',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '3-6',
    defaultRestSeconds: 240,
    isCompound: true,
    fpDistribution: { guard: 0.8, vigor: 0.2 },
  },
  {
    id: 'barbell_row',
    name: 'Barbell Row',
    muscleGroups: ['back', 'biceps', 'traps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_horizontal',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '6-10',
    defaultRestSeconds: 180,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'pull_ups',
    name: 'Pull-ups',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_vertical',
    equipment: ['bodyweight'],
    defaultSets: 4,
    defaultReps: '6-12',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_vertical',
    equipment: ['cable', 'machine'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_horizontal',
    equipment: ['cable'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'face_pulls',
    name: 'Face Pulls',
    muscleGroups: ['shoulders', 'traps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['cable'],
    defaultSets: 3,
    defaultReps: '12-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'barbell_curl',
    name: 'Barbell Curl',
    muscleGroups: ['biceps'],
    primaryMuscle: 'biceps',
    movementPattern: 'isolation',
    equipment: ['barbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'dumbbell_curl',
    name: 'Dumbbell Curl',
    muscleGroups: ['biceps'],
    primaryMuscle: 'biceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    muscleGroups: ['biceps', 'forearms'],
    primaryMuscle: 'biceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'shrugs',
    name: 'Shrugs',
    muscleGroups: ['traps'],
    primaryMuscle: 'traps',
    movementPattern: 'isolation',
    equipment: ['barbell', 'dumbbell'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { guard: 1.0 },
  },

  // =========== LEGS (Quads, Hamstrings, Glutes, Calves) ===========
  {
    id: 'back_squat',
    name: 'Back Squat',
    muscleGroups: ['quads', 'glutes', 'hamstrings', 'core'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '5-10',
    defaultRestSeconds: 240,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'front_squat',
    name: 'Front Squat',
    muscleGroups: ['quads', 'core'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['barbell'],
    defaultSets: 4,
    defaultReps: '6-10',
    defaultRestSeconds: 180,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    muscleGroups: ['quads', 'glutes', 'hamstrings', 'core'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['bodyweight'],
    // High-rep by nature — no external load, so the set is volume, not intensity.
    // Short rest keeps it usable inside an AMRAP block.
    defaultSets: 3,
    defaultReps: '15-25',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['machine'],
    defaultSets: 3,
    defaultReps: '8-15',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'walking_lunges',
    name: 'Walking Lunges',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    primaryMuscle: 'quads',
    movementPattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    muscleGroups: ['quads', 'glutes'],
    primaryMuscle: 'quads',
    movementPattern: 'lunge',
    equipment: ['dumbbell', 'barbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'hinge',
    equipment: ['barbell', 'dumbbell'],
    defaultSets: 3,
    defaultReps: '6-10',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'leg_curl',
    name: 'Leg Curl',
    muscleGroups: ['hamstrings'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'isolation',
    equipment: ['machine'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { speed: 1.0 },
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    muscleGroups: ['quads'],
    primaryMuscle: 'quads',
    movementPattern: 'isolation',
    equipment: ['machine'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { speed: 1.0 },
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    muscleGroups: ['glutes', 'hamstrings'],
    primaryMuscle: 'glutes',
    movementPattern: 'hinge',
    equipment: ['barbell'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 120,
    isCompound: true,
    fpDistribution: { vigor: 0.8, speed: 0.2 },
  },
  {
    id: 'calf_raises',
    name: 'Calf Raises',
    muscleGroups: ['calves'],
    primaryMuscle: 'calves',
    movementPattern: 'isolation',
    equipment: ['machine', 'dumbbell', 'barbell'],
    defaultSets: 4,
    defaultReps: '12-20',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },

  // =========== CORE ===========
  {
    id: 'plank',
    name: 'Plank',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    movementPattern: 'core',
    equipment: ['bodyweight'],
    defaultSets: 3,
    defaultReps: '30-60s',
    defaultRestSeconds: 45,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    movementPattern: 'core',
    equipment: ['bodyweight'],
    defaultSets: 3,
    defaultReps: '10-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },
  {
    id: 'cable_crunch',
    name: 'Cable Crunch',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    movementPattern: 'core',
    equipment: ['cable'],
    defaultSets: 3,
    defaultReps: '12-15',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },
  {
    id: 'russian_twist',
    name: 'Russian Twist',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    movementPattern: 'core',
    equipment: ['bodyweight', 'dumbbell'],
    defaultSets: 3,
    defaultReps: '20-30',
    defaultRestSeconds: 45,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },

  // =========== HOME GYM EXERCISES (Powerbuilding Home Edition) ===========
  {
    id: 'db_floor_press',
    name: 'DB Floor Press',
    muscleGroups: ['chest', 'triceps'],
    primaryMuscle: 'chest',
    movementPattern: 'push_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'db_overhead_press',
    name: 'DB Overhead Press',
    muscleGroups: ['shoulders', 'triceps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'push_vertical',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { power: 0.8, focus: 0.2 },
  },
  {
    id: 'close_grip_db_floor_press',
    name: 'Close-Grip DB Floor Press',
    muscleGroups: ['triceps', 'chest'],
    primaryMuscle: 'triceps',
    movementPattern: 'push_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '30 total',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'db_kickbacks',
    name: 'DB Kickbacks',
    muscleGroups: ['triceps'],
    primaryMuscle: 'triceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'overhead_db_tricep_ext',
    name: 'Overhead DB Tricep Extension',
    muscleGroups: ['triceps'],
    primaryMuscle: 'triceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'db_rdl',
    name: 'DB Romanian Deadlift',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'hinge',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { guard: 0.8, vigor: 0.2 },
  },
  {
    id: 'db_bent_over_row',
    name: 'DB Bent-Over Row',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '25 total',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'incline_db_row',
    name: 'Incline DB Row',
    muscleGroups: ['back'],
    primaryMuscle: 'back',
    movementPattern: 'pull_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '30 total',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { guard: 1.0 },
  },
  {
    id: 'db_shrugs',
    name: 'DB Shrugs',
    muscleGroups: ['traps'],
    primaryMuscle: 'traps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { guard: 1.0 },
  },
  {
    id: 'standing_db_curl',
    name: 'Standing DB Curl',
    muscleGroups: ['biceps'],
    primaryMuscle: 'biceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'bent_over_db_reverse_fly',
    name: 'Bent-Over DB Reverse Fly',
    muscleGroups: ['shoulders', 'traps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 15,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'db_goblet_squat',
    name: 'DB Goblet Squat',
    muscleGroups: ['quads', 'glutes', 'core'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'db_good_morning',
    name: 'DB Good Morning',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'hinge',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '25 total',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { vigor: 0.8, guard: 0.2 },
  },
  {
    id: 'nordic_curl',
    name: 'Nordic Curl',
    muscleGroups: ['hamstrings'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'isolation',
    equipment: ['bodyweight'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { speed: 1.0 },
  },
  {
    id: 'nordstick_hamstring_curl',
    name: 'NordStick Hamstring Curl',
    muscleGroups: ['hamstrings'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'isolation',
    equipment: ['machine'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { speed: 1.0 },
  },
  {
    id: 'db_standing_calf_raise',
    name: 'DB Standing Calf Raise',
    muscleGroups: ['calves'],
    primaryMuscle: 'calves',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 15,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },
  {
    id: 'db_front_squat',
    name: 'DB Front Squat',
    muscleGroups: ['quads', 'core'],
    primaryMuscle: 'quads',
    movementPattern: 'squat',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'db_hip_thrust',
    name: 'DB Hip Thrust',
    muscleGroups: ['glutes', 'hamstrings'],
    primaryMuscle: 'glutes',
    movementPattern: 'hinge',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '30 total',
    defaultRestSeconds: 60,
    isCompound: true,
    fpDistribution: { vigor: 0.8, speed: 0.2 },
  },
  {
    id: 'db_lunges',
    name: 'DB Lunges',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    primaryMuscle: 'quads',
    movementPattern: 'lunge',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: true,
    fpDistribution: { speed: 0.8, vigor: 0.2 },
  },
  {
    id: 'db_sissy_squat',
    name: 'DB Sissy Squat',
    muscleGroups: ['quads'],
    primaryMuscle: 'quads',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { speed: 1.0 },
  },
  {
    id: 'lying_leg_raise',
    name: 'Lying Leg Raise',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    movementPattern: 'core',
    equipment: ['bodyweight'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 15,
    isCompound: false,
    fpDistribution: { vigor: 1.0 },
  },
  {
    id: 'db_pullover',
    name: 'DB Pullover',
    muscleGroups: ['back', 'chest'],
    primaryMuscle: 'back',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 3,
    defaultReps: '30 total',
    defaultRestSeconds: 60,
    isCompound: false,
    fpDistribution: { guard: 1.0 },
  },
  {
    id: 'one_arm_db_row',
    name: 'One-Arm DB Row',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    movementPattern: 'pull_horizontal',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: true,
    fpDistribution: { guard: 0.8, focus: 0.2 },
  },
  {
    id: 'incline_db_curl',
    name: 'Incline DB Curl',
    muscleGroups: ['biceps'],
    primaryMuscle: 'biceps',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 30,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'prone_incline_reverse_fly',
    name: 'Prone Incline Reverse Fly',
    muscleGroups: ['shoulders', 'traps'],
    primaryMuscle: 'shoulders',
    movementPattern: 'isolation',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '50 total',
    defaultRestSeconds: 15,
    isCompound: false,
    fpDistribution: { focus: 1.0 },
  },
  {
    id: 'db_stiff_leg_deadlift',
    name: 'DB Stiff-Leg Deadlift',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    primaryMuscle: 'hamstrings',
    movementPattern: 'hinge',
    equipment: ['dumbbell'],
    defaultSets: 5,
    defaultReps: '15 total',
    defaultRestSeconds: 90,
    isCompound: true,
    fpDistribution: { guard: 0.8, vigor: 0.2 },
  },
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISE_DATABASE.find((e) => e.id === id);
}

export function getExercisesByMuscle(muscle: MuscleGroup): ExerciseDefinition[] {
  return EXERCISE_DATABASE.filter((e) => e.muscleGroups.includes(muscle));
}

export function getExercisesByPattern(pattern: MovementPattern): ExerciseDefinition[] {
  return EXERCISE_DATABASE.filter((e) => e.movementPattern === pattern);
}

export function getExercisesByEquipment(equipment: Equipment): ExerciseDefinition[] {
  return EXERCISE_DATABASE.filter((e) => e.equipment.includes(equipment));
}

export function searchExercises(query: string): ExerciseDefinition[] {
  const lowerQuery = query.toLowerCase();
  return EXERCISE_DATABASE.filter(
    (e) =>
      e.name.toLowerCase().includes(lowerQuery) ||
      e.muscleGroups.some((m) => m.toLowerCase().includes(lowerQuery))
  );
}
