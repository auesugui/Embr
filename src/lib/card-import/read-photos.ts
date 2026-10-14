// =============================================================================
// Read photos — runs the reader over a batch and reports card by card
// =============================================================================
// The review screen shows each card as soon as it is read, so the wait is spread
// out instead of ending in one long pause. The loop stops as soon as `isCurrent`
// says the batch it belongs to has been replaced or cancelled.

import { createCardReader } from './read-card-photo';
import type { Reading } from './reconcile';

export interface ReadCard {
  /** Stable key for React and for edits. */
  key: string;
  fileName: string;
  /** Null when the photo could not be read. */
  reading: Reading | null;
  error: string | null;
}

export interface ReadHooks {
  isCurrent: () => boolean;
  onCard: (card: ReadCard) => void;
  onDone: () => void;
}

export async function readPhotos(photos: File[], hooks: ReadHooks): Promise<void> {
  let reader: Awaited<ReturnType<typeof createCardReader>> | null = null;
  try {
    reader = await createCardReader();
  } catch {
    for (const [index, photo] of photos.entries()) {
      if (!hooks.isCurrent()) break;
      hooks.onCard(
        failed(photo, index, 'The photo reader could not start. Try again when online.')
      );
    }
    hooks.onDone();
    return;
  }

  try {
    for (const [index, photo] of photos.entries()) {
      if (!hooks.isCurrent()) break;
      try {
        const reading = await reader.read(photo);
        hooks.onCard({ key: keyFor(photo, index), fileName: photo.name, reading, error: null });
      } catch {
        hooks.onCard(failed(photo, index, "Couldn't read this photo."));
      }
    }
  } finally {
    await reader.close();
    hooks.onDone();
  }
}

const keyFor = (photo: File, index: number): string => `${index}-${photo.name}-${photo.size}`;

const failed = (photo: File, index: number, error: string): ReadCard => ({
  key: keyFor(photo, index),
  fileName: photo.name,
  reading: null,
  error,
});
