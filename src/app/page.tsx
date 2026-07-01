'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MMR_HISTORY, COMMUNITY_FEED } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { tierProgress, nextTier, TIER_STYLE } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Flame, CheckCircle, XCircle, Clock, Activity, Swords } from 'lucide-react';
import type { Match, Tournament, Challenge } from '@/types';
import { formatDate, formatTime, MATCH_TYPE_LABEL } from '@/lib/utils';

export default function Home() {
  const { user, matches, updateUser, confirmMatch, disputeMatch, registrations, tournaments, challenges, acceptChallenge, declineChallenge } = useApp();
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
      <div className="space-y-4">
        {/* Greeting + linked toggles */}
        <div className="space-y-2">
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
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${user.openToPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className={`text-sm ${user.openToPlay ? 'text-emerald-300' : 'text-slate-400'}`}>
                Open to Play{user.openToPlay ? ' — visible to nearby players' : ''}
              </span>
            </div>
            <button
              onClick={() => {
                const next = !user.openToPlay;
                updateUser({ openToPlay: next, ...(!next ? { lookingForPartner: false } : {}) });
              }}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${user.openToPlay ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${user.openToPlay ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Open to Partner toggle (linked) */}
          <div className={`flex items-center justify-between px-4 py-2.5 bg-slate-900 border rounded-xl transition-opacity
            ${user.openToPlay ? 'border-slate-800 opacity-100' : 'border-slate-800/50 opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${user.lookingForPartner ? 'bg-violet-400 animate-pulse' : 'bg-slate-600'}`} />
              <div>
                <span className={`text-sm ${user.lookingForPartner ? 'text-violet-300' : 'text-slate-400'}`}>
                  Open to Partner
                </span>
                {!user.openToPlay && (
                  <p className="text-[10px] text-slate-600">Requires Open to Play</p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                const next = !user.lookingForPartner;
                updateUser({ lookingForPartner: next, ...(next ? { openToPlay: true } : {}) });
              }}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${user.lookingForPartner ? 'bg-violet-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${user.lookingForPartner ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
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

        {/* Challenges */}
        <ChallengesSection challenges={challenges} userId={user.uid} onAccept={acceptChallenge} onDecline={declineChallenge}/>

        {/* Stats */}
        {(() => {
          const dm = user.disciplineMMR ?? {};
          const dmEntries = Object.entries(dm).filter(([,v]) => v != null) as [string, number][];
          const avgMMR = dmEntries.length > 0
            ? Math.round(dmEntries.reduce((s, [,v]) => s + v, 0) / dmEntries.length)
            : user.mmr;
          return (
            <div className="space-y-3">
              {/* MMR — wide card showing average + per-discipline */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">MMR</p>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <p className="text-3xl font-bold text-amber-400">{avgMMR.toLocaleString()}</p>
                    <p className="text-xs text-emerald-400 mt-0.5">▲ +42 this week · avg</p>
                  </div>
                  {dmEntries.length > 0 && (
                    <div className="flex gap-3 ml-auto">
                      {dmEntries.map(([type, val]) => (
                        <div key={type} className="text-center px-3 py-2 bg-slate-800 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{type}</p>
                          <p className="text-sm font-bold text-amber-400 mt-0.5">{val.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium min-h-[2.5rem] leading-tight">Nat. Rank</p>
                  <p className="text-2xl font-bold">#{user.globalRank}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">▲ +15</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium min-h-[2.5rem] leading-tight">Win Rate</p>
                  <p className="text-2xl font-bold text-emerald-400">{winRate}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.stats.wins}W {user.stats.losses}L</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium min-h-[2.5rem] leading-tight">Tier</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-base font-bold ${TIER_STYLE[user.tier].text}`}>{TIER_STYLE[user.tier].icon}</span>
                    <span className={`text-sm font-bold ${TIER_STYLE[user.tier].text}`}>{user.tier}</span>
                  </div>
                  {nextName && (
                    <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${TIER_STYLE[user.tier].bg.replace('/20','')}`} style={{ width:`${progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Chart + Recent matches */}
        <div className="grid md:grid-cols-2 gap-3">
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

        {/* Activity Feed */}
        <ActivityFeed matches={matches} registrations={registrations} tournaments={tournaments} userId={user.uid} communityFeed={COMMUNITY_FEED}/>
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

// ─── Challenges Section ───────────────────────────────────────────────────────

function ChallengesSection({ challenges, userId, onAccept, onDecline }: {
  challenges: Challenge[];
  userId: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const incoming = challenges.filter(c => c.toId === userId && c.status === 'pending');
  const outgoing = challenges.filter(c => c.fromId === userId && c.status === 'pending');
  const recent   = challenges.filter(c => (c.toId === userId || c.fromId === userId) && c.status !== 'pending');

  if (!incoming.length && !outgoing.length && !recent.length) return null;

  return (
    <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2 text-amber-400">
        <Swords size={15}/> Challenges
        {incoming.length > 0 && (
          <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full">{incoming.length}</span>
        )}
      </h2>

      {incoming.map(c => (
        <div key={c.id} className="bg-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                <span className="text-amber-400">⚔️ {c.fromName}</span> challenged you
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {MATCH_TYPE_LABEL[c.format]} · {formatDate(c.date)} at {formatTime(c.date)}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">📍 {c.venue}</p>
              {c.message && <p className="text-xs text-slate-400 italic mt-1">"{c.message}"</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onAccept(c.id)}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1">
              <CheckCircle size={12}/> Accept
            </button>
            <button onClick={() => onDecline(c.id)}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
              <XCircle size={12}/> Decline
            </button>
          </div>
        </div>
      ))}

      {outgoing.map(c => (
        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
          <Clock size={14} className="text-amber-400 shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate">
              Challenge sent to <span className="font-semibold">{c.toName}</span>
            </p>
            <p className="text-xs text-slate-500">{MATCH_TYPE_LABEL[c.format]} · {formatDate(c.date)}</p>
          </div>
          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0">Pending</span>
        </div>
      ))}

      {recent.map(c => {
        const isIncoming = c.toId === userId;
        return (
          <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${c.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
              {c.status === 'accepted' ? '✓ Accepted' : '✗ Declined'}
            </span>
            <p className="text-sm text-slate-400 truncate flex-1">
              {isIncoming ? c.fromName : c.toName} · {MATCH_TYPE_LABEL[c.format]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'match'; match: Match; ts: number }
  | { kind: 'tournament'; name: string; ts: number };

type CommunityItem = { p1: string; p2: string; score: string; type: string; venue: string; ts: string };

function ActivityFeed({ matches, registrations, tournaments, userId, communityFeed }: {
  matches: Match[];
  registrations: Record<string, { registeredAt: string }>;
  tournaments: Tournament[];
  userId: string;
  communityFeed: CommunityItem[];
}) {
  const [tab, setTab] = useState<'mine' | 'community'>('mine');

  const myItems: FeedItem[] = [
    ...matches
      .filter(m => m.status === 'Confirmed')
      .map(m => ({ kind: 'match' as const, match: m, ts: new Date(m.playedAt).getTime() })),
    ...Object.entries(registrations).map(([id, r]) => {
      const t = tournaments.find(x => x.id === id);
      return { kind: 'tournament' as const, name: t?.name ?? 'an event', ts: new Date(r.registeredAt).getTime() };
    }),
  ].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity size={15} className="text-emerald-400"/> Activity
        </h2>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
          {(['mine', 'community'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize
                ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t === 'mine' ? 'Mine' : '🌐 Community'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'mine' ? (
        myItems.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm">No recent activity.</p>
            <p className="text-slate-600 text-xs mt-1">Log matches and join events to build your feed.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {myItems.map((item, i) => {
              if (item.kind === 'match') {
                const m = item.match;
                const iWon = m.winnerId === userId;
                const opp  = m.player1Id === userId ? m.player2Name : m.player1Name;
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                      ${iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {iWon ? 'W' : 'L'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">
                        {iWon ? 'Beat' : 'Lost to'} <span className="font-semibold">{opp}</span>
                      </p>
                      <p className="text-xs text-slate-500">{new Date(m.playedAt).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}</p>
                    </div>
                    {m.mmrChange !== undefined && (
                      <span className={`text-xs font-bold shrink-0 ${iWon ? 'text-emerald-400' : 'text-red-400'}`}>
                        {iWon ? '+' : ''}{m.mmrChange} MMR
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 text-sm">🏸</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">Registered for <span className="font-semibold">{item.name}</span></p>
                    <p className="text-xs text-slate-500">{new Date(item.ts).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-1">
          {communityFeed.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-800 text-xs font-bold text-slate-400">
                {item.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  <span className="font-semibold">{item.p1}</span>
                  <span className="text-slate-500 mx-1">def.</span>
                  <span className="font-semibold">{item.p2}</span>
                </p>
                <p className="text-xs text-slate-500 truncate">{item.score} · {item.venue}</p>
              </div>
              <span className="text-[10px] text-slate-600 shrink-0">
                {new Date(item.ts).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
