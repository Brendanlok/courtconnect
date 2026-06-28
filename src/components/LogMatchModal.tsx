'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Plus, Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { calcMMRChange, MATCH_TYPE_LABEL } from '@/lib/utils';
import type { Match, MatchType, UserProfile } from '@/types';

const SINGLES = ['MS', 'WS'];
const DOUBLES = ['MD', 'WD', 'MX'];

interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  address: { road?: string; suburb?: string; city?: string; state?: string };
}

function LocationSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query,    setQuery]    = useState(value);
  const [results,  setResults]  = useState<NominatimResult[]>([]);
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [gpsLoad,  setGpsLoad]  = useState(false);
  const ref    = useRef<HTMLDivElement>(null);
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=my&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShow(true);
      } catch { /* ignore network errors */ }
      finally { setLoading(false); }
    }, 400);
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const name = data.name || data.address?.road || '';
        const area = data.address?.suburb || data.address?.city || '';
        const label = [name, area].filter(Boolean).join(', ') || data.display_name;
        setQuery(label);
        onChange(label);
      } catch { /* ignore */ }
      finally { setGpsLoad(false); }
    }, () => setGpsLoad(false));
  };

  const select = (r: NominatimResult) => {
    const name = r.name || r.address?.road || '';
    const area = r.address?.suburb || r.address?.city || '';
    const label = [name, area].filter(Boolean).join(', ') || r.display_name.split(',').slice(0, 2).join(',').trim();
    setQuery(label);
    onChange(label);
    setShow(false);
  };

  return (
    <div ref={ref}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-semibold">Venue / Location (optional)</span>
        <button type="button" onClick={useMyLocation} disabled={gpsLoad}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
          {gpsLoad ? <Loader2 size={11} className="animate-spin"/> : <Navigation size={11}/>}
          Use my location
        </button>
      </div>
      <div className="relative mt-1.5">
        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"/>}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); search(e.target.value); }}
          onFocus={() => { if (results.length) setShow(true); }}
          placeholder="Search or use my location…"
          className="w-full pl-8 pr-8 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"
        />
        {show && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {results.map(r => {
              const name = r.name || r.address?.road || '';
              const area = [r.address?.suburb, r.address?.city, r.address?.state].filter(Boolean).join(', ');
              return (
                <button key={r.place_id} onMouseDown={() => select(r)}
                  className="w-full flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-700 text-left transition-colors">
                  <MapPin size={13} className="text-emerald-400 mt-0.5 shrink-0"/>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name || r.display_name.split(',')[0]}</p>
                    {area && <p className="text-xs text-slate-400 truncate">{area}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerSearch({
  label, value, onChange, exclude = [],
}: {
  label: string;
  value: UserProfile | null;
  onChange: (p: UserProfile | null) => void;
  exclude?: string[];
}) {
  const [query, setQuery] = useState(value ? `${value.displayName} (@${value.username})` : '');
  const [show, setShow]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  const filtered = PLAYERS.filter(p => {
    if (exclude.includes(p.uid)) return false;
    const q = query.toLowerCase();
    return p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  const select = (p: UserProfile) => {
    onChange(p);
    setQuery(`${p.displayName} (@${p.username})`);
    setShow(false);
  };

  return (
    <div ref={ref}>
      <span className="text-xs text-slate-400 font-semibold">{label}</span>
      <div className="relative mt-1.5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(null); setShow(true); }}
          onFocus={() => setShow(true)}
          placeholder="Search name or @username…"
          className="w-full pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"
        />
        {show && query && (
          <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 px-4 py-3 text-center">No players found</p>
            ) : filtered.map(p => (
              <button key={p.uid} onMouseDown={() => select(p)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-700 text-left transition-colors">
                <span className="text-sm font-medium">{p.displayName} <span className="text-slate-400 font-normal">(@{p.username})</span></span>
                <span className="text-xs text-amber-400 shrink-0 ml-2">{p.mmr} MMR</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LogMatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, addMatch } = useApp();
  const [done,     setDone]     = useState(false);
  const [type,     setType]     = useState<MatchType>('MS');
  const [opp1,     setOpp1]     = useState<UserProfile | null>(null);
  const [opp2,     setOpp2]     = useState<UserProfile | null>(null);
  const [teammate, setTeammate] = useState<UserProfile | null>(null);
  const [games,    setGames]    = useState([{ p1:'', p2:'' }, { p1:'', p2:'' }]);
  const [loc,      setLoc]      = useState('');

  if (!open) return null;

  const isDoubles = DOUBLES.includes(type);

  // MMR preview: for doubles average team MMR vs enemy team MMR
  const myTeamMMR   = isDoubles && teammate ? Math.round((user.mmr + teammate.mmr) / 2) : user.mmr;
  const oppTeamMMR  = isDoubles && opp1 && opp2 ? Math.round((opp1.mmr + opp2.mmr) / 2) : opp1?.mmr ?? 0;
  const mmrPreview  = (isDoubles ? opp1 && opp2 && teammate : opp1)
    ? calcMMRChange(myTeamMMR, oppTeamMMR)
    : null;

  const canSubmit = isDoubles ? !!(opp1 && opp2 && teammate) : !!opp1;

  const setScore = (i: number, side: 'p1' | 'p2', v: string) =>
    setGames(g => g.map((x, idx) => idx === i ? { ...x, [side]: v } : x));

  const reset = () => {
    setOpp1(null); setOpp2(null); setTeammate(null);
    setGames([{ p1:'', p2:'' }, { p1:'', p2:'' }]);
    setLoc('');
  };

  const submit = () => {
    if (!opp1) return;
    const parsed  = games.map(g => ({ p1: Number(g.p1) || 0, p2: Number(g.p2) || 0 }));
    const myWins  = parsed.filter(g => g.p1 > g.p2).length;
    const iWon    = myWins > parsed.filter(g => g.p2 > g.p1).length;
    const change  = iWon ? mmrPreview!.gain : mmrPreview!.loss;

    addMatch({
      id: `m-${Date.now()}`, type, status: 'Pending',
      player1Id: user.uid, player1Name: user.displayName, player1Username: user.username,
      ...(isDoubles && teammate ? {
        player1PartnerId: teammate.uid,
        player1PartnerName: teammate.displayName,
        player1PartnerUsername: teammate.username,
      } : {}),
      player2Id: opp1.uid, player2Name: opp1.displayName, player2Username: opp1.username,
      ...(isDoubles && opp2 ? {
        player2PartnerId: opp2.uid,
        player2PartnerName: opp2.displayName,
        player2PartnerUsername: opp2.username,
      } : {}),
      winnerId: iWon ? user.uid : opp1.uid,
      games: parsed, mmrChange: change,
      playedAt: new Date().toISOString(),
      location: loc || `${user.area}, ${user.state}`,
    } as Match);

    setDone(true);
    setTimeout(() => { setDone(false); onClose(); reset(); }, 2000);
  };

  const excludeFromOpp2 = [opp1?.uid, teammate?.uid].filter(Boolean) as string[];
  const excludeFromOpp1 = [opp2?.uid, teammate?.uid].filter(Boolean) as string[];
  const excludeFromTeam = [opp1?.uid, opp2?.uid].filter(Boolean) as string[];

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

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-colors">
                <Camera size={17}/> Scan Opponent QR Code
              </button>
              <p className="text-center text-xs text-slate-500">— or fill in manually —</p>

              {/* Match type */}
              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Match Type</span>
                <select value={type} onChange={e => { setType(e.target.value as MatchType); reset(); }}
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors">
                  {Object.entries(MATCH_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>

              {/* Singles */}
              {!isDoubles && (
                <PlayerSearch label="Opponent" value={opp1} onChange={setOpp1} />
              )}

              {/* Doubles */}
              {isDoubles && (
                <>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-3">
                    <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">Your Team</p>
                    <PlayerSearch label="Teammate" value={teammate} onChange={setTeammate} exclude={excludeFromTeam} />
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-3">
                    <p className="text-xs text-red-400 font-semibold uppercase tracking-wide">Opponents</p>
                    <PlayerSearch label="Opponent 1" value={opp1} onChange={setOpp1} exclude={excludeFromOpp1} />
                    <PlayerSearch label="Opponent 2" value={opp2} onChange={setOpp2} exclude={excludeFromOpp2} />
                  </div>
                </>
              )}

              {/* MMR preview */}
              {mmrPreview && (
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-400">Win: +{mmrPreview.gain} MMR</span>
                  <span className="text-red-400">Loss: {mmrPreview.loss} MMR</span>
                  {isDoubles && <span className="text-slate-500">· based on avg team MMR</span>}
                </div>
              )}

              {/* Venue */}
              <LocationSearch value={loc} onChange={setLoc} />

              {/* Scores */}
              <div>
                <span className="text-xs text-slate-400 font-semibold">Scores</span>
                <div className="mt-2 space-y-2">
                  {games.map((g, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-14 shrink-0">Game {i + 1}</span>
                      <input type="number" min="0" max="30" placeholder="You" value={g.p1} onChange={e => setScore(i, 'p1', e.target.value)}
                        className="w-16 text-center bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm font-bold outline-none focus:border-emerald-500"/>
                      <span className="text-slate-500 font-bold">—</span>
                      <input type="number" min="0" max="30" placeholder="Opp" value={g.p2} onChange={e => setScore(i, 'p2', e.target.value)}
                        className="w-16 text-center bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm font-bold outline-none focus:border-emerald-500"/>
                      {i >= 2 && (
                        <button onClick={() => setGames(g => g.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-red-400 ml-auto"><X size={14}/></button>
                      )}
                    </div>
                  ))}
                  {games.length < 3 && (
                    <button onClick={() => setGames(g => [...g, { p1:'', p2:'' }])}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors mt-1">
                      <Plus size={12}/> Add Game 3
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex gap-3">
              <button onClick={submit} disabled={!canSubmit}
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
