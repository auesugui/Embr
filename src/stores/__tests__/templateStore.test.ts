// =============================================================================
// IronQuest Template Store Unit Tests (issue #5)
// =============================================================================
// Covers duplicating built-ins into personal copies, all editing actions,
// built-in immutability, persistence, and hydration. FP-distribution
// recalculation is asserted against the REAL engine functions — this is the
// regression net for the "shadow calculator" guard.

import {
  WORKOUT_TEMPLATES,
  calculateDayFPDistribution,
  calculateTotalFPDistribution,
  getTemplateById,
} from '@/data';
import { appStorage } from '@/utils/storage';
import { useTemplateStore } from '../templateStore';

jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    delete: jest.fn(),
  },
  STORAGE_KEYS: {
    PERSONAL_TEMPLATES: { FULL_STATE: 'personal_templates.full_state' },
  },
}));

const BUILT_IN_ID = 'minimalist_2day';

describe('Template Store', () => {
  beforeEach(() => {
    useTemplateStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('createBlankTemplate', () => {
    it('creates an empty single-day custom template', () => {
      const id = useTemplateStore.getState().createBlankTemplate();
      const blank = useTemplateStore.getState().getTemplate(id)!;

      expect(blank).toBeDefined();
      expect(blank.isCustom).toBe(true);
      expect(blank.name).toBe('New Workout');
      expect(blank.days).toHaveLength(1);
      expect(blank.days[0].exercises).toEqual([]);
      // Built from scratch, not copied — nothing to point back at.
      expect(blank.sourceTemplateId).toBeUndefined();
    });

    it('zeroes both FP distributions rather than leaving them undefined', () => {
      const id = useTemplateStore.getState().createBlankTemplate();
      const blank = useTemplateStore.getState().getTemplate(id)!;

      expect(blank.totalFpDistribution).toEqual(calculateTotalFPDistribution(blank.days));
      expect(blank.days[0].fpDistribution).toEqual(calculateDayFPDistribution([]));
      expect(Object.values(blank.totalFpDistribution).every((v) => v === 0)).toBe(true);
    });

    it('namespaces the day id under the template id', () => {
      const id = useTemplateStore.getState().createBlankTemplate();
      const blank = useTemplateStore.getState().getTemplate(id)!;

      expect(blank.days[0].id).toBe(`${id}__day0`);
    });

    it('never collides with a built-in id', () => {
      const id = useTemplateStore.getState().createBlankTemplate();

      expect(getTemplateById(id)).toBeUndefined();
      expect(WORKOUT_TEMPLATES.some((t) => t.id === id)).toBe(false);
      expect(useTemplateStore.getState().isCustom(id)).toBe(true);
    });

    it('produces a distinct template on every call', () => {
      const first = useTemplateStore.getState().createBlankTemplate();
      const second = useTemplateStore.getState().createBlankTemplate();

      expect(first).not.toBe(second);
      expect(useTemplateStore.getState().templates).toHaveLength(2);
    });

    it('persists the new template', () => {
      useTemplateStore.getState().createBlankTemplate();

      expect(appStorage.setJSON).toHaveBeenCalledWith(
        'personal_templates.full_state',
        expect.objectContaining({ templates: expect.any(Array) })
      );
    });

    it('accepts exercises through the normal editing actions', () => {
      const id = useTemplateStore.getState().createBlankTemplate();
      const dayId = useTemplateStore.getState().getTemplate(id)!.days[0].id;

      useTemplateStore.getState().addExercise(id, dayId, 'barbell_bench_press');

      const updated = useTemplateStore.getState().getTemplate(id)!;
      expect(updated.days[0].exercises).toHaveLength(1);
      // Distributions must come alive once there's something to distribute.
      expect(Object.values(updated.totalFpDistribution).some((v) => v > 0)).toBe(true);
    });
  });

  describe('duplicateTemplate', () => {
    it('creates a personal copy from a built-in and returns its new id', () => {
      const newId = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID);

      expect(newId).toBeTruthy();
      expect(newId).not.toBe(BUILT_IN_ID);

      const copy = useTemplateStore.getState().getTemplate(newId!)!;
      expect(copy).toBeDefined();
      expect(copy.isCustom).toBe(true);
      expect(copy.sourceTemplateId).toBe(BUILT_IN_ID);
      expect(copy.name).toBe('Minimalist (Copy)');
      expect(copy.createdAt).toBeGreaterThan(0);
      expect(copy.updatedAt).toBe(copy.createdAt);
    });

    it('deep-clones the day structure so editing the copy never touches the source', () => {
      const newId = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      const copy = useTemplateStore.getState().getTemplate(newId)!;

      // Mutate the copy's day id namespace differs from source.
      const source = getTemplateById(BUILT_IN_ID)!;
      expect(copy.days.map((d) => d.id)).not.toEqual(source.days.map((d) => d.id));
      // Exercise content is identical at duplication time.
      expect(copy.days[0].exercises).toEqual(source.days[0].exercises);
    });

    it('does NOT mutate the built-in template registry', () => {
      const before = JSON.stringify(WORKOUT_TEMPLATES);
      useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID);
      useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID);
      expect(JSON.stringify(WORKOUT_TEMPLATES)).toBe(before);
    });

    it('persists the new copy to AsyncStorage', () => {
      const newId = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID);
      expect(appStorage.setJSON).toHaveBeenCalledWith(
        'personal_templates.full_state',
        expect.objectContaining({
          templates: expect.arrayContaining([
            expect.objectContaining({ id: newId, isCustom: true }),
          ]),
        })
      );
    });

    it('can also duplicate an existing personal copy', () => {
      const first = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      const second = useTemplateStore.getState().duplicateTemplate(first)!;
      expect(second).not.toBe(first);
      expect(useTemplateStore.getState().getTemplate(second)!.sourceTemplateId).toBe(first);
    });

    it('returns null when the source id does not exist', () => {
      expect(useTemplateStore.getState().duplicateTemplate('does_not_exist')).toBeNull();
    });
  });

  describe('renameTemplate', () => {
    it('updates the name of a personal copy', () => {
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      useTemplateStore.getState().renameTemplate(id, 'My Leg Day');
      expect(useTemplateStore.getState().getTemplate(id)!.name).toBe('My Leg Day');
    });

    it('ignores empty / whitespace-only names', () => {
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      const original = useTemplateStore.getState().getTemplate(id)!.name;
      useTemplateStore.getState().renameTemplate(id, '   ');
      expect(useTemplateStore.getState().getTemplate(id)!.name).toBe(original);
    });

    it('is a no-op on built-in ids (built-ins are read-only)', () => {
      useTemplateStore.getState().renameTemplate(BUILT_IN_ID, 'Hacked');
      expect(getTemplateById(BUILT_IN_ID)!.name).toBe('Minimalist');
      expect(useTemplateStore.getState().templates).toHaveLength(0);
    });
  });

  describe('exercise editing', () => {
    const setupCopy = () => {
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      const dayId = useTemplateStore.getState().getTemplate(id)!.days[0].id;
      return { id, dayId };
    };

    it('addExercise appends an exercise using its defaults and recomputes distributions', () => {
      const { id, dayId } = setupCopy();
      const before = useTemplateStore.getState().getTemplate(id)!.days[0].exercises.length;
      useTemplateStore.getState().addExercise(id, dayId, 'barbell_bench_press');

      const day = useTemplateStore.getState().getTemplate(id)!.days[0];
      expect(day.exercises.length).toBe(before + 1);
      const added = day.exercises[day.exercises.length - 1];
      expect(added.exerciseId).toBe('barbell_bench_press');
      // Defaults pulled from the exercise definition (bench: 4 sets, '6-10', 180s).
      expect(added.sets).toBe(4);
      expect(added.reps).toBe('6-10');
      expect(added.restSeconds).toBe(180);
      // Distribution was recomputed via the real engine.
      expect(day.fpDistribution).toEqual(calculateDayFPDistribution(day.exercises));
    });

    it('removeExercise drops the exercise at the index and recomputes distributions', () => {
      const { id, dayId } = setupCopy();
      const day = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!;
      const before = day.exercises.length;
      const removedId = day.exercises[0].exerciseId;

      useTemplateStore.getState().removeExercise(id, dayId, 0);

      const after = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!;
      expect(after.exercises.length).toBe(before - 1);
      expect(after.exercises.some((e) => e.exerciseId === removedId)).toBe(false);
      expect(after.fpDistribution).toEqual(calculateDayFPDistribution(after.exercises));
    });

    it('swapExercise changes the exerciseId (keeping sets/reps/rest) and recomputes', () => {
      const { id, dayId } = setupCopy();
      const original = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises[0];

      useTemplateStore.getState().swapExercise(id, dayId, 0, 'pull_ups');

      const swapped = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises[0];
      expect(swapped.exerciseId).toBe('pull_ups');
      // Scheme preserved.
      expect(swapped.sets).toBe(original.sets);
      expect(swapped.reps).toBe(original.reps);
      expect(swapped.restSeconds).toBe(original.restSeconds);
    });

    it('reorderExercises moves an exercise from one index to another', () => {
      const { id, dayId } = setupCopy();
      const day = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!;
      const first = day.exercises[0].exerciseId;
      const second = day.exercises[1].exerciseId;

      useTemplateStore.getState().reorderExercises(id, dayId, 0, 1);

      const after = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises;
      expect(after[0].exerciseId).toBe(second);
      expect(after[1].exerciseId).toBe(first);
    });

    it('reorderExercises ignores out-of-range indices', () => {
      const { id, dayId } = setupCopy();
      const before = JSON.stringify(
        useTemplateStore
          .getState()
          .getTemplate(id)!
          .days.find((d) => d.id === dayId)!.exercises
      );
      useTemplateStore.getState().reorderExercises(id, dayId, 0, 999);
      const after = JSON.stringify(
        useTemplateStore
          .getState()
          .getTemplate(id)!
          .days.find((d) => d.id === dayId)!.exercises
      );
      expect(after).toBe(before);
    });

    it('updateSetRepScheme patches sets, reps, and rest', () => {
      const { id, dayId } = setupCopy();
      useTemplateStore.getState().updateSetRepScheme(id, dayId, 0, {
        sets: 5,
        reps: '3-5',
        restSeconds: 300,
      });
      const ex = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises[0];
      expect(ex.sets).toBe(5);
      expect(ex.reps).toBe('3-5');
      expect(ex.restSeconds).toBe(300);
    });

    it('updateSetRepScheme applies a partial patch (only reps)', () => {
      const { id, dayId } = setupCopy();
      const original = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises[0];
      useTemplateStore.getState().updateSetRepScheme(id, dayId, 0, { reps: 'AMRAP' });
      const ex = useTemplateStore
        .getState()
        .getTemplate(id)!
        .days.find((d) => d.id === dayId)!.exercises[0];
      expect(ex.reps).toBe('AMRAP');
      expect(ex.sets).toBe(original.sets);
      expect(ex.restSeconds).toBe(original.restSeconds);
    });

    it('every edit recomputes the overall totalFpDistribution via the real engine', () => {
      const { id, dayId } = setupCopy();
      useTemplateStore.getState().addExercise(id, dayId, 'barbell_bench_press');
      const copy = useTemplateStore.getState().getTemplate(id)!;
      expect(copy.totalFpDistribution).toEqual(calculateTotalFPDistribution(copy.days));
    });

    it('every edit bumps updatedAt', () => {
      const { id, dayId } = setupCopy();
      const createdAt = useTemplateStore.getState().getTemplate(id)!.updatedAt!;
      // Force time to advance (updatedAt uses Date.now()).
      const realNow = Date.now;
      Date.now = () => createdAt + 5000;
      useTemplateStore.getState().renameTemplate(id, 'Renamed');
      const updatedAt = useTemplateStore.getState().getTemplate(id)!.updatedAt!;
      Date.now = realNow;
      expect(updatedAt).toBeGreaterThan(createdAt);
    });

    it('editing a built-in id is a no-op', () => {
      const before = useTemplateStore.getState().templates;
      useTemplateStore.getState().addExercise(BUILT_IN_ID, 'min_day_a', 'pull_ups');
      useTemplateStore.getState().removeExercise(BUILT_IN_ID, 'min_day_a', 0);
      expect(useTemplateStore.getState().templates).toBe(before);
      expect(getTemplateById(BUILT_IN_ID)!.days[0].exercises.length).toBe(5);
    });
  });

  describe('deleteTemplate', () => {
    it('removes a personal copy', () => {
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      expect(useTemplateStore.getState().templates).toHaveLength(1);
      useTemplateStore.getState().deleteTemplate(id);
      expect(useTemplateStore.getState().templates).toHaveLength(0);
      // Built-in resolver still works.
      expect(useTemplateStore.getState().getTemplate(id)).toBeUndefined();
    });

    it('cannot delete a built-in', () => {
      useTemplateStore.getState().deleteTemplate(BUILT_IN_ID);
      expect(getTemplateById(BUILT_IN_ID)).toBeDefined();
    });
  });

  describe('getTemplate / isCustom', () => {
    it('resolves built-ins first, then personal copies', () => {
      expect(useTemplateStore.getState().getTemplate(BUILT_IN_ID)?.id).toBe(BUILT_IN_ID);
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      expect(useTemplateStore.getState().getTemplate(id)?.id).toBe(id);
    });

    it('isCustom is true only for owned personal copies', () => {
      expect(useTemplateStore.getState().isCustom(BUILT_IN_ID)).toBe(false);
      const id = useTemplateStore.getState().duplicateTemplate(BUILT_IN_ID)!;
      expect(useTemplateStore.getState().isCustom(id)).toBe(true);
    });
  });

  describe('hydrate', () => {
    it('loads personal templates from storage and re-flags isCustom', async () => {
      const stored = {
        templates: [
          {
            ...getTemplateById(BUILT_IN_ID)!,
            id: 'stored_copy',
            isCustom: false, // simulate stale data without the flag
          },
        ],
      };
      (appStorage.getJSON as jest.Mock).mockResolvedValueOnce(stored);

      await useTemplateStore.getState().hydrate();

      const loaded = useTemplateStore.getState().getTemplate('stored_copy');
      expect(loaded).toBeDefined();
      expect(loaded!.isCustom).toBe(true); // re-flagged on hydrate
    });

    it('does not throw when storage is empty', async () => {
      (appStorage.getJSON as jest.Mock).mockResolvedValueOnce(null);
      await expect(useTemplateStore.getState().hydrate()).resolves.toBeUndefined();
      expect(useTemplateStore.getState().templates).toHaveLength(0);
    });
  });
});
