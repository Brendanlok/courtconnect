// Offline proof of club rivalry aggregation. Run with: npx tsx src/lib/clubRivalry.selfcheck.ts
import assert from 'node:assert';
import { computeClubRivalries } from './clubRivalry';

const clubA = ['a1', 'a2'];
const clubB = { id: 'b', memberIds: ['b1', 'b2'] };
const clubC = { id: 'c', memberIds: ['c1'] };

// 1. A cross-club match credits the right side and attributes it to the right rival club.
{
  const rivalries = computeClubRivalries(
    [{ player1Id: 'a1', player2Id: 'b1', winnerId: 'a1' }],
    clubA, [clubB, clubC],
  );
  const vsB = rivalries.find(r => r.clubId === 'b')!;
  assert.deepStrictEqual([vsB.wins, vsB.losses, vsB.played], [1, 0, 1]);
  assert.ok(!rivalries.some(r => r.clubId === 'c'), 'no match played against club C, so it should not appear');
}
console.log('PASS a cross-club win is credited to the correct rival club');

// 2. A match where both players are in this club (internal ladder territory) is ignored.
{
  const rivalries = computeClubRivalries(
    [{ player1Id: 'a1', player2Id: 'a2', winnerId: 'a1' }],
    clubA, [clubB, clubC],
  );
  assert.strictEqual(rivalries.length, 0);
}
console.log('PASS an intra-club match is not counted as a rivalry');

// 3. A match where neither player is in this club is ignored.
{
  const rivalries = computeClubRivalries(
    [{ player1Id: 'b1', player2Id: 'c1', winnerId: 'b1' }],
    clubA, [clubB, clubC],
  );
  assert.strictEqual(rivalries.length, 0);
}
console.log('PASS a match not involving this club at all is ignored');

// 4. Losses count correctly, and multiple matches against the same rival club aggregate.
{
  const rivalries = computeClubRivalries(
    [
      { player1Id: 'a1', player2Id: 'b1', winnerId: 'b1' },
      { player1Id: 'a2', player2Id: 'b2', winnerId: 'a2' },
    ],
    clubA, [clubB, clubC],
  );
  const vsB = rivalries.find(r => r.clubId === 'b')!;
  assert.deepStrictEqual([vsB.wins, vsB.losses, vsB.played], [1, 1, 2]);
}
console.log('PASS multiple matches against the same rival club aggregate correctly');

// 5. A player in more than one club counts a single match toward each of their clubs.
{
  const clubD = { id: 'd', memberIds: ['a1'] }; // a1 also plays for club D
  const rivalries = computeClubRivalries(
    [{ player1Id: 'a1', player2Id: 'b1', winnerId: 'a1' }],
    clubB.memberIds, [clubD], // viewing from club B's side, opponent a1 is in club D
  );
  const vsD = rivalries.find(r => r.clubId === 'd')!;
  assert.deepStrictEqual([vsD.wins, vsD.losses], [0, 1]); // b1 lost, so club B is 0-1 vs club D
}
console.log('PASS a multi-club opponent still attributes the match to their other club');

console.log('ALL PASS clubRivalry');
