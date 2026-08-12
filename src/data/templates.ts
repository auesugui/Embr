import type { ExerciseMode } from '@/types';

// -----------------------------------------------------------------------------
// Template Types
// -----------------------------------------------------------------------------

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
  /**
   * How this block is bounded. Absent means `sets` — every template written
   * before AMRAP existed omits it, including the built-ins below and every
   * personal copy already in storage.
   */
  mode?: ExerciseMode;
  /**
   * AMRAP only: the work window in seconds. `sets`/`reps` are still carried so
   * switching back to a set scheme restores what the exercise had before.
   */
  durationSeconds?: number;
}

export interface TemplateDay {
  id: string;
  name: string;
  shortName: string;
  exercises: TemplateExercise[];
}

export interface WorkoutTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'ppl' | 'upper_lower' | 'full_body' | 'minimalist';
  daysPerWeek: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes per session
  days: TemplateDay[];
  /**
   * Personal-copy metadata. Built-in templates leave these unset, which keeps
   * them read-only (see issue #5). Personal copies set `isCustom: true`.
   */
  isCustom?: boolean;
  sourceTemplateId?: string; // built-in / copy a personal template was duplicated from
  createdAt?: number; // ms epoch — personal copies only
  updatedAt?: number; // ms epoch — personal copies only
}

// Exported so stores/UI can recompute distributions after editing a personal
// copy (issue #5). Keeping a single implementation prevents shadow calculators
// — see the engineer prompt's "Shadow calculator guard".
//
// Reads each exercise's weighted `fpDistribution` directly (issue #39 / audit
// C5). The primary mover emits dominantly (≥ 0.7) so a pet reflects its
// owner's training split instead of every template converging on a Focus-heavy
// shape. Sets act as the volume multiplier.
// -----------------------------------------------------------------------------
// Template 1: Push/Pull/Legs (6-day)
// Classic bodybuilding split, balanced FP distribution
// -----------------------------------------------------------------------------

const PPL_TEMPLATE: WorkoutTemplateDefinition = {
  id: 'ppl_6day',
  name: 'Push / Pull / Legs',
  description:
    'Classic 6-day split for balanced development. Each muscle group trained 2x per week.',
  category: 'ppl',
  daysPerWeek: 6,
  difficulty: 'intermediate',
  estimatedDuration: 60,
  days: [
    {
      id: 'ppl_push_a',
      name: 'Push A',
      shortName: 'Push',
      exercises: [
        { exerciseId: 'barbell_bench_press', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'incline_dumbbell_press', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'overhead_press', sets: 3, reps: '8-10', restSeconds: 120 },
        { exerciseId: 'lateral_raises', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'tricep_pushdowns', sets: 3, reps: '10-15', restSeconds: 60 },
      ],
    },
    {
      id: 'ppl_pull_a',
      name: 'Pull A',
      shortName: 'Pull',
      exercises: [
        { exerciseId: 'deadlift', sets: 3, reps: '3-6', restSeconds: 240 },
        { exerciseId: 'barbell_row', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'pull_ups', sets: 3, reps: '6-12', restSeconds: 120 },
        { exerciseId: 'face_pulls', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'barbell_curl', sets: 3, reps: '8-12', restSeconds: 60 },
      ],
    },
    {
      id: 'ppl_legs_a',
      name: 'Legs A',
      shortName: 'Legs',
      exercises: [
        { exerciseId: 'back_squat', sets: 4, reps: '5-10', restSeconds: 240 },
        { exerciseId: 'romanian_deadlift', sets: 3, reps: '6-10', restSeconds: 120 },
        { exerciseId: 'walking_lunges', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'leg_extension', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'calf_raises', sets: 4, reps: '12-20', restSeconds: 60 },
      ],
    },
    {
      id: 'ppl_push_b',
      name: 'Push B',
      shortName: 'Push',
      exercises: [
        { exerciseId: 'incline_dumbbell_press', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'dumbbell_shoulder_press', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'dumbbell_flyes', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'rear_delt_flyes', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'skull_crushers', sets: 3, reps: '8-12', restSeconds: 60 },
      ],
    },
    {
      id: 'ppl_pull_b',
      name: 'Pull B',
      shortName: 'Pull',
      exercises: [
        { exerciseId: 'pull_ups', sets: 4, reps: '6-12', restSeconds: 120 },
        { exerciseId: 'seated_cable_row', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'lat_pulldown', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'shrugs', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'hammer_curl', sets: 3, reps: '8-12', restSeconds: 60 },
      ],
    },
    {
      id: 'ppl_legs_b',
      name: 'Legs B',
      shortName: 'Legs',
      exercises: [
        { exerciseId: 'front_squat', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'leg_press', sets: 3, reps: '8-15', restSeconds: 120 },
        { exerciseId: 'hip_thrust', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'leg_curl', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'calf_raises', sets: 4, reps: '12-20', restSeconds: 60 },
      ],
    },
  ],
};

