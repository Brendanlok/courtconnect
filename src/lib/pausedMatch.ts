// Paused-live-match handoff — remembers the in-progress match (score included)
// across a quit/resume so it's never lost, without depending on a Firestore
// round-trip. `match`/`pointLog` are kept fresh continuously while scoring
// (see ScorerView), not just at pause time.
import type { LiveMatch } from '@/types';

const PAUSED_MATCH_KEY = 'cc_paused_live_match';

export interface PausedMatchRef {
  joinCode: string;
  recordMode: 'manual' | 'video';
  plannedMatchId?: string;
  match?: LiveMatch;
  pointLog?: ('a' | 'b')[][];
}

// Merges onto whatever's already stored so a partial call (e.g. from a spot
// that doesn't have the live score handy) never clobbers a fresher snapshot.
export function savePausedMatch(ref: Partial<PausedMatchRef> & Pick<PausedMatchRef, 'joinCode'>) {
  try {
    const existing = loadPausedMatch();
    localStorage.setItem(PAUSED_MATCH_KEY, JSON.stringify({ ...existing, ...ref }));
  } catch { /* ignore */ }
}

export function loadPausedMatch(): PausedMatchRef | null {
  try {
    const raw = localStorage.getItem(PAUSED_MATCH_KEY);
    return raw ? JSON.parse(raw) as PausedMatchRef : null;
  } catch { return null; }
}

export function clearPausedMatch() {
  try { localStorage.removeItem(PAUSED_MATCH_KEY); } catch { /* ignore */ }
}
