// =============================================================================
// Custom exercise store tests
// =============================================================================
// The store writes before it changes, and hands its list to the @/data lookups
// that every picker and template screen reads.

import { getExerciseById, searchExercises } from '@/data';
import { appStorage } from '@/utils/storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { useCustomExerciseStore } from '../customExerciseStore';

jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  },
  STORAGE_KEYS: {
    CUSTOM_EXERCISES: {
      FULL_STATE: 'custom_exercises.full_state',
    },
  },
}));

const setJSON = appStorage.setJSON as jest.Mock;
const getJSON = appStorage.getJSON as jest.Mock;

const goblet = {
  name: 'Goblet Squat',
  primaryMuscle: 'quads',
  equipment: 'kettlebell',
  metric: 'reps',
} as const;

describe('customExerciseStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setJSON.mockResolvedValue(undefined);
    useCustomExerciseStore.getState().reset();
  });

  it('saves an exercise and makes it findable by id and search', async () => {
    const result = await useCustomExerciseStore.getState().addExercise(goblet);

    expect(result.ok).toBe(true);
    expect(setJSON).toHaveBeenCalledWith('custom_exercises.full_state', {
      exercises: useCustomExerciseStore.getState().exercises,
    });
    expect(getExerciseById('custom-goblet-squat')?.name).toBe('Goblet Squat');
    expect(searchExercises('goblet')[0]?.id).toBe('custom-goblet-squat');
  });

  it('leaves the library unchanged when the write fails', async () => {
    setJSON.mockRejectedValueOnce(new Error('quota'));

    await expect(useCustomExerciseStore.getState().addExercise(goblet)).rejects.toThrow('quota');

    expect(useCustomExerciseStore.getState().exercises).toEqual([]);
    expect(getExerciseById('custom-goblet-squat')).toBeUndefined();
  });

  it('refuses a duplicate name without writing', async () => {
    await useCustomExerciseStore.getState().addExercise(goblet);
    setJSON.mockClear();

    const again = await useCustomExerciseStore.getState().addExercise({
      ...goblet,
      name: 'goblet squat',
    });

    expect(again).toEqual({ ok: false, error: 'Goblet Squat is already in the library.' });
    expect(setJSON).not.toHaveBeenCalled();
  });

  it('hydrates saved exercises into the lookups', async () => {
    getJSON.mockResolvedValueOnce({
      exercises: [{ ...searchExercises('')[0], id: 'custom-saved', name: 'Saved Move' }],
    });

    await useCustomExerciseStore.getState().hydrate();

    expect(getExerciseById('custom-saved')?.name).toBe('Saved Move');
  });
});
