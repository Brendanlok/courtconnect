'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Camera, Plus, Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { calcMMRChange, MATCH_TYPE_LABEL } from '@/lib/utils';
import type { Match, MatchType } from '@/types';

export function LogMatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, addMatch } = useApp();
  const [done,      setDone]      = useState(false);
  const [type,      setType]      = useState<MatchType>('MS');
  const [oppId,     setOppId]     = useState('');
  const [oppSearch, setOppSearch] = useState('');
  const [showDrop,  setShowDrop]  = useState(false);
  const [games,     setGames]     = useState([{ p1:'', p2:'' }, { p1:'', p2:'' }]);
  const [loc,       setLoc]       = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!open) return null;

  const opp        = PLAYERS.find(p => p.uid === oppId);
  const mmrPreview = opp ? calcMMRChange(user.mmr, opp.mmr) : null;

  const filtered = PLAYERS.filter(p => {
    const q = oppSearch.toLowerCase();
    return p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  const selectOpp = (p: typeof PLAYERS[0]) => {
    setOppId(p.uid);
    setOppSearch(`${p.displayName} (@${p.username})`);
    setShowDrop(false);
  };

  const setScore = (i: number, side: 'p1'|'p2', v: string) =>
    setGames(g => g.map((x, idx) => idx === i ? { ...x, [side]: v } : x));

  const submit = () => {
    if (!opp) return;
    const parsed   = games.map(g => ({ p1: Number(g.p1)||0, p2: Number(g.p2)||0 }));
    const myWins   = parsed.filter(g => g.p1 > g.p2).length;
    const winnerId = myWins > parsed.filter(g => g.p2 > g.p1).length ? user.uid : opp.uid;
    const change   = winnerId === user.uid ? mmrPreview!.gain : mmrPreview!.loss;

    addMatch({
      id: `m-${Date.now()}`, type, status: 'Pending',
      player1Id: user.uid,  player1Name: user.displayName,  player1Username: user.username,
      player2Id: opp.uid,   player2Name: opp.displayName,   player2Username: opp.username,
      winnerId, games: parsed, mmrChange: change,
      playedAt: new Date().toISOString(), location: loc || `${user.area}, ${user.state}`,
    });
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); setOppId(''); setOppSearch(''); setGames([{p1:'',p2:''},{p1:'',p2:''}]); }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-xl font-bold">Match Submitted!</p>
            <p className="text-slate-400 text-sm mt-2">Waiting for opponent to confirm. MMR updates after both players confirm.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-bold text-lg">Log a Match</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-colors">
                <Camera size={17}/> Scan Opponent QR Code
              </button>
              <p className="text-center text-xs text-slate-500">— or fill in manually —</p>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Match Type</span>
                <select value={type} onChange={e => setType(e.target.value as MatchType)}
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors">
                  {Object.entries(MATCH_TYPE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>

              <div className="block" ref={searchRef}>
                <span className="text-xs text-slate-400 font-semibold">Opponent</span>
                <div className="relative mt-1.5">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  <input
                    value={oppSearch}
                    onChange={e => { setOppSearch(e.target.value); setOppId(''); setShowDrop(true); }}
                    onFocus={() => setShowDrop(true)}
                    placeholder="Search name or @username…"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"
                  />
                  {showDrop && oppSearch && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="text-xs text-slate-500 px-4 py-3 text-center">No players found</p>
                      ) : (
                        filtered.map(p => (
                          <button key={p.uid} onMouseDown={() => selectOpp(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-700 text-left transition-colors">
                            <span className="text-sm font-medium">{p.displayName} <span className="text-slate-400 font-normal">(@{p.username})</span></span>
                            <span className="text-xs text-amber-400 shrink-0 ml-2">{p.mmr} MMR</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {mmrPreview && (
                  <div className="mt-1.5 flex gap-3 text-xs">
                    <span className="text-emerald-400">Win: +{mmrPreview.gain} MMR</span>
                    <span className="text-red-400">Loss: {mmrPreview.loss} MMR</span>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Venue / Location (optional)</span>
                <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. Sport Planet PJ"
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
              </label>

              <div>
                <span className="text-xs text-slate-400 font-semibold">Scores</span>
                <div className="mt-2 space-y-2">
                  {games.map((g, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-14 shrink-0">Game {i+1}</span>
                      <input type="number" min="0" max="30" placeholder="You" value={g.p1} onChange={e => setScore(i,'p1',e.target.value)}
                        className="w-16 text-center bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm font-bold outline-none focus:border-emerald-500"/>
                      <span className="text-slate-500 font-bold">—</span>
                      <input type="number" min="0" max="30" placeholder="Opp" value={g.p2} onChange={e => setScore(i,'p2',e.target.value)}
                        className="w-16 text-center bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm font-bold outline-none focus:border-emerald-500"/>
                      {i >= 2 && (
                        <button onClick={() => setGames(g => g.filter((_,idx) => idx !== i))} className="text-slate-500 hover:text-red-400 ml-auto"><X size={14}/></button>
                      )}
                    </div>
                  ))}
                  {games.length < 3 && (
                    <button onClick={() => setGames(g => [...g, {p1:'',p2:''}])}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors mt-1">
                      <Plus size={12}/> Add Game 3
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex gap-3">
              <button onClick={submit} disabled={!oppId}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-colors">
                Submit Match
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
