'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { createLiveMatch, updateLiveMatch, getLiveMatchByCode, subscribeLiveMatch } from '@/lib/firestoreService';
import { MATCH_TYPE_LABEL } from '@/lib/utils';
import { Zap, Copy, Check, RotateCcw, Trophy, Plus, Minus, Eye, Play, Users, MapPin, X } from 'lucide-react';
import type { LiveMatch, MatchType, CourtPosition } from '@/types';
import ClipRecorder from '@/components/ClipRecorder';
import CourtHeatmap from '@/components/CourtHeatmap';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function isDoubles(f: MatchType) {
  return f === 'MD' || f === 'WD' || f === 'MX';
}

function gamesNeeded(bestOf: 1 | 3 | 5): number {
  return Math.ceil(bestOf / 2);
}

function checkGameOver(a: number, b: number): 'A' | 'B' | null {
  const lead = Math.abs(a - b);
  if ((a >= 21 || b >= 21) && lead >= 2) return a > b ? 'A' : 'B';
  if (a >= 30) return 'A';
  if (b >= 30) return 'B';
  return null;
}

function blankMatch(
  uid: string, displayName: string, username: string,
  format: MatchType, venue: string, bestOf: 1 | 3 | 5,
  teamAName: string, teamBName: string,
): LiveMatch {
  const player = { uid, displayName, username };
  return {
    id:        `live_${Date.now()}`,
    joinCode:  makeCode(),
    format,
    teamA:     [player],
    teamB:     [],
    teamAName,
    teamBName,
    venue,
    hostUid:   uid,
    bestOf,
    status:    'active',
    currentGame: 0,
    games:     [{ a: 0, b: 0, done: false }],
    gameWins:  { a: 0, b: 0 },
    createdAt: new Date().toISOString(),
  };
}

// ── sub-components ─────────────────────────────────────────────────────────────

