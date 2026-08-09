import type { Match, Tournament, UserProfile } from '@/types';

// Achievement badges — computed live from match history + profile on every
// render (useMemo in AppContext), not stored anywhere. Every input already
// exists in Match/UserProfile, so there's no new schema, no award-and-persist
// pipeline, no migration: "earned" is just a pure function of data already
// loaded for every other screen.
export interface Badge {
  id: string;
  name: string;
  description: string;
}

export const BADGES: Badge[] = [
  { id: 'first_win',     name: 'First Win',     description: 'Win your first confirmed match.' },
  { id: 'hot_streak',    name: 'Hot Streak',    description: 'Win 3 confirmed matches in a row.' },
  { id: 'giant_slayer',  name: 'Giant Slayer',  description: 'Beat a much higher-rated opponent.' },
  { id: 'comeback_king', name: 'Comeback King', description: 'Win a match after a 5+ point comeback in a game.' },
  { id: 'bagel',         name: 'Bagel',         description: 'Win a game 21-0.' },
  { id: 'marathon',      name: 'Marathon',      description: 'Play a live match lasting 45+ minutes.' },
  { id: 'first_ten',     name: 'First Ten',     description: 'Play 10 confirmed matches.' },
  { id: 'half_century',  name: 'Half Century',  description: 'Play 50 confirmed matches.' },
  { id: 'century_club',  name: 'Century Club',  description: 'Play 100 confirmed matches.' },
  { id: 'champion',      name: 'Champion',      description: 'Win a tournament.' },
];

// A larger mmrChange gain on a win implies a much higher-rated opponent (the
// Elo formula in calcMMRChange awards more for beating a stronger player) —
// 24+ corresponds to roughly a 200+ MMR gap. Approximate, but reuses the
// number already stored on every match instead of adding opponent-MMR
// tracking just for this one badge.
const GIANT_SLAYER_MMR_GAIN = 24;
const COMEBACK_THRESHOLD = 5;
const MARATHON_SEC = 45 * 60;
const HOT_STREAK = 3;
const CENTURY = 100;

// Match-count badges have an obvious "X of Y" — worth surfacing on the
// unearned card instead of leaving it a flat greyed-out tile with no sense
// of how close you are. The other badges (streaks, one-off feats) don't have
// a clean linear progress metric, so they're left as plain earned/not-earned.
export const MATCH_COUNT_MILESTONE: Record<string, number> = {
  first_ten: 10, half_century: 50, century_club: CENTURY,
};

// Matches from useApp() are always normalized so player1/games.p1 is "me" and
// winnerId === 'me' means I won — see toLocalMatch in AppContext.
export function computeEarnedBadgeIds(matches: Match[], user: UserProfile, tournaments: Tournament[] = []): string[] {
  const confirmed = [...matches]
    .filter(m => m.status === 'Confirmed')
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  const wins = confirmed.filter(m => m.winnerId === user.uid);
  const earned = new Set<string>();

  if (wins.length > 0) earned.add('first_win');

  let curStreak = 0, maxStreak = 0;
  for (const m of confirmed) {
    if (m.winnerId === user.uid) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
    else curStreak = 0;
  }
  if (maxStreak >= HOT_STREAK) earned.add('hot_streak');

  if (wins.some(m => (m.mmrChange ?? 0) >= GIANT_SLAYER_MMR_GAIN)) earned.add('giant_slayer');

  if (wins.some(m => (m.liveStats?.biggestComebackPoints ?? 0) >= COMEBACK_THRESHOLD)) earned.add('comeback_king');

  if (confirmed.some(m => m.games.some(g => g.p2 === 0 && g.p1 >= 21))) earned.add('bagel');

  if (confirmed.some(m => (m.liveStats?.durationSec ?? 0) >= MARATHON_SEC)) earned.add('marathon');

  if (confirmed.length >= 10) earned.add('first_ten');
  if (confirmed.length >= 50) earned.add('half_century');
  if (confirmed.length >= CENTURY) earned.add('century_club');

  if (tournaments.some(t => t.championUsername === user.username)) earned.add('champion');

  return [...earned];
}
