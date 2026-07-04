'use client';
import { useState } from 'react';
import { PLAYERS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { TIER_STYLE, MY_STATES, skillMatch, MATCH_TYPE_LABEL, formatAvailability } from '@/lib/utils';
import {
  Search, MapPin, Filter, Users, Shield, Trophy, UserPlus, LogOut as Leave,
  Plus, Copy, Check, CheckCheck, Lock, Globe, Megaphone, Settings, Clock,
  X, AlertTriangle, TrendingUp, ArrowUp, ArrowDown, Crown, ShieldCheck,
  UserMinus, Trash2, UserCheck, UserX, Bell,
} from 'lucide-react';
import Link from 'next/link';
import { CreateClubModal } from '@/components/CreateClubModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { MMRInfoModal } from '@/components/MMRInfoModal';
import type { UserProfile, MalaysiaState, Tier, MatchType, Club } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
const TABS = ['Players', 'Partner Finder', 'Clubs'] as const;
const PLAYER_SUBTABS = ['All Players', 'Friends'] as const;

export default function Players() {
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
    if (t === 'partner') return 'Partner Finder';
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
            {t === 'Partner Finder' && <Users size={13}/>}
            {t === 'Clubs'          && <Shield size={13}/>}
            {t}
          </button>
        ))}
      </div>

      {tab === 'Players' && (
        <PlayersSection
          user={user}
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
      {tab === 'Partner Finder' && <PartnerFinder user={user} updateUser={updateUser}/>}
      {tab === 'Clubs'          && (
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

// ─── Players section (All + Friends subtabs) ──────────────────────────────────

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

function PlayersSection(props: FriendProps) {
  const [subtab, setSubtab] = useState<typeof PLAYER_SUBTABS[number]>('All Players');
  const { friends, incoming } = props;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-0.5 w-fit">
        {PLAYER_SUBTABS.map(st => (
          <button key={st} onClick={() => setSubtab(st)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors
              ${subtab === st ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {st === 'Friends' && <UserCheck size={11}/>}
            {st}
            {st === 'Friends' && friends.length > 0 && (
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{friends.length}</span>
            )}
            {st === 'Friends' && incoming.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{incoming.length}</span>
            )}
          </button>
        ))}
      </div>

      {subtab === 'All Players' && <PlayersList {...props}/>}
      {subtab === 'Friends'     && <FriendsList {...props}/>}
    </div>
  );
}

// ─── All Players list ─────────────────────────────────────────────────────────

type SortDir = 'desc' | 'asc';

function PlayersList({ user, friends, outgoing, incoming, onSend, onCancel, onAccept, onDecline, onRemove }: FriendProps) {
  const [query,       setQuery]      = useState('');
  const [stateFilter, setStateFilter] = useState<MalaysiaState | 'All'>('All');
  const [tierFilter,  setTierFilter]  = useState<Tier | 'All'>('All');
  const [sortDir,     setSortDir]    = useState<SortDir>('desc');

  const filtered = PLAYERS
    .filter(p => {
      const q = query.toLowerCase();
      return (p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
        && (stateFilter === 'All' || p.state === stateFilter)
        && (tierFilter  === 'All' || p.tier  === tierFilter);
    })
    .sort((a, b) => sortDir === 'desc' ? b.mmr - a.mmr : a.mmr - b.mmr);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or @username…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={13} className="text-slate-500"/>
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
              value: t,
              label: t === 'All' ? 'All Tiers' : t,
              prefix: t !== 'All' ? <span className="text-sm">{TIER_STYLE[t].icon}</span> : undefined,
            }))}
            onChange={setTierFilter}
          />
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors">
            {sortDir === 'desc' ? <ArrowDown size={11} className="text-amber-400"/> : <ArrowUp size={11} className="text-amber-400"/>}
            MMR {sortDir === 'desc' ? 'High → Low' : 'Low → High'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">{filtered.length} player{filtered.length !== 1 ? 's' : ''} found</p>

      <div className="space-y-2">
        {filtered.map(p => (
          <PlayerRow key={p.uid} player={p} myMMR={user.mmr}
            isFriend={friends.includes(p.uid)}
            isOutgoing={outgoing.includes(p.uid)}
            isIncoming={incoming.includes(p.uid)}
            onSend={onSend} onCancel={onCancel}
            onAccept={onAccept} onDecline={onDecline} onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({ player: p, myMMR, isFriend, isOutgoing, isIncoming, onSend, onCancel, onAccept, onDecline, onRemove }: {
  player: UserProfile; myMMR: number;
  isFriend: boolean; isOutgoing: boolean; isIncoming: boolean;
  onSend: (uid: string) => void; onCancel: (uid: string) => void;
  onAccept: (uid: string) => void; onDecline: (uid: string) => void; onRemove: (uid: string) => void;
}) {
  const sm = skillMatch(myMMR, p.mmr);
  const smColor = sm >= 80 ? 'text-emerald-400' : sm >= 60 ? 'text-amber-400' : 'text-red-400';
  const smBar   = sm >= 80 ? 'bg-emerald-500'   : sm >= 60 ? 'bg-amber-500'   : 'bg-red-500';
  const wr = Math.round((p.stats.wins / Math.max(p.stats.totalMatches, 1)) * 100);

  return (
    <div className={`flex items-center gap-3 bg-slate-900 border rounded-2xl px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md
      ${isIncoming ? 'border-amber-500/30' : isFriend ? 'border-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}`}>
      <Link href={`/players/${p.username}`} className="flex items-center gap-4 flex-1 min-w-0">
        <Avatar name={p.displayName}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{p.displayName}</p>
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
            <span className="mx-1">·</span>#{p.globalRank} National
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
          <span className="text-[10px] text-slate-500 font-medium">Skill Match</span>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${smBar} rounded-full`} style={{ width:`${sm}%` }}/>
            </div>
            <span className={`text-xs font-bold shrink-0 ${smColor}`}>{sm}%</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-amber-400">{p.mmr.toLocaleString()}</p>
          <p className="text-xs text-slate-500">{p.stats.wins}W · {wr}% WR</p>
        </div>
      </Link>

      {/* Friend action area */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {isIncoming ? (
          <>
            <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1"><Bell size={9}/> Sent you a request</p>
            <div className="flex gap-1">
              <button onClick={() => onAccept(p.uid)}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors">
                <Check size={10}/> Accept
              </button>
              <button onClick={() => onDecline(p.uid)}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-[11px] font-medium transition-colors">
                <X size={10}/> Decline
              </button>
            </div>
          </>
        ) : isFriend ? (
          <button onClick={() => onRemove(p.uid)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 rounded-xl text-[11px] font-semibold transition-colors">
            <UserCheck size={12}/> Friends
          </button>
        ) : isOutgoing ? (
          <button onClick={() => onCancel(p.uid)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 rounded-xl text-[11px] font-semibold transition-colors">
            <Clock size={12}/> Requested
          </button>
        ) : (
          <button onClick={() => onSend(p.uid)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 hover:border-emerald-500/30 hover:text-emerald-400 text-slate-400 rounded-xl text-[11px] font-semibold transition-colors">
            <UserPlus size={12}/> Add Friend
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Friends list ─────────────────────────────────────────────────────────────

function FriendsList({ user, friends, incoming, onAccept, onDecline, onRemove }: FriendProps) {
  const allPlayers = PLAYERS;
  const friendPlayers = allPlayers.filter(p => friends.includes(p.uid));
  const incomingPlayers = allPlayers.filter(p => incoming.includes(p.uid));

  return (
    <div className="space-y-5">
      {/* Incoming requests section */}
      {incomingPlayers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
            <Bell size={11}/> {incomingPlayers.length} Friend Request{incomingPlayers.length !== 1 ? 's' : ''}
          </p>
          {incomingPlayers.map(p => (
            <div key={p.uid} className="flex items-center gap-3 bg-slate-900 border border-amber-500/25 rounded-2xl px-4 py-3">
              <Link href={`/players/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar name={p.displayName}/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.displayName}</p>
                  <p className="text-xs text-slate-500">@{p.username} · <TierBadge tier={p.tier} className="inline-flex text-[10px]"/></p>
                </div>
                <p className="text-sm font-bold text-amber-400 shrink-0">{p.mmr.toLocaleString()}</p>
              </Link>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onAccept(p.uid)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
                  <Check size={11}/> Accept
                </button>
                <button onClick={() => onDecline(p.uid)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium transition-colors">
                  <X size={11}/> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accepted friends */}
      {friendPlayers.length === 0 && incomingPlayers.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <UserCheck size={32} className="mx-auto text-slate-700"/>
          <p className="text-sm text-slate-400 font-medium">No friends yet</p>
          <p className="text-xs text-slate-600">Go to All Players and tap Add Friend to send a request.</p>
        </div>
      ) : friendPlayers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{friendPlayers.length} friend{friendPlayers.length !== 1 ? 's' : ''}</p>
          {friendPlayers.map(p => {
            const sm = skillMatch(user.mmr, p.mmr);
            const smColor = sm >= 80 ? 'text-emerald-400' : sm >= 60 ? 'text-amber-400' : 'text-red-400';
            const smBar   = sm >= 80 ? 'bg-emerald-500'   : sm >= 60 ? 'bg-amber-500'   : 'bg-red-500';
            const wr = Math.round((p.stats.wins / Math.max(p.stats.totalMatches, 1)) * 100);
            return (
              <div key={p.uid} className="flex items-center gap-3 bg-slate-900 border border-emerald-500/20 rounded-2xl px-4 py-3.5 transition-all hover:-translate-y-0.5">
                <Link href={`/players/${p.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar name={p.displayName}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{p.displayName}</p>
                      <p className="text-xs text-slate-500">@{p.username}</p>
                      <TierBadge tier={p.tier}/>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {p.area}, {p.state}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
                    <span className="text-[10px] text-slate-500 font-medium">Skill Match</span>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${smBar} rounded-full`} style={{ width:`${sm}%` }}/>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${smColor}`}>{sm}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-amber-400">{p.mmr.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{p.stats.wins}W · {wr}% WR</p>
                  </div>
                </Link>
                <button onClick={() => onRemove(p.uid)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border bg-slate-800 border-slate-700 text-slate-500 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-colors"
                  title="Remove friend">
                  <UserMinus size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Partner Finder ───────────────────────────────────────────────────────────

function PartnerFinder({ user, updateUser }: { user: UserProfile; updateUser: (p: Partial<UserProfile>) => void }) {
  const partnerFormats: ('All' | MatchType)[] =
    user.gender === 'Male'   ? ['All', 'MD', 'MX'] :
    user.gender === 'Female' ? ['All', 'WD', 'MX'] :
    ['All', 'MD', 'WD', 'MX'];

  const [formatFilter, setFormatFilter] = useState<'All' | MatchType>('All');
  const [sent, setSent] = useState<string[]>([]);
  const [confirmSend,    setConfirmSend]    = useState<string | null>(null);
  const [confirmRetract, setConfirmRetract] = useState<string | null>(null);

  const allPlayers = [user, ...PLAYERS];

  const candidates = allPlayers.filter(p => {
    if (p.uid === 'me') return false;
    if (!p.lookingForPartner) return false;
    if (formatFilter === 'All') return true;
    if (formatFilter === 'MD') return p.gender === 'Male'   && (p.preferredFormats ?? []).includes('MD');
    if (formatFilter === 'WD') return p.gender === 'Female' && (p.preferredFormats ?? []).includes('WD');
    return (p.preferredFormats ?? []).includes(formatFilter);
  });

  const sendRequest    = (uid: string) => setSent(prev => [...prev, uid]);
  const retractRequest = (uid: string) => setSent(prev => prev.filter(id => id !== uid));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${user.openToPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}/>
            <span className={`text-sm ${user.openToPlay ? 'text-emerald-300' : 'text-slate-400'}`}>Open to Play</span>
          </div>
          <button onClick={() => {
            const next = !user.openToPlay;
            updateUser({ openToPlay: next, ...(!next ? { lookingForPartner: false } : {}) });
          }} className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${user.openToPlay ? 'bg-emerald-500' : 'bg-slate-600'}`}>
            <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${user.openToPlay ? 'translate-x-5' : 'translate-x-0'}`}/>
          </button>
        </div>

        <div className={`flex items-center justify-between px-4 py-2.5 bg-slate-900 border rounded-xl transition-opacity
          ${user.openToPlay ? 'border-slate-800 opacity-100' : 'border-slate-800/50 opacity-40 pointer-events-none'}`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${user.lookingForPartner ? 'bg-violet-400 animate-pulse' : 'bg-slate-600'}`}/>
            <div>
              <span className={`text-sm ${user.lookingForPartner ? 'text-violet-300' : 'text-slate-400'}`}>Open to Partner</span>
              {!user.openToPlay && <p className="text-[10px] text-slate-600">Requires Open to Play</p>}
            </div>
          </div>
          <button onClick={() => {
            const next = !user.lookingForPartner;
            updateUser({ lookingForPartner: next, ...(next ? { openToPlay: true } : {}) });
          }} className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${user.lookingForPartner ? 'bg-violet-500' : 'bg-slate-600'}`}>
            <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${user.lookingForPartner ? 'translate-x-5' : 'translate-x-0'}`}/>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={13} className="text-slate-500"/>
        <FilterDropdown<'All' | MatchType>
          label="All Formats" value={formatFilter}
          options={partnerFormats.map(f => ({ value: f, label: f === 'All' ? 'All Formats' : `${f} · ${MATCH_TYPE_LABEL[f]}` }))}
          onChange={setFormatFilter}
        />
      </div>

      <p className="text-xs text-slate-500">{candidates.length} player{candidates.length !== 1 ? 's' : ''} looking for a partner</p>

      {confirmSend && (() => {
        const p = allPlayers.find(x => x.uid === confirmSend);
        if (!p) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirmSend(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <UserPlus size={18} className="text-emerald-400"/>
                </div>
                <div>
                  <p className="font-bold text-sm">Send Partner Request?</p>
                  <p className="text-xs text-slate-400 mt-1">
                    You're sending a doubles partner request to <span className="text-white font-semibold">{p.displayName}</span>. They'll be notified and can accept or decline.
                  </p>
                </div>
                <button onClick={() => setConfirmSend(null)} className="text-slate-500 hover:text-white shrink-0"><X size={15}/></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSend(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button onClick={() => { sendRequest(confirmSend); setConfirmSend(null); }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors">Send Request</button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmRetract && (() => {
        const p = allPlayers.find(x => x.uid === confirmRetract);
        if (!p) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirmRetract(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-amber-400"/>
                </div>
                <div>
                  <p className="font-bold text-sm">Retract Request?</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This will cancel your partner request to <span className="text-white font-semibold">{p.displayName}</span>.
                  </p>
                </div>
                <button onClick={() => setConfirmRetract(null)} className="text-slate-500 hover:text-white shrink-0"><X size={15}/></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRetract(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Keep It</button>
                <button onClick={() => { retractRequest(confirmRetract); setConfirmRetract(null); }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">Retract</button>
              </div>
            </div>
          </div>
        );
      })()}

      {candidates.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No players found for this format.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(p => {
            const dm = p.disciplineMMR ?? {};
            const dmEntries = (Object.entries(dm) as [string,number][]).filter(([,v]) => v != null);
            const isSent = sent.includes(p.uid);
            const avail = formatAvailability(p.available ?? '');

            return (
              <div key={p.uid} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => { window.location.href = `/players/${p.username}/`; }} className="shrink-0">
                    <Avatar name={p.displayName} className={`${p.openToPlay ? 'ring-2 ring-emerald-400' : ''} hover:opacity-80 transition-opacity`}/>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => { window.location.href = `/players/${p.username}/`; }}
                        className="font-semibold text-sm hover:text-emerald-400 transition-colors">{p.displayName}</button>
                      <p className="text-xs text-slate-500">@{p.username}</p>
                      <TierBadge tier={p.tier}/>
                      {p.gender && <span className="text-xs text-slate-500">{p.gender === 'Male' ? '♂' : '♀'}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {p.area}, {p.state}
                      {p.distKm !== undefined && <><span className="mx-1">·</span>{p.distKm} km away</>}
                    </p>
                    {p.bio && <p className="text-xs text-slate-400 mt-1">{p.bio}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isSent ? (
                      <button onClick={() => setConfirmRetract(p.uid)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400">
                        <Check size={12}/> Request Sent
                      </button>
                    ) : (
                      <button onClick={() => setConfirmSend(p.uid)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white">
                        <UserPlus size={12}/> Send Request
                      </button>
                    )}
                    {isSent && <p className="text-[9px] text-slate-500">Tap to retract</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(p.preferredFormats ?? []).map(f => (
                    <span key={f} className="text-[10px] font-semibold px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">{f}</span>
                  ))}
                  {dmEntries.map(([type, val]) => (
                    <span key={type} className="text-[10px] font-semibold px-2 py-1 bg-amber-500/8 border border-amber-500/20 rounded-lg text-amber-400">
                      {type} {val.toLocaleString()}
                    </span>
                  ))}
                </div>

                {avail && (
                  <p className="text-xs text-slate-500 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">🕐</span> {avail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [createOpen,     setCreateOpen]     = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  const [announceDraft,  setAnnounceDraft]  = useState('');
  const [announceEdit,   setAnnounceEdit]   = useState<string | null>(null);
  const [disbandConfirm, setDisbandConfirm] = useState(false);
  const [rolesOpen,      setRolesOpen]      = useState(false);

  const states  = ['All', ...Array.from(new Set(clubs.map(c => c.state))).sort()];
  const myClub  = clubs.find(c => c.id === myClubId);

  const filtered = clubs.filter(c => {
    const q = search.toLowerCase();
    return (stateFilter === 'All' || c.state === stateFilter) &&
      (c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q));
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{clubs.length} club{clubs.length !== 1 ? 's' : ''} in Malaysia</p>
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
