'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MMR_HISTORY } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { tierProgress, nextTier } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Flame, Radio } from 'lucide-react';
import type { Match } from '@/types';

export default function Home() {
  const { user, matches, updateUser } = useApp();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const confirmed  = matches.filter(m => m.status === 'Confirmed');
  const winRate    = Math.round((user.stats.wins / Math.max(user.stats.totalMatches, 1)) * 100);
  const progress   = tierProgress(user.mmr, user.tier);
  const { name: nextName, threshold } = nextTier(user.tier);

  let streak = 0;
  for (const m of confirmed) {
    if (m.winnerId === user.uid) streak++;
    else break;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, <span className="text-emerald-400">{user.displayName.split(' ')[0]}</span> 👋
          </h1>
          {streak >= 2 && (
            <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
              <Flame size={14} className="text-orange-400" />
              <span className="text-orange-400 font-semibold">{streak}-match win streak</span> — you&apos;re on fire!
            </p>
          )}
        </div>

        {/* Open to Play toggle */}
        <button
          onClick={() => updateUser({ openToPlay: !user.openToPlay })}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all
            ${user.openToPlay
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.1)]'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
          <div className={`relative flex items-center justify-center w-11 h-11 rounded-xl shrink-0
            ${user.openToPlay ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
            <Radio size={20} className={user.openToPlay ? 'text-emerald-400' : 'text-slate-500'} />
            {user.openToPlay && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className={`font-semibold text-sm ${user.openToPlay ? 'text-emerald-300' : 'text-slate-300'}`}>
              {user.openToPlay ? 'Open to Play — You\'re visible to nearby players' : 'Open to Play'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {user.openToPlay ? 'Tap to go offline' : 'Tap to let others know you\'re looking for a match today'}
            </p>
          </div>
          <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${user.openToPlay ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${user.openToPlay ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">MMR</p>
            <p className="text-3xl font-bold text-amber-400">{user.mmr.toLocaleString()}</p>
            <p className="text-xs text-emerald-400 mt-0.5">▲ +42 this week</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">National Rank</p>
            <p className="text-3xl font-bold">#{user.globalRank}</p>
            <p className="text-xs text-emerald-400 mt-0.5">▲ +15 positions</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-3xl font-bold text-emerald-400">{winRate}%</p>
            <p className="text-xs text-slate-500 mt-0.5">{user.stats.wins}W / {user.stats.losses}L</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tier</p>
            <TierBadge tier={user.tier} />
            {nextName && (
              <>
                <p className="text-xs text-slate-500 mt-2">Next: {nextName} @ {threshold.toLocaleString()}</p>
                <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full" style={{ width:`${progress}%` }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Chart + Recent matches */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" /> MMR History
              </h2>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">30 days</span>
            </div>
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={MMR_HISTORY} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} interval={2}/>
                <YAxis tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} domain={['auto','auto']}/>
                <Tooltip
                  contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                  labelStyle={{ color:'#94a3b8' }} itemStyle={{ color:'#10b981' }}
                />
                <Area type="monotone" dataKey="mmr" stroke="#10b981" strokeWidth={2.5} fill="url(#g)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent Matches</h2>
              <p className="text-xs text-slate-500">Click for details</p>
            </div>
            <div className="space-y-1">
              {matches.slice(0, 5).map(m => (
                <MatchCard key={m.id} match={m} userId={user.uid} onClick={() => setSelectedMatch(m)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </>
  );
}
