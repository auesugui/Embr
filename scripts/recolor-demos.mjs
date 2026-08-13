// =============================================================================
// Recolour the exercise demo diagrams onto the Embr palette
// =============================================================================
// The 61 demo renders were generated before the rebrand (11a1973): "a
// featureless amber mannequin on the app's navy background". That was
// IronQuest's palette. ADR-0013 moved the app to warm sand and a single ember
// accent and never touched the images, so they are the last surviving
// pre-redesign asset — not merely clashing, but the old brand sitting inside
// the new one.
//
// WHY RECOLOUR RATHER THAN REGENERATE
// The renders cost ~57 Higgsfield credits and six prompt iterations to get the
// joint angles defensible (docs/03-workout-tracker/exercise-demo-recipe.md).
// Regenerating re-rolls all of that for a colour problem. A per-pixel transform
// keeps every verified pose and is free, deterministic and re-runnable.
//
// HOW IT SEPARATES THE THREE MATERIALS
// Not by hard thresholds — a hard cut leaves coloured fringing on every
// antialiased edge, and a JPEG has thousands of them. Each pixel gets a
// continuous "blueness" weight instead:
//
//   background  b noticeably above r and g   -> replaced with synthetic sand
//   mannequin   warm hue, saturated          -> hue rotated onto ember
//   equipment   near-neutral and dark        -> left dark, warmed slightly
//
// THE BACKGROUND IS SYNTHESISED, NOT MAPPED
// The first attempt remapped the navy's own luma onto a sand band and the
// result was visibly blotchy. The navy occupies a luma range about 26 wide and
// is the most heavily compressed part of a JPEG — quantisation noise invisible
// at that darkness gets multiplied roughly sevenfold when stretched across the
// sand band, and every compression block becomes a stain.
//
// So the background is drawn from scratch: a smooth radial falloff per panel,
// warm sand, centred where the original glow was. Nothing noisy survives to be
// amplified. The panel divider is redrawn for the same reason.
//
// Usage:
//   node scripts/recolor-demos.mjs <file.jpg> [outfile.jpg]   # one, for review
//   node scripts/recolor-demos.mjs --all                      # the whole set

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DEMO_DIR = 'public/exercise-demos';

// -----------------------------------------------------------------------------
// Target palette — must track src/theme/colors.ts
// -----------------------------------------------------------------------------

/** sand[200] — the corners of each panel. */
const BG_DARK = [233, 227, 220];
/** sand[50] — the centre, where the original render put its glow. */
const BG_LIGHT = [251, 249, 247];
/** sand[300] — the hairline between the start and end panels. */
const DIVIDER = [217, 209, 200];

/**
 * Amber sits at hue ~35°, ember at ~15°. Rotating by this and pulling a little
 * saturation out lands the mannequin on the accent ramp: sampled (234,159,31)
 * becomes (234,107,61), a near match for ember[500] #D4633C.
 */
const HUE_ROTATE = -22;
const SAT_SCALE = 0.8;

/**
 * Equipment is already near-neutral. Lifting it off pure black stops it reading
 * as a hole punched in a light card, and the warm tint keeps it in family.
 */
const EQUIP_LIFT = 14;
const EQUIP_WARM = [1.0, 0.94, 0.88];

// -----------------------------------------------------------------------------
// Colour maths
// -----------------------------------------------------------------------------

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const lerp = (a, b, t) => a + (b - a) * t;

