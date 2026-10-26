// =============================================================================
// muscle-balance — sets per muscle for one week
// =============================================================================
// The three things worth getting wrong here: what counts as a performed set
// (holds do, cardio and empty rows do not), which muscle a set credits (the
// primary one, resolved by base id so a heavy and a back-off entry are one
// movement), and the week boundary, which is the Monday the weekly goal uses
// and not the one the UTC clock would pick.

import { type ExerciseDefinition, setCustomExercises } from '@/data';
import type { Exercise, LoggedSet, WorkoutLog } from '@/types';

import {
  COLLAPSED_ROWS,
  MUSCLE_ORDER,
  OTHER_GROUP,
  balanceReading,
  balanceReadingSegments,
  describeBalance,
  describeRow,
  muscleBalance,
  showAllLabel,
  visibleRows,
} from '../muscle-balance';

const set = (overrides: Partial<LoggedSet> = {}): LoggedSet => ({
  reps: 8,
  weight: 100,
  logged: true,
  isPR: false,
  isRepPR: false,
  ...overrides,
});

/** `count` performed sets of a library movement, at its session id. */
const lift = (id: string, count: number, name = id): Exercise =>
  ({
    id,
    name,
    muscleGroups: [],
    sets: Array.from({ length: count }, () => set()),
    restSeconds: 60,
  }) as unknown as Exercise;

let nextId = 0;

const log = (
  year: number,
  month: number,
  day: number,
  exercises: Exercise[],
  hour = 9,
  minute = 30
): WorkoutLog =>
  ({
    id: `log-${nextId++}`,
    timestamp: new Date(year, month - 1, day, hour, minute).toISOString(),
    claimedAt: new Date(year, month - 1, day, hour, minute).toISOString(),
    exercises,
  }) as unknown as WorkoutLog;

const unclaimed = (entry: WorkoutLog): WorkoutLog => ({ ...entry, claimedAt: null }) as WorkoutLog;

/** Friday 30 October 2026, inside the week of Mon 26 Oct to Sun 1 Nov. */
const TODAY = new Date(2026, 9, 30, 18, 0);

const balance = (logs: WorkoutLog[], now: Date = TODAY) => {
  const value = muscleBalance(logs, now);
  if (value === null) throw new Error('expected a balance');
  return value;
};

const counts = (logs: WorkoutLog[], now: Date = TODAY) =>
  balance(logs, now).rows.map((row) => [row.group, row.sets]);

