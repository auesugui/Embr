// =============================================================================
// exercise-filter — the picker's Recent row and chips (issue #83)
// =============================================================================
// Three rules are being pinned: what counts as recent and in what order, how
// the chips combine with the search text, and which of the three empty states
// an empty list is.

import { type ExerciseDefinition, getExerciseById, setCustomExercises } from '@/data';
import type { Exercise, LoggedSet, WorkoutLog } from '@/types';

import {
  type ExerciseFilter,
  NO_FILTER,
  describeEmptyPicker,
  filterExercises,
  filterMuscles,
  isNarrowed,
  matchesChips,
  recentExercises,
  showCountLabel,
} from '../exercise-filter';

const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-10-25T18:00:00.000Z');

/** `daysAgo` before the fixed start, as an ISO timestamp. */
const at = (daysAgo: number): string => new Date(START - daysAgo * DAY_MS).toISOString();

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 10,
  weight: 135,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...over,
});

const entry = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  muscleGroups: [],
  sets: [set()],
  restSeconds: 90,
  completed: true,
  ...over,
});

const log = (timestamp: string, exercises: Exercise[], claimed = true): WorkoutLog =>
  ({
    id: timestamp,
    timestamp,
    exercises,
    durationSeconds: 1800,
    streakDays: 1,
    sessionIntent: 'normal',
    claimedAt: claimed ? timestamp : null,
  }) as WorkoutLog;

const custom = (over: Partial<ExerciseDefinition> = {}): ExerciseDefinition => ({
  id: 'custom-copenhagen-plank',
  name: 'Copenhagen Plank',
  muscleGroups: ['core'],
  primaryMuscle: 'core',
  movementPattern: 'core',
  equipment: ['bodyweight'],
  defaultSets: 3,
  defaultReps: '8-12',
  defaultRestSeconds: 90,
  isCompound: false,
  fpDistribution: {},
  ...over,
});

/** The built-in library, which is what the picker shows when nothing is custom. */
const library = (extra: ExerciseDefinition[] = []): ExerciseDefinition[] => {
  const ids = [
    'barbell_bench_press',
    'back_squat',
    'deadlift',
    'lat_pulldown',
    'overhead_press',
    'barbell_curl',
    'plank',
    'kettlebell_swing',
  ];
  const found = ids.map((id) => getExerciseById(id) as ExerciseDefinition);
  return [...extra, ...found];
};

const recents = (logs: WorkoutLog[], over: Partial<Parameters<typeof recentExercises>[0]> = {}) =>
  recentExercises({
    logs,
    library: library(),
    excludeIds: new Set<string>(),
    ...over,
  }).map((e) => e.id);

const filter = (over: Partial<ExerciseFilter> = {}): ExerciseFilter => ({ ...NO_FILTER, ...over });

afterEach(() => setCustomExercises([]));

// -----------------------------------------------------------------------------
// Recents
// -----------------------------------------------------------------------------