// Calculate FP distributions for PPL
PPL_TEMPLATE.days.forEach((day) => {});

// -----------------------------------------------------------------------------
// Template 2: Upper/Lower (4-day)
// Good balance, less gym time, well-rounded FP
// -----------------------------------------------------------------------------

const UPPER_LOWER_TEMPLATE: WorkoutTemplateDefinition = {
  id: 'upper_lower_4day',
  name: 'Upper / Lower',
  description: '4-day split perfect for busy schedules. Upper/lower alternation for recovery.',
  category: 'upper_lower',
  daysPerWeek: 4,
  difficulty: 'intermediate',
  estimatedDuration: 55,
  days: [
    {
      id: 'ul_upper_a',
      name: 'Upper A',
      shortName: 'Upper',
      exercises: [
        { exerciseId: 'barbell_bench_press', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'barbell_row', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'overhead_press', sets: 3, reps: '8-10', restSeconds: 120 },
        { exerciseId: 'pull_ups', sets: 3, reps: '6-12', restSeconds: 120 },
        { exerciseId: 'barbell_curl', sets: 3, reps: '8-12', restSeconds: 60 },
        { exerciseId: 'tricep_pushdowns', sets: 3, reps: '10-15', restSeconds: 60 },
      ],
    },
    {
      id: 'ul_lower_a',
      name: 'Lower A',
      shortName: 'Lower',
      exercises: [
        { exerciseId: 'back_squat', sets: 4, reps: '5-10', restSeconds: 240 },
        { exerciseId: 'romanian_deadlift', sets: 3, reps: '6-10', restSeconds: 120 },
        { exerciseId: 'bulgarian_split_squat', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'leg_curl', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'calf_raises', sets: 4, reps: '12-20', restSeconds: 60 },
      ],
    },
    {
      id: 'ul_upper_b',
      name: 'Upper B',
      shortName: 'Upper',
      exercises: [
        { exerciseId: 'incline_dumbbell_press', sets: 4, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'deadlift', sets: 3, reps: '3-6', restSeconds: 240 },
        { exerciseId: 'dumbbell_shoulder_press', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'lat_pulldown', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'lateral_raises', sets: 3, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'hammer_curl', sets: 3, reps: '8-12', restSeconds: 60 },
      ],
    },
    {
      id: 'ul_lower_b',
      name: 'Lower B',
      shortName: 'Lower',
      exercises: [
        { exerciseId: 'leg_press', sets: 4, reps: '8-15', restSeconds: 120 },
        { exerciseId: 'hip_thrust', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'walking_lunges', sets: 3, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'leg_extension', sets: 3, reps: '10-15', restSeconds: 60 },
        { exerciseId: 'calf_raises', sets: 4, reps: '12-20', restSeconds: 60 },
      ],
    },
  ],
};

// Calculate FP distributions
UPPER_LOWER_TEMPLATE.days.forEach((day) => {});

// -----------------------------------------------------------------------------
// Template 3: Full Body (3-day)
// Beginner-friendly, frequent practice, balanced stats
// -----------------------------------------------------------------------------

const FULL_BODY_TEMPLATE: WorkoutTemplateDefinition = {
  id: 'full_body_3day',
  name: 'Full Body',
  description:
    '3-day program hitting all muscles each session. Great for beginners and time-efficient.',
  category: 'full_body',
  daysPerWeek: 3,
  difficulty: 'beginner',
  estimatedDuration: 50,
  days: [
    {
      id: 'fb_day_a',
      name: 'Full Body A',
      shortName: 'Day A',
      exercises: [
        { exerciseId: 'back_squat', sets: 3, reps: '5-10', restSeconds: 180 },
        { exerciseId: 'barbell_bench_press', sets: 3, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'barbell_row', sets: 3, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'overhead_press', sets: 2, reps: '8-10', restSeconds: 120 },
        { exerciseId: 'dumbbell_curl', sets: 2, reps: '8-12', restSeconds: 60 },
        { exerciseId: 'tricep_pushdowns', sets: 2, reps: '10-15', restSeconds: 60 },
      ],
    },
    {
      id: 'fb_day_b',
      name: 'Full Body B',
      shortName: 'Day B',
      exercises: [
        { exerciseId: 'deadlift', sets: 3, reps: '3-6', restSeconds: 240 },
        { exerciseId: 'incline_dumbbell_press', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'pull_ups', sets: 3, reps: '6-12', restSeconds: 120 },
        { exerciseId: 'dumbbell_shoulder_press', sets: 2, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'walking_lunges', sets: 2, reps: '10-15', restSeconds: 90 },
        { exerciseId: 'plank', sets: 3, reps: '30-60s', restSeconds: 45 },
      ],
    },
    {
      id: 'fb_day_c',
      name: 'Full Body C',
      shortName: 'Day C',
      exercises: [
        { exerciseId: 'front_squat', sets: 3, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'dips', sets: 3, reps: '8-15', restSeconds: 90 },
        { exerciseId: 'seated_cable_row', sets: 3, reps: '8-12', restSeconds: 90 },
        { exerciseId: 'lateral_raises', sets: 2, reps: '12-15', restSeconds: 60 },
        { exerciseId: 'romanian_deadlift', sets: 2, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'calf_raises', sets: 3, reps: '12-20', restSeconds: 60 },
      ],
    },
  ],
};

