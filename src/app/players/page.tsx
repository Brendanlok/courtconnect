'use client';
import { useState, useRef, useEffect } from 'react';
import { PLAYERS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { TIER_STYLE, MY_STATES, COUNTRIES, getCountryByName, maxClubsForTier } from '@/lib/utils';
import {
  Search, MapPin, Filter, Users, Shield, Trophy, UserPlus, LogOut as Leave,
  Plus, Copy, Check, CheckCheck, Lock, Globe, Megaphone, Settings, Clock,
  X, AlertTriangle, TrendingUp, ArrowUp, ArrowDown, Crown, ShieldCheck,
  UserMinus, Trash2, UserCheck, ChevronDown, LayoutList, BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { CreateClubModal } from '@/components/CreateClubModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { MMRInfoModal } from '@/components/MMRInfoModal';
import type { UserProfile, MalaysiaState, Tier, MatchType, Club } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
const TABS = ['Leaderboard', 'Following', 'Clubs'] as const;

export default function PlayersPage() {
  const {
    user, updateUser,
    clubs, myClubIds, joinClub, requestJoinClub, cancelClubRequest, leaveClub,
    myClubPendingIds, acceptClubMember, declineClubMember, updateClub, disbandClub,
    assignModerator, removeModerator,
    following, followPlayer, unfollowPlayer,
  } = useApp();
  const [mmrInfoOpen, setMmrInfoOpen] = useState(false);
  const [tab, setTab] = useState<typeof TABS[number]>(() => {
    if (typeof window === 'undefined') return 'Leaderboard';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'following') return 'Following';
    if (t === 'clubs')     return 'Clubs';
    return 'Leaderboard';
  });

  // Shared filter state — applies to both Players and Friends tabs
  const userCountry = user.country ?? 'Malaysia';
  const userRegion  = user.region ?? user.state ?? '';
  const [query,         setQuery]         = useState('');
  const [countryFilter, setCountryFilter] = useState<string>(userCountry);
  const [regionFilter,  setRegionFilter]  = useState<string>('All');
  const [tierFilter,    setTierFilter]    = useState<Tier | 'All'>('All');
  const [sortKey,       setSortKey]       = useState<SortKey>('mmr');
  const [openToPlay,    setOpenToPlay]    = useState(false);
  const [openToPartner, setOpenToPartner] = useState(false);

  const sharedFilters: PlayerFilters = {
    query, setQuery,
    countryFilter, setCountryFilter,
    regionFilter, setRegionFilter,
    tierFilter, setTierFilter,
    sortKey, setSortKey,
    openToPlay, setOpenToPlay,
    openToPartner, setOpenToPartner,
    userCountry, userRegion,
  };

  // Club-tab filter state (lifted so it renders inline with the tab strip)
  const [clubSearch,      setClubSearch]      = useState('');
  const [clubMyOnly,      setClubMyOnly]      = useState(false);
  const [clubStateFilter, setClubStateFilter] = useState('All');
  const clubStates = ['All', ...Array.from(new Set(clubs.map(c => c.state))).sort()];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-slate-400 text-sm mt-0.5">Find players & clubs</p>
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
            {t === 'Following' && <UserCheck size={13}/>}
            {t === 'Clubs'    && <Shield size={13}/>}
            {t}
          </button>
        ))}
      </div>

      {/* Filters row — player filters for Leaderboard/Following, club filters for Clubs */}
      {tab !== 'Clubs' && <SharedPlayerFilters f={sharedFilters}/>}
      {tab === 'Clubs' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={clubSearch} onChange={e => setClubSearch(e.target.value)}
              placeholder="Search clubs…"
              className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
          </div>
          <FilterDropdown<string>
            icon={<MapPin size={11} className="text-emerald-400"/>}
            label={clubStateFilter === 'All' ? 'All States' : clubStateFilter}
            value={clubStateFilter}
            options={clubStates.map(s => ({ value: s, label: s === 'All' ? 'All States' : s }))}
            onChange={setClubStateFilter}
          />
          <button onClick={() => setClubMyOnly(o => !o)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors
              ${clubMyOnly ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            <Shield size={11}/> My Clubs
          </button>
        </div>
      )}

      <div className={tab !== 'Leaderboard' ? 'hidden' : ''}>
        <PlayersList user={user} following={following} filters={sharedFilters}/>
      </div>
      <div className={tab !== 'Following' ? 'hidden' : ''}>
        <FollowingTab following={following} followPlayer={followPlayer} unfollowPlayer={unfollowPlayer} user={user} filters={sharedFilters}/>
      </div>
      {tab === 'Clubs' && (
        <ClubsTab
          clubs={clubs} myClubIds={myClubIds} clubLimit={maxClubsForTier(user.tier)} myClubPendingIds={myClubPendingIds}
          clubSearch={clubSearch} clubMyOnly={clubMyOnly} clubStateFilter={clubStateFilter}
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

type SortDir = 'desc' | 'asc';
type SortKey = 'mmr' | 'winRate' | 'wins' | 'matches';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'mmr',     label: 'MMR' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'wins',    label: 'Wins' },
  { key: 'matches', label: 'Matches' },
];


// ─── Ranks view (embedded leaderboard) ───────────────────────────────────────

function RankRow({ player: p, rank, isMe, isFollowing, sortKey }: {
  player: UserProfile; rank: number; isMe: boolean; isFollowing: boolean; sortKey: SortKey;
}) {
  const wr = p.stats.totalMatches > 0 ? Math.round((p.stats.wins / p.stats.totalMatches) * 100) : 0;
  const rankColor = rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600/80' : 'text-slate-500';
  const borderClass = isMe ? 'border-emerald-500/30 bg-emerald-500/5' : isFollowing ? 'border-emerald-500/15' : 'border-slate-800 hover:border-slate-700';
  const statLabel = sortKey === 'winRate' ? `${wr}% WR` : sortKey === 'wins' ? `${p.stats.wins}W` : sortKey === 'matches' ? `${p.stats.totalMatches}` : p.mmr.toLocaleString();
  const subLabel  = sortKey === 'mmr' ? 'MMR' : sortKey === 'matches' ? 'played' : '';
  return (
    <Link href={`/players/${p.username}/`}
      className={`flex items-center gap-3 bg-slate-900 border rounded-2xl px-3.5 h-[84px] transition-all hover:-translate-y-0.5 ${borderClass}`}>
      <span className={`text-sm font-bold w-7 shrink-0 text-right ${rankColor}`}>#{rank}</span>
      <Avatar name={p.displayName}/>
      <div className="flex-1 min-w-0">
        {/* Row 1: display name + status badges */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <p className="font-bold text-sm truncate shrink">{p.displayName}</p>
          {isMe && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold shrink-0">You</span>}
          {p.isDummy && <span className="text-[9px] font-bold bg-slate-700 text-slate-500 px-1 py-0.5 rounded shrink-0">DEMO</span>}
          {p.openToPlay && (
            <span title="Open to Play" className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded shrink-0">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Play
            </span>
          )}
          {p.lookingForPartner && (
            <span title="Looking for Partner" className="flex items-center gap-0.5 text-[9px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1 py-0.5 rounded shrink-0">
              <Users size={8}/>Partner
            </span>
          )}
        </div>
        {/* Row 2: @username */}
        <p className="text-[11px] text-slate-500 truncate mt-0.5">@{p.username}</p>
        {/* Row 3: tier + stats */}
        <div className="flex items-center gap-2 mt-1">
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

// ─── Shared filter state type ─────────────────────────────────────────────────

interface PlayerFilters {
  query: string; setQuery: (v: string) => void;
  countryFilter: string; setCountryFilter: (v: string) => void;
  regionFilter: string; setRegionFilter: (v: string) => void;
  tierFilter: Tier | 'All'; setTierFilter: (v: Tier | 'All') => void;
  sortKey: SortKey; setSortKey: (v: SortKey) => void;
  openToPlay: boolean; setOpenToPlay: (v: boolean) => void;
  openToPartner: boolean; setOpenToPartner: (v: boolean) => void;
  userCountry: string; userRegion: string;
}

function SharedPlayerFilters({ f }: { f: PlayerFilters }) {
  const isAllCountries = f.countryFilter === 'All';
  const selectedCountryData = isAllCountries ? null : getCountryByName(f.countryFilter);
  const regionOptions = selectedCountryData?.regions ?? [];
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-1.5 md:flex-wrap">
      {/* Search — full width on mobile, auto on desktop */}
      <div className="relative md:flex-1 md:min-w-[180px] md:max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={f.query} onChange={e => f.setQuery(e.target.value)}
          placeholder="Search by name or @username…"
          className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
      </div>
      {/* All filter chips inline */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <Filter size={13} className="text-slate-500 shrink-0 hidden md:block"/>
        <FilterDropdown<string>
          label={isAllCountries ? '🌏 All Countries' : `${getCountryByName(f.countryFilter).flag} ${f.countryFilter}`}
          value={f.countryFilter}
          defaultValue={f.userCountry}
          options={[
            { value: 'All', label: '🌏 All Countries' },
            { value: f.userCountry, label: `${getCountryByName(f.userCountry).flag} ${f.userCountry}` },
            ...COUNTRIES.filter(c => c.name !== f.userCountry).sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ value: c.name, label: `${c.flag} ${c.name}` })),
          ]}
          onChange={v => { f.setCountryFilter(v); f.setRegionFilter('All'); }}
        />
        {!isAllCountries && regionOptions.length > 0 && (
          <FilterDropdown<string>
            icon={<MapPin size={11} className="text-emerald-400"/>}
            label={f.regionFilter === 'All' ? `All ${selectedCountryData!.regionLabel}s` : f.regionFilter}
            value={f.regionFilter}
            defaultValue="All"
            options={[
              { value: 'All', label: `All ${selectedCountryData!.regionLabel}s` },
              ...(f.countryFilter === f.userCountry && f.userRegion
                ? [{ value: f.userRegion, label: f.userRegion }, ...regionOptions.filter(r => r !== f.userRegion).sort().map(r => ({ value: r, label: r }))]
                : regionOptions.slice().sort().map(r => ({ value: r, label: r }))
              ),
            ]}
            onChange={f.setRegionFilter}
          />
        )}
        <FilterDropdown<Tier | 'All'>
          icon={<span className="text-[11px]">{f.tierFilter !== 'All' ? TIER_STYLE[f.tierFilter].icon : '🏅'}</span>}
          label={f.tierFilter === 'All' ? 'All Tiers' : f.tierFilter}
          value={f.tierFilter}
          options={TIERS.map(t => ({
            value: t, label: t === 'All' ? 'All Tiers' : t,
            prefix: t !== 'All' ? <span className="text-sm">{TIER_STYLE[t].icon}</span> : undefined,
          }))}
          onChange={f.setTierFilter}
        />
        <FilterDropdown<SortKey>
          icon={<BarChart2 size={11} className="text-amber-400"/>}
          label={SORT_OPTIONS.find(o => o.key === f.sortKey)?.label ?? 'MMR'}
          value={f.sortKey}
          options={SORT_OPTIONS.map(o => ({ value: o.key, label: o.label }))}
          onChange={f.setSortKey}
        />
        <button onClick={() => f.setOpenToPlay(!f.openToPlay)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors
            ${f.openToPlay ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${f.openToPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}/>
          Open to Play
        </button>
        <button onClick={() => f.setOpenToPartner(!f.openToPartner)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors
            ${f.openToPartner ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
          <Users size={10} className={f.openToPartner ? 'text-violet-400' : 'text-slate-600'}/>
          Open to Partner
        </button>
      </div>
    </div>
  );
}

// ─── Players list ─────────────────────────────────────────────────────────────

function PlayersList({ user, following, filters }: { user: UserProfile; following: string[]; filters: PlayerFilters }) {
  const { query, countryFilter, regionFilter, tierFilter, sortKey, openToPlay, openToPartner } = filters;
  const winRate = (p: UserProfile) => p.stats.totalMatches > 0 ? p.stats.wins / p.stats.totalMatches : 0;

  const all = [user, ...PLAYERS];
  const ranked = all
    .filter(p => countryFilter === 'All' || (p.country ?? 'Malaysia') === countryFilter)
    .filter(p => regionFilter === 'All' || (p.region ?? p.state ?? '') === regionFilter)
    .filter(p => tierFilter === 'All' || p.tier === tierFilter)
    .filter(p => !openToPlay    || p.openToPlay)
    .filter(p => !openToPartner || p.lookingForPartner)
    .filter(p => {
      const q = query.toLowerCase();
      return !q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortKey === 'winRate') return winRate(b) - winRate(a);
      if (sortKey === 'wins')    return b.stats.wins - a.stats.wins;
      if (sortKey === 'matches') return b.stats.totalMatches - a.stats.totalMatches;
      return b.mmr - a.mmr;
    });

  const meIdx = ranked.findIndex(p => p.uid === 'me');
  return (
    <div className="space-y-2">
      {meIdx >= 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-emerald-400">#{meIdx + 1}</span>
          <span className="text-xs text-slate-400">Your rank in this view</span>
        </div>
      )}
      <p className="text-xs text-slate-500">{ranked.length} player{ranked.length !== 1 ? 's' : ''}</p>
      <div className="space-y-2">
        {ranked.map((p, i) => (
          <RankRow key={p.uid} player={p} rank={i + 1} isMe={p.uid === 'me'} isFollowing={following.includes(p.uid)} sortKey={sortKey}/>
        ))}
      </div>
    </div>
  );
}

// ─── Following tab ────────────────────────────────────────────────────────────

function FollowingTab({ following, followPlayer, unfollowPlayer, user, filters }: {
  following: string[]; followPlayer: (uid: string) => void; unfollowPlayer: (uid: string) => void;
  user: UserProfile; filters: PlayerFilters;
}) {
  const { query, countryFilter, regionFilter, tierFilter, sortKey, openToPlay, openToPartner } = filters;
  const winRate = (p: UserProfile) => p.stats.totalMatches > 0 ? p.stats.wins / p.stats.totalMatches : 0;

  const followedPlayers = PLAYERS
    .filter(p => following.includes(p.uid))
    .filter(p => {
      const q = query.toLowerCase();
      return (!q || p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
        && (countryFilter === 'All' || (p.country ?? 'Malaysia') === countryFilter)
        && (regionFilter === 'All' || (p.region ?? p.state ?? '') === regionFilter)
        && (tierFilter === 'All' || p.tier === tierFilter)
        && (!openToPlay    || p.openToPlay)
        && (!openToPartner || p.lookingForPartner);
    })
    .sort((a, b) => {
      if (sortKey === 'winRate') return winRate(b) - winRate(a);
      if (sortKey === 'wins')    return b.stats.wins - a.stats.wins;
      if (sortKey === 'matches') return b.stats.totalMatches - a.stats.totalMatches;
      return b.mmr - a.mmr;
    });

  // Suggested: not yet followed, similar MMR ±300, not current user
  const suggested = PLAYERS
    .filter(p => !following.includes(p.uid) && Math.abs(p.mmr - user.mmr) <= 300)
    .sort((a, b) => Math.abs(a.mmr - user.mmr) - Math.abs(b.mmr - user.mmr))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {following.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <UserCheck size={28} className="mx-auto text-slate-700"/>
          <p className="text-sm text-slate-400 font-medium">Not following anyone yet</p>
          <p className="text-xs text-slate-600">Visit a player's profile and tap Follow to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400">
            Following <span className="text-slate-600 font-normal">({following.length})</span>
          </p>
          <div className="space-y-2">
            {followedPlayers.map((p, i) => (
              <div key={p.uid} className="relative group">
                <RankRow player={p} rank={i + 1} isMe={false} isFollowing={true} sortKey={filters.sortKey}/>
                <button
                  onClick={e => { e.preventDefault(); unfollowPlayer(p.uid); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-slate-400 rounded-xl text-[11px] font-medium z-10">
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested to follow */}
      {suggested.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400">Suggested</p>
          <div className="space-y-2">
            {suggested.map(p => (
              <div key={p.uid} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-3">
                <Avatar name={p.displayName} photoURL={p.photoURL}/>
                <div className="flex-1 min-w-0">
                  <Link href={`/players/${p.username}/`} className="font-bold text-sm hover:text-emerald-300 transition-colors truncate block">{p.displayName}</Link>
                  <p className="text-[11px] text-slate-500">@{p.username} · {p.mmr.toLocaleString()} MMR</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TierBadge tier={p.tier}/>
                    {p.openToPlay && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">Open to Play</span>}
                  </div>
                </div>
                <button onClick={() => followPlayer(p.uid)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Clubs ────────────────────────────────────────────────────────────────────

function ClubsTab({ clubs, myClubIds, clubLimit, myClubPendingIds, joinClub, requestJoinClub, cancelClubRequest, leaveClub, acceptClubMember, declineClubMember, updateClub, disbandClub, assignModerator, removeModerator, userId, clubSearch, clubMyOnly, clubStateFilter }: {
  clubs: Club[];
  myClubIds: string[];
  clubLimit: number;
  myClubPendingIds: string[];
  userId: string;
  joinClub: (id: string) => void;
  requestJoinClub: (id: string) => void;
  cancelClubRequest: (id: string) => void;
  leaveClub: (id: string) => void;
  acceptClubMember: (clubId: string, uid: string) => void;
  declineClubMember: (clubId: string, uid: string) => void;
  updateClub: (id: string, patch: Partial<Club>) => void;
  disbandClub: (id: string) => void;
  assignModerator: (clubId: string, uid: string) => void;
  removeModerator: (clubId: string, uid: string) => void;
  clubSearch: string;
  clubMyOnly: boolean;
  clubStateFilter: string;
}) {
  const [createOpen,     setCreateOpen]     = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  const [disbandTarget,  setDisbandTarget]  = useState<Club | null>(null);
  const [leaveTarget,    setLeaveTarget]    = useState<Club | null>(null);

  const atCap = myClubIds.length >= clubLimit;

  const isMyClub = (c: Club) => c.memberIds.includes(userId);

  const filtered = clubs
    .filter(c => {
      const q = clubSearch.toLowerCase();
      return (clubStateFilter === 'All' || c.state === clubStateFilter) &&
        (c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q)) &&
        (!clubMyOnly || isMyClub(c));
    })
    // User's clubs always float to top
    .sort((a, b) => {
      const aMe = isMyClub(a) ? 0 : 1;
      const bMe = isMyClub(b) ? 0 : 1;
      return aMe - bMe;
    });

  const copyLink = (clubId: string) => {
    const url = `${window.location.origin}/players/?tab=clubs&id=${clubId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(clubId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Leave club confirmation */}
      {leaveTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setLeaveTarget(null)}>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5"/>
              <div>
                <p className="font-bold text-sm">Leave {leaveTarget.name}?</p>
                <p className="text-xs text-slate-400 mt-1">You will lose access to club chat and member features.</p>
                {leaveTarget.isPrivate && (
                  <p className="text-xs text-amber-400 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    ⚠️ This is a private club — you'll need to send a new join request and get approved again if you want to rejoin.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLeaveTarget(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => { leaveClub(leaveTarget.id); setLeaveTarget(null); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors">Leave Club</button>
            </div>
          </div>
        </div>
      )}

      {/* Disband confirmation */}
      {disbandTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDisbandTarget(null)}>
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400"/>
              </div>
              <div>
                <p className="font-bold text-sm">Disband {disbandTarget.name}?</p>
                <p className="text-xs text-slate-400 mt-1">This permanently closes the club and removes all {disbandTarget.memberIds.length} members. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDisbandTarget(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => { disbandClub(disbandTarget.id); setDisbandTarget(null); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">Disband Club</button>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {filtered.length} of {clubs.length} club{clubs.length !== 1 ? 's' : ''}
          <span className="text-slate-600"> · {myClubIds.length}/{clubLimit} joined</span>
        </p>
        {!atCap && (
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
            <Plus size={13}/> Create Club
          </button>
        )}
      </div>

      {/* Club cards */}
      <div className="space-y-3">
        {filtered.map(club => {
          const isMine    = myClubIds.includes(club.id);
          const isOwner   = club.adminId === userId;
          const isPending = myClubPendingIds.includes(club.id);
          const isExpanded= expandedId === club.id;
          const full      = club.memberIds.length >= club.maxMembers;

          return (
            <div key={club.id}
              onClick={() => { window.location.href = `/clubs/${club.id}/`; }}
              className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors cursor-pointer hover:border-slate-600
              ${isMine ? 'border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] hover:border-emerald-500/60' : 'border-slate-800'}`}>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl ${club.color} flex items-center justify-center font-bold text-white text-sm shrink-0`}>
                    {club.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm">{club.name}</span>
                      {isMine && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">My Club</span>}
                      {isMine && isOwner && (
                        <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-semibold">
                          <Crown size={9}/> Owner
                        </span>
                      )}
                      {club.isDummy && <span className="text-[9px] font-bold bg-slate-700 text-slate-400 px-1 py-0.5 rounded">DEMO</span>}
                      {club.isPrivate
                        ? <Lock size={10} className="text-violet-400"/>
                        : <Globe size={10} className="text-slate-500"/>}
                      <span className="text-[9px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">{club.purpose}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {club.area}, {club.state} · Est. {club.foundedYear}
                    </p>
                  </div>

                  {isMine ? (
                    isOwner ? (
                      <button onClick={e => { e.stopPropagation(); setDisbandTarget(club); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-[11px] font-medium transition-colors shrink-0">
                        <Trash2 size={11}/> Disband
                      </button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setLeaveTarget(club); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-[11px] font-medium transition-colors shrink-0">
                        <Leave size={11}/> Leave
                      </button>
                    )
                  ) : isPending ? (
                    <button onClick={e => { e.stopPropagation(); cancelClubRequest(club.id); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-xl text-[11px] font-medium transition-colors shrink-0">
                      <Clock size={11}/> Pending · Cancel
                    </button>
                  ) : full ? (
                    <span className="text-[10px] text-slate-600 shrink-0 pt-1">Club Full</span>
                  ) : atCap ? (
                    <span className="text-[10px] text-slate-600 shrink-0 pt-1">Club limit reached ({myClubIds.length}/{clubLimit})</span>
                  ) : club.isPrivate ? (
                    <button onClick={e => { e.stopPropagation(); requestJoinClub(club.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-[11px] font-semibold transition-colors shrink-0">
                      <UserPlus size={11}/> Request
                    </button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); joinClub(club.id); }}
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
                    <button onClick={e => { e.stopPropagation(); copyLink(club.id); }}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-400 transition-colors">
                      {copiedId === club.id ? <><CheckCheck size={10} className="text-emerald-400"/> Copied</> : <><Copy size={10}/> Share</>}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : club.id); }}
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

      {!atCap && !createOpen && (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-slate-500">Don't see your club? Create one.</p>
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition-colors">
            <Plus size={14}/> Create Club
          </button>
        </div>
      )}
      {atCap && (
        <p className="text-center text-xs text-slate-600 py-2">
          You've reached your club limit for your tier ({clubLimit}). Climb to a higher tier to join more.
        </p>
      )}

      {createOpen && <CreateClubModal onClose={() => setCreateOpen(false)}/>}
    </div>
  );
}
