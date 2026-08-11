'use client';
// Public leaderboard + player-lookup — the DUPR-style "check anyone's
// rating without an account" page. No auth, no AppContext: reads straight
// from the anon-readable users_public view (see lib/publicData.ts).
import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, TrendingUp } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { fetchPublicRankings, fetchPublicPlayer, type PublicPlayer } from '@/lib/publicData';
import { usePublicAuth } from '@/context/PublicAuthContext';
import { MY_STATES } from '@/lib/utils';
import type { Tier } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];

export default function PublicRankings() {
  const openAuth = usePublicAuth();
  // One larger fetch, filtered client-side — instant filter switches instead
  // of a round-trip + spinner per dropdown change, same tradeoff the
  // authenticated in-app leaderboard makes (see app/leaderboard).
  const [pool, setPool] = useState<PublicPlayer[] | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('All');
  const [tierFilter, setTierFilter] = useState<Tier | 'All'>('All');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<PublicPlayer | 'not-found' | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { fetchPublicRankings(200).then(setPool); }, []);

  const rankings = useMemo(() => {
    if (!pool) return null;
    return pool.filter(p => (stateFilter === 'All' || p.state === stateFilter) && (tierFilter === 'All' || p.tier === tierFilter));
  }, [pool, stateFilter, tierFilter]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().replace(/^@/, '');
    if (!q) { setSearchResult(null); return; }
    setSearching(true);
    const p = await fetchPublicPlayer(q);
    setSearchResult(p ?? 'not-found');
    setSearching(false);
  };

  const PlayerRow = ({ p, rank }: { p: PublicPlayer; rank: number }) => (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
      {/* Direct-search results can surface a still-calibrating player (rank
          0, not yet on the Top list) — "0" would read as broken, so label
          it instead of printing a fake rank number. */}
      {rank > 0
        ? <span className="w-6 text-center text-sm font-bold text-slate-500 shrink-0">{rank}</span>
        : <span className="w-6 text-center text-[9px] font-bold text-amber-400 shrink-0 leading-tight">CALIB.</span>}
      <Avatar name={p.displayName} photoURL={p.photoURL} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{p.displayName}</p>
        <p className="text-xs text-slate-500 truncate">@{p.username}{p.state ? ` · ${p.state}` : ''}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-black tabular-nums">{p.mmr}</p>
        <TierBadge tier={p.tier} className="text-[10px]" />
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="text-emerald-400" size={22}/> Rankings</h1>
        <p className="text-sm text-slate-400 mt-1">Live MMR ratings for every ranked CourtConnect player in Malaysia.</p>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Look up a player by @username…"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
        </div>
        <button type="submit" disabled={searching}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-sm rounded-xl transition-colors shrink-0">
          {searching ? <Loader2 size={15} className="animate-spin"/> : 'Search'}
        </button>
      </form>

      {searchResult && (
        <div>
          {searchResult === 'not-found' ? (
            <p className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
              No public player found for &ldquo;@{query.trim().replace(/^@/, '')}&rdquo;.
            </p>
          ) : (
            <PlayerRow p={searchResult} rank={searchResult.globalRank ?? 0} />
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top Players</p>
          <div className="flex items-center gap-2">
            <FilterDropdown label="State" value={stateFilter} defaultValue="All"
              options={[{ value: 'All', label: 'All States' }, ...MY_STATES.map(s => ({ value: s, label: s }))]}
              onChange={setStateFilter} />
            <FilterDropdown label="Tier" value={tierFilter} defaultValue="All"
              options={TIERS.map(t => ({ value: t, label: t === 'All' ? 'All Tiers' : t }))}
              onChange={setTierFilter} />
          </div>
        </div>
        {rankings === null ? (
          <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="animate-spin" size={20}/></div>
        ) : rankings.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            {pool && pool.length > 0 ? 'No ranked players match these filters.' : 'No ranked players yet — be the first to climb the board.'}
          </p>
        ) : (
          <div className="space-y-2">
            {rankings.map((p, i) => <PlayerRow key={p.uid} p={p} rank={i + 1} />)}
          </div>
        )}
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-emerald-300">Want your own rating on this board?</p>
        <button onClick={() => openAuth('signup')}
          className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
          Sign up free
        </button>
      </div>
    </div>
  );
}
