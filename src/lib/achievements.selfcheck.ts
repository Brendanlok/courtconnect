// Offline proof of badge-earning logic. Run with: npx tsx src/lib/achievements.selfcheck.ts
import assert from 'node:assert';
import { computeEarnedBadgeIds } from './achievements';
import type { Match, UserProfile } from '@/types';

const USER = { uid: 'me' } as UserProfile;

function match(overrides: Partial<Match>): Match {
  return {
    id: 'm', type: 'MS', player1Id: 'me', player1Name: 'Me', player1Username: 'me',
    player2Id: 'opp', player2Name: 'Opp', player2Username: 'opp',
    winnerId: 'me', games: [{ p1: 21, p2: 15 }], status: 'Confirmed', playedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// 1. No confirmed wins → no badges at all.
{
  const earned = computeEarnedBadgeIds([match({ status: 'Pending' })], USER);
  assert.deepStrictEqual(earned, []);
}
console.log('PASS no confirmed matches earns nothing');

// 2. A single confirmed win earns first_win but not the match-count milestones.
{
  const earned = computeEarnedBadgeIds([match({})], USER);
  assert.ok(earned.includes('first_win'));
  assert.ok(!earned.includes('first_ten'));
}
console.log('PASS first_win earned on first confirmed win, milestones not yet');

// 3. Exactly 10 confirmed matches earns first_ten but not half_century.
{
  const matches = Array.from({ length: 10 }, (_, i) => match({ id: `m${i}`, playedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
  const earned = computeEarnedBadgeIds(matches, USER);
  assert.ok(earned.includes('first_ten'));
  assert.ok(!earned.includes('half_century'));
}
console.log('PASS first_ten earned at 10 confirmed matches, half_century not yet');

// 4. Exactly 50 confirmed matches earns half_century but not century_club.
{
  const matches = Array.from({ length: 50 }, (_, i) => match({ id: `m${i}`, playedAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-01T00:00:00Z` }));
  const earned = computeEarnedBadgeIds(matches, USER);
  assert.ok(earned.includes('half_century'));
  assert.ok(!earned.includes('century_club'));
}
console.log('PASS half_century earned at 50 confirmed matches, century_club not yet');

// 5. A 3-win streak earns hot_streak; a broken streak of only 2 does not.
{
  const streak3 = [match({ id: 'a' }), match({ id: 'b' }), match({ id: 'c' })];
  assert.ok(computeEarnedBadgeIds(streak3, USER).includes('hot_streak'));
  const streak2 = [match({ id: 'a' }), match({ id: 'b' }), match({ id: 'c', winnerId: 'opp' })];
  assert.ok(!computeEarnedBadgeIds(streak2, USER).includes('hot_streak'));
}
console.log('PASS hot_streak requires 3 confirmed wins in a row, not 2');

// 6. A 22-20 game win earns deuce_master; a plain 21-15 win does not.
{
  const deuce = [match({ games: [{ p1: 22, p2: 20 }] })];
  assert.ok(computeEarnedBadgeIds(deuce, USER).includes('deuce_master'));
  const plain = [match({ games: [{ p1: 21, p2: 15 }] })];
  assert.ok(!computeEarnedBadgeIds(plain, USER).includes('deuce_master'));
  const capped = [match({ games: [{ p1: 30, p2: 29 }] })];
  assert.ok(computeEarnedBadgeIds(capped, USER).includes('deuce_master'));
}
console.log('PASS deuce_master requires a 2-point-margin game at 22+ (or 30-29), not a routine win');

// 7. 5 confirmed matches on 5 distinct days within a week earns iron_man; spread
// over 8 days does not.
{
  const tightDays = ['01', '02', '03', '05', '07'].map((d, i) => match({ id: `d${i}`, playedAt: `2026-03-${d}T00:00:00Z` }));
  assert.ok(computeEarnedBadgeIds(tightDays, USER).includes('iron_man'));
  const looseDays = ['01', '03', '05', '07', '09'].map((d, i) => match({ id: `l${i}`, playedAt: `2026-03-${d}T00:00:00Z` }));
  assert.ok(!computeEarnedBadgeIds(looseDays, USER).includes('iron_man'));
}
console.log('PASS iron_man requires 5 distinct match-days within a 7-day span');

console.log('ALL PASS achievements');
