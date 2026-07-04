'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MMR_HISTORY, COMMUNITY_FEED } from '@/lib/data';
import { TierBadge } from '@/components/ui/TierBadge';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { LogMatchModal } from '@/components/LogMatchModal';
import { tierProgress, nextTier, TIER_STYLE } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp, Flame, CheckCircle, XCircle, Clock, Activity, Swords,
  Users, Trophy, Zap, Target, ChevronRight, MapPin, Star,
} from 'lucide-react';
import type { Match, Tournament, Challenge } from '@/types';
import { formatDate, formatTime, MATCH_TYPE_LABEL } from '@/lib/utils';

export default function Home() {
  const { user, matches, updateUser, confirmMatch, disputeMatch, registrations, tournaments, challenges, acceptChallenge, declineChallenge } = useApp();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const confirmed  = matches.filter(m => m.status === 'Confirmed');
  const pending    = matches.filter(m => m.status === 'Pending');
  const winRate    = Math.round((user.stats.wins / Math.max(user.stats.totalMatches, 1)) * 100);
  const progress   = tierProgress(user.mmr, user.tier);
  const { name: nextName, threshold } = nextTier(user.tier);
  const dm         = user.disciplineMMR ?? {};
  const dmEntries  = Object.entries(dm).filter(([,v]) => v != null) as [string, number][];
  const avgMMR     = dmEntries.length > 0
    ? Math.round(dmEntries.reduce((s, [,v]) => s + v, 0) / dmEntries.length)
    : user.mmr;

  let streak = 0;
  for (const m of confirmed) {
    if (m.winnerId === user.uid) streak++;
    else break;
  }

  const upcomingEvents = tournaments.filter(t =>
    t.status === 'Upcoming' && registrations[t.id]
  );

  return (
    <>
      <div className="space-y-5">

        {/* ── Hero Player Card ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"/>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-500/8 rounded-full blur-3xl pointer-events-none"/>

          <div className="relative p-5">
            {/* Top row: greeting + streak */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Welcome back</p>
                <h1 className="text-2xl font-bold leading-tight">
                  {user.displayName.split(' ')[0]} <span className="wave inline-block">👋</span>
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <TierBadge tier={user.tier}/>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin size={11} className="text-emerald-400"/>{user.area}, {user.state}
                  </span>
                </div>
              </div>

              {/* MMR glowing badge */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">MMR</p>
                <p className="text-3xl font-black text-amber-400 leading-none">{avgMMR.toLocaleString()}</p>
                <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">▲ +42 this week</p>
              </div>
            </div>

            {/* Streak banner */}
            {streak >= 2 && (
              <div className="mt-3 flex items-center gap-2 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2">
                <Flame size={14} className="text-orange-400 animate-pulse"/>
                <span className="text-sm font-bold text-orange-300">{streak}-match win streak</span>
                <span className="text-xs text-slate-400">— keep it going!</span>
              </div>
            )}

            {/* Tier progress */}
            {nextName && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-medium">{user.tier}</span>
                  <span>{threshold ? `${threshold - avgMMR} MMR to ${nextName}` : nextName}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${TIER_STYLE[user.tier].bg.replace('/20','')}`}
                    style={{ width:`${progress}%` }}/>
                </div>
              </div>
            )}

            {/* Status toggles — inline */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const next = !user.openToPlay;
                  updateUser({ openToPlay: next, ...(!next ? { lookingForPartner: false } : {}) });
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${user.openToPlay
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                <div className={`relative shrink-0 w-8 h-4 rounded-full transition-colors ${user.openToPlay ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                  <span className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full shadow transition-transform ${user.openToPlay ? 'translate-x-4' : ''}`}/>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">Open to Play</p>
                  {user.openToPlay && <p className="text-[10px] text-emerald-400/70 leading-tight">Visible nearby</p>}
                </div>
              </button>

              <button
                disabled={!user.openToPlay}
                onClick={() => {
                  const next = !user.lookingForPartner;
                  updateUser({ lookingForPartner: next, ...(next ? { openToPlay: true } : {}) });
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${!user.openToPlay ? 'opacity-40 pointer-events-none bg-slate-800/40 border-slate-800' :
                    user.lookingForPartner
                      ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                <div className={`relative shrink-0 w-8 h-4 rounded-full transition-colors ${user.lookingForPartner ? 'bg-violet-500' : 'bg-slate-600'}`}>
                  <span className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full shadow transition-transform ${user.lookingForPartner ? 'translate-x-4' : ''}`}/>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">Open to Partner</p>
                  {user.lookingForPartner && <p className="text-[10px] text-violet-400/70 leading-tight">Seeking doubles</p>}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => window.location.href='/players/'}
            className="group flex flex-col items-center gap-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 rounded-2xl p-4 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <Zap size={18} className="text-emerald-400"/>
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-300 transition-colors text-center leading-tight">Find Match</span>
          </button>
          <button onClick={() => window.location.href='/players/?tab=partner'}
            className="group flex flex-col items-center gap-2 bg-slate-900 border border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5 rounded-2xl p-4 transition-all">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center group-hover:bg-violet-500/25 transition-colors">
              <Users size={18} className="text-violet-400"/>
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-violet-300 transition-colors text-center leading-tight">Find Partner</span>
          </button>
          <button onClick={() => window.location.href='/tournaments/'}
            className="group flex flex-col items-center gap-2 bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 rounded-2xl p-4 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
              <Trophy size={18} className="text-amber-400"/>
            </div>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-amber-300 transition-colors text-center leading-tight">Events</span>
          </button>
        </div>

        {/* ── Pending verification banner ────────────────────────────────────── */}
        {pending.length > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-400 shrink-0"/>
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
                    <button onClick={e => { e.stopPropagation(); confirmMatch(m.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
                      <CheckCircle size={12}/> Confirm
                    </button>
                    <button onClick={e => { e.stopPropagation(); disputeMatch(m.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 text-xs font-semibold rounded-lg transition-colors">
                      <XCircle size={12}/> Dispute
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Challenges ─────────────────────────────────────────────────────── */}
        <ChallengesSection challenges={challenges} userId={user.uid} onAccept={acceptChallenge} onDecline={declineChallenge}/>

        {/* ── Upcoming events you're registered for ────────────────────────── */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold px-0.5">Your Upcoming Events</p>
            {upcomingEvents.map(t => (
              <button key={t.id} onClick={() => window.location.href = '/tournaments/'}
                className="w-full flex items-center gap-3 bg-slate-900 border border-amber-500/25 hover:border-amber-500/50 rounded-2xl px-4 py-3 text-left transition-all group">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Trophy size={16} className="text-amber-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10}/>{t.venue.split(',')[0]}
                    <span>·</span>
                    {new Date(t.date).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}
                  </p>
                </div>
                <ChevronRight size={15} className="text-slate-600 group-hover:text-amber-400 transition-colors shrink-0"/>
              </button>
            ))}
          </div>
        )}

        {/* ── Stat row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Rank */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Nat. Rank</p>
              <Target size={13} className="text-slate-600"/>
            </div>
            <p className="text-2xl font-black">#{user.globalRank}</p>
            <p className="text-[11px] text-emerald-400 font-semibold">▲ +15</p>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Win Rate</p>
              <TrendingUp size={13} className="text-slate-600"/>
            </div>
            <p className="text-2xl font-black text-emerald-400">{winRate}%</p>
            <p className="text-[11px] text-slate-500">{user.stats.wins}W {user.stats.losses}L</p>
          </div>

          {/* Matches */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Matches</p>
              <Star size={13} className="text-slate-600"/>
            </div>
            <p className="text-2xl font-black">{user.stats.totalMatches}</p>
            <p className="text-[11px] text-slate-500">total played</p>
          </div>
        </div>

        {/* ── Discipline MMR chips ─────────────────────────────────────────── */}
        {dmEntries.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {dmEntries.map(([type, val]) => (
              <div key={type} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex-1 min-w-[80px]">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{type}</span>
                <span className="text-sm font-bold text-amber-400 ml-auto">{val.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Chart + Recent matches ────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* MMR Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-400"/> MMR History
              </h2>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">30 days</span>
            </div>
            <ResponsiveContainer width="100%" height={148}>
              <AreaChart data={MMR_HISTORY} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
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

          {/* Recent Matches */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Recent Matches</h2>
              <p className="text-[11px] text-slate-500">Tap for details</p>
            </div>
            {matches.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <span className="text-2xl">🏸</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-400">No matches yet</p>
                  <p className="text-xs text-slate-600 mt-0.5">Log your first match to start tracking</p>
                </div>
                <button onClick={() => setLogOpen(true)} className="text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
                  + Log a Match
                </button>
              </div>
            ) : (
              <div className="space-y-1 flex-1">
                {matches.slice(0, 5).map(m => (
                  <MatchCard key={m.id} match={m} userId={user.uid} onClick={() => setSelectedMatch(m)}/>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Activity Feed ─────────────────────────────────────────────────── */}
        <ActivityFeed matches={matches} registrations={registrations} tournaments={tournaments} userId={user.uid} communityFeed={COMMUNITY_FEED}/>

      </div>

      <MatchDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onConfirm={selectedMatch?.status === 'Pending' ? () => { confirmMatch(selectedMatch.id); setSelectedMatch(null); } : undefined}
        onDispute={selectedMatch?.status === 'Pending'  ? () => { disputeMatch(selectedMatch.id);  setSelectedMatch(null); } : undefined}
      />
      <LogMatchModal open={logOpen} onClose={() => setLogOpen(false)}/>
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
    <div className="bg-slate-900 border border-amber-500/25 rounded-2xl p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2 text-amber-400 text-sm">
        <Swords size={15}/> Challenges
        {incoming.length > 0 && (
          <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full">{incoming.length}</span>
        )}
      </h2>

      {incoming.map(c => (
        <div key={c.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
          <div>
            <p className="text-sm font-semibold">
              ⚔️ <span className="text-amber-400">{c.fromName}</span> challenged you
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {MATCH_TYPE_LABEL[c.format]} · {formatDate(c.date)} at {formatTime(c.date)}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {c.venue}</p>
            {c.message && <p className="text-xs text-slate-400 italic mt-1">"{c.message}"</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onAccept(c.id)}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1">
              <CheckCircle size={12}/> Accept
            </button>
            <button onClick={() => onDecline(c.id)}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1">
              <XCircle size={12}/> Decline
            </button>
          </div>
        </div>
      ))}

      {outgoing.map(c => (
        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
          <Clock size={14} className="text-amber-400 shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate">Challenge sent to <span className="font-semibold">{c.toName}</span></p>
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
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Activity size={14} className="text-emerald-400"/> Activity
        </h2>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
          {(['mine', 'community'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t === 'mine' ? 'Mine' : '🌐 Community'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'mine' ? (
        myItems.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
              <Activity size={20} className="text-slate-600"/>
            </div>
            <p className="text-slate-500 text-sm font-medium">No activity yet</p>
            <p className="text-slate-600 text-xs">Log matches and join events to build your feed</p>
            <button onClick={() => window.location.href='/tournaments/'}
              className="text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition-colors mt-1 inline-block">
              Browse events →
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {myItems.map((item, i) => {
              if (item.kind === 'match') {
                const m = item.match;
                const iWon = m.winnerId === userId;
                const opp  = m.player1Id === userId ? m.player2Name : m.player1Name;
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0
                      ${iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {iWon ? 'W' : 'L'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">
                        {iWon ? 'Beat' : 'Lost to'} <span className="font-semibold text-white">{opp}</span>
                      </p>
                      <p className="text-xs text-slate-500">{new Date(m.playedAt).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}</p>
                    </div>
                    {m.mmrChange !== undefined && (
                      <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-lg
                        ${iWon ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {iWon ? '+' : ''}{m.mmrChange}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 text-base">🏆</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">Registered for <span className="font-semibold text-white">{item.name}</span></p>
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
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 text-[10px] font-bold text-slate-400">
                {item.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  <span className="font-semibold text-white">{item.p1}</span>
                  <span className="text-slate-500 mx-1.5 text-xs">def.</span>
                  <span className="font-semibold text-white">{item.p2}</span>
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
