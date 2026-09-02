// Offline proof of reliability tiers + the provisional-opponent MMR discount.
// Run with: npx tsx src/lib/reliability.selfcheck.ts
import assert from 'node:assert';
import { getReliability, opponentReliabilityMultiplier, STALE_AFTER_DAYS } from './reliability';

const NOW_ISO = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// 1. Still in placement -> provisional, regardless of activity recency.
{
  const p = getReliability({ placementMatchesPlayed: 3, lastActiveAt: NOW_ISO, joinedAt: NOW_ISO });
  assert.strictEqual(p, 'provisional');
}
console.log('PASS a player mid-placement is provisional');

// 2. Placement done, played recently -> established.
{
  const p = getReliability({ placementMatchesPlayed: 10, lastActiveAt: daysAgo(2), joinedAt: daysAgo(200) });
  assert.strictEqual(p, 'established');
}
console.log('PASS a recently-active fully-placed player is established');

// 3. Placement done, no match in over STALE_AFTER_DAYS -> stale, not provisional.
{
  const p = getReliability({ placementMatchesPlayed: 10, lastActiveAt: daysAgo(STALE_AFTER_DAYS + 5), joinedAt: daysAgo(300) });
  assert.strictEqual(p, 'stale');
}
console.log('PASS a dormant fully-placed player is stale, distinct from provisional');

// 4. No lastActiveAt on record at all -> falls back to joinedAt (never persisted
//    yet, or pre-migration account) rather than crashing or reading as fresh.
{
  const p = getReliability({ placementMatchesPlayed: 10, joinedAt: daysAgo(STALE_AFTER_DAYS + 1) });
  assert.strictEqual(p, 'stale');
}
console.log('PASS missing lastActiveAt falls back to joinedAt');

// 5. A provisional opponent (singles) discounts the whole match's MMR swing.
{
  assert.strictEqual(opponentReliabilityMultiplier([{ placementMatchesPlayed: 4 }]), 0.6);
  assert.strictEqual(opponentReliabilityMultiplier([{ placementMatchesPlayed: 12 }]), 1);
}
console.log('PASS a provisional singles opponent discounts the MMR swing, an established one does not');

// 6. Doubles: either opposing player being provisional is enough to discount —
//    a team's rating is only as reliable as its least-tested member.
{
  const mult = opponentReliabilityMultiplier([{ placementMatchesPlayed: 40 }, { placementMatchesPlayed: 2 }]);
  assert.strictEqual(mult, 0.6);
}
console.log('PASS one provisional player on a doubles team is enough to discount the whole team');

// 7. Seed/demo opponents (isCalibrating always false for them) never trigger
//    the discount even with placementMatchesPlayed unset.
{
  assert.strictEqual(opponentReliabilityMultiplier([{ isDummy: true }]), 1);
}
console.log('PASS demo/seed opponents never trigger the provisional discount');

// 8. Seed/demo players are always 'established' — old joinedAt, no lastActiveAt,
//    but their rating is fixed showcase data, not a dormant real account.
{
  assert.strictEqual(getReliability({ isDummy: true, joinedAt: daysAgo(600) }), 'established');
}
console.log('PASS demo/seed players read as established, not stale');

console.log('ALL PASS reliability');
