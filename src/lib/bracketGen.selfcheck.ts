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

console.log('ALL PASS bracketGen');
