'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Plus, Search, MapPin, Loader2, Navigation, Upload, ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PLAYERS, ME } from '@/lib/data';
import { calcMMRChange, MATCH_TYPE_LABEL } from '@/lib/utils';
import type { Match, MatchType, UserProfile } from '@/types';
import { lookupUserByUid, lookupUserByUsername } from '@/lib/firestoreService';
import { useModalA11y } from '@/hooks/useModalA11y';

const SINGLES = ['MS', 'WS'];
const DOUBLES = ['MD', 'WD', 'MX'];
const ALL_PLAYERS = [ME, ...PLAYERS];

// ─── QR scanner (photo / camera) ─────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

function QRScanner({ onFound }: { onFound: (player: UserProfile) => void }) {
  const [state,    setState]    = useState<ScanState>('idle');
  const [message,  setMessage]  = useState('');
  const [preview,  setPreview]  = useState<string | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const decodeImageData = useCallback(async (file: File) => {
    setState('scanning');
    setMessage('');
    setPreview(URL.createObjectURL(file));

    try {
      // Draw image to canvas and extract pixel data
      const img = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Dynamically import jsqr (avoids SSR issues)
      const jsQR = (await import('jsqr')).default;
      const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });

      if (!result) {
        setState('error');
        setMessage('No QR code found in this image. Try a clearer photo.');
        return;
      }

      // Parse the QR payload — either a profile URL (".../players/<username>/") or
      // the legacy {"uid":"...","username":"...","displayName":"..."} JSON payload
      let payload: { uid?: string; username?: string; displayName?: string } = {};
      try { payload = JSON.parse(result.data); } catch {
        const match = result.data.match(/\/players\/([^/?#]+)\/?/);
        if (match) payload = { username: decodeURIComponent(match[1]) };
      }

      // First check seed players, then look up in Firestore
      let player: UserProfile | null = ALL_PLAYERS.find(p =>
        (payload.uid && p.uid === payload.uid) ||
        (payload.username && p.username === payload.username)
      ) ?? null;

      if (!player && (payload.uid || payload.username)) {
        const fbUser = payload.uid
          ? await lookupUserByUid(payload.uid)
          : await lookupUserByUsername(payload.username!);
        if (fbUser && fbUser.uid && fbUser.username && fbUser.displayName) {
          player = {
            uid: fbUser.uid,
            username: fbUser.username,
            displayName: fbUser.displayName,
            email: fbUser.email ?? '',
            mmr: fbUser.mmr ?? 1200,
            tier: fbUser.tier ?? 'Silver',
            globalRank: fbUser.globalRank ?? 9999,
            state: fbUser.state ?? 'Selangor',
            area: fbUser.area ?? '',
            stats: fbUser.stats ?? { wins: 0, losses: 0, totalMatches: 0 },
            joinedAt: fbUser.joinedAt ?? new Date().toISOString(),
            gender: fbUser.gender,
          } as UserProfile;
        }
      }

      if (!player) {
        setState('error');
        setMessage(`QR decoded but player "${payload.displayName ?? payload.username ?? result.data}" is not registered.`);
        return;
      }

      setState('success');
      setMessage(`Found: ${player.displayName} (@${player.username})`);
      onFound(player);
    } catch {
      setState('error');
      setMessage('Could not read the image. Please try again.');
    }
  }, [onFound]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) decodeImageData(file);
    // reset so same file can re-trigger
    e.target.value = '';
  };

  const reset = () => { setState('idle'); setMessage(''); setPreview(null); };

  return (
    <div className="space-y-2">
      {/* Hidden file inputs */}
      <input ref={fileRef}    type="file" accept="image/*"                    className="hidden" onChange={handleFile}/>
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile}/>

      {state === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-sm font-medium transition-all group">
            <Camera size={20} className="text-emerald-400 group-hover:scale-110 transition-transform"/>
            <span className="text-xs text-slate-300">Take Photo</span>
          </button>
          <button type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-sm font-medium transition-all group">
            <Upload size={20} className="text-emerald-400 group-hover:scale-110 transition-transform"/>
            <span className="text-xs text-slate-300">Upload Photo</span>
          </button>
        </div>
      )}

      {state === 'scanning' && (
        <div className="flex items-center gap-3 py-4 px-4 bg-slate-800 border border-slate-700 rounded-xl">
          {preview && (
            <img src={preview} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 opacity-60"/>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-emerald-400 animate-spin shrink-0"/>
              <span className="text-sm font-medium text-slate-300">Reading QR code…</span>
            </div>
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center gap-3 py-3 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          {preview && (
            <img src={preview} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0"/>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0"/>
              <span className="text-sm font-semibold text-emerald-300">Opponent found!</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{message}</p>
          </div>
          <button type="button" onClick={reset} className="text-slate-500 hover:text-white shrink-0"><X size={14}/></button>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 py-3 px-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            {preview && (
              <img src={preview} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 opacity-60"/>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400 shrink-0"/>
                <span className="text-sm font-semibold text-red-300">Scan failed</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{message}</p>
            </div>
            <button type="button" onClick={reset} className="text-slate-500 hover:text-white shrink-0"><X size={14}/></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { reset(); setTimeout(() => cameraRef.current?.click(), 50); }}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium transition-colors">
              <Camera size={13} className="text-emerald-400"/> Try Camera
            </button>
            <button type="button" onClick={() => { reset(); setTimeout(() => fileRef.current?.click(), 50); }}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium transition-colors">
              <ImageIcon size={13} className="text-emerald-400"/> Try Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

// ─── Anti-cheat checks ───────────────────────────────────────────────────────

function antiCheatCheck(matches: import('@/types').Match[], userId: string, oppUids: string[]): string | null {
  const now = Date.now();
  const day  = 24 * 3600 * 1000;
  const week = 7 * day;

  // Rule 1: max 3 matches vs any of the same opponents in 7 days
  const recentVsOpp = matches.filter(m => {
    const opponentIds = [m.player1Id === userId ? null : m.player1Id, m.player2Id === userId ? null : m.player2Id,
      m.player1PartnerId, m.player2PartnerId].filter(Boolean) as string[];
    const involves = (m.player1Id === userId || m.player2Id === userId) &&
      opponentIds.some(id => oppUids.includes(id));
    return involves && (now - new Date(m.playedAt).getTime()) < week;
  });
  if (recentVsOpp.length >= 3) {
    return `You've already logged ${recentVsOpp.length} matches against this opponent in the past 7 days. Maximum is 3 per week to prevent MMR farming.`;
  }

  // Rule 2: max 2 matches vs same opponent today
  const todayVsOpp = recentVsOpp.filter(m => (now - new Date(m.playedAt).getTime()) < day);
  if (todayVsOpp.length >= 2) {
    return `You've already logged 2 matches against this opponent today. Come back tomorrow to log more.`;
  }

  // Rule 3: daily MMR gain cap — check confirmed wins today
  const todayWins = matches.filter(m =>
    (m.player1Id === userId || m.player2Id === userId) && m.winnerId === userId &&
    m.status === 'Confirmed' &&
    (now - new Date(m.playedAt).getTime()) < day
  );
  const todayGain = todayWins.reduce((s, m) => s + (m.mmrChange ?? 0), 0);
  if (todayGain >= 150) {
    return `You've already gained ${todayGain} MMR today. The daily cap is +150 MMR to keep ratings fair. Come back tomorrow!`;
  }

  return null; // all clear
}

export function LogMatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, addMatch, matches, updateUser } = useApp();
  const [done,     setDone]     = useState(false);
  const [type,     setType]     = useState<MatchType>('MS');
  const [opp1,     setOpp1]     = useState<UserProfile | null>(null);
  const [opp2,     setOpp2]     = useState<UserProfile | null>(null);
  const [teammate, setTeammate] = useState<UserProfile | null>(null);
  const [games,    setGames]    = useState([{ p1:'', p2:'' }, { p1:'', p2:'' }]);
  const [loc,      setLoc]      = useState('');

  const { ref: panelRef, dialogProps } = useModalA11y(open && !done, onClose, 'Log a Match');

  if (!open) return null;

  const isDoubles = DOUBLES.includes(type);

  // Calibration: first 10 matches use 1.5× K
  const placementDone = (user.placementMatchesPlayed ?? 0) >= 10;
  const kFactor = placementDone ? 32 : 48;

  // MMR preview: for doubles average team MMR vs enemy team MMR
  const myTeamMMR   = isDoubles && teammate ? Math.round((user.mmr + teammate.mmr) / 2) : user.mmr;
  const oppTeamMMR  = isDoubles && opp1 && opp2 ? Math.round((opp1.mmr + opp2.mmr) / 2) : opp1?.mmr ?? 0;
  const mmrPreview  = (isDoubles ? opp1 && opp2 && teammate : opp1)
    ? calcMMRChange(myTeamMMR, oppTeamMMR, kFactor)
    : null;

  const hasScores   = games.some(g => g.p1 !== '' && g.p2 !== '' && (Number(g.p1) > 0 || Number(g.p2) > 0));
  const cheatBlock  = opp1 ? antiCheatCheck(matches, user.uid, [opp1.uid, ...(opp2 ? [opp2.uid] : [])]) : null;
  const canSubmit   = (isDoubles ? !!(opp1 && opp2 && teammate) : !!opp1) && hasScores && !cheatBlock;

  const setScore = (i: number, side: 'p1' | 'p2', v: string) =>
    setGames(g => g.map((x, idx) => idx === i ? { ...x, [side]: v } : x));

  const reset = () => {
    setOpp1(null); setOpp2(null); setTeammate(null);
    setGames([{ p1:'', p2:'' }, { p1:'', p2:'' }]);
    setLoc('');
  };

  const submit = () => {
    if (!opp1 || !mmrPreview) return;
    const parsed  = games
      .filter(g => g.p1 !== '' && g.p2 !== '')
      .map(g => ({ p1: Number(g.p1) || 0, p2: Number(g.p2) || 0 }));
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

    if (!placementDone) {
      updateUser({ placementMatchesPlayed: (user.placementMatchesPlayed ?? 0) + 1 });
    }

    setDone(true);
    setTimeout(() => { setDone(false); onClose(); reset(); }, 2000);
  };

  const excludeFromOpp2 = [opp1?.uid, teammate?.uid].filter(Boolean) as string[];
  const excludeFromOpp1 = [opp2?.uid, teammate?.uid].filter(Boolean) as string[];
  const excludeFromTeam = [opp1?.uid, opp2?.uid].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
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
              <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* QR scan */}
              <div>
                <p className="text-xs text-slate-400 font-semibold mb-2">Scan Opponent QR Code</p>
                <QRScanner onFound={p => { setOpp1(p); }} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800"/>
                <span className="text-xs text-slate-500 shrink-0">or fill in manually</span>
                <div className="flex-1 h-px bg-slate-800"/>
              </div>

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

              {/* Anti-cheat warning */}
              {cheatBlock && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5"/>
                  <p className="text-xs text-red-300 leading-relaxed">{cheatBlock}</p>
                </div>
              )}

              {/* MMR preview */}
              {mmrPreview && !cheatBlock && (
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
                <span className="text-xs text-slate-400 font-semibold">Scores <span className="text-red-400">*</span></span>
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
                title={!opp1 ? 'Select an opponent first' : !hasScores ? 'Enter at least one game score' : undefined}
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
