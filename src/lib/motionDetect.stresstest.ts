// Stress-test motionCentroid against two realistic gym-court failure modes
// that the single-clean-blob selfcheck doesn't cover, standing in for the
// real-camera test Lok hasn't had time to run yet (28.07.2026 To-Do note):
// (1) whole-frame lighting flicker (fluorescent gym lights / auto-exposure),
// (2) two players moving at once instead of one clean blob.
// Run with: npx tsx src/lib/motionDetect.stresstest.ts
import assert from 'node:assert';
import { motionCentroid } from './motionDetect';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Whole-frame brightness flicker (no real motion) must not report a
// centroid — a fixed per-pixel threshold is exactly what flicker defeats,
// since every pixel shifts by roughly the same amount, not just the play area.
{
  const w = 40, h = 30;
  const rand = mulberry32(7);
  const prev = new Uint8ClampedArray(w * h);
  for (let i = 0; i < prev.length; i++) prev[i] = 100 + Math.round(rand() * 10);
  // Simulate a flicker: every pixel brightens by a uniform ~15 levels +/- noise.
  const curr = new Uint8ClampedArray(w * h);
  for (let i = 0; i < curr.length; i++) curr[i] = prev[i] + 15 + Math.round((rand() - 0.5) * 4);

  const c = motionCentroid(prev, curr, w, h);
  // Known real gap: default pixelThreshold=30 is comfortably above a ~15-level
  // flicker, so this passes today. Documented as a regression guard, not a
  // new finding — if pixelThreshold or camera auto-exposure range changes,
  // this is the check that should catch a flicker-triggers-false-motion bug.
  assert.strictEqual(c, null, 'uniform brightness flicker must not register as motion');
}
console.log('PASS whole-frame lighting flicker does not trigger a false centroid');

// 2. Two players moving simultaneously in different corners: centroid lands
// at the blended midpoint between them, not at either player. Expected
// behavior for a single-centroid design (this is a heatmap of "where play
// is happening broadly", not per-player skeleton tracking) - this proves
// the midpoint is at least still somewhere sane on court, not thrown off
// into a corner or NaN, and documents the known precision ceiling.
{
  const w = 100, h = 100;
  const prev = new Uint8ClampedArray(w * h).fill(100);
  const curr = new Uint8ClampedArray(prev);
  // Player A near (20,20), player B near (80,80) - opposite corners.
  for (let y = 18; y <= 22; y++) for (let x = 18; x <= 22; x++) curr[y * w + x] = 200;
  for (let y = 78; y <= 82; y++) for (let x = 78; x <= 82; x++) curr[y * w + x] = 200;

  const c = motionCentroid(prev, curr, w, h, 30, 5);
  assert(c, 'expected a centroid with two simultaneous blobs, got null');
  // Known ceiling: two equal-size blobs average to the midpoint (~0.5, 0.5),
  // not either player's real position. A heatmap built from many frames
  // still trends toward real hotspots over a match (this is one frame), but
  // a single frame like this is not representative of either player alone.
  assert(Math.abs(c!.x - 0.5) < 0.05 && Math.abs(c!.y - 0.5) < 0.05,
    `expected blended midpoint ~(0.5,0.5) for two equal blobs, got (${c!.x}, ${c!.y})`);
}
console.log('PASS two simultaneous movers blend to midpoint, not garbage/NaN — documents single-centroid precision ceiling');

console.log('\nAll checks passed.');
