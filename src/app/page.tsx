'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MMR_HISTORY } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { tierProgress, nextTier } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Flame, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Match } from '@/types';

export default function Home() {
  const { user, matches, updateUser, confirmMatch, disputeMatch } = useApp();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const confirmed  = matches.filter(m => m.status === 'Confirmed');
  const pending    = matches.filter(m => m.status === 'Pending');
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

        {/* Open to Play — compact toggle row */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${user.openToPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-sm ${user.openToPlay ? 'text-emerald-300' : 'text-slate-400'}`}>
              Open to Play{user.openToPlay ? ' — visible to nearby players' : ''}
            </span>
          </div>
          <button
            onClick={() => updateUser({ openToPlay: !user.openToPlay })}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${user.openToPlay ? 'bg-emerald-500' : 'bg-slate-600'}`}>
            <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${user.openToPlay ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Pending verification banner */}
        {pending.length > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-400 shrink-0" />
              <p className="text-sm font-semibold text-amber-300">
                {pending.length} match{pending.length > 1 ? 'es' : ''} awaiting verification
              </p>
            </div>
            {pending.map(m => {
              const isWin   = m.winnerId === user.uid;
              const oppName = m.player1Id === user.uid ? m.player2Name : m.player1Name;
              const oppUser = m.player1Id === user.uid ? m.player2Username : m.player1Username;
              return (
                <div key={m.id} className="bg-slate-900/70 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">vs. {oppName} <span className="text-slate-500 font-normal text-xs">@{oppUser}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Reported as <span className={isWin ? 'text-emerald-400' : 'text-red-400'}>{isWin ? 'Win' : 'Loss'}</span>
                      {m.mmrChange !== undefined && (
                        <span className={`ml-1 font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                          ({isWin ? '+' : ''}{m.mmrChange} MMR)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); confirmMatch(m.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
                      <CheckCircle size={12} /> Confirm
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); disputeMatch(m.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 text-xs font-semibold rounded-lg transition-colors">
                      <XCircle size={12} /> Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
              <p className="text-xs text-slate-500">Tap for details</p>
            </div>
            <div className="space-y-1">
              {matches.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No matches yet — log your first one!</p>
              ) : (
                matches.slice(0, 5).map(m => (
                  <MatchCard key={m.id} match={m} userId={user.uid} onClick={() => setSelectedMatch(m)} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <MatchDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onConfirm={selectedMatch?.status === 'Pending' ? () => { confirmMatch(selectedMatch.id); setSelectedMatch(null); } : undefined}
        onDispute={selectedMatch?.status === 'Pending'  ? () => { disputeMatch(selectedMatch.id);  setSelectedMatch(null); } : undefined}
      />
    </>
  );
}
