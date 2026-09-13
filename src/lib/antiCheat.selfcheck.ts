// Offline proof the anti-cheat opponent-counting logic is correct.
// Run with: npx tsx src/lib/antiCheat.selfcheck.ts
import assert from 'node:assert';
import { antiCheatCheck, liveBonusEligible } from './antiCheat';
import type { Match } from '@/types';

const DAY = 24 * 3600 * 1000;
const now = () => new Date(Date.now() - 2 * DAY).toISOString(); // well inside the 7-day window, outside today

function match(overrides: Partial<Match>): Match {
  return {
    id: 'm', type: 'MD', player1Id: 'me', player1Name: 'Me', player1Username: 'me',
    player2Id: 'x', player2Name: 'X', player2Username: 'x',
    games: [{ p1: 21, p2: 15 }], status: 'Confirmed', playedAt: now(),
    ...overrides,
  };
}

// 1. The bug fixed today: playing doubles matches PARTNERED WITH someone must
// never count them as an opponent, no matter how many times.
{
  const partneredMatches: Match[] = Array.from({ length: 5 }, () =>
    match({ player1Id: 'me', player1PartnerId: 'X', player2Id: 'opp1' }));
  const blocked = antiCheatCheck(partneredMatches, 'me', ['X']);
  assert.strictEqual(blocked, null, 'partnering with X repeatedly must never count X as an opponent');
}
console.log('PASS playing WITH someone as a partner never counts them as an opponent');

// 2. The actual rule still works: playing AGAINST the same opponent 3+ times
// in 7 days is blocked, whether I'm player1 or player2.
{
  const asP1: Match[] = Array.from({ length: 3 }, () => match({ player1Id: 'me', player2Id: 'rival' }));
  assert.ok(antiCheatCheck(asP1, 'me', ['rival']), '3 matches against rival as player1 should block a 4th');

  const asP2: Match[] = Array.from({ length: 3 }, () => match({ player1Id: 'rival', player2Id: 'me' }));
  assert.ok(antiCheatCheck(asP2, 'me', ['rival']), '3 matches against rival as player2 should block a 4th');
}
console.log('PASS 3+ matches against the same real opponent in 7 days is still blocked');

// 3. A doubles opponent's partner (the actual opposing side) still counts,
// only MY OWN partner is excluded.
{
  const vsOppPair: Match[] = Array.from({ length: 3 }, () =>
    match({ player1Id: 'me', player1PartnerId: 'myPartner', player2Id: 'opp1', player2PartnerId: 'opp2' }));
  assert.ok(antiCheatCheck(vsOppPair, 'me', ['opp2']), 'the actual opposing partner should still count as an opponent');
  assert.strictEqual(antiCheatCheck(vsOppPair, 'me', ['myPartner']), null, 'my own partner should never count, even across many matches');
}
console.log('PASS opposing-side partner still counts, my own partner never does');

// 4. Rule 3 (daily +150 MMR cap) had zero coverage before today — this is the
// exact bug class fixed across page.tsx/LogMatchModal/LiveMatchModal, where
// call sites passed the real user.uid instead of the 'me' sentinel that
// matches (from useApp()) actually use for the signed-in user's own side.
{
  const bigWins: Match[] = Array.from({ length: 2 }, () =>
    match({ player1Id: 'me', player2Id: 'opp', winnerId: 'me', mmrChange: 80, playedAt: new Date().toISOString() }));
  assert.ok(antiCheatCheck(bigWins, 'me', ['someoneElse']), '2 wins worth 160 MMR today should hit the 150 daily cap');
  assert.strictEqual(antiCheatCheck(bigWins, 'me-typo' as string, ['someoneElse']), null,
    'sanity check: passing the wrong sentinel silently defeats the cap (this is exactly the bug that shipped)');
}
console.log('PASS daily +150 MMR cap triggers on real wins, and only when userId matches the matches array convention');

// 5. liveBonusEligible has the same 'me'-vs-userId requirement.
{
  const liveWins: Match[] = Array.from({ length: 3 }, () => match({ recordedLive: true, playedAt: new Date().toISOString() }));
  assert.strictEqual(liveBonusEligible(liveWins, 'me'), false, '3 live-bonused matches today should exhaust the daily bonus cap');
}
console.log('PASS liveBonusEligible daily cap triggers when userId matches the matches array convention');

console.log('\nAll checks passed.');
