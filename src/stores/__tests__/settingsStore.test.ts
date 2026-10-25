// =============================================================================
// Embr Settings Store — the weekly goal and its restore path
// =============================================================================
// The restore test is the one that matters: a backup written before issue #78
// has no weekly-goal fields at all, and it has to come back as an install on
// the default of 3 rather than as an install with no goal.

import { DEFAULT_WEEKLY_GOAL, goalInEffect, weeklyStreak } from '@/lib/weekly-goal';
import type { Settings, WorkoutLog } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';

import { useSettingsStore } from '../settingsStore';

jest.mock('@/utils/storage', () => ({
  appStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    SETTINGS: { FULL_STATE: 'settings.full_state' },
  },
}));

const mockGetJSON = appStorage.getJSON as jest.Mock;

// Week of Mon 2026-10-19; 2026-10-22 is the Thursday inside it.
const THURSDAY = new Date(2026, 9, 22, 9, 0);

let nextId = 0;
const log = (month: number, day: number): WorkoutLog =>
  ({
    id: `log-${nextId++}`,
    timestamp: new Date(2026, month - 1, day, 9, 30).toISOString(),
    claimedAt: new Date(2026, month - 1, day, 9, 45).toISOString(),
  }) as unknown as WorkoutLog;

beforeEach(() => {
  useSettingsStore.getState().reset();
  jest.clearAllMocks();
});

describe('weekly goal', () => {
  it('starts with no recorded change, which reads as the default', () => {
    expect(useSettingsStore.getState().weeklyGoals).toEqual([]);
    expect(goalInEffect(useSettingsStore.getState().weeklyGoals, THURSDAY)).toBe(
      DEFAULT_WEEKLY_GOAL
    );
  });

  it('records a change against the current week and persists it', () => {
    useSettingsStore.getState().setWeeklyGoal(5, THURSDAY);

    expect(useSettingsStore.getState().weeklyGoals).toEqual([{ week: '2026-10-19', days: 5 }]);
    expect(appStorage.setJSON).toHaveBeenCalledWith(
      STORAGE_KEYS.SETTINGS.FULL_STATE,
      expect.objectContaining({ weeklyGoals: [{ week: '2026-10-19', days: 5 }] })
    );
  });

  it('replaces the entry when it is changed again in the same week', () => {
    useSettingsStore.getState().setWeeklyGoal(5, THURSDAY);
    useSettingsStore.getState().setWeeklyGoal(2, new Date(2026, 9, 24, 9, 0));

    expect(useSettingsStore.getState().weeklyGoals).toEqual([{ week: '2026-10-19', days: 2 }]);
  });
});

describe('hydrate', () => {
  it('reads the weekly goal and the prompt flag back', async () => {
    mockGetJSON.mockResolvedValue({
      units: 'kg',
      // Dated well in the past so the current week always inherits it.
      weeklyGoals: [{ week: '2020-01-06', days: 5 }],
      goalPromptSeen: true,
    } satisfies Partial<Settings>);

    await useSettingsStore.getState().hydrate();

    expect(goalInEffect(useSettingsStore.getState().weeklyGoals, THURSDAY)).toBe(5);
    expect(useSettingsStore.getState().goalPromptSeen).toBe(true);
  });

  it('restores a pre-#78 backup on the default goal, scoring weeks the same way', async () => {
    mockGetJSON.mockResolvedValue({ theme: 'dark', haptics: false, units: 'lb' });

    await useSettingsStore.getState().hydrate();
    const restored = useSettingsStore.getState();

    expect(restored.weeklyGoals).toEqual([]);
    expect(restored.goalPromptSeen).toBe(false);
    expect(goalInEffect(restored.weeklyGoals, THURSDAY)).toBe(DEFAULT_WEEKLY_GOAL);

    // Two weeks of three days each: identical to an explicit goal of 3.
    const logs = [log(10, 5), log(10, 7), log(10, 9), log(10, 12), log(10, 14), log(10, 16)];
    const explicit = [{ week: '2026-01-05', days: DEFAULT_WEEKLY_GOAL }];
    expect(weeklyStreak(logs, restored.weeklyGoals, THURSDAY)).toBe(
      weeklyStreak(logs, explicit, THURSDAY)
    );
    expect(weeklyStreak(logs, restored.weeklyGoals, THURSDAY)).toBe(2);
  });
});