const custom = (id: string, name: string, primaryMuscle: string): ExerciseDefinition =>
  ({
    id,
    name,
    muscleGroups: [primaryMuscle],
    primaryMuscle,
    movementPattern: 'isolation',
    equipment: ['bodyweight'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultRestSeconds: 90,
    isCompound: false,
    fpDistribution: {},
  }) as unknown as ExerciseDefinition;

afterEach(() => setCustomExercises([]));

describe('muscleBalance counting', () => {
  it('is null for someone with no saved workout', () => {
    expect(muscleBalance([], TODAY)).toBeNull();
    expect(
      muscleBalance([unclaimed(log(2026, 10, 28, [lift('back_squat-0', 3)]))], TODAY)
    ).toBeNull();
  });

  it('counts performed sets of claimed workouts in the week', () => {
    expect(counts([log(2026, 10, 28, [lift('back_squat-0', 4)])])).toEqual([['quads', 4]]);
  });

  it('ignores unlogged and empty sets', () => {
    const exercise = {
      id: 'back_squat-0',
      name: 'Back Squat',
      muscleGroups: [],
      restSeconds: 60,
      sets: [
        set(),
        set({ logged: false }),
        set({ reps: null, weight: null }),
        set({ reps: 0, weight: 0 }),
      ],
    } as unknown as Exercise;
    expect(counts([log(2026, 10, 28, [exercise])])).toEqual([['quads', 1]]);
  });

  it('counts a hold, where the seconds live in reps', () => {
    const plank = {
      id: 'plank-0',
      name: 'Plank',
      metric: 'time',
      muscleGroups: [],
      restSeconds: 60,
      sets: [set({ reps: 45, weight: null }), set({ reps: 60, weight: null })],
    } as unknown as Exercise;
    expect(counts([log(2026, 10, 28, [plank])])).toEqual([['core', 2]]);
  });

  it('leaves a cardio entry out entirely', () => {
    const run = {
      id: 'cardio-run',
      name: 'Run',
      muscleGroups: [],
      restSeconds: 0,
      cardio: { durationSeconds: 1800 },
      sets: [set()],
    } as unknown as Exercise;
    expect(muscleBalance([log(2026, 10, 28, [run])], TODAY)?.rows).toEqual([]);
  });

  it('leaves an unsaved workout out', () => {
    const logs = [
      log(2026, 10, 28, [lift('back_squat-0', 4)]),
      unclaimed(log(2026, 10, 29, [lift('barbell_bench_press-0', 5)])),
    ];
    expect(counts(logs)).toEqual([['quads', 4]]);
  });

  it('leaves last week out', () => {
    const logs = [
      log(2026, 10, 28, [lift('back_squat-0', 4)]),
      log(2026, 10, 22, [lift('barbell_bench_press-0', 5)]),
    ];
    expect(counts(logs)).toEqual([['quads', 4]]);
    expect(balance(logs).lastWeek).toEqual({ sets: 5, groups: 1 });
  });

  it('puts a Sunday 23:30 set in that week and a Monday 00:10 set in the next', () => {
    const sunday = log(2026, 10, 25, [lift('back_squat-0', 3)], 23, 30);
    const monday = log(2026, 10, 26, [lift('barbell_bench_press-0', 2)], 0, 10);
    // Reading the week of Sun 25 Oct: only the Sunday session is in it.
    expect(counts([sunday, monday], new Date(2026, 9, 25, 23, 45))).toEqual([['quads', 3]]);
    expect(counts([sunday, monday])).toEqual([['chest', 2]]);
  });

  it('labels the week Monday to Sunday', () => {
    const value = balance([log(2026, 10, 28, [lift('back_squat-0', 1)])]);
    expect(value.weekKey).toBe('2026-10-26');
    expect(value.range).toBe('Mon Oct 26 – Sun Nov 1');
    expect(value.rangeLong).toBe('Monday 26 October to Sunday 1 November');
  });
});

describe('muscleBalance muscle resolution', () => {
  it('credits the primary muscle of a library exercise', () => {
    // A row is back and not biceps; a bench press is chest and not triceps.
    expect(
      counts([log(2026, 10, 28, [lift('barbell_row-0', 3), lift('barbell_bench_press-1', 2)])])
    ).toEqual([
      ['back', 3],
      ['chest', 2],
    ]);
  });

  it('resolves a suffixed heavy and back-off entry to one muscle', () => {
    const logs = [log(2026, 10, 28, [lift('back_squat-0', 3), lift('back_squat-4', 2)])];
    expect(counts(logs)).toEqual([['quads', 5]]);
  });

  it('credits a custom exercise its own muscle', () => {
    setCustomExercises([custom('custom-zottman-curl', 'Zottman Curl', 'forearms')]);
    expect(counts([log(2026, 10, 28, [lift('custom-zottman-curl-0', 3)])])).toEqual([
      ['forearms', 3],
    ]);
  });

  it('sends a custom exercise with no usable muscle to Other', () => {
    // Today's form insists on a muscle; a restored backup can still carry one
    // outside MuscleGroup, since the hydrate check only asks for a string.
    setCustomExercises([custom('custom-sled-push', 'Sled Push', 'sled')]);
    const value = balance([log(2026, 10, 28, [lift('custom-sled-push-0', 4, 'Sled Push')])]);
    expect(value.rows.map((row) => [row.group, row.sets])).toEqual([[OTHER_GROUP, 4]]);
    expect(value.otherExercises).toEqual(['Sled Push']);
  });

  it('sends an exercise in neither the library nor the custom list to Other', () => {
    const value = balance([log(2026, 10, 28, [lift('bench_press-0', 2, 'Bench Press')])]);
    expect(value.rows.map((row) => [row.group, row.sets])).toEqual([[OTHER_GROUP, 2]]);
    expect(value.otherExercises).toEqual(['Bench Press']);
  });

  it('holds every unresolved exercise in one Other row', () => {
    const logs = [
      log(2026, 10, 28, [lift('sled-push-0', 2, 'Sled Push'), lift('yoke-walk-0', 3, 'Yoke Walk')]),
    ];
    const value = balance(logs);
    expect(value.rows).toHaveLength(1);
    expect(value.rows[0].sets).toBe(5);
    expect(value.otherExercises).toEqual(['Sled Push', 'Yoke Walk']);
  });
});

describe('muscleBalance ranking', () => {
  const week = (entries: [string, number][]) => [
    log(
      2026,
      10,
      28,
      entries.map(([id, count]) => lift(id, count))
    ),
  ];

  it('orders by sets, most first', () => {
    expect(
      counts(
        week([
          ['barbell_bench_press-0', 5],
          ['back_squat-0', 9],
          ['barbell_row-0', 7],
        ])
      )
    ).toEqual([
      ['quads', 9],
      ['back', 7],
      ['chest', 5],
    ]);
  });

  it('breaks a tie by the fixed muscle order, not by what was logged first', () => {
    const rows = counts(
      week([
        ['back_squat-0', 4],
        ['overhead_press-0', 4],
        ['barbell_row-0', 4],
        ['barbell_bench_press-0', 4],
        ['cable_crunch-0', 1],
      ])
    );
    expect(rows).toEqual([
      ['chest', 4],
      ['back', 4],
      ['shoulders', 4],
      ['quads', 4],
      ['core', 1],
    ]);
  });

  it('declares the tie order the frames are drawn in', () => {
    expect(MUSCLE_ORDER).toEqual([
      'chest',
      'back',
      'shoulders',
      'quads',
      'hamstrings',
      'glutes',
      'biceps',
      'triceps',
      'core',
      'traps',
      'calves',
      'forearms',
    ]);
  });

  it('pins Other last even when it is the largest', () => {
    const rows = counts(
      week([
        ['back_squat-0', 3],
        ['sled-push-0', 20],
      ])
    );
    expect(rows).toEqual([
      ['quads', 3],
      [OTHER_GROUP, 20],
    ]);
  });

  it('scales the share to the largest count on the card', () => {
    const rows = balance(
      week([
        ['back_squat-0', 24],
        ['barbell_bench_press-0', 6],
        ['calf_raises-0', 1],
      ])
    ).rows;
    expect(rows.map((row) => row.share)).toEqual([1, 0.25, 1 / 24]);
    expect(rows.map((row) => row.top)).toEqual([true, false, false]);
  });

  it('marks every muscle level at the top as the top', () => {
    const rows = balance(
      week([
        ['back_squat-0', 4],
        ['barbell_bench_press-0', 4],
        ['calf_raises-0', 1],
      ])
    ).rows;
    expect(rows.map((row) => row.top)).toEqual([true, true, false]);
  });

  it('names the untrained muscles in the fixed order', () => {
    const value = balance(week([['barbell_bench_press-0', 5]]));
    expect(value.untrained).toEqual(MUSCLE_ORDER.filter((muscle) => muscle !== 'chest'));
    expect(value.total).toBe(5);
  });
});

describe('visibleRows', () => {
  const rows = (count: number, other = false) =>
    balance([
      log(2026, 10, 28, [
        ...[
          'back_squat-0',
          'barbell_bench_press-0',
          'barbell_row-0',
          'overhead_press-0',
          'barbell_curl-0',
          'romanian_deadlift-0',
          'cable_crunch-0',
        ]
          .slice(0, count)
          .map((id, index) => lift(id, 20 - index)),
        ...(other ? [lift('sled-push-0', 4, 'Sled Push')] : []),
      ]),
    ]).rows;

  it('shows every row when there are no more than five', () => {
    const five = rows(5);
    expect(visibleRows(five, false)).toHaveLength(COLLAPSED_ROWS);
    expect(visibleRows(five, false)).toEqual(five);
  });

  it('shows five of seven collapsed and all of them expanded', () => {
    const seven = rows(7);
    expect(visibleRows(seven, false)).toHaveLength(COLLAPSED_ROWS);
    expect(visibleRows(seven, true)).toHaveLength(7);
    expect(showAllLabel(seven)).toBe('Show all 7');
  });

  it('keeps Other in the last collapsed slot rather than hiding it', () => {
    const withOther = rows(6, true);
    const shown = visibleRows(withOther, false);
    expect(shown).toHaveLength(COLLAPSED_ROWS);
    expect(shown[COLLAPSED_ROWS - 1].group).toBe(OTHER_GROUP);
    // The fifth muscle is behind Show all, below Other in the full list.
    expect(withOther[withOther.length - 1].group).toBe(OTHER_GROUP);
  });
});

describe('the reading line', () => {
  const reading = (logs: WorkoutLog[], now: Date = TODAY) => balanceReading(balance(logs, now));
  const week = (entries: [string, number, string?][]) => [
    log(
      2026,
      10,
      28,
      entries.map(([id, count, name]) => lift(id, count, name))
    ),
  ];

  it('names the leader and the trail, then what has nothing', () => {
    expect(
      reading(
        week([
          ['barbell_row-0', 14],
          ['barbell_bench_press-0', 12],
          ['back_squat-0', 10],
          ['overhead_press-0', 9],
          ['tricep_pushdowns-0', 8],
          ['barbell_curl-0', 6],
          ['romanian_deadlift-0', 5],
          ['cable_crunch-0', 4],
          ['hip_thrust-0', 3],
          ['calf_raises-0', 2],
        ])
      )
    ).toBe(
      '73 sets this week. Back leads at 14, calves trail at 2. Nothing yet for traps or forearms.'
    );
  });

  it('says nothing yet on a Monday with an empty week, with last week to compare against', () => {
    const logs = [log(2026, 10, 21, [lift('back_squat-0', 5), lift('barbell_row-0', 4)])];
    expect(reading(logs)).toBe(
      'No sets yet this week. Last week you logged 9 sets across 2 muscles.'
    );
  });

  it('drops the last-week sentence when last week was empty too', () => {
    expect(reading([log(2026, 10, 10, [lift('back_squat-0', 5)])])).toBe('No sets yet this week.');
  });

  it('writes last week in the singular', () => {
    const logs = [log(2026, 10, 21, [lift('back_squat-0', 1)])];
    expect(reading(logs)).toBe(
      'No sets yet this week. Last week you logged 1 set across 1 muscle.'
    );
  });

  it('says all of one muscle when only one was trained', () => {
    expect(reading(week([['barbell_bench_press-0', 5]]))).toBe(
      '5 sets this week, all chest. Nothing yet for back, shoulders, quads, hamstrings, glutes, biceps, triceps, core, traps, calves or forearms.'
    );
  });

  it('writes a single set in the singular', () => {
    expect(reading(week([['barbell_bench_press-0', 1]]))).toContain('1 set this week, all chest.');
  });

  it('calls a tie at the top a tie', () => {
    expect(
      reading(
        week([
          ['barbell_bench_press-0', 4],
          ['barbell_row-0', 4],
          ['overhead_press-0', 4],
          ['back_squat-0', 4],
          ['cable_crunch-0', 2],
        ])
      )
    ).toBe(
      '18 sets this week, four muscles level at 4. Nothing yet for hamstrings, glutes, biceps, triceps, traps, calves or forearms.'
    );
  });

  it('carries the ratio in words on a lopsided week', () => {
    expect(
      reading(
        week([
          ['barbell_row-0', 24],
          ['barbell_bench_press-0', 7],
          ['back_squat-0', 5],
          ['tricep_pushdowns-0', 3],
          ['barbell_curl-0', 2],
          ['calf_raises-0', 1],
        ])
      )
    ).toBe(
      '42 sets this week. Back at 24 is more than three times the next muscle. Calves have 1. Nothing yet for shoulders, hamstrings, glutes, core, traps or forearms.'
    );
  });

  it('names the exercise behind Other when one accounts for it', () => {
    expect(
      reading(
        week([
          ['barbell_row-0', 9],
          ['barbell_bench_press-0', 8],
          ['back_squat-0', 6],
          ['overhead_press-0', 5],
          ['barbell_curl-0', 3],
          ['calf_raises-0', 1],
          ['sled-push-0', 4, 'Sled Push'],
        ])
      )
    ).toBe(
      '36 sets this week. 4 of them are in Other, from Sled Push, which has no muscle set. Nothing yet for hamstrings, glutes, triceps, core, traps or forearms.'
    );
  });

  it('counts the exercises behind Other when there is more than one', () => {
    expect(
      reading(
        week([
          ['barbell_row-0', 9],
          ['sled-push-0', 2, 'Sled Push'],
          ['yoke-walk-0', 1, 'Yoke Walk'],
          ['tyre-flip-0', 1, 'Tyre Flip'],
        ])
      )
    ).toContain('4 of them are in Other, from 3 exercises with no muscle set.');
  });

  it('writes one set in Other in the singular', () => {
    expect(
      reading(
        week([
          ['barbell_row-0', 9],
          ['sled-push-0', 1, 'Sled Push'],
        ])
      )
    ).toContain('1 of them is in Other, from Sled Push, which has no muscle set.');
  });

  it('drops the nothing-yet sentence when every muscle has been trained', () => {
    setCustomExercises([custom('custom-wrist-curl', 'Wrist Curl', 'forearms')]);
    const every = week([
      ['barbell_bench_press-0', 12],
      ['barbell_row-0', 11],
      ['overhead_press-0', 10],
      ['back_squat-0', 9],
      ['romanian_deadlift-0', 8],
      ['hip_thrust-0', 7],
      ['barbell_curl-0', 6],
      ['tricep_pushdowns-0', 5],
      ['cable_crunch-0', 4],
      ['shrugs-0', 3],
      ['calf_raises-0', 2],
      ['custom-wrist-curl-0', 1],
    ]);
    expect(balance(every).untrained).toEqual([]);
    expect(reading(every)).toBe('78 sets this week. Chest leads at 12, forearms trail at 1.');
  });

  it('sets the figures apart from the words', () => {
    const segments = balanceReadingSegments(
      balance(
        week([
          ['barbell_row-0', 6],
          ['barbell_bench_press-0', 4],
        ])
      )
    );
    expect(segments.filter((segment) => segment.strong).map((segment) => segment.text)).toEqual([
      '10 sets',
      '6',
      '4',
    ]);
    expect(new Set(segments.map((segment) => segment.id)).size).toBe(segments.length);
  });
});

describe('spoken labels', () => {
  const week = (entries: [string, number, string?][]) => [
    log(
      2026,
      10,
      28,
      entries.map(([id, count, name]) => lift(id, count, name))
    ),
  ];

  it('announces the card as a summary, with no bar length in it', () => {
    const value = balance(
      week([
        ['barbell_row-0', 14],
        ['barbell_bench_press-0', 12],
      ])
    );
    expect(describeBalance(value)).toBe(
      'Sets per muscle, Monday 26 October to Sunday 1 November. 26 sets across 2 muscles.'
    );
  });

  it('announces an empty week without rows', () => {
    const value = balance([log(2026, 10, 21, [lift('back_squat-0', 2)])]);
    expect(describeBalance(value)).toBe(
      'Sets per muscle, Monday 26 October to Sunday 1 November. No sets yet this week.'
    );
  });

  it('announces a row as a name and a count, and marks the leader', () => {
    const rows = balance(
      week([
        ['barbell_row-0', 14],
        ['barbell_bench_press-0', 1],
        ['sled-push-0', 4, 'Sled Push'],
      ])
    ).rows;
    expect(rows.map(describeRow)).toEqual([
      'Back, 14 sets, most this week',
      'Chest, 1 set',
      'Other, 4 sets, exercises with no muscle set',
    ]);
  });
});
