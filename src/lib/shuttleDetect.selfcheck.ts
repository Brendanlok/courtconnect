// Offline proof the shuttle-hit onset detection math is correct.
// Run with: npx tsx src/lib/shuttleDetect.selfcheck.ts
import assert from 'node:assert';
import { computeFrameEnergies, detectHitsFromEnergies } from './shuttleDetect';

// 0. Frame energy: a loud burst inside quiet samples should stand out.
{
  const sampleRate = 1000; // 1 sample/ms for easy reasoning
  const samples = new Float32Array(2000).fill(0.001); // near-silence
  for (let i = 500; i < 520; i++) samples[i] = 0.9; // 20ms burst at t=0.5s
  const energies = computeFrameEnergies(samples, sampleRate, 20); // 20ms frames -> 100 frames
  const burstFrame = Math.floor(500 / 20);
  assert(energies[burstFrame] > energies[0] * 10, 'burst frame should have much higher energy than silence');
}
console.log('PASS frame energy highlights a loud burst over silence');

// 1. Detection: several isolated spikes on a quiet floor -> one hit each, at
// the right frame, none from the quiet floor itself.
{
  const frameCount = 300; // 300 frames * 20ms = 6s
  const energies = new Float32Array(frameCount).fill(0.001);
  const spikeFrames = [60, 150, 250]; // 1.2s, 3.0s, 5.0s
  spikeFrames.forEach(f => { energies[f] = 0.5; });
  const hits = detectHitsFromEnergies(energies, 20);
  assert.strictEqual(hits.length, spikeFrames.length, `expected ${spikeFrames.length} hits, got ${hits.length}: ${hits}`);
  spikeFrames.forEach((f, i) => {
    const expected = (f * 20) / 1000;
    assert(Math.abs(hits[i] - expected) < 0.001, `hit ${i} expected ~${expected}s, got ${hits[i]}s`);
  });
}
console.log('PASS detects isolated spikes at correct timestamps, ignores quiet floor');

// 2. Refractory period: two spikes closer together than MIN_GAP_MS collapse
// into one reported hit, not two.
{
  const frameCount = 200;
  const energies = new Float32Array(frameCount).fill(0.001);
  energies[60] = 0.5;
  energies[65] = 0.5; // 100ms later — inside the 300ms refractory window
  const hits = detectHitsFromEnergies(energies, 20);
  assert.strictEqual(hits.length, 1, `expected the two close spikes to collapse into 1 hit, got ${hits.length}`);
}
console.log('PASS refractory period collapses two close spikes into one hit');

// 3. Pure silence (below MIN_ENERGY floor) never reports a hit, even with
// tiny random-looking fluctuation that a naive stddev threshold might catch.
{
  const frameCount = 200;
  const energies = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) energies[i] = 0.001 + (i % 3) * 0.0001;
  const hits = detectHitsFromEnergies(energies, 20);
  assert.strictEqual(hits.length, 0, `expected no hits in near-silence, got ${hits.length}`);
}
console.log('PASS near-silence never triggers a false hit');

console.log('\nAll checks passed.');
