// Rating reliability: how much a player's MMR number can be trusted, purely
// derived from data already on UserProfile — no new tracking pipeline beyond
// last_active_at (see migration 0031). Loosely mirrors DUPR's confidence
// tiers (provisional while unproven, established once tested) plus an early
// staleness warning distinct from AppContext's existing 90-day hard
// recalibration reset — that reset already forces a dormant rating back into
// calibration; this flags it earlier, while the number is still shown but
// shouldn't be fully trusted yet.
import { isCalibrating } from './utils';

export type Reliability = 'provisional' | 'established' | 'stale';

// Earlier heads-up than AppContext's INACTIVITY_DAYS (90) hard reset —
// deliberately a different, smaller number so the two don't collide.
export const STALE_AFTER_DAYS = 30;

// `lastMatchAt` is the same activity signal `last_active_at` (migration 0031)
// is meant to hold — the date of a player's most recent confirmed match —
// computed client-side from match history that's already loaded. Pre-migration
// `last_active_at` never persists, so without this fallback every real account
// reads as 'stale' 30 days after signup even if they played yesterday. The
// most recent of the two wins; if neither is present it still falls back to
// joinedAt (so a genuinely dormant account is correctly stale).
export function daysSinceActive(p: { lastActiveAt?: string | null; lastMatchAt?: string | null; joinedAt: string }): number {
  const candidates = [p.lastActiveAt, p.lastMatchAt].filter(Boolean) as string[];
  const lastActive = candidates.length
    ? new Date(Math.max(...candidates.map(d => new Date(d).getTime())))
    : new Date(p.joinedAt);
  return (Date.now() - lastActive.getTime()) / 86_400_000;
}

export function getReliability(p: {
  isDummy?: boolean;
  placementMatchesPlayed?: number | null;
  lastActiveAt?: string | null;
  lastMatchAt?: string | null;
  joinedAt: string;
}): Reliability {
  // Seed/demo roster is static showcase data with an old joinedAt and no
  // lastActiveAt — without this every demo profile reads as 'stale' and hides
  // its Skill Match badge. Same spirit as isCalibrating's !isDummy guard.
  if (p.isDummy) return 'established';
  if (isCalibrating(p)) return 'provisional';
  return daysSinceActive(p) >= STALE_AFTER_DAYS ? 'stale' : 'established';
}

// A win/loss against an opponent whose own rating is still provisional
// proves less than the same result against an established player — their
// number is still noisy from too few matches. Discount (not zero out) the
// whole MMR delta so a real result still counts for something. Any
// provisional player on the opposing side is enough to trigger it — a
// doubles team's rating is only as reliable as its least-tested member.
const PROVISIONAL_OPPONENT_MULT = 0.6;
export function opponentReliabilityMultiplier(opponents: { isDummy?: boolean; placementMatchesPlayed?: number | null }[]): number {
  return opponents.some(isCalibrating) ? PROVISIONAL_OPPONENT_MULT : 1;
}