// Calculate FP distributions
FULL_BODY_TEMPLATE.days.forEach((day) => {});

// -----------------------------------------------------------------------------
// Template 4: Minimalist (2-day)
// For busy people, high ROI exercises, balanced but less frequent
// -----------------------------------------------------------------------------

const MINIMALIST_TEMPLATE: WorkoutTemplateDefinition = {
  id: 'minimalist_2day',
  name: 'Minimalist',
  description:
    '2-day program focused on compound movements. Maximum results with minimum time investment.',
  category: 'minimalist',
  daysPerWeek: 2,
  difficulty: 'beginner',
  estimatedDuration: 45,
  days: [
    {
      id: 'min_day_a',
      name: 'Day A',
      shortName: 'A',
      exercises: [
        { exerciseId: 'back_squat', sets: 4, reps: '5-10', restSeconds: 240 },
        { exerciseId: 'barbell_bench_press', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'barbell_row', sets: 4, reps: '6-10', restSeconds: 180 },
        { exerciseId: 'overhead_press', sets: 3, reps: '8-10', restSeconds: 120 },
        { exerciseId: 'plank', sets: 3, reps: '30-60s', restSeconds: 45 },
      ],
    },
    {
      id: 'min_day_b',
      name: 'Day B',
      shortName: 'B',
      exercises: [
        { exerciseId: 'deadlift', sets: 4, reps: '3-6', restSeconds: 300 },
        { exerciseId: 'leg_press', sets: 3, reps: '8-15', restSeconds: 120 },
        { exerciseId: 'pull_ups', sets: 4, reps: '6-12', restSeconds: 120 },
        { exerciseId: 'incline_dumbbell_press', sets: 3, reps: '8-12', restSeconds: 120 },
        { exerciseId: 'calf_raises', sets: 3, reps: '12-20', restSeconds: 60 },
      ],
    },
  ],
};

// Calculate FP distributions
MINIMALIST_TEMPLATE.days.forEach((day) => {});

// -----------------------------------------------------------------------------
// Template 5: Powerbuilding Home Edition (6-day)
// Dumbbell-only program by Nick Ludlow, adapted for home gym
// NordStick Bench Pro + Adjustable Dumbbells (15-85 lbs)
// -----------------------------------------------------------------------------

