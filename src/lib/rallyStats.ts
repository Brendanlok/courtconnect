// Derives rally-level stats purely from detected shuttle-hit timestamps
// (see shuttleDetect.ts) — no new data collection, just clustering hits that
// are close together in time into rallies, separated by the natural pause
// between points (serve reset, walking back, etc).
export interface RallyStats {
  rallyCount: number;
  longestRallySec: number;
  longestRallyHits: number;
  avgHitsPerRally: number;
}

// ponytail: fixed threshold rather than a setting — revisit if real match
// audio shows points routinely pause longer/shorter than this.
const RALLY_GAP_SEC = 4;

export function computeRallyStats(hits: number[]): RallyStats | null {
  if (hits.length === 0) return null;
  const sorted = [...hits].sort((a, b) => a - b);
  const rallies: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = rallies[rallies.length - 1];
    if (sorted[i] - last[last.length - 1] > RALLY_GAP_SEC) rallies.push([sorted[i]]);
    else last.push(sorted[i]);
  }

  let longestRallySec = 0;
  let longestRallyHits = 1;
  let totalHits = 0;
  for (const r of rallies) {
    const span = r[r.length - 1] - r[0];
    if (r.length > longestRallyHits) { longestRallyHits = r.length; longestRallySec = span; }
    totalHits += r.length;
  }

  return {
    rallyCount: rallies.length,
    longestRallySec: Math.round(longestRallySec),
    longestRallyHits,
    avgHitsPerRally: Math.round((totalHits / rallies.length) * 10) / 10,
  };
}