describe('recentExercises', () => {
  it('reads distinct movements, newest workout first', () => {
    const logs = [
      log(at(1), [entry('back_squat-0'), entry('plank-1')]),
      log(at(4), [entry('barbell_bench_press-0')]),
    ];
    expect(recents(logs)).toEqual(['back_squat', 'plank', 'barbell_bench_press']);
  });

  it('collapses a movement logged twice, and the positional suffix with it', () => {
    const logs = [
      log(at(1), [entry('back_squat-0'), entry('back_squat-3')]),
      log(at(4), [entry('back_squat-0'), entry('deadlift-1')]),
    ];
    expect(recents(logs)).toEqual(['back_squat', 'deadlift']);
  });

  it('stops at six', () => {
    const logs = [
      log(at(1), [
        entry('back_squat-0'),
        entry('deadlift-1'),
        entry('plank-2'),
        entry('lat_pulldown-3'),
        entry('overhead_press-4'),
        entry('barbell_curl-5'),
        entry('barbell_bench_press-6'),
      ]),
    ];
    expect(recents(logs)).toHaveLength(6);
    expect(recents(logs)).not.toContain('barbell_bench_press');
  });

  it('takes six eligible ones: an excluded id does not spend a slot', () => {
    const logs = [
      log(at(1), [
        entry('back_squat-0'),
        entry('deadlift-1'),
        entry('plank-2'),
        entry('lat_pulldown-3'),
        entry('overhead_press-4'),
        entry('barbell_curl-5'),
        entry('barbell_bench_press-6'),
      ]),
    ];
    const got = recents(logs, { excludeIds: new Set(['plank']) });
    expect(got).toHaveLength(6);
    expect(got).not.toContain('plank');
    expect(got).toContain('barbell_bench_press');
  });

  it('skips a movement that is no longer in the library', () => {
    const logs = [log(at(1), [entry('custom-deleted-thing-0'), entry('back_squat-1')])];
    expect(recents(logs)).toEqual(['back_squat']);
  });

  it('includes a custom exercise the library still carries', () => {
    const own = custom();
    const logs = [log(at(1), [entry(`${own.id}-0`)])];
    expect(recents(logs, { library: library([own]) })).toEqual([own.id]);
  });

  it('is empty with no history, and ignores an unclaimed workout', () => {
    expect(recents([])).toEqual([]);
    expect(recents([log(at(1), [entry('back_squat-0')], false)])).toEqual([]);
  });

  it('ignores an entry with nothing performed, and keeps the older workout that has it', () => {
    const empty = [set({ reps: null, weight: null }), set({ reps: 0, weight: 0, logged: true })];
    const logs = [
      log(at(1), [entry('back_squat-0', { sets: empty })]),
      log(at(4), [entry('back_squat-0')]),
    ];
    expect(recents(logs)).toEqual(['back_squat']);
  });

  it('leaves cardio entries out', () => {
    const logs = [
      log(at(1), [
        entry('treadmill-0', { sets: [], cardio: { durationSeconds: 600 } }),
        entry('back_squat-1'),
      ]),
    ];
    expect(recents(logs)).toEqual(['back_squat']);
  });
});

// -----------------------------------------------------------------------------
// Chips
// -----------------------------------------------------------------------------

describe('matchesChips', () => {
  const squat = getExerciseById('back_squat') as ExerciseDefinition;
  const rdl = getExerciseById('romanian_deadlift') as ExerciseDefinition;

  it('matches everything with no chip on', () => {
    expect(matchesChips(squat, filter())).toBe(true);
  });

  it('filters on primaryMuscle alone', () => {
    expect(matchesChips(squat, filter({ muscle: 'quads' }))).toBe(true);
    expect(matchesChips(squat, filter({ muscle: 'chest' }))).toBe(false);
  });

  it('ORs within equipment, and a multi-equipment exercise matches any of them', () => {
    expect(matchesChips(rdl, filter({ equipment: ['dumbbell'] }))).toBe(true);
    expect(matchesChips(rdl, filter({ equipment: ['barbell'] }))).toBe(true);
    expect(matchesChips(rdl, filter({ equipment: ['cable', 'barbell'] }))).toBe(true);
    expect(matchesChips(rdl, filter({ equipment: ['kettlebell'] }))).toBe(false);
  });

  it('ANDs muscle with equipment', () => {
    expect(matchesChips(squat, filter({ muscle: 'quads', equipment: ['barbell'] }))).toBe(true);
    expect(matchesChips(squat, filter({ muscle: 'quads', equipment: ['cable'] }))).toBe(false);
    expect(matchesChips(squat, filter({ muscle: 'back', equipment: ['barbell'] }))).toBe(false);
  });
});

describe('filterExercises', () => {
  const ids = (f: ExerciseFilter, exclude: string[] = []) =>
    filterExercises(f, new Set(exclude)).map((e) => e.id);

  it('ANDs the search text with the chips', () => {
    const pressed = ids(filter({ query: 'press', muscle: 'chest' }));
    expect(pressed).toContain('barbell_bench_press');
    // Overhead Press matches the text and is a shoulders exercise.
    expect(pressed).not.toContain('overhead_press');

    const barbellOnly = ids(filter({ query: 'press', muscle: 'chest', equipment: ['barbell'] }));
    expect(barbellOnly).toEqual(['barbell_bench_press']);
  });

  it('comes back when a filter is cleared', () => {
    expect(ids(filter({ muscle: 'calves', equipment: ['kettlebell'] }))).toEqual([]);
    expect(ids(filter({ muscle: 'calves' })).length).toBeGreaterThan(0);
    expect(ids(filter({ equipment: ['kettlebell'] })).length).toBeGreaterThan(0);
  });

  it('still hides the ids it was told to hide', () => {
    expect(ids(filter({ query: 'back squat' }))).toEqual(['back_squat']);
    expect(ids(filter({ query: 'back squat' }), ['back_squat'])).toEqual([]);
  });

  it('filters a custom exercise on the fields it carries', () => {
    setCustomExercises([custom()]);
    expect(ids(filter({ muscle: 'core', equipment: ['bodyweight'] }))).toContain(
      'custom-copenhagen-plank'
    );
    expect(ids(filter({ muscle: 'core', equipment: ['barbell'] }))).not.toContain(
      'custom-copenhagen-plank'
    );
  });
});

