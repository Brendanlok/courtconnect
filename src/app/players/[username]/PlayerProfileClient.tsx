'use client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PLAYERS, ME } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { QRModal } from '@/components/QRModal';
import { InviteModal } from '@/components/InviteModal';
import { ChallengeModal } from '@/components/ChallengeModal';
import { SettingsModal } from '@/components/SettingsModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { tierProgress, nextTier, skillMatch, MATCH_TYPE_LABEL, BASE_PATH, clubHref, TIER_STYLE, DAY_IDS, DAY_LABELS, SLOT_IDS, SLOT_LABELS, isCalibrating } from '@/lib/utils';
import { BADGES, MATCH_COUNT_MILESTONE, type Badge } from '@/lib/achievements';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { MapPin, QrCode, MessageCircle, Swords, ThumbsUp, Settings, Search, Users, UserPlus, UserCheck, Trophy, Lock, Clock, Flame, TrendingUp, CircleSlash, Star, X, Medal, Award } from 'lucide-react';
import { useState } from 'react';
import type { Match, MatchType } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';
import { auth } from '@/lib/supabase';

const RESULT_FILTERS = ['All', 'Wins', 'Losses', 'Pending'] as const;
type ResultFilter = typeof RESULT_FILTERS[number];

const RADAR_DATA = [
  { stat:'Smash', val:72 },{ stat:'Net Play', val:58 },{ stat:'Defense', val:65 },
  { stat:'Footwork', val:80 },{ stat:'Stamina', val:74 },{ stat:'Serve', val:68 },
];

const BADGE_ICON: Record<string, React.ReactNode> = {
  first_win:     <Trophy size={18} className="text-amber-400"/>,
  hot_streak:    <Flame size={18} className="text-orange-400"/>,
  giant_slayer:  <Swords size={18} className="text-red-400"/>,
  comeback_king: <TrendingUp size={18} className="text-emerald-400"/>,
  bagel:         <CircleSlash size={18} className="text-blue-400"/>,
  marathon:      <Clock size={18} className="text-violet-400"/>,
  first_ten:     <Medal size={18} className="text-sky-400"/>,
  half_century:  <Award size={18} className="text-fuchsia-400"/>,
  century_club:  <Star size={18} className="text-amber-400"/>,
  champion:      <Trophy size={18} className="text-amber-400"/>,
};

function BadgeDetailModal({ badge, earned, onClose }: { badge: Badge; earned: boolean; onClose: () => void }) {
  const { ref: panelRef, dialogProps } = useModalA11y(true, onClose, badge.name);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold">Achievement</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${earned ? 'bg-slate-800' : 'bg-slate-800/50 opacity-50'}`}>
            {BADGE_ICON[badge.id]}
          </div>
          <div>
            <p className="font-bold text-base">{badge.name}</p>
            <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border
              ${earned ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              {earned ? 'Unlocked' : 'Locked'}
            </span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">{badge.description}</p>
        </div>
      </div>
    </div>
  );
}