function rgbToHsv(r, g, b) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const mx = Math.max(R, G, B);
  const mn = Math.min(R, G, B);
  const d = mx - mn;

  let h = 0;
  if (d > 0) {
    if (mx === R) h = 60 * (((G - B) / d) % 6);
    else if (mx === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;

  return [h, mx === 0 ? 0 : d / mx, mx];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((n) => clamp255((n + m) * 255));
}

/**
 * How much this pixel belongs to the background, 0..1.
 *
 * Blue above both other channels is the one property the navy has and neither
 * the mannequin nor the equipment does. Returning a ramp rather than a boolean
 * keeps antialiased edges from fringing.
 *
 * THE BAND IS MEASURED, NOT GUESSED. The metric is sharply bimodal across the
 * source renders: foreground sits at or below 0, background piles up between 16
 * and 28 with a peak at 20, and only ~3% of pixels fall in the valley between.
 * The first version ramped over 0..26, so a typical background pixel scored
 * 0.77 and kept a quarter of its dark-grey treatment — which is what made the
 * whole backdrop read as dirty grey rather than sand. Ramping across the actual
 * valley (4..15) puts real background at a clean 1.
 */
const BG_METRIC_LOW = 0.15;
const BG_METRIC_HIGH = 0.55;

function blueness(r, g, b) {
  // RELATIVE to brightness, not absolute. The render's floor shadow is navy
  // too, but so dark that its absolute channel gaps collapse — (4,6,10) scores
  // only 4 on the absolute metric and got classified as equipment, which is why
  // the shadow came back as grey blotches. Dividing by luma asks the question
  // that actually distinguishes the materials — is this pixel blue-leaning? —
  // at any brightness.
  //
  // Measured across the set, the relative metric puts background at 0.6..1.2
  // (two peaks, one per lighting zone), foreground at or below 0.1, and leaves
  // a ~2% valley at 0.2..0.5. The band ramps across that valley and nothing
  // else: an earlier 0.2..0.7 band cut through the background's own lower peak,
  // so a quarter of every backdrop kept a fifth of its dark treatment. That is
  // what made the floor-contact exercises — russian twist, leg press — come out
  // blotched while the standing ones looked clean.
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const metric = (b - Math.max(r, g)) / Math.max(6, luma);
  const t = (metric - BG_METRIC_LOW) / (BG_METRIC_HIGH - BG_METRIC_LOW);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * The synthetic background at (x, y): a smooth radial falloff inside each
 * panel, brightest at its centre.
 *
 * Drawn rather than derived, so no compression noise from the original navy can
 * reach the output. `panelH` is half the image because every render is a
 * two-panel start/end pair.
 */
function sandAt(x, y, width, panelH) {
  const cx = width / 2;
  const cy = (Math.floor(y / panelH) + 0.5) * panelH;

  const dx = (x - cx) / (width * 0.72);
  const dy = (y - cy) / (panelH * 0.72);
  let d = Math.sqrt(dx * dx + dy * dy);
  d = d > 1 ? 1 : d;

  // Smoothstep, so the falloff has no visible edge where it reaches the corner.
  const t = 1 - d * d * (3 - 2 * d);

  return [
    lerp(BG_DARK[0], BG_LIGHT[0], t),
    lerp(BG_DARK[1], BG_LIGHT[1], t),
    lerp(BG_DARK[2], BG_LIGHT[2], t),
  ];
}

/** The mannequin and the equipment: rotated onto ember, or warmed if neutral. */
function toEmber(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);

  // Near-neutral and dark is equipment, not skin. Rotating its hue does nothing
  // useful (there is no hue to rotate) so it gets the warm-and-lift treatment.
  if (s < 0.25) {
    return [
      clamp255((r + EQUIP_LIFT) * EQUIP_WARM[0]),
      clamp255((g + EQUIP_LIFT) * EQUIP_WARM[1]),
      clamp255((b + EQUIP_LIFT) * EQUIP_WARM[2]),
    ];
  }

  let nh = h + HUE_ROTATE;
  if (nh < 0) nh += 360;
  return hsvToRgb(nh, Math.min(1, s * SAT_SCALE), v);
}

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

/**
 * Smooth the background mask spatially.
 *
 * Per-pixel classification leaves two artefacts, both from the ~3% of pixels in
 * the valley between the two modes: dark speckle along every antialiased edge
 * where amber meets navy, and the render's floor shadow breaking into grey
 * blotches. Neither is a colour problem — an ambiguous pixel surrounded by
 * background is background, and a box blur says exactly that.
 *
 * It also feathers the silhouette, which a hard mask would leave stair-stepped
 * against the flat sand.
 */
function smoothMask(mask, width, height, radius) {
  const pass = (src, horizontal) => {
    const dst = new Float32Array(src.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        let n = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const sx = horizontal ? x + k : x;
          const sy = horizontal ? y : y + k;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
          sum += src[sy * width + sx];
          n += 1;
        }
        dst[y * width + x] = sum / n;
      }
    }
    return dst;
  };

  // Separable: two 1-D passes rather than one 2-D kernel.
  return pass(pass(mask, true), false);
}

export async function recolor(inPath, outPath) {
  const { data, info } = await sharp(inPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(data.length);

  const panelH = height / 2;

  // Classify every pixel, then clean the mask up as a whole before using it.
  const raw = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += channels, p += 1) {
    raw[p] = blueness(data[i], data[i + 1], data[i + 2]);
  }
  const mask = smoothMask(raw, width, height, 2);

  for (let i = 0; i < data.length; i += channels) {
    const p = i / channels;
    const px = p % width;
    const py = Math.floor(p / width);

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Push the blurred mask back toward its extremes so the figure keeps a
    // crisp silhouette; the blur is there to kill speckle, not to soften edges
    // into a halo.
    const m = mask[p];
    const t = m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
    const sand = sandAt(px, py, width, panelH);
    const ember = toEmber(r, g, b);

    out[i] = clamp255(lerp(ember[0], sand[0], t));
    out[i + 1] = clamp255(lerp(ember[1], sand[1], t));
    out[i + 2] = clamp255(lerp(ember[2], sand[2], t));
    for (let ch = 3; ch < channels; ch += 1) out[i + ch] = data[i + ch];
  }

  // Redraw the panel divider. The original is a pale hairline that the mask
  // classifies as background and replaces, and without it the start and end
  // positions run together into one tall image.
  // Three pixels, not one: the original hairline carries a compression halo a
  // pixel either side of it, and a 1px replacement leaves that dirt showing.
  const divY = Math.round(panelH);
  for (let dy = -1; dy <= 1; dy += 1) {
    const y = divY + dy;
    if (y < 0 || y >= height) continue;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      out[i] = DIVIDER[0];
      out[i + 1] = DIVIDER[1];
      out[i + 2] = DIVIDER[2];
    }
  }

  await sharp(out, { raw: { width, height, channels } })
    // 4:4:4 keeps the ember edges from bleeding — the mannequin is the one
    // saturated thing in the frame and chroma subsampling smears its outline
    // against the light sand. 76 pays for that with detail nobody looks at in a
    // reference diagram, and lands the whole set below its original weight.
    .jpeg({ quality: 76, chromaSubsampling: '4:4:4' })
    .toFile(outPath);

  return outPath;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const [, , arg, outArg] = process.argv;

if (arg === '--all') {
  const files = (await readdir(DEMO_DIR)).filter((f) => f.endsWith('.jpg'));
  for (const file of files) {
    const p = path.join(DEMO_DIR, file);
    await recolor(p, p);
    process.stdout.write(`recoloured ${file}\n`);
  }
  process.stdout.write(`\n${files.length} files\n`);
} else if (arg) {
  const out = outArg ?? arg.replace(/\.jpg$/, '.recolored.jpg');
  await recolor(arg, out);
  process.stdout.write(`${out}\n`);
} else {
  process.stdout.write('usage: node scripts/recolor-demos.mjs <file.jpg|--all>\n');
}
