// =============================================================================
// Exercise Demos — mannequin form diagrams
// =============================================================================
// Two-panel stills (start position / end position) for each exercise, rendered
// as a featureless artist's mannequin so the joint angles read without the
// distraction of a person. Generated via Higgsfield (GPT Image 2); source PNGs
// and the prompt recipe live in docs/03-workout-tracker/exercise-demo-refs/.
//
// These are DEMOS, not coaching. They were reviewed by eye, not by a coach, and
// AI image models get joint angles approximately right at best — depth on the
// squat, bar path on the deadlift. Good enough to answer "which movement is
// this again?" at the rack; not good enough to learn a lift from. The UI labels
// them accordingly and must keep doing so.
//
// Served from public/ rather than bundled: ~4 MB across 62 files would be dead
// weight in the JS bundle, and the web build streams them on demand. That does
// mean they are unavailable offline until the browser has cached them.

/** Exercise ids that have a demo image. Filenames match the id exactly. */
const EXERCISE_DEMO_IDS = new Set<string>([
  'back_squat',
  'barbell_bench_press',
  'barbell_curl',
  'barbell_row',
  'bent_over_db_reverse_fly',
  'bulgarian_split_squat',
  'cable_crossover',
  'calf_raises',
  'close_grip_db_floor_press',
  'db_bent_over_row',
  'db_floor_press',
  'db_front_squat',
  'db_goblet_squat',
  'db_good_morning',
  'db_hip_thrust',
  'db_kickbacks',
  'db_lunges',
  'db_overhead_press',
  'db_pullover',
  'db_rdl',
  'db_shrugs',
  'db_sissy_squat',
  'db_standing_calf_raise',
  'db_stiff_leg_deadlift',
  'deadlift',
  'dips',
  'dumbbell_curl',
  'dumbbell_flyes',
  'dumbbell_shoulder_press',
  'face_pulls',
  'front_raises',
  'front_squat',
  'hammer_curl',
  'hanging_leg_raise',
  'hip_thrust',
  'incline_db_curl',
  'incline_db_row',
  'incline_dumbbell_press',
  'lat_pulldown',
  'lateral_raises',
  'leg_curl',
  'leg_extension',
  'leg_press',
  'lying_leg_raise',
  'nordic_curl',
  'nordstick_hamstring_curl',
  'one_arm_db_row',
  'overhead_db_tricep_ext',
  'overhead_press',
  'plank',
  'prone_incline_reverse_fly',
  'pull_ups',
  'push_ups',
  'rear_delt_flyes',
  'romanian_deadlift',
  'russian_twist',
  'seated_cable_row',
  'shrugs',
  'skull_crushers',
  'standing_db_curl',
  'tricep_pushdowns',
  'walking_lunges',
]);

/**
 * Public path for an exercise's demo image, or null when there isn't one.
 * Callers must handle null — coverage is 62/63 (cable_crunch was refused by
 * the image model's content filter across three attempts).
 */
export function getExerciseDemoUri(exerciseId: string): string | null {
  return EXERCISE_DEMO_IDS.has(exerciseId) ? `/exercise-demos/${exerciseId}.jpg` : null;
}

export function hasExerciseDemo(exerciseId: string): boolean {
  return EXERCISE_DEMO_IDS.has(exerciseId);
}
