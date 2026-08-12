import { getExerciseById } from '@/data';
import type { Exercise, WeightUnit, WorkoutLog } from '@/types';
import { STORAGE_KEYS, appStorage } from '@/utils/storage';

import { useBaselineStore } from '@/stores/baselineStore';
import { usePlayerStore } from '@/stores/playerStore';
import { usePRStore } from '@/stores/prStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useWeightHistoryStore } from '@/stores/weightHistoryStore';
import { useWorkoutHistoryStore } from '@/stores/workoutHistoryStore';
import { useWorkoutStore } from '@/stores/workoutStore';

const persistPlayer = () =>
  appStorage.setJSON(STORAGE_KEYS.PLAYER.FULL_STATE, usePlayerStore.getState()).catch(console.warn);

// -----------------------------------------------------------------------------
// Player
// -----------------------------------------------------------------------------

export function devSetStreak(current: number) {
  const lastWorkoutDate = current > 0 ? new Date().toISOString().split('T')[0] : null;
  usePlayerStore.setState({
    streak: { current, longest: current, lastWorkoutDate },
  });
  persistPlayer();
}

// -----------------------------------------------------------------------------
// PRs
// -----------------------------------------------------------------------------

// recordPR builds the ExercisePR shape correctly and updates totalPRCount —
// records are keyed `${exerciseId}::${unit}`, so pass the unit being tested.
const PR_SEEDS: Array<{ exerciseId: string; lb: number; kg: number; reps: number }> = [
  { exerciseId: 'barbell_bench_press', lb: 225, kg: 100, reps: 5 },
  { exerciseId: 'back_squat', lb: 315, kg: 140, reps: 5 },
  { exerciseId: 'deadlift', lb: 405, kg: 180, reps: 5 },
  { exerciseId: 'overhead_press', lb: 135, kg: 60, reps: 5 },
  { exerciseId: 'barbell_row', lb: 185, kg: 85, reps: 8 },
];

export function devSeedPRs(unit: WeightUnit) {
  const record = usePRStore.getState().recordPR;
  for (const seed of PR_SEEDS) {
    record(seed.exerciseId, unit === 'lb' ? seed.lb : seed.kg, seed.reps, unit);
  }
}

// -----------------------------------------------------------------------------
// Workout history
// -----------------------------------------------------------------------------

function makeExercise(id: string, weight: number, reps: number, sets: number): Exercise {
  const def = getExerciseById(id);
  return {
    id,
    name: def?.name ?? id,
    muscleGroups: def?.muscleGroups ?? [],
    restSeconds: 120,
    completed: true,
    sets: Array.from({ length: sets }, () => ({
      reps,
      weight,
      logged: true,
      isPR: false,
      isRepPR: false,
    })),
  };
}

/**
 * Seeds 5 pre-saved logs. `createLog` can't be reused — it writes *unsaved*
 * logs (null `claimedAt`), and the history screen only lists saved ones.
 */
export function devSeedHistory() {
  const now = Date.now();
  const mk = (daysAgo: number): WorkoutLog => ({
    id: `seed_${daysAgo}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(now - daysAgo * 86_400_000).toISOString(),
    exercises: [makeExercise('barbell_bench_press', 225, 5, 3)],
    durationSeconds: 2700,
    streakDays: Math.max(1, 7 - daysAgo),
    sessionIntent: 'normal',
    claimedAt: new Date(now - daysAgo * 86_400_000 + 60_000).toISOString(),
  });
  const logs = [mk(1), mk(2), mk(4), mk(6), mk(8)];
  useWorkoutHistoryStore.setState({ logs });
  appStorage.setJSON(STORAGE_KEYS.WORKOUT_HISTORY.FULL_STATE, { logs }).catch(console.warn);
}

// -----------------------------------------------------------------------------
// Reset
// -----------------------------------------------------------------------------

/**
 * Full reset to fresh-install state. Each store's reset()/clearAll() deletes
 * its own AsyncStorage key, so no manual key cleanup is needed.
 */
export function devResetAll() {
  usePlayerStore.getState().reset();
  useWorkoutHistoryStore.getState().reset();
  usePRStore.getState().clearAll();
  useBaselineStore.getState().reset();
  useWeightHistoryStore.getState().reset();
  useTemplateStore.getState().reset();
  useSettingsStore.getState().reset();
  useWorkoutStore.getState().reset();
}
