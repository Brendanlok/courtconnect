'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { auth } from '@/lib/supabase';
import {
  createCourtSession, addCourtSessionPositions, getCourtSessionByCode,
  subscribeCourtSession, completeCourtSession,
} from '@/lib/supabaseService';
import type { CourtSession, CourtPosition, LiveMatch } from '@/types';
import { X, Copy, Check, Radio } from 'lucide-react';
import CourtHeatmap from '@/components/CourtHeatmap';
import ClipRecorder from '@/components/ClipRecorder';
import { LogMatchModal } from '@/components/LogMatchModal';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

function genCode(): string { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function genId(): string { return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`; }

interface PlannedMatchRef {
  id: string;
  venue: string;
}

type View = 'setup' | 'tracking' | 'score';

export function CourtTrackModal({ open, onClose, plannedMatch = null, onSessionEnded }: {
  open: boolean;
  onClose: () => void;
  plannedMatch?: PlannedMatchRef | null;
  onSessionEnded?: (plannedMatchId: string) => void;
}) {
  const { saveCourtPositions } = useApp();
  const [view, setView] = useState<View>('setup');
  const [session, setSession] = useState<CourtSession | null>(null);
  const [isHostEnd, setIsHostEnd] = useState(true); // just for which-baseline instruction wording
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const { ref: panelRef, dialogProps } = useModalA11y(open, onClose, 'Track & Record');

  const uid = auth.currentUser?.uid ?? 'me';

  // Live-sync the combined heatmap from both ends
  useEffect(() => {
    if (!session || view !== 'tracking') return;
    const unsub = subscribeCourtSession(session.id, s => { if (s) setSession(s); });
    return unsub;
  }, [session?.id, view]);

  if (!open) return null;

  const startAsHost = () => {
    const s: CourtSession = {
      id: genId(), joinCode: genCode(), hostUid: uid, status: 'active',
      positions: [], createdAt: new Date().toISOString(),
      plannedMatchId: plannedMatch?.id, venue: plannedMatch?.venue,
    };
    createCourtSession(s).catch(() => {});
    setSession(s);
    setIsHostEnd(true);
    setView('tracking');
  };

  const joinSession = async () => {
    if (joinCodeInput.trim().length !== 6) { setJoinErr('Enter the full 6-character code.'); return; }
    setJoinLoading(true); setJoinErr('');
    const s = await getCourtSessionByCode(joinCodeInput.trim()).catch(() => null);
    setJoinLoading(false);
    if (!s) { setJoinErr('No active tracking session with that code.'); return; }
    setSession(s);
    setIsHostEnd(false);
    setView('tracking');
  };

  const handleTap = (pos: CourtPosition) => {
    if (!session) return;
    setSession(s => s ? { ...s, positions: [...s.positions, pos] } : s);
    addCourtSessionPositions(session.id, [pos]).catch(() => {});
  };

  const handleEndTracking = () => {
    if (!session) return;
    completeCourtSession(session.id).catch(() => {});
    saveCourtPositions(session.positions);
    setView('score');
  };

  const copyCode = async () => {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.joinCode); } catch { /* ignore */ }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Score entry reuses LogMatchModal as-is — no separate score form to maintain.
  if (view === 'score' && session) {
    return (
      <LogMatchModal open={true} onClose={onClose}
        plannedMatchId={plannedMatch?.id}
        onLogged={id => { onSessionEnded?.(id); onClose(); }}/>
    );
  }

  // Minimal LiveMatch-shaped stub so ClipRecorder can mount — this flow doesn't
  // score live, so the 0–0 header it shows is cosmetic only.
  const recorderStub: LiveMatch | null = session ? {
    id: session.id, joinCode: session.joinCode, format: 'MS', hostUid: session.hostUid,
    teamA: [], teamB: [], teamAName: isHostEnd ? 'Your end' : 'Other end', teamBName: isHostEnd ? 'Other end' : 'Your end',
    venue: session.venue ?? '', bestOf: 1, status: 'active', currentGame: 0,
    games: [{ a: 0, b: 0, done: false }], gameWins: { a: 0, b: 0 }, createdAt: session.createdAt,
  } : null;

  const titles: Record<View, string> = { setup: 'Track & Record', tracking: 'Tracking Match', score: 'Enter Final Score' };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[92vh] flex flex-col outline-none"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-bold text-sm">{titles[view]}</p>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
        </div>
        <div className="overflow-y-auto p-4 flex-1 space-y-4">
          {view === 'setup' && (
            plannedMatch ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Two phones, one at each end of the court, each at a 3/4 angle from the back. Both tap this device&apos;s court diagram every so often to mark where play is happening — positions from both ends combine into one shared heatmap. This is manual tap-tracking, not automatic video tracking.
                </p>
                <Button onClick={startAsHost} className="w-full flex items-center justify-center gap-2">
                  <Radio size={14}/> Start Tracking Session
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">Enter the code shown on the other device to join their tracking session.</p>
                <input value={joinCodeInput} onChange={e => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && joinSession()}
                  maxLength={6} placeholder="e.g. BX72KA"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.3em] outline-none focus:border-emerald-500 uppercase"/>
                {joinErr && <p className="text-xs text-red-400">{joinErr}</p>}
                <Button onClick={joinSession} disabled={joinLoading} className="w-full">
                  {joinLoading ? 'Joining…' : 'Join Session'}
                </Button>
              </div>
            )
          )}

          {view === 'tracking' && session && recorderStub && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button onClick={copyCode}
                  className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-bold shrink-0">
                  {session.joinCode} {codeCopied ? <Check size={11} className="text-emerald-400"/> : <Copy size={11}/>}
                </button>
                <span className="text-[11px] text-slate-500 text-right">{session.positions.length} positions logged (both ends)</span>
              </div>
              <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
                Position your phone 3/4 back from {isHostEnd ? 'your baseline' : 'the far baseline'}, landscape, elevated. Once the camera&apos;s open, tap its 4 court corners once to calibrate, then tap the live picture whenever play settles into a new spot. Or use the diagram below any time.
              </p>
              <ClipRecorder match={recorderStub} courtTapMode onCourtTap={handleTap} courtTapCount={session.positions.length}/>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Or tap where play is happening here</p>
                <CourtHeatmap positions={session.positions} tapMode onTap={handleTap} showStats={false}/>
              </div>
              <Button variant="danger" onClick={handleEndTracking} className="w-full">
                End Tracking &amp; Enter Score
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
