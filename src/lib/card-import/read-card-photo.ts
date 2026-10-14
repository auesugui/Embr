import { parseCard } from './parse-card';
import type { Reading } from './reconcile';
import { reconcile } from './reconcile';

const ASSET_PATH = '/ocr/';
// iOS Safari will not draw a canvas larger than this on either side.
const MAX_CANVAS_SIDE = 4096;

interface Pass {
  /** Upscale factor before reading. Capped so the canvas stays within MAX_CANVAS_SIDE. */
  scale: number;
  /** Pixels brighter than this after inverting become white; the rest become black. */
  threshold: number;
}

const PASSES: readonly [Pass, Pass] = [
  { scale: 2, threshold: 110 },
  { scale: 1, threshold: 128 },
];

export interface CardReader {
  read(photo: Blob): Promise<Reading>;
  close(): Promise<void>;
}

export async function createCardReader(): Promise<CardReader> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: `${ASSET_PATH}worker.min.js`,
    corePath: ASSET_PATH,
    langPath: ASSET_PATH,
    gzip: true,
  });

  return {
    async read(photo) {
      const bitmap = await createImageBitmap(photo);
      try {
        const first = parseCard(await recognize(worker, bitmap, PASSES[0]));
        const second = parseCard(await recognize(worker, bitmap, PASSES[1]));
        return reconcile(first, second);
      } finally {
        bitmap.close();
      }
    },
    async close() {
      await worker.terminate();
    },
  };
}

type OcrWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

async function recognize(worker: OcrWorker, bitmap: ImageBitmap, pass: Pass): Promise<string[]> {
  const canvas = preprocess(bitmap, pass);
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const lines: { y: number; text: string }[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        lines.push({ y: line.bbox.y0, text: line.text.trim() });
      }
    }
  }
  return lines
    .sort((a, b) => a.y - b.y)
    .map((line) => line.text)
    .filter((text) => text.length > 0);
}

/** Grayscale, invert, and threshold: light text on a dark card becomes dark on light. */
function preprocess(bitmap: ImageBitmap, { scale, threshold }: Pass): HTMLCanvasElement {
  const factor = Math.min(scale, MAX_CANVAS_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * factor);
  const height = Math.round(bitmap.height * factor);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot read the photo.');

  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = 255 - gray > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}
