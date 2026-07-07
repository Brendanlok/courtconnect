'use client';
import { notFound } from 'next/navigation';
import { PLAYERS, MMR_HISTORY, ME } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { QRModal } from '@/components/QRModal';
import { ChallengeModal } from '@/components/ChallengeModal';
import { SettingsModal } from '@/components/SettingsModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { tierProgress, nextTier, skillMatch, MATCH_TYPE_LABEL } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { MapPin, QrCode, MessageCircle, Swords, ThumbsUp, Settings, Search, Users, UserPlus, UserCheck, Trophy, Video, Camera } from 'lucide-react';
import CourtHeatmap from '@/components/CourtHeatmap';
import { useState } from 'react';
import type { Match, MatchType } from '@/types';

const RESULT_FILTERS = ['All', 'Wins', 'Losses', 'Pending'] as const;
type ResultFilter = typeof RESULT_FILTERS[number];

const RADAR_DATA = [
  { stat:'Smash', val:72 },{ stat:'Net Play', val:58 },{ stat:'Defense', val:65 },
  { stat:'Footwork', val:80 },{ stat:'Stamina', val:74 },{ stat:'Serve', val:68 },
];

const ACHIEVEMENTS = [
  { icon:'🔥', name:'Hot Streak',  desc:'5 wins in a row',       done:true },
  { icon:'🏅', name:'First Blood', desc:'Win your first match',   done:true },
  { icon:'📈', name:'On the Rise', desc:'+100 MMR in a week',     done:true },
  { icon:'💎', name:'Diamond',     desc:'Reach 2000 MMR',         done:false },
  { icon:'🏆', name:'Champion',    desc:'Win a tournament',        done:false },
  { icon:'🤝', name:'Centurion',   desc:'Play 100 matches',        done:false },
];

