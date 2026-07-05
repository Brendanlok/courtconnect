'use client';
import { useState, useRef, useEffect } from 'react';
import { PLAYERS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { TIER_STYLE, MY_STATES, skillMatch } from '@/lib/utils';
import {
  Search, MapPin, Filter, Users, Shield, Trophy, UserPlus, LogOut as Leave,
  Plus, Copy, Check, CheckCheck, Lock, Globe, Megaphone, Settings, Clock,
  X, AlertTriangle, TrendingUp, ArrowUp, ArrowDown, Crown, ShieldCheck,
  UserMinus, Trash2, UserCheck, UserX, Bell, ChevronDown, LayoutList, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { CreateClubModal } from '@/components/CreateClubModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { MMRInfoModal } from '@/components/MMRInfoModal';
import type { UserProfile, MalaysiaState, Tier, MatchType, Club } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
const TABS = ['Players', 'Friends', 'Clubs'] as const;

export default function PlayersPage() {
  const {
    user, updateUser,
    clubs, myClubId, joinClub, requestJoinClub, cancelClubRequest, leaveClub,
    myClubPendingIds, acceptClubMember, declineClubMember, updateClub, disbandClub,
    assignModerator, removeModerator,
    friends, outgoingFriendRequests, incomingFriendRequests,
    sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  } = useApp();
  const [mmrInfoOpen, setMmrInfoOpen] = useState(false);
  const [tab, setTab] = useState<typeof TABS[number]>(() => {
    if (typeof window === 'undefined') return 'Players';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'friends') return 'Friends';
    if (t === 'clubs')   return 'Clubs';
    return 'Players';
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-slate-400 text-sm mt-0.5">Find players across 🇲🇾 Malaysia</p>
        </div>
        <button onClick={() => setMmrInfoOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium transition-colors shrink-0 mt-1">
          <TrendingUp size={12}/> How MMR works
        </button>
      </div>
      <MMRInfoModal open={mmrInfoOpen} onClose={() => setMmrInfoOpen(false)}/>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t === 'Friends' && <UserCheck size={13}/>}
            {t === 'Clubs'   && <Shield size={13}/>}
            {t}
            {t === 'Friends' && incomingFriendRequests.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {incomingFriendRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Players' && (
        <PlayersList
          user={user}
          friends={friends}
          incoming={incomingFriendRequests}
        />
      )}
      {tab === 'Friends' && (
        <FriendsTab
          user={user} updateUser={updateUser}
          friends={friends}
          outgoing={outgoingFriendRequests}
          incoming={incomingFriendRequests}
          onSend={sendFriendRequest}
          onCancel={cancelFriendRequest}
          onAccept={acceptFriendRequest}
          onDecline={declineFriendRequest}
          onRemove={removeFriend}
        />
      )}
      {tab === 'Clubs' && (
        <ClubsTab
          clubs={clubs} myClubId={myClubId} myClubPendingIds={myClubPendingIds}
          joinClub={joinClub} requestJoinClub={requestJoinClub}
          cancelClubRequest={cancelClubRequest} leaveClub={leaveClub}
          acceptClubMember={acceptClubMember} declineClubMember={declineClubMember}
          updateClub={updateClub} disbandClub={disbandClub}
          assignModerator={assignModerator} removeModerator={removeModerator}
          userId={user.uid}
        />
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FriendProps {
  user: UserProfile;
  friends: string[];
  outgoing: string[];
  incoming: string[];
  onSend: (uid: string) => void;
  onCancel: (uid: string) => void;
  onAccept: (uid: string) => void;
  onDecline: (uid: string) => void;
  onRemove: (uid: string) => void;
}

type SortDir = 'desc' | 'asc';
type SortKey = 'mmr' | 'winRate' | 'wins' | 'matches';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'mmr',     label: 'MMR' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'wins',    label: 'Wins' },
  { key: 'matches', label: 'Matches' },
];

const RANK_TABS = ['Nationwide', 'By State', 'Nearby', 'Friends'] as const;
type RankTab = typeof RANK_TABS[number];

// ─── Shared filter bar ────────────────────────────────────────────────────────

function FilterBar({ query, setQuery, stateFilter, setStateFilter, tierFilter, setTierFilter, sortDir, setSortDir, openToPlay, setOpenToPlay, openToPartner, setOpenToPartner, endSlot }: {
  query: string; setQuery: (v: string) => void;
  stateFilter: MalaysiaState | 'All'; setStateFilter: (v: MalaysiaState | 'All') => void;
  tierFilter: Tier | 'All'; setTierFilter: (v: Tier | 'All') => void;
  sortDir: SortDir; setSortDir: (v: SortDir) => void;
  openToPlay?: boolean; setOpenToPlay?: (v: boolean) => void;
  openToPartner?: boolean; setOpenToPartner?: (v: boolean) => void;
  endSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or @username…"
          className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
      </div>
      <div className="flex gap-1.5 flex-wrap items-center">
        <FilterDropdown<MalaysiaState | 'All'>
          icon={<MapPin size={11} className="text-emerald-400"/>}
          label="All States" value={stateFilter}
          options={[{ value: 'All', label: 'All States' }, ...MY_STATES.map(s => ({ value: s as MalaysiaState, label: s }))]}
          onChange={setStateFilter}
        />
        <FilterDropdown<Tier | 'All'>
          icon={<span className="text-[11px]">{tierFilter !== 'All' ? TIER_STYLE[tierFilter].icon : '🏅'}</span>}
          label="All Tiers" value={tierFilter}
          options={TIERS.map(t => ({
            value: t, label: t === 'All' ? 'All Tiers' : t,
            prefix: t !== 'All' ? <span className="text-sm">{TIER_STYLE[t].icon}</span> : undefined,
          }))}
          onChange={setTierFilter}
        />
        <button onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors">
          {sortDir === 'desc' ? <ArrowDown size={10} className="text-amber-400"/> : <ArrowUp size={10} className="text-amber-400"/>}
          {sortDir === 'desc' ? 'High → Low' : 'Low → High'}
        </button>
        {setOpenToPlay && (
          <button onClick={() => setOpenToPlay(!openToPlay)}
            className={"flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors " + (openToPlay ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700')}>
            <span className={"w-1.5 h-1.5 rounded-full " + (openToPlay ? 'bg-emerald-400' : 'bg-slate-600')}/>
            Open to Play
          </button>
        )}
        {setOpenToPartner && (
          <button onClick={() => setOpenToPartner(!openToPartner)}
            className={"flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors " + (openToPartner ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700')}>
            <span className={"w-1.5 h-1.5 rounded-full " + (openToPartner ? 'bg-violet-400' : 'bg-slate-600')}/>
            Open to Partner
          </button>
        )}
        {endSlot}
      </div>
    </div>
  );
}

// ─── Consistent player card ───────────────────────────────────────────────────

function PlayerCard({ player: p, myMMR, isFriend, isIncoming }: {
  player: UserProfile; myMMR: number;
  isFriend?: boolean; isIncoming?: boolean;
}) {
  const sm = skillMatch(myMMR, p.mmr);
  const smColor = sm >= 80 ? 'text-emerald-400' : sm >= 60 ? 'text-amber-400' : 'text-red-400';
  const smBar   = sm >= 80 ? 'bg-emerald-500'   : sm >= 60 ? 'bg-amber-500'   : 'bg-red-500';
  const wr = Math.round((p.stats.wins / Math.max(p.stats.totalMatches, 1)) * 100);

  const borderClass = isIncoming
    ? 'border-amber-500/30'
    : isFriend ? 'border-emerald-500/20'
    : 'border-slate-800 hover:border-slate-700';

  return (
    <Link href={`/players/${p.username}`}
      className={`block bg-slate-900 border rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${borderClass}`}>
      <div className="flex gap-3 px-3.5 py-3 items-center min-h-[76px]">
        <div className="shrink-0">
          <Avatar name={p.displayName}/>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <p className="font-bold text-sm truncate">{p.displayName}</p>
              <p className="text-[11px] text-slate-500 shrink-0">@{p.username}</p>
              {p.openToPlay && (
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" title="Open to play"/>
              )}
              {p.lookingForPartner && (
                <Users size={9} className="text-violet-400 shrink-0"/>
              )}
              {isFriend && (
                <UserCheck size={9} className="text-emerald-400 shrink-0"/>
              )}
              {isIncoming && !isFriend && (
                <Bell size={9} className="text-amber-400 shrink-0"/>
              )}
            </div>
            <p className="text-base font-bold text-amber-400 shrink-0">{p.mmr.toLocaleString()}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <TierBadge tier={p.tier}/>
            <p className="text-xs text-slate-400 shrink-0">{p.stats.wins}W · {wr}% WR</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <MapPin size={9}/> {p.area}, {p.state}
              <span className="mx-0.5">·</span>#{p.globalRank}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${smBar} rounded-full`} style={{ width:`${sm}%` }}/>
              </div>
              <span className={`text-[10px] font-bold ${smColor}`}>{sm}%</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Ranks view (embedded leaderboard) ───────────────────────────────────────

function RankRow({ player: p, rank, isMe, isFriend, sortKey }: {
  player: UserProfile; rank: number; isMe: boolean; isFriend: boolean; sortKey: SortKey;
}) {
  const wr = p.stats.totalMatches > 0 ? Math.round((p.stats.wins / p.stats.totalMatches) * 100) : 0;
  const rankColor = rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600/80' : 'text-slate-500';
  const borderClass = isMe ? 'border-emerald-500/30 bg-emerald-500/5' : isFriend ? 'border-emerald-500/15' : 'border-slate-800 hover:border-slate-700';
  const statLabel = sortKey === 'winRate' ? `${wr}% WR` : sortKey === 'wins' ? `${p.stats.wins}W` : sortKey === 'matches' ? `${p.stats.totalMatches}` : p.mmr.toLocaleString();
  const subLabel  = sortKey === 'mmr' ? 'MMR' : sortKey === 'matches' ? 'played' : '';
  return (
    <Link href={isMe ? '/profile' : `/players/${p.username}`}
      className={`flex items-center gap-3 bg-slate-900 border rounded-2xl px-3.5 py-3 min-h-[60px] transition-all hover:-translate-y-0.5 ${borderClass}`}>
      <span className={`text-sm font-bold w-7 shrink-0 text-right ${rankColor}`}>#{rank}</span>
      <Avatar name={p.displayName}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-bold text-sm truncate">{p.displayName}</p>
          {isMe && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold shrink-0">You</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <TierBadge tier={p.tier}/>
          <p className="text-[11px] text-slate-500">{p.stats.wins}W · {wr}% WR</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-amber-400">{statLabel}</p>
        {subLabel && <p className="text-[10px] text-slate-500">{subLabel}</p>}
      </div>
    </Link>
  );
}

function RanksView({ user, friends }: { user: UserProfile; friends: string[] }) {
  const [tab,      setTab]      = useState<RankTab>('Nationwide');
  const [selState, setSelState] = useState<MalaysiaState>(user.state);
  const [sortKey,  setSortKey]  = useState<SortKey>('mmr');
  const [query,    setQuery]    = useState('');
  const winRate = (p: UserProfile) => p.stats.totalMatches > 0 ? p.stats.wins / p.stats.totalMatches : 0;
  const all = [user, ...PLAYERS];
  const ranked = all
    .filter(p => {
      if (tab === 'By State') return p.state === selState;
      if (tab === 'Nearby')   return (p.distKm ?? (p.uid === 'me' ? 0 : 999)) <= 10;
      if (tab === 'Friends')  return friends.includes(p.uid) || p.uid === 'me';
      return true;
    })
    .filter(p => p.displayName.toLowerCase().includes(query.toLowerCase()) || p.username.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'winRate') return winRate(b) - winRate(a);
      if (sortKey === 'wins')    return b.stats.wins - a.stats.wins;
      if (sortKey === 'matches') return b.stats.totalMatches - a.stats.totalMatches;
      return b.mmr - a.mmr;
    });
  const meIdx = ranked.findIndex(p => p.uid === 'me');
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {RANK_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap
              ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'By State' && (
        <FilterDropdown<MalaysiaState>
          icon={<MapPin size={11} className="text-emerald-400"/>}
          label={selState} value={selState}
          options={MY_STATES.map(s => ({ value: s as MalaysiaState, label: s }))}
          onChange={setSelState}
        />
      )}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </div>
        <FilterDropdown<SortKey>
          icon={<BarChart2 size={11} className="text-amber-400"/>}
          label={SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? 'MMR'}
          value={sortKey}
          options={SORT_OPTIONS.map(o => ({ value: o.key, label: o.label }))}
          onChange={setSortKey}
        />
      </div>
      {meIdx >= 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-emerald-400">#{meIdx + 1}</span>
          <span className="text-xs text-slate-400">Your rank in this view</span>
        </div>
      )}
      <p className="text-xs text-slate-500">{ranked.length} player{ranked.length !== 1 ? 's' : ''}</p>
      <div className="space-y-2">
        {ranked.map((p, i) => (
          <RankRow key={p.uid} player={p} rank={i + 1} isMe={p.uid === 'me'} isFriend={friends.includes(p.uid)} sortKey={sortKey}/>
        ))}
      </div>
    </div>
  );
}

// ─── All Players list ─────────────────────────────────────────────────────────

function PlayersList({ user, friends, incoming }: Pick<FriendProps, 'user' | 'friends' | 'incoming'>) {
  const [view,          setView]         = useState<'browse' | 'ranks'>('browse');
  const [query,          setQuery]          = useState('');
  const [stateFilter,    setStateFilter]    = useState<MalaysiaState | 'All'>('All');
  const [tierFilter,     setTierFilter]     = useState<Tier | 'All'>('All');
  const [sortDir,        setSortDir]        = useState<SortDir>('desc');
  const [openToPlay,     setOpenToPlay]     = useState(false);
  const [openToPartner,  setOpenToPartner]  = useState(false);

  const filtered = PLAYERS
    .filter(p => {
      const q = query.toLowerCase();
      return (p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
        && (stateFilter === 'All' || p.state === stateFilter)
        && (tierFilter  === 'All' || p.tier  === tierFilter)
        && (!openToPlay    || p.openToPlay)
        && (!openToPartner || p.lookingForPartner);
    })
    .sort((a, b) => sortDir === 'desc' ? b.mmr - a.mmr : a.mmr - b.mmr);

  return (
    <div className="space-y-3">
      <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-0.5 gap-0.5 w-fit">
        <button onClick={() => setView('browse')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${view === 'browse' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <LayoutList size={11}/> Browse
        </button>
        <button onClick={() => setView('ranks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${view === 'ranks' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <BarChart2 size={11}/> Ranks
        </button>
      </div>

      {view === 'ranks' && <RanksView user={user} friends={friends}/>}

      {view === 'browse' && (
        <>
          <FilterBar query={query} setQuery={setQuery} stateFilter={stateFilter} setStateFilter={setStateFilter}
            tierFilter={tierFilter} setTierFilter={setTierFilter} sortDir={sortDir} setSortDir={setSortDir}
            openToPlay={openToPlay} setOpenToPlay={setOpenToPlay}
            openToPartner={openToPartner} setOpenToPartner={setOpenToPartner}/>
          <p className="text-xs text-slate-500">{filtered.length} player{filtered.length !== 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {filtered.map(p => (
              <PlayerCard key={p.uid} player={p} myMMR={user.mmr}
                isFriend={friends.includes(p.uid)}
                isIncoming={incoming.includes(p.uid)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Friends tab ─────────────────────────────────────────────────────────────

function FriendsTab({ user, updateUser, friends, outgoing, incoming, onSend, onCancel, onAccept, onDecline, onRemove }: FriendProps & { updateUser: (p: Partial<UserProfile>) => void }) {
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [query,        setQuery]        = useState('');
  const [stateFilter,  setStateFilter]  = useState<MalaysiaState | 'All'>('All');
  const [tierFilter,   setTierFilter]   = useState<Tier | 'All'>('All');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [openToPlay,     setOpenToPlay]     = useState(false);
  const [openToPartner,  setOpenToPartner]  = useState(false);
  const requestsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!requestsOpen) return;
    function handler(e: MouseEvent) {
      if (requestsRef.current && !requestsRef.current.contains(e.target as Node)) {
        setRequestsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [requestsOpen]);

  const incomingPlayers = PLAYERS.filter(p => incoming.includes(p.uid));
  const outgoingPlayers = PLAYERS.filter(p => outgoing.includes(p.uid));
  const totalRequests = incoming.length + outgoing.length;

  const friendPlayers = PLAYERS
    .filter(p => {
      if (!friends.includes(p.uid)) return false;
      const q = query.toLowerCase();
      return (p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
        && (stateFilter === 'All' || p.state === stateFilter)
        && (tierFilter  === 'All' || p.tier  === tierFilter)
        && (!openToPlay    || p.openToPlay)
        && (!openToPartner || p.lookingForPartner);
    })
    .sort((a, b) => sortDir === 'desc' ? b.mmr - a.mmr : a.mmr - b.mmr);

  const allPlayers = [user, ...PLAYERS];

  const requestsBell = (
    <div className="relative ml-auto" ref={requestsRef}>
      <button onClick={() => setRequestsOpen(o => !o)}
        title="Friend requests"
        className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
          incoming.length > 0
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
        }`}>
        <Bell size={13} className={incoming.length > 0 ? 'text-amber-400' : 'text-slate-500'}/>
        {totalRequests > 0 && (
          <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full leading-none ${incoming.length > 0 ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
            {totalRequests}
          </span>
        )}
      </button>

      {requestsOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-30 overflow-hidden max-h-80 overflow-y-auto">
          {incomingPlayers.length > 0 && (
            <div className="p-3 space-y-2">
              <p className="text-[11px] text-amber-400 font-semibold px-1 flex items-center gap-1">
                <Bell size={10}/> {incomingPlayers.length} incoming
              </p>
              {incomingPlayers.map(p => (
                <div key={p.uid} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                  <Avatar name={p.displayName} className="!w-7 !h-7 !text-xs shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.displayName}</p>
                    <p className="text-[10px] text-slate-500">@{p.username} · {p.mmr} MMR</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onAccept(p.uid)}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                      <Check size={11}/>
                    </button>
                    <button onClick={() => onDecline(p.uid)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      <X size={11} className="text-slate-400"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {incomingPlayers.length > 0 && outgoingPlayers.length > 0 && (
            <div className="border-t border-slate-800"/>
          )}
          {outgoingPlayers.length > 0 && (
            <div className="p-3 space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold px-1">{outgoingPlayers.length} sent</p>
              {outgoingPlayers.map(p => (
                <div key={p.uid} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                  <Avatar name={p.displayName} className="!w-7 !h-7 !text-xs shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.displayName}</p>
                    <p className="text-[10px] text-slate-500">@{p.username}</p>
                  </div>
                  <button onClick={() => onCancel(p.uid)}
                    className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shrink-0">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
          {totalRequests === 0 && (
            <div className="p-5 text-center">
              <p className="text-xs text-slate-500">No pending requests</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Search + filters + requests bell */}
      <FilterBar query={query} setQuery={setQuery} stateFilter={stateFilter} setStateFilter={setStateFilter}
        tierFilter={tierFilter} setTierFilter={setTierFilter} sortDir={sortDir} setSortDir={setSortDir}
        openToPlay={openToPlay} setOpenToPlay={setOpenToPlay}
        openToPartner={openToPartner} setOpenToPartner={setOpenToPartner}
        endSlot={requestsBell}/>

      {/* Friends list */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400">
          Friends <span className="text-slate-600 font-normal">({friends.length})</span>
        </p>
        {friends.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <UserCheck size={28} className="mx-auto text-slate-700"/>
            <p className="text-sm text-slate-400 font-medium">No friends yet</p>
            <p className="text-xs text-slate-600">Go to the Players tab and tap a player to add them.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">{friendPlayers.length} friend{friendPlayers.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {friendPlayers.map(p => (
                <PlayerCard key={p.uid} player={p} myMMR={user.mmr} isFriend={true}/>
              ))}
            </div>
          </>
        )}
      </div>


    </div>
  );
}


// ─── Clubs ────────────────────────────────────────────────────────────────────

function ClubsTab({ clubs, myClubId, myClubPendingIds, joinClub, requestJoinClub, cancelClubRequest, leaveClub, acceptClubMember, declineClubMember, updateClub, disbandClub, assignModerator, removeModerator, userId }: {
  clubs: Club[];
  myClubId: string | null;
  myClubPendingIds: string[];
  userId: string;
  joinClub: (id: string) => void;
  requestJoinClub: (id: string) => void;
  cancelClubRequest: (id: string) => void;
  leaveClub: () => void;
  acceptClubMember: (clubId: string, uid: string) => void;
  declineClubMember: (clubId: string, uid: string) => void;
  updateClub: (id: string, patch: Partial<Club>) => void;
  disbandClub: (id: string) => void;
  assignModerator: (clubId: string, uid: string) => void;
  removeModerator: (clubId: string, uid: string) => void;
}) {
  const [stateFilter,    setStateFilter]    = useState<string>('All');
  const [search,         setSearch]         = useState('');
  const [myClubsOnly,    setMyClubsOnly]    = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  const [announceDraft,  setAnnounceDraft]  = useState('');
  const [announceEdit,   setAnnounceEdit]   = useState<string | null>(null);
  const [disbandConfirm, setDisbandConfirm] = useState(false);
  const [rolesOpen,      setRolesOpen]      = useState(false);

  const states  = ['All', ...Array.from(new Set(clubs.map(c => c.state))).sort()];
  const myClub  = clubs.find(c => c.id === myClubId);

  const isMyClub = (c: Club) => c.id === myClubId || c.adminId === userId || c.memberIds.includes(userId);

  const filtered = clubs.filter(c => {
    const q = search.toLowerCase();
    return (stateFilter === 'All' || c.state === stateFilter) &&
      (c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q)) &&
      (!myClubsOnly || isMyClub(c));
  });

  const copyLink = (clubId: string) => {
    const url = `${window.location.origin}/players/?tab=clubs&id=${clubId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(clubId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveAnnouncement = (clubId: string) => {
    updateClub(clubId, { announcement: announceDraft.trim() || undefined });
    setAnnounceEdit(null);
    setAnnounceDraft('');
  };

  const isOwner = myClub?.adminId === userId;
  const isMod   = myClub ? (myClub.moderatorIds ?? []).includes(userId) : false;
  const canManage = isOwner || isMod;

  return (
    <div className="space-y-4">
      {/* Disband confirmation */}
      {disbandConfirm && myClub && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDisbandConfirm(false)}>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400"/>
              </div>
              <div>
                <p className="font-bold text-sm">Disband {myClub.name}?</p>
                <p className="text-xs text-slate-400 mt-1">This permanently closes the club and removes all {myClub.memberIds.length} members. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDisbandConfirm(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => { disbandClub(myClub.id); setDisbandConfirm(false); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">Disband Club</button>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500">{filtered.length} of {clubs.length} club{clubs.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setMyClubsOnly(o => !o)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors
              ${myClubsOnly
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            <Shield size={10}/> My Clubs
          </button>
        </div>
        {!myClubId && (
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
            <Plus size={13}/> Create Club
          </button>
        )}
      </div>

      {/* My Club summary card */}
      {myClub && (
        <div className="rounded-2xl border border-emerald-500/25 bg-slate-900 overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${myClub.color} flex items-center justify-center font-bold text-white text-lg shrink-0`}>
              {myClub.logoInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm">{myClub.name}</p>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">My Club</span>
                {isOwner && (
                  <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-semibold">
                    <Crown size={9}/> Owner
                  </span>
                )}
                {!isOwner && isMod && (
                  <span className="flex items-center gap-1 text-[10px] bg-violet-500/15 text-violet-400 border border-violet-500/25 px-1.5 py-0.5 rounded-full font-semibold">
                    <ShieldCheck size={9}/> Moderator
                  </span>
                )}
                {myClub.isPrivate ? <Lock size={10} className="text-violet-400"/> : <Globe size={10} className="text-slate-500"/>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {myClub.memberIds.length}/{myClub.maxMembers} members · Avg {myClub.avgMMR.toLocaleString()} MMR
                {myClub.minMMR && ` · Min ${myClub.minMMR.toLocaleString()} MMR`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <button onClick={() => copyLink(myClub.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[11px] font-medium transition-colors">
                {copiedId === myClub.id ? <><CheckCheck size={11} className="text-emerald-400"/> Copied</> : <><Copy size={11}/> Share</>}
              </button>
              {isOwner && (
                <>
                  <button onClick={() => setRolesOpen(o => !o)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 text-violet-400 rounded-xl text-[11px] font-medium transition-colors">
                    <ShieldCheck size={11}/> Roles
                  </button>
                  <button onClick={() => setDisbandConfirm(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-[11px] font-medium transition-colors">
                    <Trash2 size={11}/> Disband
                  </button>
                </>
              )}
              {!isOwner && (
                <button onClick={leaveClub}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-[11px] font-medium transition-colors">
                  <Leave size={11}/> Leave
                </button>
              )}
            </div>
          </div>

          {/* Role management panel — owner only */}
          {isOwner && rolesOpen && (
            <div className="border-t border-slate-800 px-4 py-3 space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 mb-2">
                <ShieldCheck size={11} className="text-violet-400"/> Assign Moderator Rights
              </p>
              <p className="text-[10px] text-slate-500 mb-2">Moderators can accept/decline join requests and post announcements.</p>
              {myClub.memberIds.filter(uid => uid !== userId).length === 0 ? (
                <p className="text-xs text-slate-600 italic">No other members yet.</p>
              ) : (
                myClub.memberIds.filter(uid => uid !== userId).map(uid => {
                  const isModerator = (myClub.moderatorIds ?? []).includes(uid);
                  return (
                    <div key={uid} className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-300 font-medium">@{uid}</p>
                        {isModerator && (
                          <span className="text-[9px] bg-violet-500/15 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            <ShieldCheck size={8}/> Mod
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => isModerator ? removeModerator(myClub.id, uid) : assignModerator(myClub.id, uid)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          isModerator
                            ? 'bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                            : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}>
                        {isModerator ? 'Remove Mod' : 'Make Mod'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Admin/mod panel — pending requests */}
          {canManage && myClub.pendingIds.length > 0 && (
            <div className="border-t border-slate-800 px-4 py-3 space-y-2">
              <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                <Clock size={11}/> {myClub.pendingIds.length} join request{myClub.pendingIds.length !== 1 ? 's' : ''}
              </p>
              {myClub.pendingIds.map(uid => (
                <div key={uid} className="flex items-center justify-between gap-2 bg-slate-800 rounded-xl px-3 py-2">
                  <p className="text-xs text-slate-300 font-medium">@{uid}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => acceptClubMember(myClub.id, uid)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors">Accept</button>
                    <button onClick={() => declineClubMember(myClub.id, uid)}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-[11px] font-medium transition-colors">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Announcement — owner or mod */}
          <div className="border-t border-slate-800 px-4 py-3">
            {announceEdit === myClub.id ? (
              <div className="space-y-2">
                <textarea value={announceDraft} onChange={e => setAnnounceDraft(e.target.value)} rows={2}
                  placeholder="Post an announcement to your club members…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 transition-colors resize-none"/>
                <div className="flex gap-2">
                  <button onClick={() => saveAnnouncement(myClub.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors">Post</button>
                  <button onClick={() => setAnnounceEdit(null)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition-colors">Cancel</button>
                </div>
              </div>
            ) : myClub.announcement ? (
              <div className="flex items-start gap-2">
                <Megaphone size={12} className="text-amber-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-slate-300 flex-1 leading-relaxed">{myClub.announcement}</p>
                {canManage && (
                  <button onClick={() => { setAnnounceEdit(myClub.id); setAnnounceDraft(myClub.announcement ?? ''); }}
                    className="text-slate-500 hover:text-slate-300 shrink-0"><Settings size={12}/></button>
                )}
              </div>
            ) : canManage ? (
              <button onClick={() => { setAnnounceEdit(myClub.id); setAnnounceDraft(''); }}
                className="text-[11px] text-slate-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                <Megaphone size={11}/> Post an announcement
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Search + state filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clubs…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-slate-500"/>
          <FilterDropdown<string>
            icon={<MapPin size={11} className="text-emerald-400"/>}
            label="All States" value={stateFilter}
            options={states.map(s => ({ value: s, label: s === 'All' ? 'All States' : s }))}
            onChange={setStateFilter}
          />
        </div>
      </div>

      {/* Club cards */}
      <div className="space-y-3">
        {filtered.map(club => {
          const isMine    = club.id === myClubId;
          const isPending = myClubPendingIds.includes(club.id);
          const hasClub   = myClubId !== null;
          const isExpanded= expandedId === club.id;
          const full      = club.memberIds.length >= club.maxMembers;

          return (
            <div key={club.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors
              ${isMine ? 'border-emerald-500/30' : 'border-slate-800'}`}>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl ${club.color} flex items-center justify-center font-bold text-white text-sm shrink-0`}>
                    {club.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-sm">{club.name}</p>
                      {club.isPrivate
                        ? <Lock size={10} className="text-violet-400"/>
                        : <Globe size={10} className="text-slate-500"/>}
                      <span className="text-[9px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">{club.purpose}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {club.area}, {club.state} · Est. {club.foundedYear}
                    </p>
                  </div>

                  {isMine ? null : isPending ? (
                    <button onClick={() => cancelClubRequest(club.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-xl text-[11px] font-medium transition-colors shrink-0">
                      <Clock size={11}/> Pending · Cancel
                    </button>
                  ) : full ? (
                    <span className="text-[10px] text-slate-600 shrink-0 pt-1">Club Full</span>
                  ) : hasClub ? (
                    <span className="text-[10px] text-slate-600 shrink-0 pt-1">Already in a club</span>
                  ) : club.isPrivate ? (
                    <button onClick={() => requestJoinClub(club.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[11px] font-semibold transition-colors shrink-0">
                      <UserPlus size={11}/> Request
                    </button>
                  ) : (
                    <button onClick={() => joinClub(club.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold transition-colors shrink-0">
                      <UserPlus size={11}/> Join
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{club.description}</p>

                {isMine && club.announcement && (
                  <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
                    <Megaphone size={11} className="text-amber-400 shrink-0 mt-0.5"/>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">{club.announcement}</p>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users size={11}/>
                      {club.memberIds.length}/{club.maxMembers}
                      {full && <span className="text-red-400 font-semibold ml-1">Full</span>}
                    </span>
                    <span className="flex items-center gap-1"><Trophy size={11}/> {club.avgMMR.toLocaleString()} MMR avg</span>
                    {club.minMMR && <span className="flex items-center gap-1 text-amber-400/80">Min {club.minMMR.toLocaleString()}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => copyLink(club.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-400 transition-colors">
                      {copiedId === club.id ? <><CheckCheck size={10} className="text-emerald-400"/> Copied</> : <><Copy size={10}/> Share</>}
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : club.id)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                      {isExpanded ? 'Less ▲' : 'More ▼'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {club.tags.map(t => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400">{t}</span>
                  ))}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-800 px-4 py-3 space-y-3">
                  {club.topPlayers.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold mb-1.5">Top Players</p>
                      <div className="flex gap-2 flex-wrap">
                        {club.topPlayers.map(p => (
                          <span key={p} className="text-[11px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg text-slate-300">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>🏠 {club.area}, {club.state}</span>
                    <span>📅 Est. {club.foundedYear}</span>
                    <span>🎯 {club.purpose}</span>
                    <span>{club.isPrivate ? '🔒 Private' : '🌐 Public'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!myClubId && !createOpen && (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-slate-500">Don't see your club? Create one.</p>
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-colors">
            <Plus size={14}/> Create Club
          </button>
        </div>
      )}

      {createOpen && <CreateClubModal onClose={() => setCreateOpen(false)}/>}
    </div>
  );
}
