// =============================================================================
// Copy the OCR engine into public/ocr — runs after install
// =============================================================================
// The photo reader runs tesseract.js in the browser. Its engine and English data
// come from node_modules and are copied into public/ocr/, so the app serves them
// from its own origin: no CDN at runtime, and the browser can cache them.
// public/ocr is generated and git-ignored. This runs on npm install, which is
// also what Vercel runs before it builds.

const fs = require('node:fs');
const path = require('node:path');

const modules = path.join(__dirname, '..', 'node_modules');
const out = path.join(__dirname, '..', 'public', 'ocr');

const files = [
  [path.join(modules, 'tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  [
    path.join(modules, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
    'eng.traineddata.gz',
  ],
];
// The browser picks one engine build by SIMD support, so all three LSTM builds are copied.
for (const variant of ['relaxedsimd-lstm', 'simd-lstm', 'lstm']) {
  for (const ext of ['wasm.js', 'wasm']) {
    const name = `tesseract-core-${variant}.${ext}`;
    files.push([path.join(modules, 'tesseract.js-core', name), name]);
  }
}

fs.mkdirSync(out, { recursive: true });
let missing = 0;
for (const [from, name] of files) {
  if (!fs.existsSync(from)) {
    console.error(`copy-ocr-assets: missing ${from}`);
    missing += 1;
    continue;
  }
  fs.copyFileSync(from, path.join(out, name));
}
if (missing > 0) process.exitCode = 1;
