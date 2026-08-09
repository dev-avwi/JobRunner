import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../assets/adaptive-icon.png');
const OUT = path.resolve(__dirname, '../assets/adaptive-icon-monochrome.png');

const SIZE = 432;

const img = sharp(SRC).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  const r = data[i * channels];
  const g = data[i * channels + 1];
  const b = data[i * channels + 2];
  const a = channels === 4 ? data[i * channels + 3] : 255;
  // Coverage = alpha * (1 - luminance/255 dampening). We treat any non-transparent
  // pixel as part of the silhouette but weight by alpha and content brightness so
  // anti-aliased edges remain smooth.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Pixels close to white (background) should fade. Pixels with strong color/dark
  // content stay opaque.
  const coverage = a / 255 * Math.max(0, 1 - Math.pow(lum, 2));
  const alpha = Math.round(coverage * 255);
  out[i * 4] = 255;
  out[i * 4 + 1] = 255;
  out[i * 4 + 2] = 255;
  out[i * 4 + 3] = alpha;
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT}`);
