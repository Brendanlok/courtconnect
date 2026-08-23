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

export function daysSinceActive(p: { lastActiveAt?: string | null; joinedAt: string }): number {
  const lastActive = new Date(p.lastActiveAt || p.joinedAt);
  return (Date.now() - lastActive.getTime()) / 86_400_000;
}

export function getReliability(p: {
  isDummy?: boolean;
  placementMatchesPlayed?: number | null;
  lastActiveAt?: string | null;
  joinedAt: string;
}): Reliability {
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