export function PlayerProfileClient({ username, forceIsMe = false }: { username: string; forceIsMe?: boolean }) {
  const { user: ctxUser, matches: allMatches, confirmMatch, disputeMatch, resubmitMatch, cancelPendingMatch, myEndorsements, playerEndorsements, endorsePlayer, clubs, following, followRequestsSent, followPlayer, unfollowPlayer, tournaments, earnedBadgeIds, pastSeasons } = useApp();
  const matchesConfirmedCount = allMatches.filter(m => m.status === 'Confirmed').length;

  const ENDORSE_SKILLS = ['Powerful Smash', 'Sharp Net Play', 'Great Footwork', 'Strong Defense', 'Smart Placement', 'Good Sportsmanship'];
  const staticPlayer = [ME, ...PLAYERS].find(p => p.username === username);

  const [selectedMatch,  setSelectedMatch]  = useState<Match | null>(null);
  const [qrOpen,         setQrOpen]         = useState(false);
  const [inviteOpen,     setInviteOpen]     = useState(false);
  const [challengeOpen,  setChallengeOpen]  = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('challenge') === '1';
  });
  const [settOpen,       setSettOpen]       = useState(false);
  const [matchQuery,     setMatchQuery]     = useState('');
  const [matchFormat,    setMatchFormat]    = useState<MatchType | 'All'>('All');
  const [matchResult,    setMatchResult]    = useState<ResultFilter>('All');
  const [selectedBadge,  setSelectedBadge]  = useState<Badge | null>(null);

  if (!staticPlayer && !forceIsMe) return notFound();

  // staticPlayer.uid === 'me' only means the URL matched the ME seed
  // placeholder's username ("brendanlok") — it does NOT mean the current
  // viewer is Lok. ctxUser.uid is ALWAYS the 'me' sentinel by app-wide
  // convention (see AppContext's onAuthStateChanged handler), even for a
  // fully real signed-in account — the real uid lives in auth.currentUser,
  // not on ctxUser. So checking ctxUser.uid here can never tell demo mode
  // apart from a real session; check auth.currentUser directly instead.
  // Without this, any signed-in user landing on /players/brendanlok/ saw
  // their OWN account's data mislabeled as this static demo page.
  const isMe   = forceIsMe || (staticPlayer!.uid === 'me' && !auth.currentUser);
  const player = isMe ? ctxUser : staticPlayer!;

  const progress = tierProgress(player.mmr, player.tier);
  const { name: nextName, threshold } = nextTier(player.tier);
  const wr  = Math.round((player.stats.wins / Math.max(player.stats.totalMatches, 1)) * 100);
  const playerCalibrating = isCalibrating(player);
  const sm  = isMe ? 100 : skillMatch(ctxUser.mmr, player.mmr);
  const playerMatches = allMatches.filter(m => m.player1Id === player.uid || m.player2Id === player.uid);

  // Real MMR history for the last 30 days (own profile only), walked forward
  // from each confirmed match's mmrChange — same approach as the Home page
  // chart, not a hardcoded seed series.
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const recentConfirmedForMmr = isMe
    ? [...allMatches]
        .filter(m => m.status === 'Confirmed' && new Date(m.playedAt).getTime() >= thirtyDaysAgo)
        .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
    : [];
  let mmrRunning = ctxUser.mmr - recentConfirmedForMmr.reduce((s, m) => s + (m.mmrChange ?? 0), 0);
  const mmrHistory = recentConfirmedForMmr.map(m => {
    mmrRunning += m.mmrChange ?? 0;
    const d = new Date(m.playedAt);
    return { date: `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`, mmr: mmrRunning };
  });
  const filteredMatches = playerMatches
    .filter(m => matchFormat === 'All' || m.type === matchFormat)
    .filter(m => {
      if (matchResult === 'All')     return true;
      if (matchResult === 'Pending') return m.status === 'Pending';
      if (matchResult === 'Wins')    return m.status === 'Confirmed' && m.winnerId === player.uid;
      return m.status === 'Confirmed' && m.winnerId !== player.uid;
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

  // Doubles partner chemistry: confirmed doubles matches grouped by teammate,
  // sorted by matches played together (most-played partner first).
  const partnerStats = [...playerMatches
    .filter(m => m.status === 'Confirmed' && m.type !== 'MS' && m.type !== 'WS')
    .reduce((map, m) => {
      const iAmP1 = m.player1Id === player.uid;
      const partnerId       = iAmP1 ? m.player1PartnerId       : m.player2PartnerId;
      const partnerName     = iAmP1 ? m.player1PartnerName     : m.player2PartnerName;
      if (!partnerId) return map;
      const entry = map.get(partnerId) ?? { id: partnerId, name: partnerName ?? 'Partner', wins: 0, losses: 0 };
      if (m.winnerId === player.uid) entry.wins++; else entry.losses++;
      map.set(partnerId, entry);
      return map;
    }, new Map<string, { id: string; name: string; wins: number; losses: number }>())
    .values()]
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  // Account privacy: private accounts require an accepted follow to see anything beyond the header
  const isFollowingPlayer  = following.includes(player.uid);
  const hasRequestedFollow = followRequestsSent.includes(player.uid);
  const targetIsPrivate    = !!player.isPrivate;
  const canSeeFullProfile  = isMe || !targetIsPrivate || isFollowingPlayer;

  // Match History privacy: public = visible to all, followers = visible to followers only, private = owner only
  const matchHistoryVisibility = player.privacy?.matchHistory ?? 'public';
  const canSeeMatchHistory = canSeeFullProfile && (isMe || matchHistoryVisibility === 'public' || (matchHistoryVisibility === 'friends' && isFollowingPlayer));

  // Club membership privacy: same public/followers/private rule
  const clubMembershipVisibility = player.privacy?.clubMembership ?? 'public';
  const canSeeClubMembership = canSeeFullProfile && (isMe || clubMembershipVisibility === 'public' || (clubMembershipVisibility === 'friends' && isFollowingPlayer));
  const playerClubs = canSeeClubMembership ? clubs.filter(c => c.memberIds.includes(player.uid)) : [];

  // Weekly availability: collected in onboarding/Settings, shown here so other
  // players know when to challenge someone — same public/followers/private
  // gate as the rest of this section (canSeeFullProfile), no separate toggle.
  const availSlots = (player.available ?? '').split(',').map(s => s.trim()).filter(Boolean);

  // Event history privacy: same public/followers/private rule
  const eventHistoryVisibility = player.privacy?.eventHistory ?? 'public';
  const canSeeEventHistory = canSeeFullProfile && (isMe || eventHistoryVisibility === 'public' || (eventHistoryVisibility === 'friends' && isFollowingPlayer));
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
            {!isMe && !playerCalibrating && (
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
              <TierBadge tier={player.tier} placementMatchesPlayed={player.placementMatchesPlayed} recalibrationMatchesPlayed={isMe ? player.recalibrationMatchesPlayed : undefined}/>
              {player.isDummy && (
                <span className="text-[10px] font-bold bg-slate-700 border border-slate-600 text-slate-400 px-2 py-0.5 rounded-full tracking-wide">
                  DEMO PROFILE
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-1.5 flex-wrap">
              <MapPin size={12}/> {player.area}, {player.state}
              <span className="text-slate-600">·</span>
              <span>{playerCalibrating ? 'Calibrating — unranked' : `#${player.globalRank} National`}</span>
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
                { label:'MMR',      val:playerCalibrating ? '🔒' : player.mmr.toLocaleString(), color:'text-amber-400' },
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
              <div className="text-center">
                <p className="text-xl font-bold">{(isMe ? following.length : (player.followingCount ?? 0)).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Following</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{(isMe ? (ctxUser.followersCount ?? 0) : (player.followersCount ?? 0)).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Followers</p>
              </div>
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

            {!playerCalibrating && nextName && (
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
                <button onClick={() => { window.location.href = `${BASE_PATH}/chat/?uid=${player.uid}`; }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                  <MessageCircle size={14}/> Message
                </button>
                <button onClick={() => {
                    if (isFollowingPlayer || hasRequestedFollow) unfollowPlayer(player.uid);
                    else followPlayer(player.uid, targetIsPrivate);
                  }}
                  title={hasRequestedFollow ? 'Cancel follow request' : isFollowingPlayer ? 'Unfollow' : targetIsPrivate ? 'Request to follow' : 'Follow'}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                    isFollowingPlayer
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                      : hasRequestedFollow
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}>
                  {isFollowingPlayer ? <UserCheck size={14}/> : hasRequestedFollow ? <Clock size={14}/> : <UserPlus size={14}/>}
                  {hasRequestedFollow && <span className="text-xs">Requested</span>}
                </button>
              </>
            )}
          </div>
          {isMe && (
            <button onClick={() => setInviteOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm font-semibold transition-colors">
              <UserPlus size={14}/> Invite Friends
            </button>
          )}
        </div>

        {!canSeeFullProfile ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
            <Lock size={28} className="text-slate-600 mx-auto mb-3"/>
            <p className="font-semibold text-slate-200">This account is private</p>
            <p className="text-sm text-slate-500 mt-1">
              {hasRequestedFollow
                ? 'Your follow request is pending. Their profile will unlock once accepted.'
                : `Follow @${player.username} to see their matches, stats, and more.`}
            </p>
          </div>
        ) : (
        <>
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

        {/* ── Doubles Partners ── */}
        {partnerStats.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users size={15} className="text-emerald-400"/> Doubles Partners
            </h2>
            <div className="space-y-2">
              {partnerStats.slice(0, 4).map((p, i) => {
                const played = p.wins + p.losses;
                const wr = Math.round((p.wins / played) * 100);
                // No username on hand here (Match only stores partner uid/name) —
                // /profile/?uid= resolves a real account the same way chat and
                // notification links elsewhere in the app already do.
                const partnerHref = p.id === 'me' ? '/profile/' : `/profile/?uid=${p.id}`;
                return (
                  <Link key={p.id} href={partnerHref}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    {i === 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        MOST PLAYED
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.wins}-{p.losses} together &middot; {wr}% win rate</p>
                    </div>
                    <div className="h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden shrink-0">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${wr}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
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
        {(canSeeClubMembership ? playerClubs.length > 0 : !isMe) && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users size={15} className="text-violet-400"/> {playerClubs.length > 1 ? 'Clubs' : 'Club'}
            </h2>
            {!canSeeClubMembership ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                {clubMembershipVisibility === 'private' ? 'This player has hidden their club membership.' : 'Only followers can see this player\'s club membership.'}
              </p>
            ) : (
            <div className="space-y-2">
              {playerClubs.map(club => (
                <Link key={club.id} href={clubHref(club)}
                  className="flex items-center gap-4 p-3 bg-slate-800/60 border border-slate-700 hover:border-violet-500/40 rounded-2xl transition-colors group">
                  {/* Club logo */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black border ${club.color}`}>
                    {club.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm group-hover:text-violet-300 transition-colors">{club.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{club.area}, {club.state}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-400">
                        <span className="font-bold text-white">{club.memberIds.length}</span> members
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Avg MMR <span className="font-bold text-amber-400">{club.avgMMR.toLocaleString()}</span>
                      </span>
                      {club.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">{t}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-slate-600 group-hover:text-violet-400 transition-colors text-sm shrink-0">›</span>
                </Link>
              ))}
            </div>
            )}
          </div>
        )}

        {/* ── Availability ── */}
        {availSlots.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={15} className="text-emerald-400"/> Availability
            </h2>
            <div className="space-y-1">
              <div className="flex gap-0.5 ml-7">
                {SLOT_LABELS.map(l => (
                  <div key={l} className="flex-1 text-center text-[8px] text-slate-600 leading-tight">{l}</div>
                ))}
              </div>
              {(DAY_IDS as readonly string[]).map((day, di) => (
                <div key={day} className="flex items-center gap-0.5">
                  <span className="text-[10px] text-slate-500 w-6 shrink-0 font-medium">{DAY_LABELS[di]}</span>
                  {(SLOT_IDS as readonly string[]).map(slot => {
                    const on = availSlots.includes(`${day}_${slot}`);
                    return (
                      <div key={slot}
                        className={`flex-1 h-7 rounded text-[9px] font-bold flex items-center justify-center border
                          ${on ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700/40'}`}>
                        {on ? '✓' : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
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
                  <a key={t.id} href={`${BASE_PATH}/tournaments/`}
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
          {/* MMR chart — hidden while calibrating, same as the number itself */}
          {isMe && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4">MMR Progression</h2>
              {playerCalibrating ? (
                <div className="h-[150px] flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-xs text-slate-500">⚡ Calibrating — your MMR chart unlocks once placement is done</p>
                </div>
              ) : mmrHistory.length === 0 ? (
                <div className="h-[150px] flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-xs text-slate-500">No confirmed matches in the last 30 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={mmrHistory} margin={{ top:4, right:4, left:-24, bottom:0 }}>
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
              )}
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

          {/* Achievements — own profile only; badges are computed from real match
              history the client only has for the signed-in user. */}
          {isMe && (
            <div id="achievements" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 scroll-mt-20">
              <h2 className="font-semibold mb-3">Achievements</h2>
              <div className="grid grid-cols-2 gap-2">
                {BADGES.map(b => {
                  const done = earnedBadgeIds.includes(b.id);
                  const milestone = MATCH_COUNT_MILESTONE[b.id];
                  return (
                    <button key={b.id} onClick={() => setSelectedBadge(b)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors
                        ${done ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-slate-900 border-slate-800 opacity-35 hover:opacity-60'}`}>
                      {BADGE_ICON[b.id]}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{b.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {!done && milestone
                            ? `${Math.min(matchesConfirmedCount, milestone)}/${milestone} matches`
                            : b.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Season History — own profile only; past seasons are only ever
            snapshotted for the signed-in account itself (season_history RLS
            allows inserting your own row, and only the owner's client ever
            performs a rollover for their own account). */}
        {isMe && pastSeasons.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Season History</h2>
            <div className="space-y-2">
              {pastSeasons.map(s => {
                const style = TIER_STYLE[s.tierEnd];
                return (
                  <div key={s.seasonNumber}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border ${style.bg} ${style.text} ${style.border}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Season {s.seasonNumber}</p>
                      <p className={`text-xs ${style.text}`}>{s.tierEnd} · {s.mmrEnd} MMR</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stage 2: Match Analytics ──────────────────────────────── */}
        {(() => {
          if (!canSeeMatchHistory) return null;
          // playerMatches is built from allMatches, which only ever holds
          // the signed-in viewer's own matches (player1Id is always the
          // local 'me' sentinel — see toLocalMatch in AppContext). For
          // anyone else's profile that silently degrades to "matches
          // between me and them" — real data, but not their overall record,
          // and shown here with no caveat. Own-profile only until there's a
          // real per-player match fetch to back this section for others.
          if (!isMe) return null;
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
          const allByDate = [...confirmed].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
          const recent = allByDate.slice(0, 7);

          // Streak: current W or L run from latest match — walks the full
          // history (not just the 7 shown as "recent form" dots above), or a
          // streak longer than 7 would silently show capped at 7.
          let streak = 0; let streakType: 'W' | 'L' | null = null;
          for (const m of allByDate) {
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
        </>
        )}
      </div>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)}
        onConfirm={selectedMatch?.status === 'Pending' ? () => { confirmMatch(selectedMatch.id, ctxUser.uid); setSelectedMatch(null); } : undefined}
        onDispute={selectedMatch?.status === 'Pending'  ? () => { disputeMatch(selectedMatch.id);  setSelectedMatch(null); } : undefined}
        onCancel={selectedMatch?.status === 'Pending'   ? () => { cancelPendingMatch(selectedMatch.id); setSelectedMatch(null); } : undefined}
        onResubmit={selectedMatch?.status === 'Disputed' ? games => { resubmitMatch(selectedMatch.id, games); setSelectedMatch(null); } : undefined}
      />
      {isMe && <QRModal open={qrOpen} onClose={() => setQrOpen(false)}/>}
      {isMe && settOpen && <SettingsModal open={settOpen} onClose={() => setSettOpen(false)}/>}
      {selectedBadge && (
        <BadgeDetailModal badge={selectedBadge} earned={earnedBadgeIds.includes(selectedBadge.id)} onClose={() => setSelectedBadge(null)}/>
      )}
      {!isMe && challengeOpen && <ChallengeModal opponent={player} onClose={() => setChallengeOpen(false)}/>}
    </>
  );
}