const POWERBUILDING_HOME_TEMPLATE: WorkoutTemplateDefinition = {
  id: 'powerbuilding_home_6day',
  name: 'Powerbuilding Home',
  description:
    '6-day dumbbell-only split by Nick Ludlow. Heavy compounds first (5x15 total), back-off AMQRAP, then rest-pause accessories.',
  category: 'ppl',
  daysPerWeek: 6,
  difficulty: 'advanced',
  estimatedDuration: 65,
  days: [
    {
      id: 'pb_push_a',
      name: 'Push A',
      shortName: 'Push A',
      exercises: [
        {
          exerciseId: 'db_floor_press',
          sets: 5,
          reps: '15 total',
          restSeconds: 90,
          notes: 'Heavy',
        },
        {
          exerciseId: 'db_floor_press',
          sets: 1,
          reps: 'AMQRAP',
          restSeconds: 90,
          notes: 'Back-off -20%',
        },
        {
          exerciseId: 'db_overhead_press',
          sets: 3,
          reps: '25 total',
          restSeconds: 60,
          notes: 'Seated',
        },
        { exerciseId: 'close_grip_db_floor_press', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'dumbbell_flyes', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'overhead_db_tricep_ext', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'lateral_raises', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
    {
      id: 'pb_pull_a',
      name: 'Pull A',
      shortName: 'Pull A',
      exercises: [
        { exerciseId: 'db_rdl', sets: 5, reps: '15 total', restSeconds: 90, notes: 'Heavy' },
        { exerciseId: 'db_rdl', sets: 1, reps: 'AMQRAP', restSeconds: 90, notes: 'Back-off -20%' },
        {
          exerciseId: 'db_bent_over_row',
          sets: 3,
          reps: '25 total',
          restSeconds: 60,
          notes: 'Supinated grip',
        },
        { exerciseId: 'incline_db_row', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'db_shrugs', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'standing_db_curl', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'bent_over_db_reverse_fly', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
    {
      id: 'pb_legs_a',
      name: 'Legs A',
      shortName: 'Legs A',
      exercises: [
        {
          exerciseId: 'db_goblet_squat',
          sets: 5,
          reps: '15 total',
          restSeconds: 90,
          notes: 'Heavy',
        },
        {
          exerciseId: 'db_goblet_squat',
          sets: 1,
          reps: 'AMQRAP',
          restSeconds: 90,
          notes: 'Back-off -20%',
        },
        { exerciseId: 'db_good_morning', sets: 3, reps: '25 total', restSeconds: 60 },
        { exerciseId: 'bulgarian_split_squat', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'nordic_curl', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'nordstick_hamstring_curl', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'db_standing_calf_raise', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
    {
      id: 'pb_push_b',
      name: 'Push B',
      shortName: 'Push B',
      exercises: [
        {
          exerciseId: 'db_overhead_press',
          sets: 5,
          reps: '15 total',
          restSeconds: 90,
          notes: 'Standing, heavy',
        },
        {
          exerciseId: 'db_overhead_press',
          sets: 1,
          reps: 'AMQRAP',
          restSeconds: 90,
          notes: 'Back-off -20%',
        },
        { exerciseId: 'incline_dumbbell_press', sets: 3, reps: '25 total', restSeconds: 60 },
        { exerciseId: 'close_grip_db_floor_press', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'dumbbell_flyes', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'db_kickbacks', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'lateral_raises', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
    {
      id: 'pb_pull_b',
      name: 'Pull B',
      shortName: 'Pull B',
      exercises: [
        {
          exerciseId: 'db_stiff_leg_deadlift',
          sets: 5,
          reps: '15 total',
          restSeconds: 90,
          notes: 'Wide stance',
        },
        {
          exerciseId: 'db_stiff_leg_deadlift',
          sets: 1,
          reps: 'AMQRAP',
          restSeconds: 90,
          notes: 'Back-off -20%',
        },
        {
          exerciseId: 'db_bent_over_row',
          sets: 3,
          reps: '25 total',
          restSeconds: 60,
          notes: 'Pronated grip',
        },
        { exerciseId: 'db_pullover', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'one_arm_db_row', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'incline_db_curl', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'prone_incline_reverse_fly', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
    {
      id: 'pb_legs_b',
      name: 'Legs B',
      shortName: 'Legs B',
      exercises: [
        {
          exerciseId: 'db_front_squat',
          sets: 5,
          reps: '15 total',
          restSeconds: 90,
          notes: 'Heavy',
        },
        {
          exerciseId: 'db_front_squat',
          sets: 1,
          reps: 'AMQRAP',
          restSeconds: 90,
          notes: 'Back-off -20%',
        },
        {
          exerciseId: 'db_rdl',
          sets: 3,
          reps: '25 total',
          restSeconds: 60,
          notes: 'Slow eccentric',
        },
        { exerciseId: 'db_hip_thrust', sets: 3, reps: '30 total', restSeconds: 60 },
        { exerciseId: 'db_lunges', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'db_sissy_squat', sets: 5, reps: '50 total', restSeconds: 30 },
        { exerciseId: 'lying_leg_raise', sets: 5, reps: '50 total', restSeconds: 15 },
      ],
    },
  ],
};

// Calculate FP distributions
POWERBUILDING_HOME_TEMPLATE.days.forEach((day) => {});

// -----------------------------------------------------------------------------
// Export All Templates
// -----------------------------------------------------------------------------

export const WORKOUT_TEMPLATES: WorkoutTemplateDefinition[] = [
  PPL_TEMPLATE,
  UPPER_LOWER_TEMPLATE,
  FULL_BODY_TEMPLATE,
  MINIMALIST_TEMPLATE,
  POWERBUILDING_HOME_TEMPLATE,
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

export function getTemplateById(id: string): WorkoutTemplateDefinition | undefined {
  return WORKOUT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByDaysPerWeek(days: number): WorkoutTemplateDefinition[] {
  return WORKOUT_TEMPLATES.filter((t) => t.daysPerWeek === days);
}

export function getTemplatesByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): WorkoutTemplateDefinition[] {
  return WORKOUT_TEMPLATES.filter((t) => t.difficulty === difficulty);
}
