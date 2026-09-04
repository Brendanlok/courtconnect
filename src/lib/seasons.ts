// Ranked seasons: a fixed-length calendar cadence (no cron/server exists in
// this static-export app, so every season boundary is a pure function of the
// date — any client can compute "which season is it" and "when did season N
// start/end" without asking a server). AppContext's rollover effect is what
// actually acts on this when a signed-in user's stored season_number falls
// behind.
export const SEASON_LENGTH_DAYS = 60; // ~2 months, standard ranked-season cadence
export const SEASON_EPOCH = '2026-07-28T00:00:00Z'; // season 1 start

// New accounts start at 1000 (AuthContext signup default) — soft reset
// regresses toward that same anchor so a fresh season isn't a harsher climb
// for a high-mmr veteran than it was for them as a brand-new player.
const SOFT_RESET_ANCHOR = 1000;
const SOFT_RESET_FACTOR = 0.5; // halfway back toward the anchor each season

export function seasonNumberForDate(d: Date): number {
  const diffDays = (d.getTime() - new Date(SEASON_EPOCH).getTime()) / 86_400_000;
  return Math.max(1, Math.floor(diffDays / SEASON_LENGTH_DAYS) + 1);
}

export function seasonStartDate(seasonNumber: number): Date {
  return new Date(new Date(SEASON_EPOCH).getTime() + (seasonNumber - 1) * SEASON_LENGTH_DAYS * 86_400_000);
}

export function seasonEndDate(seasonNumber: number): Date {
  return new Date(seasonStartDate(seasonNumber).getTime() + SEASON_LENGTH_DAYS * 86_400_000);
}

export function softResetMmr(mmr: number): number {
  return Math.round(SOFT_RESET_ANCHOR + (mmr - SOFT_RESET_ANCHOR) * SOFT_RESET_FACTOR);
}

// Roll a player's ranked state forward from their stored season to the current
// season, one season at a time. Returns one closing record per season left
// behind, plus the post-reset MMR to carry into `toSeason`. A client that
// missed a whole season (stored N, now N+2) still gets a history row AND a soft
// reset for every skipped season — skipped seasons had no matches, so their
// closing MMR is just the carried-in (already soft-reset) value.
export function rolloverSeasons(
  mmr: number,
  fromSeason: number,
  toSeason: number,
): { closed: { seasonNumber: number; mmrEnd: number }[]; mmr: number } {
  const closed: { seasonNumber: number; mmrEnd: number }[] = [];
  let m = mmr;
  for (let s = fromSeason; s < toSeason; s++) {
    closed.push({ seasonNumber: s, mmrEnd: Math.round(m) });
    m = softResetMmr(m);
  }
  return { closed, mmr: m };
}

export function daysUntilSeasonEnd(now: Date): number {
  const current = seasonNumberForDate(now);
  return Math.ceil((seasonEndDate(current).getTime() - now.getTime()) / 86_400_000);
}
