// Offline proof the Phase 2 motion-centroid math is correct.
// Run with: npx tsx src/lib/motionDetect.selfcheck.ts
import assert from 'node:assert';
import { computeCoverCrop, toGrayscale, motionCentroid } from './motionDetect';

// 0. object-fit: cover crop rect.
{
  // Same aspect ratio -> full frame, no crop.
  let c = computeCoverCrop(1280, 720, 320, 180);
  assert.deepStrictEqual(c, { sx: 0, sy: 0, sw: 1280, sh: 720 });

  // Video wider than container -> crop left/right, sh stays full video height.
  c = computeCoverCrop(1280, 720, 200, 180);
  assert(c.sy === 0 && c.sh === 720, `expected full-height crop, got ${JSON.stringify(c)}`);
  assert(c.sx > 0 && c.sw < 1280, `expected left/right crop, got ${JSON.stringify(c)}`);

  // Portrait video into a landscape container -> crop top/bottom.
  c = computeCoverCrop(720, 1280, 320, 180);
  assert(c.sx === 0 && c.sw === 720, `expected full-width crop, got ${JSON.stringify(c)}`);
  assert(c.sy > 0 && c.sh < 1280, `expected top/bottom crop, got ${JSON.stringify(c)}`);

  // Zero-size container (pre-layout) must not divide by zero / NaN out.
  c = computeCoverCrop(1280, 720, 0, 0);
  assert(Number.isFinite(c.sw) && Number.isFinite(c.sh));
}
console.log('PASS object-fit: cover crop rect matches CSS behaviour, no div-by-zero');

// 1. Grayscale conversion — known RGBA pixel -> known luma.
{
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]); // red px, green px
  const gray = toGrayscale(data, 2, 1);
  assert.strictEqual(gray[0], Math.round(0.299 * 255));
  assert.strictEqual(gray[1], Math.round(0.587 * 255));
}
console.log('PASS grayscale luma conversion');

// 2. A moved 3x3 blob on an otherwise-static 10x10 frame should recover the
// blob's centroid, not get thrown off by nothing else changing.
{
  const w = 10, h = 10;
  const prev = new Uint8ClampedArray(w * h).fill(100);
  const curr = new Uint8ClampedArray(prev);
  for (let y = 6; y <= 8; y++) for (let x = 6; x <= 8; x++) curr[y * w + x] = 200;
  const c = motionCentroid(prev, curr, w, h, 30, 5);
  assert(c, 'expected a centroid, got null');
  assert(Math.abs(c!.x - 0.75) < 0.02, `expected x≈0.75, got ${c!.x}`);
  assert(Math.abs(c!.y - 0.75) < 0.02, `expected y≈0.75, got ${c!.y}`);
}
console.log('PASS recovers centroid of a moved blob');

// 3. Identical frames (no motion between samples) -> null, not a false blip.
{
  const w = 10, h = 10;
  const prev = new Uint8ClampedArray(w * h).fill(120);
  const curr = new Uint8ClampedArray(prev);
  assert.strictEqual(motionCentroid(prev, curr, w, h), null);
}
console.log('PASS identical frames report no motion');

// 4. Diff below pixelThreshold (sensor/compression noise) must not count as
// motion — only real movement should ever move the heatmap dot.
{
  const w = 10, h = 10;
  const prev = new Uint8ClampedArray(w * h).fill(120);
  const curr = new Uint8ClampedArray(w * h).fill(124); // 4-level diff, well under default threshold 30
  assert.strictEqual(motionCentroid(prev, curr, w, h), null);
}
console.log('PASS sub-threshold noise does not register as motion');

console.log('\nAll checks passed.');
