'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { TIER_STYLE, COUNTRIES, approxDistanceKm, profileHref, getCountryByName, isCalibrating } from '@/lib/utils';
import { seasonNumberForDate, daysUntilSeasonEnd } from '@/lib/seasons';
import { Search, MapPin, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import type { UserProfile, Tier } from '@/types';

const TABS = ['Nationwide', 'By State', 'Nearby', 'Following'] as const;
type Tab = typeof TABS[number];
type SortKey = 'mmr' | 'winRate' | 'wins' | 'matches';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'mmr',     label: 'MMR' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'wins',    label: 'Wins' },
  { key: 'matches', label: 'Matches' },
];

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];

export default function Leaderboard() {
  const { user, following, allRealPlayers } = useApp();
  const [tab,           setTab]          = useState<Tab>('Nationwide');
  const [query,         setQuery]        = useState('');
  // Same fallback handleCountryChange uses when switching back to the
  // user's own country below — non-MY users have their real location in
  // .region, not .state (.state is a required-but-unused MalaysiaState
  // default for them). Initializing from .state alone left the By-Region
  // tab filtering on a value that could never match any non-MY player,
  // including the user's own row, until they touched the country dropdown.
  const [selState,      setSelState]     = useState<string>(user.region ?? user.state);
  const [sortKey,       setSortKey]      = useState<SortKey>('mmr');
  const [tierFilter,    setTierFilter]   = useState<Tier | 'All'>('All');
  const userCountry = user.country ?? 'Malaysia';
  const [countryFilter, setCountryFilter]= useState<string>(userCountry);
  const countryData = COUNTRIES.find(c => c.name === countryFilter);
  // Every real country's COUNTRIES entry (including Malaysia's own) carries
  // a real regions list — only 'Other' has an empty one, since no fixed list
  // exists for it. That used to fall back to MY_STATES, showing Malaysian
  // state names as filter options for non-Malaysian players (never matched
  // anything, always-empty tab) — free-text instead, same fallback every
  // sibling location picker (SettingsModal, OnboardingModal, AuthModal) uses.
  const hasFixedRegions = !!countryData?.regions.length;
  const regions = countryData?.regions ?? [];
  const regionLabel = countryData?.regionLabel ?? 'State';

  function handleCountryChange(name: string) {
    setCountryFilter(name);
    const cd = getCountryByName(name);
    setSelState(name === userCountry ? (user.region ?? user.state) : (cd.regions[0] ?? ''));
  }

  const winRate = (p: UserProfile) => p.stats.totalMatches > 0 ? p.stats.wins / p.stats.totalMatches : 0;
  // Calibrating players (new accounts still on placement, or returning
  // accounts re-placed after inactivity) don't appear in ranks at all —
  // their MMR keeps updating behind the scenes, just not surfaced here.
  const all: UserProfile[] = [user, ...PLAYERS, ...allRealPlayers].filter(p => !isCalibrating(p));

  const list = all
    .filter(p => (p.country ?? 'Malaysia') === countryFilter)
    .filter(p => {
      if (tab === 'By State') return (countryFilter === 'Malaysia' ? p.state : (p.region ?? '')) === selState;
      if (tab === 'Nearby')   return (p.distKm ?? (p.uid === 'me' ? 0 : approxDistanceKm(user, p))) <= 10;
      if (tab === 'Following') return following.includes(p.uid) || p.uid === 'me';
      return true;
    })
    .filter(p => tierFilter === 'All' || p.tier === tierFilter)
    .filter(p => p.displayName.toLowerCase().includes(query.toLowerCase()) || p.username.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'mmr')     return b.mmr - a.mmr;
      if (sortKey === 'winRate') return winRate(b) - winRate(a);
      if (sortKey === 'wins')    return b.stats.wins - a.stats.wins;
      if (sortKey === 'matches') return b.stats.totalMatches - a.stats.totalMatches;
      return 0;
    })
    .map((p, i) => ({ ...p, tabRank: i + 1 }));

  const top3      = list.slice(0, 3);
  const showPodium = !query && top3.length >= 3;
  const rest      = showPodium ? list.slice(3) : list;
  const meInList  = list.find(p => p.uid === 'me');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-full">
            Season {seasonNumberForDate(new Date())} · {daysUntilSeasonEnd(new Date())}d left
          </span>
        </div>
        <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
          <span>{countryData?.flag ?? '🌐'}</span> {countryFilter} — {list.length} players ranked
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t === 'By State' ? `By ${regionLabel}` : t}
            </button>
          ))}
        </div>

        {tab === 'By State' && (
          hasFixedRegions ? (
            <FilterDropdown<string>
              icon={<MapPin size={11} className="text-emerald-400"/>}
              label={selState || `All ${regionLabel}s`} value={selState}
              options={regions.map(s => ({ value: s, label: s }))}
              onChange={setSelState}
            />
          ) : (
            <div className="relative max-w-[200px]">
              <MapPin size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400"/>
              <input value={selState} onChange={e => setSelState(e.target.value)}
                placeholder={regionLabel}
                className="w-full pl-7 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs outline-none focus:border-emerald-500 transition-colors"/>
            </div>
          )
        )}
      </div>

      {/* Search + filters row */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search player or @username…"
            className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </div>

        <FilterDropdown<string>
          label={`${COUNTRIES.find(c => c.name === userCountry)?.flag ?? ''} ${userCountry}`}
          value={countryFilter}
          defaultValue={userCountry}
          options={[userCountry, ...COUNTRIES.filter(c => c.name !== userCountry).map(c => c.name)]
            .map(name => COUNTRIES.find(c => c.name === name))
            .filter((c): c is NonNullable<typeof c> => !!c)
            .map(c => ({ value: c.name, label: c.name, prefix: <span>{c.flag}</span> }))}
          onChange={handleCountryChange}
        />

        <FilterDropdown<SortKey>
          icon={<ArrowUpDown size={11} className="text-slate-400"/>}
          label="Sort: MMR" value={sortKey}
          options={SORT_OPTIONS.map(s => ({ value: s.key, label: `Sort: ${s.label}` }))}
          onChange={setSortKey}
        />

        <FilterDropdown<Tier | 'All'>
          icon={<span className="text-[11px]">{tierFilter !== 'All' ? TIER_STYLE[tierFilter].icon : '🏅'}</span>}
          label="All Tiers" value={tierFilter}
          options={TIERS.map(t => ({
            value: t,
            label: t === 'All' ? 'All Tiers' : t,
            prefix: t !== 'All' ? <span className="text-sm">{TIER_STYLE[t].icon}</span> : undefined,
          }))}
          onChange={setTierFilter}
        />
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No players found.</div>
      ) : (
        <>
          {/* Podium */}
          {showPodium && (
            <div className="flex justify-center items-end gap-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              {[top3[1], top3[0], top3[2]].map((p, idx) => {
                const isFirst = idx === 1;
                const medal   = ['🥈','🥇','🥉'][idx];
                return (
                  <Link key={p.uid} href={profileHref(p)}
                    className={`text-center group hover:opacity-90 transition-opacity ${isFirst ? '' : 'mt-6'}`}
                    style={{ width: isFirst ? 140 : 110 }}>
                    <p className="text-2xl mb-2">{medal}</p>
                    <Avatar name={p.displayName} size={isFirst ? 'lg' : 'md'} photoURL={p.photoURL}
                      className={`mx-auto ${isFirst ? 'ring-2 ring-amber-400' : ''}`}/>
                    <p className="text-xs text-slate-400 mt-1">@{p.username}</p>
                    <p className={`font-bold mt-0.5 group-hover:text-emerald-300 transition-colors ${isFirst ? 'text-base' : 'text-sm'}`}>{p.displayName}</p>
                    {p.isDummy && <span className="text-[9px] font-bold bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">DEMO</span>}
                    <p className={`font-bold text-amber-400 ${isFirst ? 'text-lg' : 'text-sm'}`}>{p.mmr.toLocaleString()}</p>
                    <div className="flex justify-center mt-1"><TierBadge tier={p.tier}/></div>
                    <p className="text-xs text-slate-500 mt-1">📍 {p.area || p.state}</p>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[44px_1fr_auto_auto] gap-3 px-4 py-2.5 bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
              <span>#</span><span>Player</span><span>Tier</span>
              <span className="text-right">{SORT_OPTIONS.find(s => s.key === sortKey)?.label ?? 'MMR'}</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {rest.map(p => {
                const displayRank = p.tabRank;
                const isMe = p.uid === 'me';
                return (
                  <Link key={p.uid} href={profileHref(p)}
                    className={`grid grid-cols-[44px_1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors
                      ${isMe
                        ? 'bg-emerald-500/5 shadow-[inset_0_0_0_1.5px_rgba(16,185,129,0.35)]'
                        : 'hover:bg-slate-800/50'}`}>
                    <span className={`text-sm font-bold text-center
                      ${displayRank===1?'text-amber-400':displayRank===2?'text-slate-300':displayRank===3?'text-amber-600':'text-slate-500'}`}>
                      {displayRank<=3?['🥇','🥈','🥉'][displayRank-1]:displayRank}
                    </span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={p.displayName} size="sm" photoURL={p.photoURL}/>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold truncate ${isMe ? 'text-emerald-400' : ''}`}>
                            {p.displayName}{isMe ? ' (You)' : ''}
                          </p>
                          {p.isDummy && <span className="text-[9px] font-bold bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded shrink-0">DEMO</span>}
                          {p.openToPlay && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full shrink-0">
                              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"/>Live
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">@{p.username} · 📍 {p.area ? `${p.area}, ` : ''}{p.state}</p>
                      </div>
                    </div>
                    <TierBadge tier={p.tier}/>
                    <p className="text-sm font-bold text-emerald-400 text-right">
                      {sortKey === 'mmr'     && p.mmr.toLocaleString()}
                      {sortKey === 'winRate' && `${Math.round(winRate(p) * 100)}%`}
                      {sortKey === 'wins'    && `${p.stats.wins}W`}
                      {sortKey === 'matches' && `${p.stats.totalMatches}`}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Calibrating: you're not filtered by query, just not ranked yet */}
          {!query && !meInList && isCalibrating(user) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Avatar name={user.displayName} size="sm" photoURL={user.photoURL}/>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">⚡ Calibrating {user.placementMatchesPlayed ?? 0}/10</p>
                <p className="text-xs text-slate-400">Your MMR is being calculated but stays hidden — including from the leaderboard — until you finish {10 - (user.placementMatchesPlayed ?? 0)} more ranked match{10 - (user.placementMatchesPlayed ?? 0) === 1 ? '' : 'es'}.</p>
              </div>
            </div>
          )}

          {/* Your rank callout */}
          {!query && meInList && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Avatar name={user.displayName} size="sm" photoURL={user.photoURL}/>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">
                  {tab === 'Nationwide' ? `National Rank #${meInList.tabRank}` : `${tab} Rank #${meInList.tabRank}`}
                </p>
                <p className="text-xs text-slate-400">
                  {tab === 'By State' ? `Top ${meInList.tabRank} in ${selState}` :
                   tab === 'Nearby'   ? `Top ${meInList.tabRank} within 10km` :
                   tab === 'Following' ? `Top ${meInList.tabRank} among following` :
                   meInList.tabRank <= 100 ? `You're ranked #${meInList.tabRank} nationally — in the top 100` :
                   sortKey !== 'mmr' ? `You're ranked #${meInList.tabRank} nationally by ${sortKey === 'winRate' ? 'win rate' : sortKey}` :
                   `You need ${(list[99]?.mmr ?? 2000) - user.mmr} more MMR to break into the top 100`}
                </p>
              </div>
              <p className="text-2xl font-bold text-amber-400">{user.mmr.toLocaleString()}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
