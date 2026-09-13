'use client';
// Public tournament directory (DUPR's "Events"). Reads tournaments_public
// (supabase/migrations/0023) — a curated view with no participant names, no
// join-request list, no host uid. Requires that migration to actually be run
// (see lib/publicData.ts header) — until then this renders the empty state,
// same fail-closed behavior as every other public* fetch.
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Trophy, Loader2, Search } from 'lucide-react';
import { fetchPublicTournaments, type PublicTournament } from '@/lib/publicData';
import { formatDate, MATCH_TYPE_LABEL, MY_STATES } from '@/lib/utils';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { usePublicAuth } from '@/context/PublicAuthContext';
import type { MatchType } from '@/types';

const FORMATS: (MatchType | 'All')[] = ['All', 'MS', 'WS', 'MD', 'WD', 'MX'];

export default function Events() {
  const openAuth = usePublicAuth();
  // One larger fetch, filtered client-side — same tradeoff as the public
  // Rankings page (instant filter switches, no round-trip per change).
  const [pool, setPool] = useState<PublicTournament[] | null>(null);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [formatFilter, setFormatFilter] = useState<MatchType | 'All'>('All');
  useEffect(() => { fetchPublicTournaments().then(setPool); }, []);

  const tournaments = useMemo(() => {
    if (!pool) return null;
    const q = query.trim().toLowerCase();
    return pool.filter(t =>
      (stateFilter === 'All' || t.state === stateFilter) &&
      (formatFilter === 'All' || t.type === formatFilter) &&
      (!q || t.name.toLowerCase().includes(q) || t.venue.toLowerCase().includes(q)));
  }, [pool, query, stateFilter, formatFilter]);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="text-emerald-400" size={22}/> Events</h1>
        <p className="text-sm text-slate-400 mt-1">Upcoming tournaments open to CourtConnect players.</p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or venue…"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <FilterDropdown label="State" value={stateFilter} defaultValue="All"
            options={[{ value: 'All', label: 'All States' }, ...MY_STATES.map(s => ({ value: s, label: s }))]}
            onChange={setStateFilter} />
          <FilterDropdown label="Format" value={formatFilter} defaultValue="All"
            options={FORMATS.map(f => ({ value: f, label: f === 'All' ? 'All Formats' : MATCH_TYPE_LABEL[f] }))}
            onChange={setFormatFilter} />
        </div>
      </div>

      {tournaments === null ? (
        <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="animate-spin" size={20}/></div>
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          {pool && pool.length > 0 ? 'No events match these filters.' : 'No upcoming tournaments listed right now.'}
        </p>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{MATCH_TYPE_LABEL[t.type] ?? t.type}{t.organiser ? ` · ${t.organiser}` : ''}</p>
                </div>
                {t.entryFee > 0 && <span className="text-xs font-bold text-amber-400 shrink-0">RM{t.entryFee}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><CalendarDays size={12}/> {formatDate(t.date)}</span>
                <span className="flex items-center gap-1"><MapPin size={12}/> {t.venue}</span>
                <span>{t.currentPlayers}/{t.maxPlayers} players</span>
                {t.prizePool > 0 && <span className="text-emerald-400">RM{t.prizePool} prize pool</span>}
              </div>
              {t.description && <p className="text-xs text-slate-500 mt-2">{t.description}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-emerald-300">Sign up to register for a tournament.</p>
        <button onClick={() => openAuth('signup')}
          className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
          Sign up free
        </button>
      </div>
    </div>
  );
}
