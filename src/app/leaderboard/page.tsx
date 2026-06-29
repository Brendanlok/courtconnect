'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { MY_STATES, TIER_STYLE } from '@/lib/utils';
import { Search, MapPin, ChevronDown, ArrowUpDown } from 'lucide-react';
import type { UserProfile, MalaysiaState, Tier } from '@/types';

const TABS = ['Nationwide', 'By State', 'Nearby', 'Friends'] as const;
type Tab = typeof TABS[number];
type SortKey = 'mmr' | 'winRate' | 'wins' | 'matches';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'mmr',     label: 'MMR' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'wins',    label: 'Wins' },
  { key: 'matches', label: 'Matches' },
];

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];

const FRIENDS = ['p5', 'p7', 'p4'];

export default function Leaderboard() {
  const { user } = useApp();
  const [tab,       setTab]      = useState<Tab>('Nationwide');
  const [query,     setQuery]    = useState('');
  const [selState,  setSelState] = useState<MalaysiaState>(user.state);
  const [stateOpen, setStateOpen] = useState(false);
  const [sortKey,   setSortKey]  = useState<SortKey>('mmr');
  const [tierFilter,setTierFilter] = useState<Tier | 'All'>('All');

  const winRate = (p: UserProfile) => p.stats.totalMatches > 0 ? p.stats.wins / p.stats.totalMatches : 0;

  const all: UserProfile[] = [user, ...PLAYERS];

  const list = all
    .filter(p => {
      if (tab === 'By State') return p.state === selState;
      if (tab === 'Nearby')   return (p.distKm ?? (p.uid === 'me' ? 0 : 999)) <= 10;
      if (tab === 'Friends')  return FRIENDS.includes(p.uid) || p.uid === 'me';
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

  const top3 = list.slice(0, 3);
  const rest  = list.slice(3);
  const meInList = list.find(p => p.uid === 'me');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
          <span>🇲🇾</span> Malaysia — {list.length} players ranked
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* State picker */}
        {tab === 'By State' && (
          <div className="relative">
            <button onClick={() => setStateOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm hover:border-emerald-500 transition-colors">
              <MapPin size={13} className="text-emerald-400"/>
              {selState}
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${stateOpen ? 'rotate-180' : ''}`}/>
            </button>
            {stateOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-1 grid grid-cols-2 gap-0.5 w-64">
                {MY_STATES.map(s => (
                  <button key={s} onClick={() => { setSelState(s as MalaysiaState); setStateOpen(false); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors
                      ${selState === s ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + Sort + Tier filter */}
      <div className="space-y-2.5">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search player or @username…"
              className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
          </div>
          {/* Sort */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown size={13} className="text-slate-500"/>
            <div className="flex gap-1">
              {SORT_OPTIONS.map(s => (
                <button key={s.key} onClick={() => setSortKey(s.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border
                    ${sortKey === s.key ? 'bg-slate-700 border-slate-600 text-white' : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier filter */}
        <div className="flex gap-1 flex-wrap">
          {TIERS.map(t => {
            const s = t !== 'All' ? TIER_STYLE[t] : null;
            return (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border
                  ${tierFilter === t
                    ? t === 'All' ? 'bg-slate-600 border-slate-500 text-white' : `${s!.bg} ${s!.text} ${s!.border}`
                    : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
                {t !== 'All' && s ? `${s.icon} ` : ''}{t}
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-20 text-slate-500">No players found.</div>
      ) : (
        <>
          {/* Podium — only show if no search, >= 3 players */}
          {!query && top3.length >= 3 && (
            <div className="flex justify-center items-end gap-4 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              {[top3[1], top3[0], top3[2]].map((p, idx) => {
                const isFirst = idx === 1;
                const medal   = ['🥈','🥇','🥉'][idx];
                const rank    = [2,1,3][idx];
                return (
                  <div key={p.uid} className={`text-center ${isFirst ? '' : 'mt-6'}`} style={{ width: isFirst ? 140 : 110 }}>
                    <p className="text-2xl mb-2">{medal}</p>
                    <Avatar name={p.displayName} size={isFirst ? 'lg' : 'md'}
                      className={`mx-auto ${isFirst ? 'ring-2 ring-amber-400' : ''}`}/>
                    <p className="text-xs text-slate-400 mt-1">@{p.username}</p>
                    <p className={`font-bold mt-0.5 ${isFirst ? 'text-base' : 'text-sm'}`}>{p.displayName}</p>
                    <p className={`font-bold text-amber-400 ${isFirst ? 'text-lg' : 'text-sm'}`}>{p.mmr.toLocaleString()}</p>
                    <div className="flex justify-center mt-1"><TierBadge tier={p.tier}/></div>
                    <p className="text-xs text-slate-500 mt-1">📍 {p.area}</p>
                  </div>
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
              {(query ? list : rest).map(p => {
                const displayRank = tab === 'Nationwide' ? p.globalRank : (p as any).tabRank;
                const isMe = p.uid === 'me';
                return (
                  <div key={p.uid}
                    className={`grid grid-cols-[44px_1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors
                      ${isMe ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : 'hover:bg-slate-800/40'}`}>
                    <span className={`text-sm font-bold text-center
                      ${displayRank===1?'text-amber-400':displayRank===2?'text-slate-300':displayRank===3?'text-amber-600':'text-slate-500'}`}>
                      {displayRank<=3?['🥇','🥈','🥉'][displayRank-1]:displayRank}
                    </span>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={p.displayName} size="sm"/>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold truncate ${isMe?'text-emerald-400':''}`}>
                            {p.displayName}{isMe?' (You)':''}
                          </p>
                          {p.openToPlay && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full shrink-0">
                              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"/>Live
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">@{p.username} · 📍 {p.area}, {p.state}</p>
                      </div>
                    </div>
                    <TierBadge tier={p.tier}/>
                    <p className="text-sm font-bold text-emerald-400 text-right">
                      {sortKey === 'mmr'     && p.mmr.toLocaleString()}
                      {sortKey === 'winRate' && `${Math.round(winRate(p) * 100)}%`}
                      {sortKey === 'wins'    && `${p.stats.wins}W`}
                      {sortKey === 'matches' && `${p.stats.totalMatches}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Your rank callout */}
          {!query && meInList && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Avatar name={user.displayName} size="sm"/>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300">
                  {tab === 'Nationwide' ? `National Rank #${user.globalRank}` : `${tab} Rank #${(meInList as any).tabRank}`}
                </p>
                <p className="text-xs text-slate-400">
                  {tab === 'By State' ? `Top ${(meInList as any).tabRank} in ${selState}` :
                   tab === 'Nearby'   ? `Top ${(meInList as any).tabRank} within 10km` :
                   tab === 'Friends'  ? `Top ${(meInList as any).tabRank} among friends` :
                   `You need ${Math.max(0, 2000 - user.mmr)} more MMR to break into the top 100`}
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
