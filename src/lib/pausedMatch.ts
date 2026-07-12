// Paused-live-match handoff — remembers the in-progress match (score included)
// across a quit/resume so it's never lost, without depending on a Firestore
// round-trip. `match`/`pointLog` are kept fresh continuously while scoring
// (see ScorerView), not just at pause time.
import { useEffect, useState } from 'react';
import type { LiveMatch } from '@/types';

const PAUSED_MATCH_KEY = 'cc_paused_live_match';
// Same-tab localStorage writes don't fire the 'storage' event, so nav badges
// that want to react to a pause/resume without a full page reload need this.
const CHANGE_EVENT = 'cc-paused-match-change';

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
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* ignore */ }
}

export function loadPausedMatch(): PausedMatchRef | null {
  try {
    const raw = localStorage.getItem(PAUSED_MATCH_KEY);
    return raw ? JSON.parse(raw) as PausedMatchRef : null;
  } catch { return null; }
}

export function clearPausedMatch() {
  try {
    localStorage.removeItem(PAUSED_MATCH_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* ignore */ }
}

// Drives the paused-match nav badge (BottomNav/Sidebar) so it's visible from
// anywhere in the app, not just the Matches tab.
export function useHasPausedMatch(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const check = () => setHas(!!loadPausedMatch());
    check();
    window.addEventListener(CHANGE_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(CHANGE_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, []);
  return has;
}
