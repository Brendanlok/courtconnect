'use client';
import { useState } from 'react';
import { PLAYERS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { TIER_STYLE, MY_STATES, skillMatch } from '@/lib/utils';
import { Search, MapPin, Filter, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { UserProfile, MalaysiaState, Tier } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];

export default function Players() {
  const { user } = useApp();
  const [query,      setQuery]      = useState('');
  const [stateFilter,setStateFilter]= useState<MalaysiaState | 'All'>('All');
  const [tierFilter, setTierFilter] = useState<Tier | 'All'>('All');
  const [stateOpen,  setStateOpen]  = useState(false);

  const allPlayers = [user, ...PLAYERS];

  const filtered = allPlayers.filter(p => {
    const q = query.toLowerCase();
    const nameMatch = p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
    const stateMatch = stateFilter === 'All' || p.state === stateFilter;
    const tierMatch  = tierFilter  === 'All' || p.tier  === tierFilter;
    return nameMatch && stateMatch && tierMatch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-slate-400 text-sm mt-1">Find and view player profiles across 🇲🇾 Malaysia</p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or @username…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={13} className="text-slate-500"/>

          {/* State filter */}
          <div className="relative">
            <button onClick={() => setStateOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs hover:border-emerald-500 transition-colors">
              <MapPin size={11} className="text-emerald-400"/>
              {stateFilter === 'All' ? 'All States' : stateFilter}
              <ChevronDown size={11} className="text-slate-400"/>
            </button>
            {stateOpen && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-1 grid grid-cols-2 gap-0.5 w-60">
                <button onClick={() => { setStateFilter('All'); setStateOpen(false); }}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs col-span-2 transition-colors ${stateFilter==='All'?'bg-emerald-600 text-white':'text-slate-300 hover:bg-slate-800'}`}>
                  All States
                </button>
                {MY_STATES.map(s => (
                  <button key={s} onClick={() => { setStateFilter(s as MalaysiaState); setStateOpen(false); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${stateFilter===s?'bg-emerald-600 text-white':'text-slate-300 hover:bg-slate-800'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tier filter chips */}
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
      </div>

      <p className="text-xs text-slate-500">{filtered.length} player{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.map(p => <PlayerRow key={p.uid} player={p} myMMR={user.mmr} isMe={p.uid === 'me'} />)}
      </div>
    </div>
  );
}

function PlayerRow({ player: p, myMMR, isMe }: { player: UserProfile; myMMR: number; isMe: boolean }) {
  const sm = skillMatch(myMMR, p.mmr);
  const smColor = sm >= 80 ? 'text-emerald-400' : sm >= 60 ? 'text-amber-400' : 'text-red-400';
  const smBar   = sm >= 80 ? 'bg-emerald-500' : sm >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const wr      = Math.round((p.stats.wins / Math.max(p.stats.totalMatches, 1)) * 100);

  return (
    <Link href={`/players/${p.username}`}
      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md group
        ${isMe ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
      <Avatar name={p.displayName} className={isMe ? 'ring-2 ring-emerald-500/40' : ''}/>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-semibold text-sm ${isMe ? 'text-emerald-400' : ''}`}>
            {p.displayName}{isMe ? ' (You)' : ''}
          </p>
          <p className="text-xs text-slate-500">@{p.username}</p>
          <TierBadge tier={p.tier}/>
          {p.openToPlay && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Playing today
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          <MapPin size={10}/> {p.area}, {p.state}
          <span className="mx-1">·</span>
          #{p.globalRank} National
        </p>
      </div>

      {/* Skill match */}
      {!isMe && (
        <div className="hidden sm:flex items-center gap-2 w-28 shrink-0">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${smBar} rounded-full`} style={{ width:`${sm}%` }}/>
          </div>
          <span className={`text-xs font-bold shrink-0 ${smColor}`}>{sm}%</span>
        </div>
      )}

      <div className="text-right shrink-0">
        <p className="text-base font-bold text-amber-400">{p.mmr.toLocaleString()}</p>
        <p className="text-xs text-slate-500">{p.stats.wins}W · {wr}% WR</p>
      </div>
    </Link>
  );
}
