// Offline proof of club ladder aggregation. Run with: npx tsx src/lib/clubLadder.selfcheck.ts
import assert from 'node:assert';
import { computeLadder } from './clubLadder';

const id = (u: string) => u; // identity resolver for these checks

// 1. A single match credits a win to the winner and a loss to the loser.
{
  const ladder = computeLadder([{ player1Id: 'a', player2Id: 'b', winnerId: 'a' }], id);
  const a = ladder.find(e => e.uid === 'a')!;
  const b = ladder.find(e => e.uid === 'b')!;
  assert.deepStrictEqual([a.wins, a.losses, a.played], [1, 0, 1]);
  assert.deepStrictEqual([b.wins, b.losses, b.played], [0, 1, 1]);
}
console.log('PASS a single match credits winner and loser correctly');

// 2. Standings sort by win rate first, then total wins as a tiebreaker.
{
  const ladder = computeLadder([
    { player1Id: 'a', player2Id: 'b', winnerId: 'a' },
    { player1Id: 'a', player2Id: 'c', winnerId: 'a' },
    { player1Id: 'b', player2Id: 'c', winnerId: 'b' },
  ], id);
  assert.deepStrictEqual(ladder.map(e => e.uid), ['a', 'b', 'c']);
}
console.log('PASS standings sort by win rate, then total wins');

// 3. A player with a worse win rate but more matches played must not outrank
//    a player with a better win rate on fewer matches (regression: sort used
//    to fall back to matches-played, rewarding more losses).
{
  const heavyLosses = Array.from({ length: 10 }, () => ({ player1Id: 'a', player2Id: 'x', winnerId: 'x' }));
  const ladder = computeLadder([
    ...heavyLosses,
    { player1Id: 'a', player2Id: 'x', winnerId: 'a' },
    { player1Id: 'a', player2Id: 'x', winnerId: 'a' },
    { player1Id: 'a', player2Id: 'x', winnerId: 'a' },
    { player1Id: 'b', player2Id: 'y', winnerId: 'b' },
    { player1Id: 'b', player2Id: 'y', winnerId: 'b' },
    { player1Id: 'b', player2Id: 'y', winnerId: 'b' },
  ], id);
  const aIdx = ladder.findIndex(e => e.uid === 'a');
  const bIdx = ladder.findIndex(e => e.uid === 'b');
  assert.ok(bIdx < aIdx, 'a 3-win/13-played record must not outrank b\'s 3-win/3-played record');
}
console.log('PASS win rate beats raw matches played in the tiebreak');

// 4. toLocalId lets a real uid collapse onto the caller's own "me" convention.
{
  const toLocal = (u: string) => u === 'real123' ? 'me' : u;
  const ladder = computeLadder([{ player1Id: 'real123', player2Id: 'x', winnerId: 'real123' }], toLocal);
  assert.ok(ladder.some(e => e.uid === 'me' && e.wins === 1));
  assert.ok(!ladder.some(e => e.uid === 'real123'));
}
console.log('PASS toLocalId resolves the current user\'s real uid onto "me"');

console.log('ALL PASS clubLadder');
