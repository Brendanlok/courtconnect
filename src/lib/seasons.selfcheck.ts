// Offline proof of season date math. Run with: npx tsx src/lib/seasons.selfcheck.ts
import assert from 'node:assert';
import { seasonNumberForDate, seasonStartDate, seasonEndDate, softResetMmr, rolloverSeasons, SEASON_EPOCH, SEASON_LENGTH_DAYS } from './seasons';

// 1. The epoch instant itself is season 1.
{
  assert.strictEqual(seasonNumberForDate(new Date(SEASON_EPOCH)), 1);
}
console.log('PASS the epoch instant is season 1');

// 2. A date before the epoch never returns a season below 1.
{
  const before = new Date(new Date(SEASON_EPOCH).getTime() - 86_400_000 * 365);
  assert.strictEqual(seasonNumberForDate(before), 1);
}
console.log('PASS a date before the epoch clamps to season 1');

// 3. Exactly one season length after the epoch is season 2.
{
  const boundary = new Date(new Date(SEASON_EPOCH).getTime() + SEASON_LENGTH_DAYS * 86_400_000);
  assert.strictEqual(seasonNumberForDate(boundary), 2);
}
console.log('PASS one full season length after the epoch is season 2');

// 4. A moment 1ms before the season-2 boundary is still season 1.
{
  const justBefore = new Date(new Date(SEASON_EPOCH).getTime() + SEASON_LENGTH_DAYS * 86_400_000 - 1);
  assert.strictEqual(seasonNumberForDate(justBefore), 1);
}
console.log('PASS 1ms before the boundary is still the prior season');

// 5. seasonStartDate/seasonEndDate round-trip with seasonNumberForDate.
{
  const n = 5;
  const start = seasonStartDate(n);
  const end = seasonEndDate(n);
  assert.strictEqual(seasonNumberForDate(start), n);
  assert.strictEqual(seasonNumberForDate(new Date(end.getTime() - 1)), n);
  assert.strictEqual(seasonNumberForDate(end), n + 1);
}
console.log('PASS seasonStartDate/seasonEndDate bracket exactly the matching season number');

// 6. Soft reset regresses halfway toward the 1000 anchor, both above and below it.
{
  assert.strictEqual(softResetMmr(2000), 1500); // 1000 + (2000-1000)*0.5
  assert.strictEqual(softResetMmr(800),  900);  // 1000 + (800-1000)*0.5
  assert.strictEqual(softResetMmr(1000), 1000); // already at anchor, no change
}
console.log('PASS soft reset regresses halfway toward the 1000 anchor in both directions');

// 7. Rollover of a single season: one closing row, one soft reset.
{
  const { closed, mmr } = rolloverSeasons(2000, 3, 4);
  assert.deepStrictEqual(closed, [{ seasonNumber: 3, mmrEnd: 2000 }]);
  assert.strictEqual(mmr, 1500);
}
console.log('PASS rollover of one season closes one row and soft-resets once');

// 8. Rollover across skipped seasons: a row + a soft reset for EACH season left
//    behind, skipped seasons closing at the carried-in value.
{
  const { closed, mmr } = rolloverSeasons(2000, 3, 6);
  assert.deepStrictEqual(closed, [
    { seasonNumber: 3, mmrEnd: 2000 },
    { seasonNumber: 4, mmrEnd: 1500 },
    { seasonNumber: 5, mmrEnd: 1250 },
  ]);
  assert.strictEqual(mmr, 1125); // softResetMmr applied 3x from 2000
}
console.log('PASS rollover across skipped seasons backfills a row + reset per season');

// 9. No rollover when already current (defensive — the effect guards this too).
{
  const { closed, mmr } = rolloverSeasons(1400, 5, 5);
  assert.deepStrictEqual(closed, []);
  assert.strictEqual(mmr, 1400);
}
console.log('PASS rollover is a no-op when the stored season is already current');

console.log('ALL PASS seasons');