describe('filterMuscles', () => {
  it('is library order, and offers no chip nothing is filed under', () => {
    const muscles = filterMuscles(library());
    expect(muscles).toEqual(['chest', 'back', 'shoulders', 'biceps', 'quads', 'glutes', 'core']);
    expect(muscles).not.toContain('forearms');
  });
});

describe('isNarrowed', () => {
  it('is true for a chip or a search, false for the sheet as it opens', () => {
    expect(isNarrowed(filter())).toBe(false);
    expect(isNarrowed(filter({ muscle: 'chest' }))).toBe(true);
    expect(isNarrowed(filter({ equipment: ['cable'] }))).toBe(true);
    expect(isNarrowed(filter({ query: 'press' }))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Copy
// -----------------------------------------------------------------------------

describe('showCountLabel', () => {
  it('counts in the singular and the plural', () => {
    expect(showCountLabel(1)).toBe('Show 1 exercise');
    expect(showCountLabel(31)).toBe('Show 31 exercises');
    expect(showCountLabel(0)).toBe('Show 0 exercises');
  });
});

describe('describeEmptyPicker', () => {
  const squat = getExerciseById('back_squat') as ExerciseDefinition;

  it('names the combination that failed', () => {
    expect(
      describeEmptyPicker({
        filter: filter({ muscle: 'calves', equipment: ['kettlebell'] }),
        named: undefined,
      })
    ).toEqual({
      line: 'No calves exercise uses a kettlebell.',
      hint: 'Drop one filter and the list comes back.',
      canClear: true,
    });
  });

  it('names the typed text too, and lists equipment as an either/or', () => {
    const { line } = describeEmptyPicker({
      filter: filter({ muscle: 'back', query: 'sled row', equipment: ['cable', 'bodyweight'] }),
      named: undefined,
    });
    expect(line).toBe('No back exercise named “sled row” uses a cable or bodyweight.');
  });

  it('offers no Clear filters when only the search text is narrowing', () => {
    expect(
      describeEmptyPicker({ filter: filter({ query: 'sled row' }), named: undefined })
    ).toEqual({ line: 'No exercise named “sled row”.', hint: null, canClear: false });
  });

  it('says which filter is hiding a name that is in the library', () => {
    const { line, canClear } = describeEmptyPicker({
      filter: filter({ muscle: 'quads', query: 'back squat', equipment: ['kettlebell'] }),
      named: squat,
    });
    expect(line).toBe('Back Squat is in your library. Your kettlebell filter is hiding it.');
    expect(canClear).toBe(true);
  });

  it('names both filters when both of them hide it', () => {
    const { line } = describeEmptyPicker({
      filter: filter({ muscle: 'chest', query: 'back squat', equipment: ['kettlebell'] }),
      named: squat,
    });
    expect(line).toBe(
      'Back Squat is in your library. Your chest and kettlebell filters are hiding it.'
    );
  });

  it('says it is already in the day when no chip is hiding it', () => {
    expect(describeEmptyPicker({ filter: filter({ query: 'back squat' }), named: squat })).toEqual({
      line: 'Back Squat is already in this day.',
      hint: null,
      canClear: false,
    });
  });

  it('answers the unfiltered sheet with nothing left to add', () => {
    expect(describeEmptyPicker({ filter: filter(), named: undefined })).toEqual({
      line: 'No exercises left to add.',
      hint: null,
      canClear: false,
    });
  });
});
