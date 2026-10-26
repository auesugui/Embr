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
  restIsUp,
  restRemaining,
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
export { useCardImportStore } from './cardImportStore';
export { useCustomExerciseStore } from './customExerciseStore';
