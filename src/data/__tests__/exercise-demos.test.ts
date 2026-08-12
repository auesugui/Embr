// =============================================================================
// Exercise demos — id/asset coverage
// =============================================================================
// The demo lookup is filename-based, so a renamed exercise id silently drops its
// diagram and a stale entry silently 404s. These tests make both failures loud.

import fs from 'node:fs';
import path from 'node:path';

import { getExerciseDemoUri, hasExerciseDemo } from '../exercise-demos';
import { EXERCISE_DATABASE } from '../exercises';

const EXERCISE_IDS = new Set(EXERCISE_DATABASE.map((e) => e.id));

/**
 * Exercises that intentionally ship without a diagram.
 *
 * - `cable_crunch` — refused by the image model's content filter across three
 *   prompt rewrites.
 * - `bodyweight_squat` — added with AMRAP support; no rendered diagram yet.
 *   Reusing `back_squat.jpg` would show a loaded barbell for an unloaded
 *   movement, which is worse than no picture. `ExerciseDemo` renders nothing
 *   when a demo is absent, so this degrades cleanly.
 */
const KNOWN_MISSING = ['cable_crunch', 'bodyweight_squat'];

describe('exercise demos', () => {
  it('has a file on disk for every exercise it claims to cover', () => {
    // Filename-based lookup means a missing file is a silent 404 at runtime.
    const dir = path.join(__dirname, '../../../public/exercise-demos');
    const onDisk = new Set(
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.jpg'))
        .map((f) => f.replace(/\.jpg$/, ''))
    );

    const claimedButMissing = EXERCISE_DATABASE.filter(
      (e) => hasExerciseDemo(e.id) && !onDisk.has(e.id)
    ).map((e) => e.id);
    expect(claimedButMissing).toEqual([]);

    // And no stray assets for ids that aren't exercises any more.
    const orphans = [...onDisk].filter((id) => !EXERCISE_IDS.has(id));
    expect(orphans).toEqual([]);
  });

  it('covers every exercise except the known-missing ones', () => {
    const missing = EXERCISE_DATABASE.filter((e) => !hasExerciseDemo(e.id)).map((e) => e.id);
    expect(missing.sort()).toEqual([...KNOWN_MISSING].sort());
  });

  it('returns a public path for a covered exercise', () => {
    expect(getExerciseDemoUri('back_squat')).toBe('/exercise-demos/back_squat.jpg');
  });

  it('returns null rather than a broken path for an uncovered exercise', () => {
    expect(getExerciseDemoUri('cable_crunch')).toBeNull();
    expect(getExerciseDemoUri('not_a_real_exercise')).toBeNull();
  });
});
