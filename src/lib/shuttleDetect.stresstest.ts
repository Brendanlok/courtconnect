// Stress-test shuttleDetect against a synthetic noisy-court recording, standing
// in for the real match recording Lok hasn't had time to test with yet
// (28.07.2026 To-Do note). shuttleDetect.selfcheck.ts proves the math is
// correct on near-silent audio; this proves the THRESHOLD_K=4.2 constant
// still tells hits from crowd/footstep noise once the floor isn't silent.
// Run with: npx tsx src/lib/shuttleDetect.stresstest.ts
import assert from 'node:assert';
import { computeFrameEnergies, detectHitsFromEnergies } from './shuttleDetect';

// Deterministic PRNG (mulberry32) so failures reproduce instead of flaking.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMatchAudio(seed: number) {
  const sampleRate = 8000;
  const durationS = 90;
  const n = sampleRate * durationS;
  const samples = new Float32Array(n);
  const rand = mulberry32(seed);
  const noise = () => (rand() * 2 - 1);

  // Ambient crowd/talk noise: slow-drifting amplitude so the local rolling
  // mean/stddev actually has something realistic to adapt to.
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const drift = 0.04 + 0.03 * Math.sin(t * 0.2) + 0.015 * Math.sin(t * 1.7 + 1);
    samples[i] = noise() * Math.max(0, drift);
  }

  // Footstep/court-squeak transients: duller and lower-peak than a shuttle
  // hit, ~50ms, roughly every 1-2s — this is the noise that made real hits
  // "feel random" per the 21.07 comment.
  const footstepTimes: number[] = [];
  for (let t = 0.5; t < durationS - 0.5; t += 1 + rand()) {
    footstepTimes.push(t);
    const start = Math.round(t * sampleRate);
    const len = Math.round(0.05 * sampleRate);
    for (let j = 0; j < len && start + j < n; j++) {
      samples[start + j] += noise() * 0.18 * (1 - j / len);
    }
  }

  // Shuttle hits: sharp ~15ms transients, spaced well beyond the 300ms
  // refractory window, at known ground-truth timestamps.
  const hitTimes: number[] = [];
  for (let t = 1.2; t < durationS - 1; t += 1.8 + rand() * 2.5) {
    hitTimes.push(t);
    const start = Math.round(t * sampleRate);
    const len = Math.round(0.015 * sampleRate);
    for (let j = 0; j < len && start + j < n; j++) {
      samples[start + j] += noise() * 0.8 * (1 - j / len * 0.3);
    }
  }

  return { samples, sampleRate, hitTimes, footstepTimes };
}

function scoreDetections(detected: number[], groundTruth: number[], toleranceS = 0.05) {
  const matchedGT = new Set<number>();
  let truePositives = 0;
  for (const d of detected) {
    const gi = groundTruth.findIndex((g, idx) => !matchedGT.has(idx) && Math.abs(g - d) <= toleranceS);
    if (gi !== -1) { matchedGT.add(gi); truePositives++; }
  }
  const falsePositives = detected.length - truePositives;
  const precision = detected.length ? truePositives / detected.length : 1;
  const recall = groundTruth.length ? truePositives / groundTruth.length : 1;
  return { truePositives, falsePositives, precision, recall };
}

// Run across a few seeds so one lucky/unlucky noise draw doesn't decide it.
const seeds = [1, 2, 3, 4, 5];
const results = seeds.map(seed => {
  const { samples, sampleRate, hitTimes } = buildMatchAudio(seed);
  const energies = computeFrameEnergies(samples, sampleRate);
  const detected = detectHitsFromEnergies(energies);
  const score = scoreDetections(detected, hitTimes);
  console.log(
    `seed ${seed}: ${hitTimes.length} real hits, ${detected.length} detected, ` +
    `precision ${(score.precision * 100).toFixed(0)}%, recall ${(score.recall * 100).toFixed(0)}%`
  );
  return score;
});

const avgPrecision = results.reduce((s, r) => s + r.precision, 0) / results.length;
const avgRecall = results.reduce((s, r) => s + r.recall, 0) / results.length;
console.log(`\nAverage across ${seeds.length} synthetic matches: precision ${(avgPrecision * 100).toFixed(0)}%, recall ${(avgRecall * 100).toFixed(0)}%`);

// Bar: footstep noise must not swamp the detector, and most real hits must
// survive. This is a synthetic proxy, not a substitute for Lok's real-court
// test — it only proves the current constants are in a sane ballpark against
// plausible court noise, not that real audio (racket squeak, other courts'
// hits bleeding in, wind on the mic) behaves identically.
assert(avgPrecision > 0.6, `precision too low against footstep noise: ${avgPrecision}`);
assert(avgRecall > 0.7, `recall too low, missing too many real hits: ${avgRecall}`);
console.log('PASS: THRESHOLD_K=4.2 holds up against synthetic footstep/crowd noise');