export function PlayerProfileClient({ username }: { username: string }) {
  const { user: ctxUser, matches: allMatches, confirmMatch, disputeMatch, myEndorsements, playerEndorsements, endorsePlayer, clubs, following, followPlayer, unfollowPlayer, tournaments, clipCredits, courtProfile } = useApp();

  const ENDORSE_SKILLS = ['Powerful Smash', 'Sharp Net Play', 'Great Footwork', 'Strong Defense', 'Smart Placement', 'Good Sportsmanship'];
  const staticPlayer = [ME, ...PLAYERS].find(p => p.username === username);

  const [selectedMatch,  setSelectedMatch]  = useState<Match | null>(null);
  const [qrOpen,         setQrOpen]         = useState(false);
  const [challengeOpen,  setChallengeOpen]  = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('challenge') === '1';
  });
  const [settOpen,       setSettOpen]       = useState(false);
  const [matchQuery,     setMatchQuery]     = useState('');
  const [matchFormat,    setMatchFormat]    = useState<MatchType | 'All'>('All');
  const [matchResult,    setMatchResult]    = useState<ResultFilter>('All');

  if (!staticPlayer) return notFound();

  const isMe   = staticPlayer.uid === 'me';
  const player = isMe ? ctxUser : staticPlayer;

  const progress = tierProgress(player.mmr, player.tier);
  const { name: nextName, threshold } = nextTier(player.tier);
  const wr  = Math.round((player.stats.wins / Math.max(player.stats.totalMatches, 1)) * 100);
  const sm  = isMe ? 100 : skillMatch(ME.mmr, player.mmr);
  const playerMatches = allMatches.filter(m => m.player1Id === player.uid || m.player2Id === player.uid);
  const filteredMatches = playerMatches
    .filter(m => matchFormat === 'All' || m.type === matchFormat)
    .filter(m => {
      if (matchResult === 'All')     return true;
      if (matchResult === 'Pending') return m.status === 'Pending';
      if (matchResult === 'Wins')    return m.winnerId === player.uid;
      return m.status !== 'Pending' && m.winnerId !== player.uid;
    })
    .filter(m => {
      if (!matchQuery.trim()) return true;
      const opponent = m.player1Id === player.uid ? m.player2Name     : m.player1Name;
      const oppUser  = m.player1Id === player.uid ? m.player2Username : m.player1Username;
      const q = matchQuery.toLowerCase();
      return opponent.toLowerCase().includes(q) || oppUser.toLowerCase().includes(q);
    });

  // Head-to-Head: confirmed matches between me and this player
  const h2hMatches = isMe ? [] : allMatches.filter(m =>
    m.status === 'Confirmed' &&
    ((m.player1Id === 'me' && m.player2Id === player.uid) ||
     (m.player1Id === player.uid && m.player2Id === 'me'))
  );
  const h2hWins   = h2hMatches.filter(m => m.winnerId === 'me').length;
  const h2hLosses = h2hMatches.filter(m => m.winnerId === player.uid).length;

  // Match History privacy: public = visible to all, followers = visible to followers only, private = owner only
  const matchHistoryVisibility = player.privacy?.matchHistory ?? 'public';
  const isFollowingPlayer = following.includes(player.uid);
  const canSeeMatchHistory = isMe || matchHistoryVisibility === 'public' || (matchHistoryVisibility === 'friends' && isFollowingPlayer);

  // Club membership privacy: same public/followers/private rule
  const clubMembershipVisibility = player.privacy?.clubMembership ?? 'public';
  const canSeeClubMembership = isMe || clubMembershipVisibility === 'public' || (clubMembershipVisibility === 'friends' && isFollowingPlayer);
  const playerClub = canSeeClubMembership ? clubs.find(c => c.memberIds.includes(player.uid)) : undefined;

  // Event history privacy: same public/followers/private rule
  const eventHistoryVisibility = player.privacy?.eventHistory ?? 'public';
  const canSeeEventHistory = isMe || eventHistoryVisibility === 'public' || (eventHistoryVisibility === 'friends' && isFollowingPlayer);
  const playerEvents = canSeeEventHistory
    ? tournaments.filter(t => (t.participants ?? []).some(p => p.username === player.username))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
          {/* Top row: avatar left, skill match right */}
          <div className="flex items-start justify-between">
            <Avatar name={player.displayName} size="lg" photoURL={player.photoURL} className="ring-4 ring-emerald-500/20"/>
            {!isMe && (
              <div className="group relative">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-help
                  ${sm>=80?'bg-emerald-500/10 border-emerald-500/25 text-emerald-400':sm>=60?'bg-amber-500/10 border-amber-500/25 text-amber-400':'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                  {sm>=80?'⚡':sm>=60?'🟡':'🔴'} {sm}% match
                </div>
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                  <p className="font-semibold text-white mb-1">Skill Match</p>
                  How closely your MMR matches theirs. Based on a {Math.abs(ctxUser.mmr - player.mmr)} MMR gap.
                  <p className="mt-1 text-slate-400">{sm>=80?'Very even match':sm>=60?'Moderate gap — still competitive':'Large gap — may feel one-sided'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Player info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{player.displayName}</h1>
              <span className="text-slate-400 text-base">@{player.username}</span>
              <TierBadge tier={player.tier}/>
              {player.isDummy && (
                <span className="text-[10px] font-bold bg-slate-700 border border-slate-600 text-slate-400 px-2 py-0.5 rounded-full tracking-wide">
                  DEMO PROFILE
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-1.5 flex-wrap">
              <MapPin size={12}/> {player.area}, {player.state}
              <span className="text-slate-600">·</span>
              <span>#{player.globalRank} National</span>
              {player.gender && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>{player.gender === 'Male' ? '♂' : '♀'} {player.gender}</span>
                </>
              )}
            </p>
            {player.openToPlay && (
              <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Open to play today
              </span>
            )}
            {player.bio && <p className="text-slate-300 text-sm mt-2">{player.bio}</p>}

            <div className="flex flex-wrap gap-5 mt-4">
              {[
                { label:'MMR',      val:player.mmr.toLocaleString(), color:'text-amber-400' },
                { label:'Wins',     val:player.stats.wins,           color:'text-emerald-400' },
                { label:'Losses',   val:player.stats.losses,         color:'text-red-400' },
                { label:'Matches',  val:player.stats.totalMatches,   color:'' },
                { label:'Win Rate', val:`${wr}%`,                    color:'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
              <div className="w-px bg-slate-700/60 self-stretch"/>
              {isMe ? (
                <>
                  <div className="text-center">
                    <p className="text-xl font-bold">{following.length}</p>
                    <p className="text-xs text-slate-500">Following</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-500">—</p>
                    <p className="text-xs text-slate-500">Followers</p>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-bold">{(player.followersCount ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Followers</p>
                </div>
              )}
            </div>

            {/* Discipline MMR chips */}
            {player.disciplineMMR && Object.keys(player.disciplineMMR).length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {(Object.entries(player.disciplineMMR) as [string, number][]).filter(([,v]) => v != null).map(([type, val]) => (
                  <div key={type} className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-none">{type}</p>
                    <p className="text-sm font-bold text-amber-400 leading-tight mt-0.5">{val.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {nextName && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{player.tier}</span>
                  <span>{nextName} @ {threshold.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full" style={{ width:`${progress}%` }}/>
                </div>
              </div>
            )}
          </div>

          {/* Full-width action buttons */}
          <div className="flex gap-2">
            {isMe ? (
              <>
                <button onClick={() => setQrOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                  <QrCode size={14}/> QR Code
                </button>
                <button onClick={() => setSettOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                  <Settings size={14}/> Edit Profile
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setChallengeOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-bold transition-colors">
                  <Swords size={14}/> Challenge
                </button>
                <button onClick={() => { window.location.href = `/chat/?uid=${player.uid}`; }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                  <MessageCircle size={14}/> Message
                </button>
                {(() => {
                  const isFollowing = following.includes(player.uid);
                  return (
                    <button onClick={() => isFollowing ? unfollowPlayer(player.uid) : followPlayer(player.uid)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                        isFollowing
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}>
                      {isFollowing ? <UserCheck size={14}/> : <UserPlus size={14}/>}
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* ── Head to Head ── */}
        {!isMe && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Swords size={15} className="text-emerald-400"/> Head to Head
            </h2>
            {h2hMatches.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-400 text-sm">No confirmed matches against @{player.username} yet.</p>
                <p className="text-slate-500 text-xs mt-1">Log a match and confirm it to start tracking.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Big record */}
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-black text-emerald-400">{h2hWins}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">You</p>
                  </div>
                  <div className="text-center px-4 border-x border-slate-700">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{h2hMatches.length} played</p>
                    <p className="text-lg font-bold text-slate-300 mt-0.5">{h2hWins} – {h2hLosses}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-black text-red-400">{h2hLosses}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{player.displayName.split(' ')[0]}</p>
                  </div>
                </div>

                {/* Win bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${(h2hWins / h2hMatches.length) * 100}%` }} />
                </div>

                {/* Recent H2H matches */}
                <div className="space-y-1 pt-1">
                  {h2hMatches.slice(0, 4).map(m => {
                    const iWon = m.winnerId === 'me';
                    const scores = m.games.filter(g => g.p1 > 0 || g.p2 > 0)
                      .map(g => m.player1Id === 'me' ? `${g.p1}-${g.p2}` : `${g.p2}-${g.p1}`)
                      .join(', ');
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 text-sm">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                          ${iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {iWon ? 'W' : 'L'}
                        </span>
                        <span className="text-slate-400 text-xs flex-1">{scores || '—'}</span>
                        {m.mmrChange !== undefined && (
                          <span className={`text-xs font-bold ${iWon ? 'text-emerald-400' : 'text-red-400'}`}>
                            {iWon ? '+' : ''}{m.mmrChange}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Endorsements ── */}
        {(() => {
          // Merge seed endorsements with any I've added this session
          const seedEndo = player.endorsements ?? {};
          const sessionEndo = playerEndorsements[player.uid] ?? {};
          const merged: Record<string, number> = { ...seedEndo };
          for (const [skill, cnt] of Object.entries(sessionEndo)) {
            merged[skill] = (merged[skill] ?? 0) + cnt;
          }
          const myGiven = myEndorsements[player.uid] ?? [];
          const topSkills = Object.entries(merged).sort((a, b) => b[1] - a[1]);
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <ThumbsUp size={15} className="text-violet-400"/> Endorsements
              </h2>
              {/* Top endorsed skills */}
              {topSkills.length > 0 && (
                <div className="space-y-2 mb-4">
                  {topSkills.map(([skill, count]) => (
                    <div key={skill} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 w-36 shrink-0">{skill}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (count / (topSkills[0][1] || 1)) * 100)}%` }}/>
                      </div>
                      <span className="text-xs font-bold text-violet-400 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Endorse buttons (only for other players) */}
              {!isMe && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {myGiven.length > 0 ? 'Your endorsements:' : 'Endorse this player:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ENDORSE_SKILLS.map(skill => {
                      const given = myGiven.includes(skill);
                      return (
                        <button key={skill} onClick={() => endorsePlayer(player.uid, skill)}
                          title={given ? 'Click to remove endorsement' : 'Click to endorse'}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
                            ${given
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-300'}`}>
                          <ThumbsUp size={11} className={given ? 'text-violet-400' : ''}/>
                          {skill}
                          {given && <span className="text-[10px] opacity-60">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {topSkills.length === 0 && isMe && (
                <p className="text-sm text-slate-500 text-center py-2">No endorsements yet. Play matches to earn some!</p>
              )}
            </div>
          );
        })()}

        {/* ── Club Membership ── */}
        {playerClub && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users size={15} className="text-violet-400"/> Club
            </h2>
            <a href={`/clubs/${playerClub.id}/`}
              className="flex items-center gap-4 p-3 bg-slate-800/60 border border-slate-700 hover:border-violet-500/40 rounded-2xl transition-colors group">
              {/* Club logo */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black border ${playerClub.color}`}>
                {playerClub.logoInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm group-hover:text-violet-300 transition-colors">{playerClub.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{playerClub.area}, {playerClub.state}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-slate-400">
                    <span className="font-bold text-white">{playerClub.memberIds.length}</span> members
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Avg MMR <span className="font-bold text-amber-400">{playerClub.avgMMR.toLocaleString()}</span>
                  </span>
                  {playerClub.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">{t}</span>
                  ))}
                </div>
              </div>
              <span className="text-slate-600 group-hover:text-violet-400 transition-colors text-sm shrink-0">›</span>
            </a>
          </div>
        )}

        {/* ── Event History ── */}
        {(canSeeEventHistory ? playerEvents.length > 0 : !isMe) && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Trophy size={15} className="text-amber-400"/> Event History
            </h2>
            {!canSeeEventHistory ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                {eventHistoryVisibility === 'private' ? 'This player has hidden their event history.' : 'Only followers can see this player\'s event history.'}
              </p>
            ) : (
              <div className="space-y-2">
                {playerEvents.slice(0, 5).map(t => (
                  <a key={t.id} href={`/tournaments/`}
                    className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700 hover:border-amber-500/40 rounded-2xl transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-amber-300 transition-colors truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(t.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.venue.split(',')[0]}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                      t.status === 'Completed' ? 'bg-slate-700 text-slate-400 border-slate-600'
                      : t.status === 'Active'  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                    }`}>{t.status}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* MMR chart */}
          {isMe && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4">MMR Progression</h2>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={MMR_HISTORY} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} interval={2}/>
                  <YAxis tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} domain={['auto','auto']}/>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:'#94a3b8' }} itemStyle={{ color:'#10b981' }}/>
                  <Area type="monotone" dataKey="mmr" stroke="#10b981" strokeWidth={2.5} fill="url(#pg)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-2">Skills</h2>
            <ResponsiveContainer width="100%" height={190}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="#334155"/>
                <PolarAngleAxis dataKey="stat" tick={{ fontSize:11, fill:'#94a3b8' }}/>
                <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false}/>
                <Radar dataKey="val" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Match history */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Match History</h2>
            {!canSeeMatchHistory ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                {matchHistoryVisibility === 'private' ? 'This player has hidden their match history.' : 'Only followers can see this player\'s match history.'}
              </p>
            ) : playerMatches.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No matches recorded yet.</p>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <div className="relative flex-1 min-w-[140px]">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                    <input value={matchQuery} onChange={e => setMatchQuery(e.target.value)}
                      placeholder="Search opponent…"
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 transition-colors"/>
                  </div>
                  <FilterDropdown<ResultFilter>
                    label="All" value={matchResult}
                    options={RESULT_FILTERS.map(r => ({ value: r, label: r }))}
                    onChange={setMatchResult}
                  />
                  <FilterDropdown<MatchType | 'All'>
                    label="Format" value={matchFormat}
                    options={[{ value: 'All' as const, label: 'All Formats' },
                      ...(Object.keys(MATCH_TYPE_LABEL) as MatchType[]).map(t => ({ value: t, label: MATCH_TYPE_LABEL[t] }))]}
                    onChange={setMatchFormat}
                  />
                </div>
                {filteredMatches.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No matches match these filters.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredMatches.slice(0,6).map(m => (
                      <MatchCard key={m.id} match={m} userId={player.uid} onClick={() => setSelectedMatch(m)}/>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Achievements */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Achievements</h2>
            <div className="grid grid-cols-2 gap-2">
              {ACHIEVEMENTS.map(a => (
                <div key={a.name}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-opacity
                    ${a.done ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-35'}`}>
                  <span className="text-xl">{a.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stage 2: Match Analytics ──────────────────────────────── */}
        {(() => {
          if (!canSeeMatchHistory) return null;
          const confirmed = playerMatches.filter(m => m.status === 'Confirmed');
          if (confirmed.length === 0) return null;

          // Win rate by format
          const formats = ['MS','WS','MD','WD','MX'] as MatchType[];
          const byFormat = formats
            .map(f => {
              const ms = confirmed.filter(m => m.type === f);
              if (ms.length === 0) return null;
              const w = ms.filter(m => m.winnerId === player.uid).length;
              return { format: f, played: ms.length, wins: w, rate: Math.round((w / ms.length) * 100) };
            })
            .filter(Boolean) as { format: MatchType; played: number; wins: number; rate: number }[];

          // Recent form: last 7 confirmed matches
          const recent = [...confirmed].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()).slice(0, 7);

          // Streak: current W or L run from latest match
          let streak = 0; let streakType: 'W' | 'L' | null = null;
          for (const m of recent) {
            const won = m.winnerId === player.uid;
            if (streakType === null) { streakType = won ? 'W' : 'L'; streak = 1; }
            else if ((streakType === 'W') === won) streak++;
            else break;
          }

          // Score patterns: avg points scored/conceded per game
          let scored = 0, conceded = 0, gameCount = 0;
          confirmed.forEach(m => {
            const isP1 = m.player1Id === player.uid;
            m.games.forEach(g => {
              scored   += isP1 ? g.p1 : g.p2;
              conceded += isP1 ? g.p2 : g.p1;
              gameCount++;
            });
          });
          const avgScored   = gameCount > 0 ? (scored / gameCount).toFixed(1) : '—';
          const avgConceded = gameCount > 0 ? (conceded / gameCount).toFixed(1) : '—';

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Match Analytics</h2>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold">Stage 2</span>
              </div>

              {/* Recent form */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">Recent Form</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {recent.map((m, i) => {
                      const won = m.winnerId === player.uid;
                      return (
                        <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold
                          ${won ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                          {won ? 'W' : 'L'}
                        </div>
                      );
                    })}
                  </div>
                  {streakType && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${streakType === 'W' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {streak}{streakType} streak
                    </span>
                  )}
                </div>
              </div>

              {/* Win rate by format */}
              {byFormat.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">Win Rate by Format</p>
                  <div className="space-y-2">
                    {byFormat.map(row => (
                      <div key={row.format} className="flex items-center gap-3">
                        <span className="text-[11px] font-mono font-bold w-8 shrink-0 text-slate-300">{row.format}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${row.rate}%` }}/>
                        </div>
                        <span className="text-[11px] text-slate-400 w-12 text-right shrink-0">{row.rate}% <span className="text-slate-600">({row.played})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score patterns */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-emerald-400">{avgScored}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Avg pts scored/game</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-rose-400">{avgConceded}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Avg pts conceded/game</p>
                </div>
              </div>
            </div>
          );
        })()}
        {/* ── Court Analytics ── */}
        {(() => {
          const profile = isMe ? courtProfile : (player.courtProfile ?? null);
          const positions = profile?.positions ?? [];
          const credits   = isMe ? clipCredits : (player.clipCredits ?? 0);
          const badge     = isMe ? (ctxUser.clipBadge ?? null) : (player.clipBadge ?? null);

          const BADGE_META: Record<string, { icon: string; label: string; desc: string; color: string }> = {
            Camera:       { icon: '📹', label: 'Camera',       desc: '1st clip uploaded',    color: 'text-slate-300 border-slate-600 bg-slate-800' },
            Director:     { icon: '🎬', label: 'Director',     desc: '5 clips uploaded',     color: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
            Studio:       { icon: '🎥', label: 'Studio',       desc: '20 clips uploaded',    color: 'text-purple-300 border-purple-500/40 bg-purple-500/10' },
            Broadcaster:  { icon: '📡', label: 'Broadcaster',  desc: '50 clips uploaded',    color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
          };

          if (positions.length === 0 && credits === 0) return null;

          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Camera size={15} className="text-sky-400"/> Court Analytics
                </h2>
                <span className="text-[10px] bg-sky-500/15 text-sky-400 border border-sky-500/25 px-2 py-0.5 rounded-full font-semibold">Stage 3</span>
              </div>

              {/* Clip badge + credits */}
              {(badge || credits > 0) && (
                <div className="flex items-center gap-3">
                  {badge && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${BADGE_META[badge].color}`}>
                      <span>{BADGE_META[badge].icon}</span>
                      <div>
                        <p className="text-xs font-bold">{BADGE_META[badge].label}</p>
                        <p className="text-[10px] opacity-70">{BADGE_META[badge].desc}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 text-right">
                    <p className="text-xl font-black text-sky-400">{credits}</p>
                    <p className="text-[10px] text-slate-500">Clip Credits</p>
                  </div>
                </div>
              )}

              {/* Clip credits progress */}
              {credits > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Next: {credits < 5 ? 'Director' : credits < 20 ? 'Studio' : credits < 50 ? 'Broadcaster' : 'Max reached'}</span>
                    <span>{credits < 5 ? `${credits}/5` : credits < 20 ? `${credits}/20` : credits < 50 ? `${credits}/50` : '50/50'}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, credits < 5 ? (credits/5)*100 : credits < 20 ? (credits/20)*100 : credits < 50 ? (credits/50)*100 : 100)}%` }}/>
                  </div>
                </div>
              )}

              {/* Court heatmap */}
              {positions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <MapPin size={11}/> Court Coverage
                    </p>
                    <span className="text-[10px] text-slate-500">
                      {positions.length} pts · {profile?.totalMatches ?? 1} match{(profile?.totalMatches ?? 1) !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <CourtHeatmap positions={positions} showStats/>
                </div>
              )}

              {positions.length === 0 && isMe && (
                <div className="text-center py-3">
                  <Video size={20} className="text-slate-600 mx-auto mb-2"/>
                  <p className="text-sm text-slate-500">No court data yet</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Use <span className="text-emerald-500">Track</span> during a live match to build your court profile</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)}
        onConfirm={selectedMatch?.status === 'Pending' ? () => { confirmMatch(selectedMatch.id); setSelectedMatch(null); } : undefined}
        onDispute={selectedMatch?.status === 'Pending'  ? () => { disputeMatch(selectedMatch.id);  setSelectedMatch(null); } : undefined}
      />
      {isMe && <QRModal open={qrOpen} onClose={() => setQrOpen(false)}/>}
      {isMe && settOpen && <SettingsModal open={settOpen} onClose={() => setSettOpen(false)}/>}
      {!isMe && challengeOpen && <ChallengeModal opponent={player} onClose={() => setChallengeOpen(false)}/>}
    </>
  );
}
