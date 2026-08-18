// Offline proof of bracket generation + progression. Run with: npx tsx src/lib/bracketGen.selfcheck.ts
import assert from 'node:assert';
import { generateBracket, reportBracketResult, bracketChampion } from './bracketGen';
import type { BracketMatch } from '@/types';

const p = (n: string) => ({ displayName: n, username: n.toLowerCase() });

// 1. 4 participants, no byes: 2 round-1 matches (all real names), 1 final (all TBD).
{
  const bracket = generateBracket([p('A'), p('B'), p('C'), p('D')]);
  const r1 = bracket.filter(b => b.round === 1);
  const r2 = bracket.filter(b => b.round === 2);
  assert.strictEqual(r1.length, 2);
  assert.strictEqual(r2.length, 1);
  // player1/player2 store usernames now, not display names.
  const r1Names = r1.flatMap(m => [m.player1, m.player2]).sort();
  assert.deepStrictEqual(r1Names, ['a', 'b', 'c', 'd']);
  assert.ok(r1.every(m => !m.winner));
  assert.strictEqual(r2[0].player1, 'TBD');
  assert.strictEqual(r2[0].player2, 'TBD');
}
console.log('PASS 4 participants: 2 round-1 matches, empty final');

// 2. 3 participants: one bye auto-advances into the final immediately.
{
  const bracket = generateBracket([p('A'), p('B'), p('C')]);
  const r1 = bracket.filter(b => b.round === 1);
  const r2 = bracket.filter(b => b.round === 2);
  assert.strictEqual(r1.length, 2);
  const byeMatch = r1.find(m => m.player1 === 'BYE' || m.player2 === 'BYE');
  assert.ok(byeMatch, 'one round-1 match should be a bye');
  assert.ok(byeMatch!.winner, 'bye auto-advances a winner');
  assert.strictEqual(r2.length, 1);
  const finalNames = [r2[0].player1, r2[0].player2];
  assert.ok(finalNames.includes(byeMatch!.winner), 'bye winner pre-fills the final');
  assert.ok(finalNames.includes('TBD'), 'other final slot waits on the live match');
}
console.log('PASS 3 participants: bye auto-advances into the final');

// 3. Reporting a result propagates the winner into the next round's correct slot.
{
  const bracket: BracketMatch[] = [
    { id: 'b1_0', round: 1, player1: 'A', player2: 'B', winner: undefined, score: undefined },
    { id: 'b1_1', round: 1, player1: 'C', player2: 'D', winner: undefined, score: undefined },
    { id: 'b2_0', round: 2, player1: 'TBD', player2: 'TBD', winner: undefined, score: undefined },
  ];
  const afterFirst = reportBracketResult(bracket, 'b1_0', 'A', '21-15');
  const final1 = afterFirst.find(b => b.id === 'b2_0')!;
  assert.strictEqual(final1.player1, 'A');
  assert.strictEqual(final1.player2, 'TBD');
  assert.strictEqual(bracketChampion(afterFirst), null, 'no champion until the final is decided');

  const afterSecond = reportBracketResult(afterFirst, 'b1_1', 'D', '21-19');
  const final2 = afterSecond.find(b => b.id === 'b2_0')!;
  assert.strictEqual(final2.player1, 'A');
  assert.strictEqual(final2.player2, 'D');

  const afterFinal = reportBracketResult(afterSecond, 'b2_0', 'D', '21-10');
  assert.strictEqual(bracketChampion(afterFinal), 'D');
}
console.log('PASS reporting results propagates winners round to round, champion resolves at the final');

// 4. Reporting against an unknown match id is a no-op.
{
  const bracket: BracketMatch[] = [{ id: 'b1_0', round: 1, player1: 'A', player2: 'B', winner: undefined, score: undefined }];
  const result = reportBracketResult(bracket, 'nope', 'A');
  assert.deepStrictEqual(result, bracket);
}
console.log('PASS unknown match id is a no-op');

// 5. Two participants sharing a display name still resolve to distinct
// identities throughout - the actual bug this was built to prevent
// (previously player1/player2/winner stored displayName, so a name
// collision could advance/credit the wrong account).
{
  const dup1 = { displayName: 'Alex', username: 'alex_kl' };
  const dup2 = { displayName: 'Alex', username: 'alex_penang' };
  const bracket = generateBracket([dup1, dup2]);
  const r1Usernames = [bracket[0].player1, bracket[0].player2].sort();
  assert.deepStrictEqual(r1Usernames, ['alex_kl', 'alex_penang'], 'same display name must still produce distinct usernames in the bracket');

  const afterResult = reportBracketResult(bracket, bracket[0].id, 'alex_penang', '21-10');
  assert.strictEqual(bracketChampion(afterResult), 'alex_penang', 'champion resolves to the exact username that won, not just a matching display name');
}
console.log('PASS duplicate display names stay distinguishable by username');

// 6. Every participant count from 2-20 must generate without throwing, and
// every round-1 match must have at least one real player (no null-vs-null
// bye pairing). Regression test for a real crash: byes used to be appended
// as trailing nulls, so 2+ byes (e.g. 5, 6, 9-14, 17-20 participants) paired
// null with null and threw reading `.username` off both-null slots.
for (let n = 2; n <= 20; n++) {
  const participants = Array.from({ length: n }, (_, i) => p(`P${i}`));
  const bracket = generateBracket(participants);
  const r1 = bracket.filter(b => b.round === 1);
  for (const m of r1) {
    assert.ok(m.player1 !== 'BYE' || m.player2 !== 'BYE', `${n} participants: a round-1 match can't be BYE vs BYE`);
  }
  const totalByes = r1.filter(m => m.player1 === 'BYE' || m.player2 === 'BYE').length;
  const size = 2 ** Math.ceil(Math.log2(n));
  assert.strictEqual(totalByes, size - n, `${n} participants: expected ${size - n} byes`);
}
console.log('PASS 2-20 participants all generate without a null-vs-null bye match');

console.log('ALL PASS bracketGen');
