'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';

// Seed suggestions so autocomplete isn't empty before anyone's added a real
// venue via the Venues tab. Real, crowd-sourced entries (the `venues` table,
// loaded through AppContext) are merged in and take priority — this list is
// just a fallback, not the source of truth.
const SEED_VENUES = [
  'Sport Planet PJ, No.5 Jalan SS7/19, 47301 Petaling Jaya, Selangor',
  'Sport Planet Sunway, Jalan PJS 11/28A, 47500 Subang Jaya, Selangor',
  'Sport Planet Ampang, Jalan Ampang Utama 2/2, 68000 Ampang, Selangor',
  'Stadium Putra, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Bukit Jalil Sports Complex, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Stadium Badminton Cheras, Jalan Manis 6, 56000 Cheras, Kuala Lumpur',
  'Axiata Arena, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Stadium Shah Alam, Persiaran Majlis, 40150 Shah Alam, Selangor',
  'Penang Sports Arena, Jalan Batu Uban, 11700 Georgetown, Penang',
  'Komtar Jbcc, Jalan Wong Ah Fook, 80000 Johor Bahru, Johor',
  'Dewan Badminton Kepong, Jalan Kepong, 52100 Kepong, Kuala Lumpur',
  'Stadium Juara, Jalan 3/27B, 40150 Shah Alam, Selangor',
  'Multi Sports Hall USJ, Jalan USJ 10/1A, 47620 Subang Jaya, Selangor',
  'KL Sports City, Jalan Hang Tuah, 55200 Kuala Lumpur',
  'Ipoh Badminton Hall, Jalan Raja Musa Aziz, 30450 Ipoh, Perak',
  'Alor Setar Sports Complex, Jalan Darul Aman, 05100 Alor Setar, Kedah',
  'Kuching Sports Complex, Jalan Stadium, 93350 Kuching, Sarawak',
  'Kota Kinabalu Sports School, Jalan Universititi, 88400 Kota Kinabalu, Sabah',
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder?: string;
  required?: boolean;
}

export function VenueInput({ value, onChange, className, placeholder, required }: Props) {
  const { venues, matches } = useApp();
  const pool = useMemo(() => {
    const real = venues.map(v => v.name);
    const seen = new Set(real.map(s => s.toLowerCase()));
    return [...real, ...SEED_VENUES.filter(s => !seen.has(s.toLowerCase()))];
  }, [venues]);

  // Top 3 venues this player has actually logged, most-played first — shown
  // before they type anything so re-picking a regular court isn't a re-type.
  // player1Id is always 'me' for the signed-in user's own matches (see Match
  // type comment).
  const myVenues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) {
      if (m.player1Id !== 'me') continue;
      const v = m.venue || m.location;
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
  }, [matches]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [showRecent, setShowRecent]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setShowSugg(false); setShowRecent(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    setShowRecent(false);
    if (v.length >= 2) {
      const q = v.toLowerCase();
      const matches = pool.filter(s => s.toLowerCase().includes(q)).slice(0, 5);
      setSuggestions(matches);
      setShowSugg(matches.length > 0);
    } else {
      setShowSugg(false);
    }
  };

  const pick = (s: string) => { onChange(s); setShowSugg(false); setShowRecent(false); };

  return (
    <div className="relative" ref={ref}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0 && value.length >= 2) setShowSugg(true);
          else if (!value && myVenues.length > 0) setShowRecent(true);
        }}
        placeholder={placeholder ?? 'e.g. Sport Planet, No.5 Jalan SS7/19, 47301 Petaling Jaya'}
        required={required}
        className={className}
      />
      {showRecent && (
        <div className="absolute top-full mt-1 left-0 right-0 z-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <p className="text-[10px] text-slate-500 px-3 pt-2 pb-1 font-semibold uppercase tracking-wide flex items-center gap-1">
            <MapPin size={9}/> Your venues
          </p>
          {myVenues.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700/50">
              <span className="font-medium text-white">{s.split(',')[0]}</span>
              {/* no comma (custom-typed venue) -> nothing after the name, not a duplicate of the whole string */}
              <span className="text-slate-400">{s.includes(',') ? s.substring(s.indexOf(',')) : ''}</span>
            </button>
          ))}
        </div>
      )}
      {showSugg && (
        <div className="absolute top-full mt-1 left-0 right-0 z-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <p className="text-[10px] text-slate-500 px-3 pt-2 pb-1 font-semibold uppercase tracking-wide flex items-center gap-1">
            <MapPin size={9}/> Suggested venues
          </p>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700/50">
              <span className="font-medium text-white">{s.split(',')[0]}</span>
              <span className="text-slate-400">{s.includes(',') ? s.substring(s.indexOf(',')) : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