function ScorePill({ score, winner }: { score: string; winner?: 'A' | 'B' }) {
  return (
    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border
      ${winner === 'A' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
      : winner === 'B' ? 'bg-red-500/10 border-red-500/20 text-red-400'
      : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
      {score}
    </span>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'setup' | 'scoring' | 'complete' | 'watching';

export default function LivePage() {
  const { user, awardClipCredits, saveCourtPositions } = useApp();

  // phase machine
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [match,      setMatch]      = useState<LiveMatch | null>(null);

  // setup form
  const [format,     setFormat]     = useState<MatchType>('MS');
  const [venue,      setVenue]      = useState('');
  const [bestOf,     setBestOf]     = useState<1 | 3 | 5>(3);
  const [teamAName,  setTeamAName]  = useState(user.displayName);
  const [teamBName,  setTeamBName]  = useState('');

  // court tracking
  const [courtPositions, setCourtPositions] = useState<CourtPosition[]>([]);
  const [courtOpen,      setCourtOpen]      = useState(false);
  const [courtSaved,     setCourtSaved]     = useState(false);

  // join flow — pre-fill from ?code= query param
  const [joinInput,  setJoinInput]  = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('code') ?? '';
  });
  const [joinErr,    setJoinErr]    = useState('');
  const [joinLoading,setJoinLoading]= useState(false);

  // copy code
  const [copied,     setCopied]     = useState(false);

  // undo stack — list of previous LiveMatch states
  const [history,    setHistory]    = useState<LiveMatch[]>([]);

  // Sync from Firestore when watching
  useEffect(() => {
    if (phase !== 'watching' || !match) return;
    const unsub = subscribeLiveMatch(match.id, (updated) => {
      if (updated) {
        setMatch(updated);
        if (updated.status === 'completed') setPhase('complete');
      }
    });
    return unsub;
  }, [phase, match?.id]);

  // ── scoring logic ──────────────────────────────────────────────────────────

  const mutateMatch = useCallback((next: LiveMatch) => {
    setMatch(next);
    updateLiveMatch(next.id, next).catch(() => {});
  }, []);

  const addPoint = useCallback((side: 'a' | 'b') => {
    if (!match || match.status === 'completed') return;
    setHistory(h => [...h, match]);

    const games    = match.games.map(g => ({ ...g }));
    const cur      = games[match.currentGame];
    const gameWins = { ...match.gameWins };

    cur[side] += 1;

    const winner = checkGameOver(cur.a, cur.b);
    let nextGame   = match.currentGame;
    let status: LiveMatch['status'] = 'active';
    let winningSide: LiveMatch['winningSide'];

    if (winner) {
      cur.done       = true;
      cur.winningSide = winner;
      gameWins[winner.toLowerCase() as 'a' | 'b'] += 1;

      const needed = gamesNeeded(match.bestOf);
      if (gameWins.a >= needed) { status = 'completed'; winningSide = 'A'; }
      else if (gameWins.b >= needed) { status = 'completed'; winningSide = 'B'; }
      else {
        nextGame = match.currentGame + 1;
        games.push({ a: 0, b: 0, done: false });
      }
    }

    const next: LiveMatch = {
      ...match,
      games, gameWins, currentGame: nextGame, status, winningSide,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };
    mutateMatch(next);
    if (status === 'completed') setPhase('complete');
  }, [match, mutateMatch]);

  const removePoint = useCallback((side: 'a' | 'b') => {
    if (!match || match.status === 'completed') return;
    setHistory(h => [...h, match]);

    const games = match.games.map(g => ({ ...g }));
    const cur   = games[match.currentGame];
    if (cur[side] <= 0) return;
    cur[side] -= 1;

    const next = { ...match, games };
    mutateMatch(next);
  }, [match, mutateMatch]);

  const undo = useCallback(() => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setMatch(prev);
    updateLiveMatch(prev.id, prev).catch(() => {});
    if (phase === 'complete') setPhase('scoring');
  }, [history, phase]);

  // ── start match ────────────────────────────────────────────────────────────

  const startMatch = useCallback(async () => {
    const m = blankMatch(user.uid, user.displayName, user.username, format, venue || 'Venue TBD', bestOf, teamAName || user.displayName, teamBName || 'Opponent');
    setMatch(m);
    setHistory([]);
    setPhase('scoring');
    try { await createLiveMatch(m); } catch { /* offline — local state is source of truth */ }
  }, [user, format, venue, bestOf, teamAName, teamBName]);

  // ── join by code ───────────────────────────────────────────────────────────

  const joinMatch = useCallback(async () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length !== 6) { setJoinErr('Enter the full 6-character code.'); return; }
    setJoinLoading(true);
    setJoinErr('');
    try {
      const found = await getLiveMatchByCode(code);
      if (!found) { setJoinErr('No active match with that code.'); return; }
      setMatch(found);
      setPhase(found.hostUid === user.uid ? 'scoring' : 'watching');
    } catch {
      setJoinErr('Could not connect. Check your internet connection.');
    } finally {
      setJoinLoading(false);
    }
  }, [joinInput, user.uid]);

  const copyCode = useCallback(async () => {
    if (!match) return;
    try { await navigator.clipboard.writeText(match.joinCode); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [match]);

  // ── render helpers ─────────────────────────────────────────────────────────

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors';

  // ── IDLE ───────────────────────────────────────────────────────────────────

  if (phase === 'idle') return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap size={22} className="text-amber-400"/> Live Score</h1>
        <p className="text-slate-400 text-sm mt-1">Score a match in real time. Others can follow live with a 6-digit code.</p>
      </div>

      <button onClick={() => setPhase('setup')}
        className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-base transition-colors">
        <Play size={18}/> Start a Match
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Eye size={14} className="text-slate-400"/> Watch a Match</p>
        <p className="text-xs text-slate-500">Enter the 6-character code from the person scoring.</p>
        <div className="flex gap-2">
          <input value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinMatch()}
            maxLength={6} placeholder="e.g. AB12CD"
            className={`${inp} font-mono text-base tracking-widest uppercase flex-1`}/>
          <button onClick={joinMatch} disabled={joinLoading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors shrink-0">
            {joinLoading ? '…' : 'Join'}
          </button>
        </div>
        {joinErr && <p className="text-xs text-red-400">{joinErr}</p>}
      </div>
    </div>
  );

  // ── SETUP ──────────────────────────────────────────────────────────────────

  if (phase === 'setup') return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setPhase('idle')} className="text-slate-400 hover:text-white transition-colors text-sm">← Back</button>
        <h1 className="text-xl font-bold">Match Setup</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">

        {/* Format */}
        <div>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">Format</p>
          <div className="grid grid-cols-5 gap-1.5">
            {(['MS','WS','MD','WD','MX'] as MatchType[]).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors
                  ${format === f ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                {f}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-1.5">{MATCH_TYPE_LABEL[format]}</p>
        </div>

        {/* Best of */}
        <div>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">Best of</p>
          <div className="flex gap-2">
            {([1, 3, 5] as const).map(n => (
              <button key={n} onClick={() => setBestOf(n)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors
                  ${bestOf === n ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Teams */}
        <div>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">
            {isDoubles(format) ? 'Teams' : 'Players'}
          </p>
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400">A</span>
              <input value={teamAName} onChange={e => setTeamAName(e.target.value)}
                placeholder={isDoubles(format) ? 'Team A name' : 'Player A name'}
                className={`${inp} pl-7`}/>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">B</span>
              <input value={teamBName} onChange={e => setTeamBName(e.target.value)}
                placeholder={isDoubles(format) ? 'Team B name' : 'Player B name'}
                className={`${inp} pl-7`}/>
            </div>
          </div>
        </div>

        {/* Venue */}
        <div>
          <p className="text-[11px] text-slate-500 font-semibold mb-2">Venue (optional)</p>
          <input value={venue} onChange={e => setVenue(e.target.value)}
            placeholder="e.g. Sport Planet PJ"
            className={inp}/>
        </div>

        <button onClick={startMatch}
          disabled={!teamBName.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition-colors">
          Start Scoring
        </button>
      </div>
    </div>
  );

  // ── SCORING / WATCHING / COMPLETE ──────────────────────────────────────────

  if (!match) return null;

  const cur       = match.games[match.currentGame];
  const needed    = gamesNeeded(match.bestOf);
  const isHost    = phase === 'scoring';
  const isDone    = phase === 'complete';
  const winnerName = match.winningSide === 'A' ? match.teamAName : match.winningSide === 'B' ? match.teamBName : '';

  const teamColor = (side: 'A' | 'B') =>
    side === 'A' ? 'text-emerald-400' : 'text-blue-400';

  const ScorePanel = ({ side }: { side: 'A' | 'B' }) => {
    const s  = side.toLowerCase() as 'a' | 'b';
    const sc = cur[s];
    const name = side === 'A' ? match.teamAName : match.teamBName;
    const wins = side === 'A' ? match.gameWins.a : match.gameWins.b;
    const isWinner = match.winningSide === side;

    return (
      <div className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl border transition-colors
        ${isWinner ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>

        {/* Name */}
        <p className={`text-sm font-bold truncate max-w-full text-center ${teamColor(side)}`}>{name}</p>

        {/* Game wins pips */}
        <div className="flex gap-1">
          {Array.from({ length: needed }).map((_, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-full border
              ${i < wins ? (side === 'A' ? 'bg-emerald-500 border-emerald-400' : 'bg-blue-500 border-blue-400') : 'bg-slate-700 border-slate-600'}`}/>
          ))}
        </div>

        {/* Big score */}
        <p className={`text-6xl font-black tabular-nums leading-none
          ${isWinner ? 'text-emerald-300' : 'text-white'}`}>
          {sc}
        </p>

        {/* +/- buttons */}
        {isHost && !isDone && (
          <div className="flex gap-2 w-full">
            <button onClick={() => removePoint(s)}
              disabled={sc === 0}
              className="flex-1 h-10 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl flex items-center justify-center transition-colors">
              <Minus size={16}/>
            </button>
            <button onClick={() => addPoint(s)}
              className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl flex items-center justify-center transition-all font-bold text-lg">
              +1
            </button>
          </div>
        )}

        {isWinner && <Trophy size={20} className="text-amber-400"/>}
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{MATCH_TYPE_LABEL[match.format]}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isDone ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'}`}>
              {isDone ? 'FINAL' : phase === 'watching' ? '👁 WATCHING' : '● LIVE'}
            </span>
          </div>
          {match.venue && <p className="text-xs text-slate-500 mt-0.5">{match.venue}</p>}
        </div>

        {/* Share code */}
        <button onClick={copyCode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-mono font-bold transition-colors">
          {copied ? <Check size={12} className="text-emerald-400"/> : <Copy size={12}/>}
          {match.joinCode}
        </button>
      </div>

      {/* Score panels */}
      <div className="flex gap-3">
        <ScorePanel side="A"/>
        <div className="flex items-center justify-center shrink-0 px-1">
          <span className="text-slate-600 font-bold text-sm">VS</span>
        </div>
        <ScorePanel side="B"/>
      </div>

      {/* Game context */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Best of {match.bestOf}</span>
          {!isDone && <span className="font-semibold text-slate-300">Game {match.currentGame + 1} of {match.bestOf}</span>}
          {isDone && <span className="font-bold text-emerald-400">{winnerName} wins!</span>}
        </div>

        {/* Game history */}
        {match.games.filter(g => g.done).length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-600 uppercase tracking-wide">Games played</p>
            <div className="flex flex-wrap gap-2">
              {match.games.map((g, i) => g.done && (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">G{i+1}</span>
                  <ScorePill
                    score={`${g.a}–${g.b}`}
                    winner={g.winningSide}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score rules hint */}
        {!isDone && (
          <p className="text-[10px] text-slate-600">First to 21 (2-point lead) · Cap at 30</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {isHost && !isDone && history.length > 0 && (
          <button onClick={undo}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-colors">
            <RotateCcw size={14}/> Undo
          </button>
        )}
        {isDone && (
          <button onClick={() => { setPhase('idle'); setMatch(null); setHistory([]); }}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
            New Match
          </button>
        )}
        {isHost && !isDone && (
          <button onClick={() => {
            const ended: LiveMatch = { ...match, status: 'completed', completedAt: new Date().toISOString() };
            mutateMatch(ended);
            setPhase('complete');
          }}
            className="ml-auto px-4 py-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-slate-700 rounded-xl text-sm font-medium text-slate-400 transition-colors">
            End Match
          </button>
        )}
      </div>

      {/* Watching notice */}
      {phase === 'watching' && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <Users size={12}/>
          <span>You&apos;re watching this match live. Scores update automatically.</span>
        </div>
      )}
    </div>
  );
}
