// =============================================================================
// Card import store — photos on their way to the review screen
// =============================================================================
// Transient on purpose. The chosen photos and their readings live only while the
// review screen is open, and nothing here is persisted. Saving goes through
// workoutHistoryStore.mergeLogs, the one place history changes.
//
// Every batch has a run id. A reading that finishes after its batch was replaced
// or cancelled is dropped, so it cannot land in the next batch's review.

import type { ReadCard } from '@/lib/card-import/read-photos';
import { create } from 'zustand';

interface CardImportState {
  photos: File[];
  /** Identifies the current batch. Bumped whenever a batch starts or is cancelled. */
  runId: number;
  /** True once the reader has been started for the current batch. */
  started: boolean;
  /** True while the reader is still working through the batch. */
  reading: boolean;
  cards: ReadCard[];
  setPhotos: (photos: File[]) => void;
  /** Returns the run id to read under, or null if the batch is already being read. */
  claimReading: () => number | null;
  addCard: (runId: number, card: ReadCard) => void;
  setReading: (runId: number, reading: boolean) => void;
  updateCard: (key: string, update: (card: ReadCard) => ReadCard) => void;
  removeCard: (key: string) => void;
  /** Drops the batch and anything still being read for it. */
  reset: () => void;
}

const idle = { photos: [], started: false, reading: false, cards: [] };

export const useCardImportStore = create<CardImportState>((set, get) => ({
  runId: 0,
  ...idle,

  setPhotos: (photos) => set((state) => ({ ...idle, photos, runId: state.runId + 1 })),

  claimReading: () => {
    const state = get();
    if (state.started || state.photos.length === 0) return null;
    set({ started: true, reading: true });
    return state.runId;
  },

  addCard: (runId, card) =>
    set((state) => (runId === state.runId ? { cards: [...state.cards, card] } : {})),

  setReading: (runId, reading) => set((state) => (runId === state.runId ? { reading } : {})),

  updateCard: (key, update) =>
    set((state) => ({
      cards: state.cards.map((card) => (card.key === key ? update(card) : card)),
    })),

  removeCard: (key) => set((state) => ({ cards: state.cards.filter((card) => card.key !== key) })),

  reset: () => set((state) => ({ ...idle, runId: state.runId + 1 })),
}));
