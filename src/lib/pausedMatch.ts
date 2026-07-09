// Paused-live-match handoff — remembers the in-progress match across a quit/resume
// so both the Live Match modal and the Matches page can tell a match was paused,
// not lost, and which planned match (if any) it belongs to.
const PAUSED_MATCH_KEY = 'cc_paused_live_match';

export interface PausedMatchRef {
  joinCode: string;
  recordMode: 'manual' | 'video';
  plannedMatchId?: string;
}

export function savePausedMatch(ref: PausedMatchRef) {
  try { localStorage.setItem(PAUSED_MATCH_KEY, JSON.stringify(ref)); } catch { /* ignore */ }
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
