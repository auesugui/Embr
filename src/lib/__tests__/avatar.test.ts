// =============================================================================
// Avatar sizing and budget
// =============================================================================
// The budget check is the load-bearing part. On web the avatar shares a ~5 MB
// `localStorage` with every logged workout, and `workout_history` is the one
// slice that cannot be recovered. A guard that measured the wrong thing — or
// let a 3 MB photo through — would trade someone's training log for a picture.

import { AVATAR_MAX_BYTES, coverCrop, dataUriBytes, isStoredAvatar, withinBudget } from '../avatar';

describe('coverCrop', () => {
  it('takes the whole frame when the image is already square', () => {
    expect(coverCrop(500, 500)).toEqual({ x: 0, y: 0, size: 500 });
  });

  it('centres the crop on a landscape photo', () => {
    expect(coverCrop(1000, 400)).toEqual({ x: 300, y: 0, size: 400 });
  });

  it('centres the crop on a portrait photo', () => {
    // Cropping from the top-left of a portrait shot is how you cut off a face.
    expect(coverCrop(400, 1000)).toEqual({ x: 0, y: 300, size: 400 });
  });

  it('rounds to whole pixels', () => {
    expect(coverCrop(101, 50)).toEqual({ x: 26, y: 0, size: 50 });
  });

  it('refuses dimensions it cannot crop rather than returning a bad rect', () => {
    expect(coverCrop(0, 100)).toBeNull();
    expect(coverCrop(-10, 100)).toBeNull();
    expect(coverCrop(Number.NaN, 100)).toBeNull();
  });
});

describe('dataUriBytes', () => {
  it('measures the decoded payload, not the string length', () => {
    // "abc" -> "YWJj": 4 base64 chars, 3 real bytes. Measuring string length
    // would overstate the cost by a third and reject images that do fit.
    expect(dataUriBytes('data:image/jpeg;base64,YWJj')).toBe(3);
  });

  it('accounts for padding', () => {
    expect(dataUriBytes('data:image/jpeg;base64,YQ==')).toBe(1);
    expect(dataUriBytes('data:image/jpeg;base64,YWI=')).toBe(2);
  });

  it('is zero for something that is not a data URI', () => {
    expect(dataUriBytes('nonsense')).toBe(0);
  });
});

describe('withinBudget', () => {
  const uriOfBytes = (bytes: number) =>
    `data:image/jpeg;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`;

  it('accepts a small avatar', () => {
    expect(withinBudget(uriOfBytes(20 * 1024))).toBe(true);
  });

  it('rejects anything over the ceiling', () => {
    // A raw phone photo lands here, and letting one through is what would
    // evict the workout history.
    expect(withinBudget(uriOfBytes(AVATAR_MAX_BYTES * 4))).toBe(false);
  });

  it('accepts exactly the ceiling', () => {
    expect(withinBudget(uriOfBytes(AVATAR_MAX_BYTES))).toBe(true);
  });
});

describe('isStoredAvatar', () => {
  it('recognises what we produce', () => {
    expect(isStoredAvatar('data:image/jpeg;base64,YWJj')).toBe(true);
  });

  it('rejects anything else, including a null from a fresh profile', () => {
    expect(isStoredAvatar(null)).toBe(false);
    expect(isStoredAvatar(undefined)).toBe(false);
    expect(isStoredAvatar('https://example.com/face.png')).toBe(false);
    expect(isStoredAvatar('data:image/svg+xml,<svg/>')).toBe(false);
  });
});
