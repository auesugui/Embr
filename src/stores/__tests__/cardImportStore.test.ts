// =============================================================================
// Card import store — batches, and readings that arrive after their batch is gone
// =============================================================================
// The reader runs over a batch while the person may leave the screen, choose a new
// batch, or cancel. A reading that lands after that must not show up in the new
// batch. These tests pin that down.

import type { ReadCard } from '@/lib/card-import/read-photos';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { useCardImportStore } from '../cardImportStore';

const photo = (name: string) => new File(['x'], name, { type: 'image/png' });

const card = (key: string): ReadCard => ({
  key,
  fileName: key,
  reading: null,
  error: 'unreadable',
});

describe('Card import store', () => {
  beforeEach(() => {
    useCardImportStore.getState().reset();
  });

  it('starts reading a batch once, however many times it is asked', () => {
    useCardImportStore.getState().setPhotos([photo('a.png')]);

    const first = useCardImportStore.getState().claimReading();
    const second = useCardImportStore.getState().claimReading();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('will not start a batch with no photos in it', () => {
    expect(useCardImportStore.getState().claimReading()).toBeNull();
  });

  it('drops a reading that finishes after a new batch has replaced its own', () => {
    useCardImportStore.getState().setPhotos([photo('a.png')]);
    const oldRun = useCardImportStore.getState().claimReading();

    useCardImportStore.getState().setPhotos([photo('b.png')]);
    useCardImportStore.getState().addCard(oldRun as number, card('old'));

    expect(useCardImportStore.getState().cards).toEqual([]);
  });

  it('keeps readings for the batch that is current', () => {
    useCardImportStore.getState().setPhotos([photo('a.png')]);
    const run = useCardImportStore.getState().claimReading() as number;

    useCardImportStore.getState().addCard(run, card('a'));

    expect(useCardImportStore.getState().cards.map((c) => c.key)).toEqual(['a']);
  });

  it('removes a card and clears everything when the batch is reset', () => {
    useCardImportStore.getState().setPhotos([photo('a.png')]);
    const run = useCardImportStore.getState().claimReading() as number;
    useCardImportStore.getState().addCard(run, card('a'));
    useCardImportStore.getState().addCard(run, card('b'));

    useCardImportStore.getState().removeCard('a');
    expect(useCardImportStore.getState().cards.map((c) => c.key)).toEqual(['b']);

    useCardImportStore.getState().reset();
    expect(useCardImportStore.getState().cards).toEqual([]);
    expect(useCardImportStore.getState().photos).toEqual([]);
  });
});
