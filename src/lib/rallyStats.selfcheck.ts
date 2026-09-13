// Offline proof of rally clustering. Run with: npx tsx src/lib/rallyStats.selfcheck.ts
import assert from 'node:assert';
import { computeRallyStats } from './rallyStats';

// 1. No hits — nothing to report.
{
  assert.strictEqual(computeRallyStats([]), null);
}
console.log('PASS empty input returns null');

// 2. Hits close together (< 4s apart) form one rally.
{
  const r = computeRallyStats([1, 2, 3.5, 5]);
  assert.strictEqual(r!.rallyCount, 1);
  assert.strictEqual(r!.longestRallyHits, 4);
}
console.log('PASS tightly spaced hits collapse into a single rally');

// 3. A gap > 4s starts a new rally.
{
  const r = computeRallyStats([1, 2, 10, 11, 12]);
  assert.strictEqual(r!.rallyCount, 2);
  assert.strictEqual(r!.longestRallyHits, 3); // the [10,11,12] rally
}
console.log('PASS a >4s gap splits into a new rally');

// 4. Unsorted input is handled the same as sorted.
{
  const sorted = computeRallyStats([1, 2, 10, 11, 12]);
  const shuffled = computeRallyStats([11, 1, 12, 2, 10]);
  assert.deepStrictEqual(shuffled, sorted);
}
console.log('PASS unsorted hit timestamps produce the same result as sorted');

// 5. avgHitsPerRally averages across rallies correctly.
{
  const r = computeRallyStats([1, 2, 3, 10, 20]); // rally of 3, then two singles
  assert.strictEqual(r!.rallyCount, 3);
  assert.strictEqual(r!.avgHitsPerRally, Math.round((3 + 1 + 1) / 3 * 10) / 10);
}
console.log('PASS avgHitsPerRally averages hit counts across all rallies');

console.log('ALL PASS rallyStats');
