// =============================================================================
// Embr Stores - Main Export
// =============================================================================

export {
  usePlayerStore,
  selectStreakDays,
  selectNeedsOnboarding,
  needsOnboarding,
  LEGACY_DEFAULT_NAME,
} from './playerStore';
export {
  useWorkoutStore,
  selectSessionDuration,
  selectExerciseProgress,
  selectIsRestTimerComplete,
} from './workoutStore';
export {
  useSettingsStore,
  selectTheme,
  selectHapticsEnabled,
  selectReducedMotion,
} from './settingsStore';
export {
  useWeightHistoryStore,
  selectLastWeight,
  selectRecentWeights,
} from './weightHistoryStore';
export { usePRStore } from './prStore';
export { useBaselineStore } from './baselineStore';
export { useTemplateStore } from './templateStore';
export { useWorkoutHistoryStore } from './workoutHistoryStore';
