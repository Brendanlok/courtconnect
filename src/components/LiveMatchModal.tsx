'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { auth } from '@/lib/firebase';
import { createLiveMatch, updateLiveMatch, subscribeLiveMatch, getLiveMatchByCode } from '@/lib/firestoreService';
import type { MatchType, LiveMatch, LiveGame, LiveMatchPlayer, LiveMatchStats } from '@/types';
import {
  X, ChevronRight, Users, RotateCcw, Share2, Trophy,
  Wifi, WifiOff, Radio, Search, Check, Camera, Hand, AlertTriangle,
} from 'lucide-react';
import ClipRecorder from '@/components/ClipRecorder';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';
import { savePausedMatch, loadPausedMatch, clearPausedMatch, type PausedMatchRef } from '@/lib/pausedMatch';
import { calcMMRChange } from '@/lib/utils';
import { antiCheatCheck, liveMatchIntegrityCheck, liveBonusEligible, LIVE_BONUS_MULTIPLIER } from '@/lib/antiCheat';

type RecordMode = 'manual' | 'video';

const FORMATS: MatchType[] = ['MS', 'WS', 'MD', 'WD', 'MX'];
const FORMAT_LABELS: Record<MatchType, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", MX: "Mixed Doubles",
};

function genCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function genId(): string {
  return `lm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function teamSize(f: MatchType) { return f === 'MS' || f === 'WS' ? 1 : 2; }

// ── Player picker ─────────────────────────────────────────────────────────────

function PlayerPicker({ label, selected, onSelect, onClear, excludeUids }: {
  label: string; selected: LiveMatchPlayer | null;
  onSelect: (p: LiveMatchPlayer) => void; onClear: () => void;
  excludeUids: string[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = PLAYERS
    .filter(p => !excludeUids.includes(p.uid))
    .filter(p => !q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
    .slice(0, 5);

  if (selected) return (
    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 min-h-[44px]">
      <Avatar name={selected.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{selected.displayName}</p>
        <p className="text-[10px] text-slate-500">@{selected.username}</p>
      </div>
      <button onClick={onClear} aria-label={`Remove ${selected.displayName}`} className="text-slate-500 hover:text-red-400"><X size={12}/></button>
    </div>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 border border-dashed border-slate-600 hover:border-emerald-500/50 rounded-xl px-3 py-2 min-h-[44px] text-left transition-colors">
        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <Users size={10} className="text-slate-500"/>
        </div>
        <p className="text-[11px] text-slate-400">{label}</p>
      </button>
      {open && (
        <div className="popover-anim absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input autoFocus value={q} onChange={e => setQ(e.target.value.toLowerCase())}
                placeholder="Search player…"
                className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500"/>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No players found</p>
            ) : results.map(p => (
              <button key={p.uid} onClick={() => { onSelect({ uid: p.uid, displayName: p.displayName, username: p.username }); setOpen(false); setQ(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left">
                <Avatar name={p.displayName} className="!w-5 !h-5 !text-[9px] shrink-0"/>
                <div>
                  <p className="text-xs font-semibold">{p.displayName}</p>
                  <p className="text-[10px] text-slate-500">@{p.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Setup view ────────────────────────────────────────────────────────────────

function SetupView({ me, onStart, onJoin }: {
  me: LiveMatchPlayer;
  onStart: (match: LiveMatch, recordMode: RecordMode) => void;
  onJoin: (match: LiveMatch) => void;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [format, setFormat] = useState<MatchType>('MS');
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3);
  const [venue, setVenue] = useState('');
  const [teamA, setTeamA] = useState<(LiveMatchPlayer | null)[]>([me, null]);
  const [teamB, setTeamB] = useState<(LiveMatchPlayer | null)[]>([null, null]);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const ts = teamSize(format);
  const teamASlots = teamA.slice(0, ts);
  const teamBSlots = teamB.slice(0, ts);
  const filledUids = [...teamASlots, ...teamBSlots].filter(Boolean).map(p => p!.uid);

  const setSlot = (team: 'A' | 'B', idx: number, p: LiveMatchPlayer | null) => {
    if (team === 'A') setTeamA(prev => { const n = [...prev]; n[idx] = p; return n; });
    else setTeamB(prev => { const n = [...prev]; n[idx] = p; return n; });
  };

  const buildTeamName = (slots: (LiveMatchPlayer | null)[]) =>
    slots.filter(Boolean).map(p => p!.displayName.split(' ')[0]).join(' & ') || '—';

  const canStart = venue.trim() && teamBSlots.some(Boolean);

  const handleStart = (recordMode: RecordMode) => {
    if (!canStart) return;
    const aPlayers = teamASlots.map(p => p ?? me);
    const bPlayers = teamBSlots.filter(Boolean) as LiveMatchPlayer[];
    const id = genId();
    const match: LiveMatch = {
      id, joinCode: genCode(), format, bestOf, venue: venue.trim(),
      hostUid: auth.currentUser?.uid ?? 'me',
      teamA: aPlayers, teamB: bPlayers,
      teamAName: buildTeamName(aPlayers),
      teamBName: buildTeamName(bPlayers),
      status: 'active', currentGame: 0,
      games: [{ a: 0, b: 0, done: false }],
      gameWins: { a: 0, b: 0 },
      createdAt: new Date().toISOString(),
    };
    createLiveMatch(match).catch(() => {});
    onStart(match, recordMode);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true); setJoinError('');
    const m = await getLiveMatchByCode(joinCode.trim()).catch(() => null);
    setJoinLoading(false);
    if (!m) { setJoinError('Match not found. Check the code and try again.'); return; }
    onJoin(m);
  };

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-1">
        <button onClick={() => setMode('create')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === 'create' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          🏸 Start Match
        </button>
        <button onClick={() => setMode('join')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === 'join' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          👁 Watch Live
        </button>
      </div>

      {mode === 'join' ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Enter the 6-character code from the scorer's screen.</p>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6} placeholder="e.g. BX72KA"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.3em] outline-none focus:border-emerald-500 uppercase"/>
          {joinError && <p className="text-xs text-red-400">{joinError}</p>}
          <button onClick={handleJoin} disabled={joinLoading || joinCode.length < 4}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold rounded-xl text-sm transition-colors">
            {joinLoading ? 'Searching…' : 'Watch Match'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Format</label>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map(f => (
                <button key={f} onClick={() => { setFormat(f); setTeamA([me, null]); setTeamB([null, null]); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${format === f ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {f}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">{FORMAT_LABELS[format]}</p>
          </div>

          {/* Best of */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Best of</label>
            <div className="flex gap-2">
              {([1, 3, 5] as const).map(n => (
                <button key={n} onClick={() => setBestOf(n)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${bestOf === n ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Players */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Players</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Team A</p>
                {/* Slot 0 = me, fixed */}
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 min-h-[44px]">
                  <Avatar name={me.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{me.displayName}</p>
                    <p className="text-[10px] text-slate-500">You</p>
                  </div>
                </div>
                {ts === 2 && (
                  <PlayerPicker label="Your partner" selected={teamASlots[1] ?? null}
                    onSelect={p => setSlot('A', 1, p)} onClear={() => setSlot('A', 1, null)}
                    excludeUids={filledUids}/>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Team B</p>
                {Array.from({ length: ts }).map((_, i) => (
                  <PlayerPicker key={i} label={ts === 1 ? 'Opponent' : `Opponent ${i + 1}`}
                    selected={teamBSlots[i] ?? null}
                    onSelect={p => setSlot('B', i, p)} onClear={() => setSlot('B', i, null)}
                    excludeUids={filledUids}/>
                ))}
              </div>
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Venue</label>
            <input value={venue} onChange={e => setVenue(e.target.value)}
              placeholder="e.g. Sport Planet PJ"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500"/>
          </div>

          <div className="flex gap-2">
            <button onClick={() => handleStart('manual')} disabled={!canStart}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
              <Hand size={13}/> Manual Score
            </button>
            <button onClick={() => handleStart('video')} disabled={!canStart}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
              <Camera size={13}/> Video Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scorer view ───────────────────────────────────────────────────────────────

const TARGET = 21;
const MAX = 30;

function checkGameEnd(game: LiveGame, bestOf: number): { done: boolean; winner?: 'A' | 'B' } {
  const { a, b } = game;
  const lead = Math.max(a, b);
  const trail = Math.min(a, b);
  if (lead >= TARGET && lead - trail >= 2) {
    return { done: true, winner: a > b ? 'A' : 'B' };
  }
  if (lead >= MAX) {
    return { done: true, winner: a > b ? 'A' : 'B' };
  }
  return { done: false };
}

function checkMatchEnd(gameWins: { a: number; b: number }, bestOf: number): 'A' | 'B' | null {
  const needed = Math.ceil(bestOf / 2);
  if (gameWins.a >= needed) return 'A';
  if (gameWins.b >= needed) return 'B';
  return null;
}

// ── Point log table — one row per side, one column per rally, cell shows the
// running tally for that side at that point (e.g. 1-0 → "1", 1-1 → "1", 2-1 → "2").
// Row color already distinguishes the side, so no letter suffix is needed.
const POINT_COLS = 30;

function pointLabel(log: ('a' | 'b')[], idx: number): string {
  const side = log[idx];
  let tally = 0;
  for (let i = 0; i <= idx; i++) if (log[i] === side) tally++;
  return `${tally}`;
}

// ── Derived match insights — computed purely from the point log + timestamps
// already being tracked, no extra capture needed.
function computeMaxStreak(allPoints: ('a' | 'b')[]): { side: 'a' | 'b'; count: number } {
  let best: { side: 'a' | 'b'; count: number } = { side: 'a', count: 0 };
  let cur: { side: 'a' | 'b' | null; count: number } = { side: null, count: 0 };
  for (const p of allPoints) {
    cur = p === cur.side ? { side: p, count: cur.count + 1 } : { side: p, count: 1 };
    if (cur.count > best.count) best = { side: p, count: cur.count };
  }
  return best;
}

function biggestComebackInGame(log: ('a' | 'b')[], winner: 'A' | 'B'): number {
  let a = 0, b = 0, maxDeficit = 0;
  const winSide = winner === 'A' ? 'a' : 'b';
  for (const p of log) {
    if (p === 'a') a++; else b++;
    const deficit = winSide === 'a' ? (b - a) : (a - b);
    if (deficit > maxDeficit) maxDeficit = deficit;
  }
  return maxDeficit;
}

function PointLogTable({ log, teamAName, teamBName, active }: {
  log: ('a' | 'b')[]; teamAName: string; teamBName: string; active: boolean;
}) {
  const rowCell = (side: 'a' | 'b', i: number, borderClass: string) => {
    const filled = log[i] === side;
    return (
      <div key={`${side}-${i}`}
        className={`h-5 w-5 shrink-0 flex items-center justify-center text-[8px] font-bold ${borderClass}
          ${filled ? (side === 'a' ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300') : ''}`}>
        {filled ? pointLabel(log, i) : ''}
      </div>
    );
  };
  return (
    <div className={`rounded-xl border overflow-hidden ${active ? 'border-emerald-500/30' : 'border-slate-800'}`}>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="h-5 w-6 shrink-0 flex items-center justify-center text-[9px] font-bold text-emerald-400 bg-slate-900" title={teamAName}>A</div>
            {Array.from({ length: POINT_COLS }).map((_, i) => rowCell('a', i, 'border-t border-r border-slate-800 bg-slate-900/60'))}
          </div>
          <div className="flex">
            <div className="h-5 w-6 shrink-0 flex items-center justify-center text-[9px] font-bold text-rose-400 bg-slate-900" title={teamBName}>B</div>
            {Array.from({ length: POINT_COLS }).map((_, i) => rowCell('b', i, 'border-t border-r border-b border-slate-800 bg-slate-900/60'))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorerView({ initialMatch, isHost, recordMode, onRequestExit, onComplete }: {
  initialMatch: LiveMatch;
  isHost: boolean;
  recordMode: RecordMode;
  onRequestExit: () => void;
  onComplete: (match: LiveMatch) => void;
}) {
  const { awardClipCredits } = useApp();
  const [match, setMatch] = useState<LiveMatch>(initialMatch);
  const [history, setHistory] = useState<{ games: LiveGame[]; gameWins: { a: number; b: number }; currentGame: number; pointLog: ('a' | 'b')[][] }[]>([]);
  const [pointLog, setPointLog] = useState<('a' | 'b')[][]>([[]]);
  const [connected, setConnected] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);

  // Match-insight capture — timing only; streak/comeback are derived from pointLog at completion.
  const matchStartRef = useRef(Date.now());
  const lastPointAtRef = useRef(Date.now());
  const gameStartRef = useRef(Date.now());
  const [pointGapsSec, setPointGapsSec] = useState<number[]>([]);
  const [gameDurationsSec, setGameDurationsSec] = useState<number[]>([]);

  // Subscribe to live updates
  useEffect(() => {
    const unsub = subscribeLiveMatch(match.id, updated => {
      setConnected(true);
      if (updated && !isHost) setMatch(updated);
    });
    return unsub;
  }, [match.id, isHost]);

  const currentGame = match.games[match.currentGame] ?? { a: 0, b: 0, done: false };

  const addPoint = useCallback((side: 'a' | 'b') => {
    if (!isHost || currentGame.done || match.status === 'completed') return;

    setHistory(prev => [...prev, {
      games: match.games.map(g => ({ ...g })),
      gameWins: { ...match.gameWins },
      currentGame: match.currentGame,
      pointLog: pointLog.map(arr => [...arr]),
    }]);

    // Timing: gap since the last point, tracked regardless of how the game/match ends up.
    const now = Date.now();
    const gapSec = (now - lastPointAtRef.current) / 1000;
    lastPointAtRef.current = now;
    setPointGapsSec(prev => [...prev, gapSec]);

    const updatedPointLog = pointLog.map(arr => [...arr]);
    updatedPointLog[match.currentGame] = [...(updatedPointLog[match.currentGame] ?? []), side];
    setPointLog(updatedPointLog);

    setMatch(prev => {
      const games = prev.games.map(g => ({ ...g }));
      const g = { ...games[prev.currentGame] };
      g[side] += 1;

      const { done, winner } = checkGameEnd(g, prev.bestOf);
      g.done = done;
      if (winner) g.winningSide = winner;
      games[prev.currentGame] = g;

      const gameWins = { ...prev.gameWins };
      let nextGame = prev.currentGame;
      let winningSide = prev.winningSide;
      let status = prev.status;
      let finishedGameDurations = gameDurationsSec;

      if (done && winner) {
        gameWins[winner.toLowerCase() as 'a' | 'b'] += 1;
        finishedGameDurations = [...gameDurationsSec, (now - gameStartRef.current) / 1000];
        setGameDurationsSec(finishedGameDurations);
        gameStartRef.current = now;
        const matchWinner = checkMatchEnd(gameWins, prev.bestOf);
        if (matchWinner) {
          winningSide = matchWinner;
          status = 'completed';
        } else {
          nextGame = prev.currentGame + 1;
          games.push({ a: 0, b: 0, done: false });
        }
      }

      let next: LiveMatch = { ...prev, games, gameWins, currentGame: nextGame, winningSide, status };
      let updatePatch: Partial<LiveMatch> = { games, gameWins, currentGame: nextGame, winningSide, status };

      if (status === 'completed') {
        const allPoints = updatedPointLog.flat();
        const gaps = [...pointGapsSec, gapSec];
        const liveStats: LiveMatchStats = {
          durationSec: (now - matchStartRef.current) / 1000,
          gameDurationsSec: finishedGameDurations,
          pointGapsSec: gaps,
          avgPointGapSec: gaps.reduce((s, x) => s + x, 0) / gaps.length,
          longestGapSec: Math.max(...gaps),
          shortestGapSec: Math.min(...gaps),
          maxWinStreak: computeMaxStreak(allPoints),
          biggestComebackPoints: games.filter(gm => gm.done && gm.winningSide).reduce((max, gm, i) =>
            Math.max(max, biggestComebackInGame(updatedPointLog[i] ?? [], gm.winningSide!)), 0),
        };
        next = { ...next, liveStats };
        updatePatch = { ...updatePatch, liveStats };
      }

      updateLiveMatch(prev.id, updatePatch).catch(() => {});
      // In video mode, stay on screen so the recording isn't cut off — the Log Result
      // button inside the camera view lets the user finish saving the clip first.
      if (status === 'completed' && recordMode !== 'video') setTimeout(() => onComplete(next), 800);
      return next;
    });
  }, [isHost, currentGame, match, onComplete, recordMode, pointLog, pointGapsSec, gameDurationsSec]);

  // New game started — make sure pointLog has a slot for it (covers the case
  // where match state syncs in from Firestore, e.g. a watcher's view)
  useEffect(() => {
    setPointLog(prev => {
      if (match.currentGame < prev.length) return prev;
      const next = [...prev];
      while (next.length <= match.currentGame) next.push([]);
      return next;
    });
  }, [match.currentGame]);

  const undoLast = () => {
    if (!isHost || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setPointLog(prev.pointLog);
    setMatch(m => {
      const next = { ...m, games: prev.games, gameWins: prev.gameWins, currentGame: prev.currentGame, status: 'active' as const, winningSide: undefined };
      updateLiveMatch(m.id, { games: prev.games, gameWins: prev.gameWins, currentGame: prev.currentGame, status: 'active' } as Partial<LiveMatch>).catch(() => {});
      return next;
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(match.joinCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const gameWinsNeeded = Math.ceil(match.bestOf / 2);

  // ── Video mode: full-screen camera is the entire scoring experience ──
  // No separate tap-to-score grid — scoring happens by tapping the score in the camera header.
  if (recordMode === 'video') {
    return (
      <ClipRecorder
        match={match}
        autoStart
        canScore={isHost}
        onAddPoint={addPoint}
        onUndo={undoLast}
        canUndo={isHost && history.length > 0}
        onUploaded={() => awardClipCredits(50)}
        onRequestExit={onRequestExit}
        matchComplete={match.status === 'completed'}
        onLogResult={() => onComplete(match)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Join code + connection */}
      <div className="flex items-center justify-between">
        <button onClick={copyCode}
          className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs transition-colors hover:bg-slate-700">
          <Radio size={11} className="text-emerald-400 animate-pulse"/>
          <span className="font-mono font-bold tracking-widest">{match.joinCode}</span>
          {codeCopied ? <Check size={11} className="text-emerald-400"/> : <Share2 size={11} className="text-slate-400"/>}
        </button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {connected ? <Wifi size={12} className="text-emerald-400"/> : <WifiOff size={12} className="text-red-400"/>}
          {isHost ? 'Scoring' : 'Watching live'}
        </div>
      </div>

      {/* Game wins strip */}
      {match.bestOf > 1 && (
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: match.bestOf }).map((_, i) => {
            const g = match.games[i];
            const won = g?.done ? (g.winningSide === 'A' ? 'a' : 'b') : null;
            return (
              <div key={i} className={`text-center px-3 py-1.5 rounded-lg text-xs border transition-colors
                ${i === match.currentGame && !g?.done ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                <p className="font-bold text-[10px] uppercase tracking-wide">G{i+1}</p>
                {g ? <p className="font-mono text-xs">{g.a}–{g.b}</p> : <p className="text-slate-700">—</p>}
                {won && <p className={`text-[9px] font-bold mt-0.5 ${won === 'a' ? 'text-emerald-400' : 'text-rose-400'}`}>{won === 'a' ? match.teamAName : match.teamBName}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Live score */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-2">
          {/* Team A */}
          <button onClick={() => addPoint('a')} disabled={!isHost || currentGame.done || match.status === 'completed'}
            className={`group flex flex-col items-center justify-center py-8 px-4 transition-all active:scale-95
              ${isHost && !currentGame.done ? 'hover:bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer' : 'cursor-default'}
              border-r border-slate-700`}>
            <p className="text-[11px] font-semibold text-slate-400 truncate w-full text-center mb-1">{match.teamAName}</p>
            <p className={`font-black tabular-nums transition-all ${currentGame.a > currentGame.b ? 'text-6xl text-emerald-400' : 'text-5xl text-slate-200'}`}>
              {currentGame.a}
            </p>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: gameWinsNeeded }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < match.gameWins.a ? 'bg-emerald-400' : 'bg-slate-700'}`}/>
              ))}
            </div>
            {isHost && !currentGame.done && match.status === 'active' && (
              <p className="text-[10px] text-emerald-400/60 mt-2 group-hover:text-emerald-400 transition-colors">Tap to score</p>
            )}
          </button>

          {/* Team B */}
          <button onClick={() => addPoint('b')} disabled={!isHost || currentGame.done || match.status === 'completed'}
            className={`group flex flex-col items-center justify-center py-8 px-4 transition-all active:scale-95
              ${isHost && !currentGame.done ? 'hover:bg-rose-500/10 active:bg-rose-500/20 cursor-pointer' : 'cursor-default'}`}>
            <p className="text-[11px] font-semibold text-slate-400 truncate w-full text-center mb-1">{match.teamBName}</p>
            <p className={`font-black tabular-nums transition-all ${currentGame.b > currentGame.a ? 'text-6xl text-rose-400' : 'text-5xl text-slate-200'}`}>
              {currentGame.b}
            </p>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: gameWinsNeeded }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < match.gameWins.b ? 'bg-rose-400' : 'bg-slate-700'}`}/>
              ))}
            </div>
            {isHost && !currentGame.done && match.status === 'active' && (
              <p className="text-[10px] text-rose-400/60 mt-2 group-hover:text-rose-400 transition-colors">Tap to score</p>
            )}
          </button>
        </div>

        {/* Game over banner */}
        {currentGame.done && match.status === 'active' && (
          <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 py-3 text-center">
            <p className="text-sm font-bold text-amber-300">
              Game {match.currentGame + 1} won by {currentGame.winningSide === 'A' ? match.teamAName : match.teamBName}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Next game starting…</p>
          </div>
        )}

        {/* Match complete banner */}
        {match.status === 'completed' && (
          <div className="bg-emerald-500/10 border-t border-emerald-500/20 px-4 py-4 text-center">
            <Trophy size={20} className="mx-auto text-amber-400 mb-2"/>
            <p className="text-sm font-bold text-emerald-300">
              {match.winningSide === 'A' ? match.teamAName : match.teamBName} wins!
            </p>
          </div>
        )}
      </div>

      {/* Point-by-point log — one table per set */}
      {isHost && (
        <div className="space-y-2">
          {Array.from({ length: Math.min(match.bestOf, 3) }).map((_, i) => (
            <div key={i} className="space-y-1">
              <p className="text-[10px] text-slate-500 font-semibold">Game {i + 1}{i === match.currentGame && match.status === 'active' ? ' · live' : ''}</p>
              <PointLogTable log={pointLog[i] ?? []} teamAName={match.teamAName} teamBName={match.teamBName} active={i === match.currentGame}/>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {isHost && (
        <div className="flex flex-wrap gap-2">
          <button onClick={undoLast} disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-xl text-xs font-medium transition-colors">
            <RotateCcw size={12}/> Undo
          </button>
          <div className="flex-1"/>
          {match.status === 'completed' && (
            <button onClick={() => onComplete(match)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-colors">
              <ChevronRight size={13}/> Log Result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Completion view ───────────────────────────────────────────────────────────

function CompletionView({ match, onLogMatch, onClose, blockReason, bonusEligible }: {
  match: LiveMatch; onLogMatch: (m: LiveMatch) => void; onClose: () => void;
  blockReason: string | null; bonusEligible: boolean;
}) {
  const winner = match.winningSide === 'A' ? match.teamAName : match.teamBName;
  const totalGames = match.games.filter(g => g.done).length;
  const stats = match.liveStats;
  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">🏆</div>
      <div>
        <p className="font-black text-xl text-emerald-400">{winner}</p>
        <p className="text-slate-400 text-sm">wins the match!</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2 text-left">
        <p className="text-xs font-semibold text-slate-400 text-center mb-3">Final Score</p>
        {match.games.filter(g => g.done).map((g, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-slate-400 text-xs">Game {i + 1}</span>
            <span className={`font-bold tabular-nums ${g.winningSide === 'A' ? 'text-emerald-400' : 'text-slate-300'}`}>{g.a}</span>
            <span className="text-slate-600 text-xs">—</span>
            <span className={`font-bold tabular-nums ${g.winningSide === 'B' ? 'text-emerald-400' : 'text-slate-300'}`}>{g.b}</span>
          </div>
        ))}
        <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">{totalGames} game{totalGames !== 1 ? 's' : ''} · {match.venue}</span>
          <span className="text-xs font-bold text-slate-300">{match.gameWins.a} – {match.gameWins.b}</span>
        </div>
      </div>

      {stats && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 text-left space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Match Insights</p>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-slate-500">Duration</span>
            <span className="text-slate-200 text-right font-semibold tabular-nums">{fmtDuration(stats.durationSec)}</span>
            <span className="text-slate-500">Longest streak</span>
            <span className="text-slate-200 text-right font-semibold">
              {stats.maxWinStreak.count} pts ({stats.maxWinStreak.side === 'a' ? match.teamAName : match.teamBName})
            </span>
            {stats.biggestComebackPoints > 0 && (
              <>
                <span className="text-slate-500">Biggest comeback</span>
                <span className="text-amber-400 text-right font-semibold">{stats.biggestComebackPoints} pts</span>
              </>
            )}
            <span className="text-slate-500">Avg. gap between points</span>
            <span className="text-slate-200 text-right font-semibold">{Math.round(stats.avgPointGapSec)}s</span>
          </div>
        </div>
      )}

      {!blockReason && bonusEligible && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-xl py-2">
          <Radio size={12}/> Live-verified — +{Math.round((LIVE_BONUS_MULTIPLIER - 1) * 100)}% MMR bonus on log
        </div>
      )}
      {blockReason && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-300 text-left">
          {blockReason}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1 border border-slate-700 font-medium">
          Close
        </Button>
        <Button onClick={() => onLogMatch(match)} disabled={!!blockReason} className="flex-1 font-bold">
          Log to Profile
        </Button>
      </div>
    </div>
  );
}

// ── Planned match start view ──────────────────────────────────────────────────

function PlannedMatchStart({ pm, me, onStart, onJoin }: {
  pm: PlannedMatchRef; me: LiveMatchPlayer;
  onStart: (recordMode: RecordMode) => void; onJoin: (m: LiveMatch) => void;
}) {
  const aPlayers = pm.teamA.filter(Boolean) as LiveMatchPlayer[];
  const bPlayers = pm.teamB.filter(Boolean) as LiveMatchPlayer[];

  return (
    <div className="space-y-4">
      {/* Match summary */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Format</span>
          <span className="font-bold text-xs">{FORMAT_LABELS[pm.format]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Venue</span>
          <span className="text-xs text-slate-200 truncate max-w-[60%] text-right">{pm.venue}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs">Best of</span>
          <span className="text-xs text-slate-200">{pm.bestOf ?? 3}</span>
        </div>
      </div>

      {/* Teams preview */}
      <div className="grid grid-cols-2 gap-2">
        {[{ label: 'Team A', players: aPlayers }, { label: 'Team B', players: bPlayers }].map(({ label, players }) => (
          <div key={label} className="space-y-1">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">{label}</p>
            {players.length === 0
              ? <p className="text-[11px] text-slate-600 italic">No players</p>
              : players.map(p => (
                <div key={p.uid} className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1.5">
                  <Avatar name={p.displayName} className="!w-5 !h-5 !text-[9px] shrink-0"/>
                  <span className="text-[11px] font-semibold truncate">{p.displayName}</span>
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-slate-500 font-semibold">How do you want to record this match?</p>
        <div className="flex gap-2">
          <button onClick={() => onStart('manual')}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
            <Hand size={13}/> Manual Score
          </button>
          <button onClick={() => onStart('video')}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
            <Camera size={13}/> Video Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type ModalView = 'setup' | 'scoring' | 'complete';

// PlannedMatch shape (minimal — matches the type in matches/page.tsx)
interface PlannedMatchRef {
  id: string; format: MatchType; venue: string; bestOf?: 1 | 3 | 5;
  teamA: ({ uid: string; displayName: string; username: string } | null)[];
  teamB: ({ uid: string; displayName: string; username: string } | null)[];
}

export function LiveMatchModal({ open, onClose, plannedMatch = null, onMatchLogged }: {
  open: boolean; onClose: () => void; plannedMatch?: PlannedMatchRef | null;
  onMatchLogged?: (plannedMatchId: string) => void;
}) {
  const { user, matches, addMatch, addNotification } = useApp();
  const [view, setView] = useState<ModalView>('setup');
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [isHost, setIsHost] = useState(true);
  const [recordMode, setRecordMode] = useState<RecordMode>('manual');
  const [exitConfirm, setExitConfirm] = useState(false);
  const [resumedPlannedId, setResumedPlannedId] = useState<string | undefined>(undefined);

  // Paused-match resume banner — only relevant on the plain setup screen
  const [pausedMatch, setPausedMatch] = useState<LiveMatch | null>(null);
  const [pausedRef, setPausedRef] = useState<PausedMatchRef | null>(null);

  const titles: Record<ModalView, string> = {
    setup: plannedMatch ? 'Record Live' : 'Live Match',
    scoring: liveMatch ? `${liveMatch.teamAName} vs ${liveMatch.teamBName}` : 'Live Scoring',
    complete: 'Match Complete',
  };

  const requestClose = () => {
    if (view === 'scoring') { setExitConfirm(true); return; }
    onClose();
  };

  const { ref: panelRef, dialogProps } = useModalA11y(
    open, exitConfirm ? () => setExitConfirm(false) : requestClose, titles[view],
  );

  const me: LiveMatchPlayer = { uid: auth.currentUser?.uid ?? 'me', displayName: user.displayName, username: user.username };

  useEffect(() => {
    if (!open || view !== 'setup') return;
    const ref = loadPausedMatch();
    if (!ref) { setPausedMatch(null); setPausedRef(null); return; }
    // A paused match tied to a specific planned match only counts as "this" paused
    // match when we're reopening that same planned match — otherwise it belongs
    // to a different Record Live entry point and shouldn't hijack this one.
    if (plannedMatch && ref.plannedMatchId !== plannedMatch.id) { setPausedMatch(null); setPausedRef(null); return; }
    getLiveMatchByCode(ref.joinCode).then(m => {
      if (m && m.status === 'paused' && m.hostUid === me.uid) {
        setPausedMatch(m);
        setPausedRef(ref);
      } else {
        clearPausedMatch();
        setPausedMatch(null);
        setPausedRef(null);
      }
    }).catch(() => { setPausedMatch(null); setPausedRef(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, plannedMatch?.id]);

  if (!open) return null;

  const handleStart = (m: LiveMatch, mode: RecordMode = 'manual') => { setLiveMatch(m); setIsHost(true); setRecordMode(mode); setView('scoring'); };
  const handleJoin  = (m: LiveMatch) => { setLiveMatch(m); setIsHost(false); setRecordMode('manual'); setView('scoring'); };

  const handleResumePaused = () => {
    if (!pausedMatch || !pausedRef) return;
    const resumed: LiveMatch = { ...pausedMatch, status: 'active' };
    updateLiveMatch(resumed.id, { status: 'active' }).catch(() => {});
    setLiveMatch(resumed);
    setIsHost(true);
    setRecordMode(pausedRef.recordMode);
    setResumedPlannedId(pausedRef.plannedMatchId);
    clearPausedMatch();
    setPausedMatch(null);
    setPausedRef(null);
    setView('scoring');
  };

  const handleDiscardPaused = () => {
    clearPausedMatch();
    setPausedMatch(null);
    setPausedRef(null);
  };

  // If coming from a planned match, auto-build and start immediately
  const handleStartFromPlanned = (pm: PlannedMatchRef, mode: RecordMode) => {
    const aPlayers = pm.teamA.filter(Boolean) as LiveMatchPlayer[];
    const bPlayers = pm.teamB.filter(Boolean) as LiveMatchPlayer[];
    const buildName = (slots: LiveMatchPlayer[]) =>
      slots.map(p => p.displayName.split(' ')[0]).join(' & ') || '—';
    const m: LiveMatch = {
      id: genId(), joinCode: genCode(), format: pm.format, bestOf: pm.bestOf ?? 3,
      venue: pm.venue, hostUid: me.uid,
      teamA: aPlayers.length ? aPlayers : [me],
      teamB: bPlayers.length ? bPlayers : [],
      teamAName: buildName(aPlayers.length ? aPlayers : [me]),
      teamBName: buildName(bPlayers),
      status: 'active', currentGame: 0,
      games: [{ a: 0, b: 0, done: false }],
      gameWins: { a: 0, b: 0 },
      createdAt: new Date().toISOString(),
    };
    createLiveMatch(m).catch(() => {});
    handleStart(m, mode);
  };
  const handleComplete = (m: LiveMatch) => { setLiveMatch(m); setView('complete'); };

  // Computed reactively (not just at click time) so CompletionView can show the
  // block reason / bonus eligibility before the user even taps "Log to Profile".
  const opponentUidsForLog = liveMatch ? liveMatch.teamB.filter(Boolean).map(p => p!.uid).filter(uid => uid !== 'me') : [];
  const totalPointsForLog = liveMatch ? liveMatch.games.reduce((s, g) => s + g.a + g.b, 0) : 0;
  const logBlockReason = liveMatch
    ? antiCheatCheck(matches, user.uid, opponentUidsForLog)
      ?? (liveMatch.liveStats ? liveMatchIntegrityCheck(liveMatch.liveStats.durationSec, totalPointsForLog) : null)
    : null;
  const logBonusEligible = liveBonusEligible(matches, user.uid);

  const handleLogMatch = (m: LiveMatch) => {
    if (!m.winningSide || logBlockReason) return;
    const iWon = m.winningSide === 'A'; // team A is always host's team
    const gameScores = m.games.filter(g => g.done).map(g => ({ p1: g.a, p2: g.b }));
    const opp = m.teamB[0];
    // Everyone on the opposing team must confirm before the result is finalized
    const opponentUids = m.teamB.filter(Boolean).map(p => p.uid).filter(uid => uid !== 'me');

    const oppMMR = PLAYERS.find(p => p.uid === opp?.uid)?.mmr ?? user.mmr;
    const { gain, loss } = calcMMRChange(iWon ? user.mmr : oppMMR, iWon ? oppMMR : user.mmr);
    const bonus = liveBonusEligible(matches, user.uid) ? LIVE_BONUS_MULTIPLIER : 1;
    const mmrChange = Math.round((iWon ? gain : loss) * bonus);

    const newMatch = {
      id: `m_${Date.now()}`,
      type: m.format,
      player1Id: me.uid, player1Name: me.displayName, player1Username: me.username,
      player2Id: opp?.uid ?? 'opp', player2Name: opp?.displayName ?? 'Opponent', player2Username: opp?.username ?? 'opponent',
      winnerId: iWon ? me.uid : opp?.uid ?? 'opp',
      games: gameScores,
      status: opponentUids.length > 0 ? 'Pending' as const : 'Confirmed' as const,
      pendingConfirmations: opponentUids,
      playedAt: new Date().toISOString(),
      venue: m.venue,
      mmrChange,
      recordedLive: true,
      liveStats: m.liveStats,
      plannedMatchId: plannedMatch?.id ?? resumedPlannedId,
    };
    addMatch(newMatch as import('@/types').Match);
    opponentUids.forEach(uid => {
      const player = m.teamB.find(p => p?.uid === uid);
      addNotification({
        id: `notif_confirm_${Date.now()}_${uid}`,
        type: 'match_pending',
        title: 'Confirm Match Result',
        body: `${me.displayName} logged the result of your ${FORMAT_LABELS[m.format]} match — please confirm it's correct.`,
        read: false,
        createdAt: new Date().toISOString(),
        meta: { matchId: newMatch.id, opponentUid: uid, opponentName: player?.displayName ?? '' },
      });
    });
    clearPausedMatch();
    const loggedPlannedId = plannedMatch?.id ?? resumedPlannedId;
    if (loggedPlannedId) onMatchLogged?.(loggedPlannedId);
    onClose();
  };

  const handlePauseAndQuit = () => {
    if (liveMatch && isHost && view === 'scoring') {
      updateLiveMatch(liveMatch.id, { status: 'paused' }).catch(() => {});
      savePausedMatch({ joinCode: liveMatch.joinCode, recordMode, plannedMatchId: plannedMatch?.id ?? resumedPlannedId });
    }
    setExitConfirm(false);
    onClose();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-end justify-center sm:items-center p-4" onClick={requestClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[92vh] flex flex-col outline-none"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-bold text-sm">{titles[view]}</p>
          <button onClick={requestClose} aria-label="Close" className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {view === 'setup' && pausedMatch && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 space-y-3">
              <div>
                <p className="text-sm font-bold text-amber-300">Paused match</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pausedMatch.teamAName} vs {pausedMatch.teamBName} · Game {pausedMatch.currentGame + 1} · {pausedMatch.games[pausedMatch.currentGame]?.a ?? 0}–{pausedMatch.games[pausedMatch.currentGame]?.b ?? 0}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDiscardPaused} className="flex-1 py-2 text-xs font-medium">
                  Discard
                </Button>
                <Button onClick={handleResumePaused} className="flex-1 py-2 text-xs font-bold">
                  Continue Match
                </Button>
              </div>
            </div>
          )}
          {view === 'setup' && !pausedMatch && plannedMatch && (
            <PlannedMatchStart pm={plannedMatch} me={me} onStart={mode => handleStartFromPlanned(plannedMatch, mode)} onJoin={handleJoin}/>
          )}
          {view === 'setup' && !pausedMatch && !plannedMatch && <SetupView me={me} onStart={handleStart} onJoin={handleJoin}/>}
          {view === 'scoring'  && liveMatch && (
            <ScorerView initialMatch={liveMatch} isHost={isHost} recordMode={recordMode}
              onRequestExit={() => setExitConfirm(true)} onComplete={handleComplete}/>
          )}
          {view === 'complete' && liveMatch && <CompletionView match={liveMatch} onLogMatch={handleLogMatch} onClose={onClose}/>}
        </div>
      </div>

      {/* Exit warning — match still in progress */}
      {exitConfirm && (
        <div className="modal-backdrop fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); setExitConfirm(false); }}>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400"/>
              </div>
              <div>
                <p className="font-bold text-sm">Match still in progress</p>
                <p className="text-xs text-slate-400 mt-1">
                  {isHost
                    ? `Quitting now will pause the match${recordMode === 'video' ? ' (recording stops)' : ''} — you can pick up scoring again later from Live Match.`
                    : 'You’ll stop watching, but the match keeps going for the scorer.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setExitConfirm(false)} className="flex-1 py-2 font-medium">
                Keep Playing
              </Button>
              <Button variant="danger" onClick={handlePauseAndQuit} className="flex-1 py-2 font-bold">
                {isHost ? 'Pause & Quit' : 'Quit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
