// =============================================================================
// Manual workout — the shapes the add-workout screen and its cards share
// =============================================================================

import type { DistanceUnit } from '@/types';

export interface SetRow {
  key: number;
  weight: string;
  reps: string;
}

export interface CardioFields {
  minutes: string;
  distance: string;
  distanceUnit: DistanceUnit;
  rpe: string;
}

export interface ExerciseRow {
  key: number;
  name: string;
  sets: SetRow[];
  /** Set on a cardio row, which has no sets. */
  cardio?: CardioFields;
}

export interface Suggestion {
  key: string;
  name: string;
  meta?: string;
}

/** What a card may ask the screen to change. The screen owns the state. */
export interface ExerciseHandlers {
  onRename: (key: number, name: string) => void;
  onFocusName: (key: number) => void;
  onRemove: (key: number) => void;
  onChooseSuggestion: (key: number, name: string) => void;
  onAddSet: (key: number) => void;
  onUpdateSet: (
    key: number,
    setKey: number,
    patch: Partial<Pick<SetRow, 'weight' | 'reps'>>
  ) => void;
  onRemoveSet: (key: number, setKey: number) => void;
  onUpdateCardio: (key: number, patch: Partial<CardioFields>) => void;
}
