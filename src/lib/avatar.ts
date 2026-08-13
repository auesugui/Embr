// =============================================================================
// Avatar — pick a photo, shrink it hard, keep it out of the way of the workouts
// =============================================================================
// THE CONSTRAINT THAT SHAPES THIS FILE
// There is no backend. On web the whole app lives in `localStorage`, which is
// roughly 5 MB for the entire origin — shared with every workout ever logged.
// A phone photo is 2–6 MB, and base64 makes it a third bigger again. Storing
// one raw would not just be wasteful; it could push the quota over and take
// `workout_history` with it, which is the one slice that cannot be recovered
// (CLAUDE.md: "Export or it's gone").
//
// So an avatar is downscaled to a 256px square, JPEG-encoded, and refused
// outright if it will not fit in AVATAR_MAX_BYTES. A picture of your face is
// worth about 40 KB and not one byte more.

/** The stored square, in pixels. 256 is retina-sharp at the 80px circle. */
export const AVATAR_SIZE = 256;

/**
 * Hard ceiling for the stored data URI, in bytes.
 *
 * ~40 KB is under 1% of the web storage budget. Anything that cannot be
 * squeezed under it is rejected rather than silently eating the space that
 * holds logged workouts.
 */
export const AVATAR_MAX_BYTES = 40 * 1024;

/** Encoder qualities tried in order, best first. */
export const AVATAR_QUALITY_STEPS = [0.72, 0.6, 0.45, 0.3];

/**
 * The source rectangle for a centre-crop to a square.
 *
 * A portrait photo cropped from the top-left would cut off the face; centring
 * is what people expect and it costs one function.
 */
export function coverCrop(
  width: number,
  height: number
): { x: number; y: number; size: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const size = Math.min(width, height);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    size: Math.round(size),
  };
}

/**
 * Byte length of a data URI's payload.
 *
 * Measured on the base64 body, not the string length, because the `data:`
 * prefix and the padding both lie about the real cost by a few percent — and
 * the budget check should be about what is actually stored.
 */
export function dataUriBytes(dataUri: string): number {
  const comma = dataUri.indexOf(',');
  if (comma === -1) return 0;

  const body = dataUri.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

export function withinBudget(dataUri: string): boolean {
  return dataUriBytes(dataUri) <= AVATAR_MAX_BYTES;
}

/** A stored avatar is always a JPEG data URI we produced ourselves. */
export function isStoredAvatar(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:image/jpeg;base64,');
}

// -----------------------------------------------------------------------------
// Browser plumbing
// -----------------------------------------------------------------------------
// Everything below touches the DOM and is therefore web-only. Embr ships as a
// PWA (CLAUDE.md), so this is the path that actually runs; callers guard on
// Platform.OS and say so plainly rather than pulling in a native picker
// dependency for a target that does not ship.

export class AvatarTooLargeError extends Error {
  constructor() {
    super('That image is too detailed to store. Try a photo with a simpler background.');
    this.name = 'AvatarTooLargeError';
  }
}

/**
 * Open the system photo picker and return a stored-ready data URI.
 *
 * Resolves to null when the user cancels. `capture` is set so iOS Safari offers
 * "Take Photo" alongside the library — one control, the native sheet decides.
 */
export function pickAvatarFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Hints the camera without forcing it: iOS shows Take Photo / Photo Library.
    input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // A cancelled picker fires `cancel` in modern browsers. Without this the
    // promise would hang forever and the button would look stuck.
    input.addEventListener('cancel', () => finish(null));

    document.body.appendChild(input);
    input.click();
  });
}

/** Decode a File into an image element. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Downscale and encode, stepping quality down until it fits the budget.
 *
 * Throws `AvatarTooLargeError` if even the lowest quality is over — better an
 * honest refusal than quietly spending the storage that holds the workouts.
 */
export async function processAvatar(file: File): Promise<string> {
  const img = await loadImage(file);
  const crop = coverCrop(img.naturalWidth, img.naturalHeight);
  if (!crop) throw new Error('That image has no usable dimensions.');

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');

  ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  for (const quality of AVATAR_QUALITY_STEPS) {
    const dataUri = canvas.toDataURL('image/jpeg', quality);
    if (withinBudget(dataUri)) return dataUri;
  }

  throw new AvatarTooLargeError();
}
