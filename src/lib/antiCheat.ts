import type { Match } from '@/types';

// ── Shared MMR-farming guardrails — applies equally to Log Match and Live Match ──

export function antiCheatCheck(matches: Match[], userId: string, oppUids: string[]): string | null {
  const now = Date.now();
  const day  = 24 * 3600 * 1000;
  const week = 7 * day;

  // Rule 1: max 3 matches vs any of the same opponents in 7 days
  const recentVsOpp = matches.filter(m => {
    const opponentIds = [m.player1Id === userId ? null : m.player1Id, m.player2Id === userId ? null : m.player2Id,
      m.player1PartnerId, m.player2PartnerId].filter(Boolean) as string[];
    const involves = (m.player1Id === userId || m.player2Id === userId) &&
      opponentIds.some(id => oppUids.includes(id));
    return involves && (now - new Date(m.playedAt).getTime()) < week;
  });
  if (recentVsOpp.length >= 3) {
    return `You've already logged ${recentVsOpp.length} matches against this opponent in the past 7 days. Maximum is 3 per week to prevent MMR farming.`;
  }

  // Rule 2: max 2 matches vs same opponent today
  const todayVsOpp = recentVsOpp.filter(m => (now - new Date(m.playedAt).getTime()) < day);
  if (todayVsOpp.length >= 2) {
    return `You've already logged 2 matches against this opponent today. Come back tomorrow to log more.`;
  }

  // Rule 3: daily MMR gain cap — check confirmed wins today
  const todayWins = matches.filter(m =>
    (m.player1Id === userId || m.player2Id === userId) && m.winnerId === userId &&
    m.status === 'Confirmed' &&
    (now - new Date(m.playedAt).getTime()) < day
  );
  const todayGain = todayWins.reduce((s, m) => s + (m.mmrChange ?? 0), 0);
  if (todayGain >= 150) {
    return `You've already gained ${todayGain} MMR today. The daily cap is +150 MMR to keep ratings fair. Come back tomorrow!`;
  }

  return null; // all clear
}

// ── Live-match-specific guardrails ──────────────────────────────────────────────
// Live scoring earns an MMR bonus (it's harder to fake than typing in a final
// score), so it needs its own floor against trivial farm matches and its own
// cap on how often the bonus itself can be claimed per day.

const MIN_LIVE_DURATION_SEC = 90;   // a real rally-by-rally game can't finish faster than this
const MIN_LIVE_POINTS = 11;         // at least a partial single game's worth of points
export const LIVE_BONUS_MULTIPLIER = 1.1; // +10% MMR magnitude for live-verified matches
export const MAX_LIVE_BONUS_MATCHES_PER_DAY = 3;

export function liveMatchIntegrityCheck(durationSec: number, totalPoints: number): string | null {
  if (durationSec < MIN_LIVE_DURATION_SEC) {
    return `This match lasted under ${MIN_LIVE_DURATION_SEC} seconds — too short to log. Play a real match to earn MMR.`;
  }
  if (totalPoints < MIN_LIVE_POINTS) {
    return `Only ${totalPoints} points were scored — log at least ${MIN_LIVE_POINTS} to count this as a real match.`;
  }
  return null;
}

// Live matches beyond the daily bonus cap still log normally (full MMR change),
// they just stop earning the +10% live-verified bonus — logging itself is
// never blocked purely for hitting this cap.
export function liveBonusEligible(matches: Match[], userId: string): boolean {
  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const todayLiveBonused = matches.filter(m =>
    (m.player1Id === userId || m.player2Id === userId) &&
    m.recordedLive && (now - new Date(m.playedAt).getTime()) < day
  );
  return todayLiveBonused.length < MAX_LIVE_BONUS_MATCHES_PER_DAY;
}
