'use client';
import { useState } from 'react';
import { PLAYERS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { TIER_STYLE, MY_STATES, skillMatch, MATCH_TYPE_LABEL, formatAvailability } from '@/lib/utils';
import { Search, MapPin, Filter, Users, Shield, Trophy, UserPlus, LogOut as Leave, Plus, Copy, Check, CheckCheck, Lock, Globe, Megaphone, Settings, Clock } from 'lucide-react';
import Link from 'next/link';
import { CreateClubModal } from '@/components/CreateClubModal';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import type { UserProfile, MalaysiaState, Tier, MatchType, Club } from '@/types';

const TIERS: (Tier | 'All')[] = ['All','Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
const TABS = ['Players', 'Partner Finder', 'Clubs'] as const;

export default function Players() {
  const { user, updateUser, clubs, myClubId, joinClub, requestJoinClub, cancelClubRequest, leaveClub, myClubPendingIds, acceptClubMember, declineClubMember, updateClub } = useApp();
  const [tab, setTab] = useState<typeof TABS[number]>(() => {
    if (typeof window === 'undefined') return 'Players';
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'partner') return 'Partner Finder';
    if (t === 'clubs')   return 'Clubs';
    return 'Players';
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-slate-400 text-sm mt-0.5">Find players across 🇲🇾 Malaysia</p>
      </div>

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

      {tab === 'Players'        && <PlayersList user={user}/>}
      {tab === 'Partner Finder' && <PartnerFinder user={user} updateUser={updateUser}/>}
      {tab === 'Clubs'          && <ClubsTab clubs={clubs} myClubId={myClubId} myClubPendingIds={myClubPendingIds} joinClub={joinClub} requestJoinClub={requestJoinClub} cancelClubRequest={cancelClubRequest} leaveClub={leaveClub} acceptClubMember={acceptClubMember} declineClubMember={declineClubMember} updateClub={updateClub} userId={user.uid}/>}
    </div>
  );
}

// ─── Players list ─────────────────────────────────────────────────────────────

function PlayersList({ user }: { user: UserProfile }) {
  const [query,      setQuery]       = useState('');
  const [stateFilter,setStateFilter] = useState<MalaysiaState | 'All'>('All');
  const [tierFilter, setTierFilter]  = useState<Tier | 'All'>('All');

  const allPlayers = [user, ...PLAYERS];

  const filtered = allPlayers.filter(p => {
    const q = query.toLowerCase();
    const nameMatch  = p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
    const stateMatch = stateFilter === 'All' || p.state === stateFilter;
    const tierMatch  = tierFilter  === 'All' || p.tier  === tierFilter;
    return nameMatch && stateMatch && tierMatch;
  });

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
        </div>
      </div>

      <p className="text-xs text-slate-500">{filtered.length} player{filtered.length !== 1 ? 's' : ''} found</p>

      <div className="space-y-2">
        {filtered.map(p => <PlayerRow key={p.uid} player={p} myMMR={user.mmr} isMe={p.uid === 'me'} />)}
      </div>
    </div>
  );
}

function PlayerRow({ player: p, myMMR, isMe }: { player: UserProfile; myMMR: number; isMe: boolean }) {
  const sm = skillMatch(myMMR, p.mmr);
  const smColor = sm >= 80 ? 'text-emerald-400' : sm >= 60 ? 'text-amber-400' : 'text-red-400';
  const smBar   = sm >= 80 ? 'bg-emerald-500'   : sm >= 60 ? 'bg-amber-500'   : 'bg-red-500';
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
      {!isMe && (
        <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
          <span className="text-[10px] text-slate-500 font-medium">Skill Match</span>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${smBar} rounded-full`} style={{ width:`${sm}%` }}/>
            </div>
            <span className={`text-xs font-bold shrink-0 ${smColor}`}>{sm}%</span>
          </div>
        </div>
      )}
      <div className="text-right shrink-0">
        <p className="text-base font-bold text-amber-400">{p.mmr.toLocaleString()}</p>
        <p className="text-xs text-slate-500">{p.stats.wins}W · {wr}% WR</p>
      </div>
    </Link>
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

  const allPlayers = [user, ...PLAYERS];

  const candidates = allPlayers.filter(p => {
    if (p.uid === 'me') return false;
    if (!p.lookingForPartner) return false;
    if (formatFilter === 'All') return true;
    if (formatFilter === 'MD') return p.gender === 'Male'   && (p.preferredFormats ?? []).includes('MD');
    if (formatFilter === 'WD') return p.gender === 'Female' && (p.preferredFormats ?? []).includes('WD');
    return (p.preferredFormats ?? []).includes(formatFilter);
  });

  const sendRequest = (uid: string) => setSent(prev => [...prev, uid]);

  return (
    <div className="space-y-4">
      {/* Linked toggles: Open to Play + Open to Partner */}
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

      {/* Format filter — gender-aware */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-slate-500"/>
        <FilterDropdown<'All' | MatchType>
          label="All Formats" value={formatFilter}
          options={partnerFormats.map(f => ({ value: f, label: f === 'All' ? 'All Formats' : `${f} · ${MATCH_TYPE_LABEL[f]}` }))}
          onChange={setFormatFilter}
        />
      </div>

      <p className="text-xs text-slate-500">{candidates.length} player{candidates.length !== 1 ? 's' : ''} looking for a partner</p>

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
                      {p.gender && (
                        <span className="text-xs text-slate-500">{p.gender === 'Male' ? '♂' : '♀'}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {p.area}, {p.state}
                      {p.distKm !== undefined && <><span className="mx-1">·</span>{p.distKm} km away</>}
                    </p>
                    {p.bio && <p className="text-xs text-slate-400 mt-1">{p.bio}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => sendRequest(p.uid)} disabled={isSent}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors
                        ${isSent
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default'
                          : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white'}`}>
                      {isSent ? <><Check size={12}/> Request Sent</> : 'Send Request'}
                    </button>
                    {!isSent && <p className="text-[9px] text-slate-600">Sends a partner request</p>}
                  </div>
                </div>

                {/* Formats + MMR */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(p.preferredFormats ?? []).map(f => (
                    <span key={f} className="text-[10px] font-semibold px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                      {f}
                    </span>
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

function ClubsTab({ clubs, myClubId, myClubPendingIds, joinClub, requestJoinClub, cancelClubRequest, leaveClub, acceptClubMember, declineClubMember, updateClub, userId }: {
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
}) {
  const [stateFilter,   setStateFilter]   = useState<string>('All');
  const [search,        setSearch]        = useState('');
  const [createOpen,    setCreateOpen]    = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [copiedId,      setCopiedId]      = useState<string | null>(null);
  const [announceDraft, setAnnounceDraft] = useState('');
  const [announceEdit,  setAnnounceEdit]  = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
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
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">{myClub.name}</p>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold">My Club</span>
                {myClub.isPrivate ? <Lock size={10} className="text-violet-400"/> : <Globe size={10} className="text-slate-500"/>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {myClub.memberIds.length}/{myClub.maxMembers} members · Avg {myClub.avgMMR.toLocaleString()} MMR
                {myClub.minMMR && ` · Min ${myClub.minMMR.toLocaleString()} MMR`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => copyLink(myClub.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[11px] font-medium transition-colors">
                {copiedId === myClub.id ? <><CheckCheck size={11} className="text-emerald-400"/> Copied</> : <><Copy size={11}/> Share</>}
              </button>
              {myClub.adminId !== userId && (
                <button onClick={leaveClub}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-[11px] font-medium transition-colors">
                  <Leave size={11}/> Leave
                </button>
              )}
            </div>
          </div>

          {/* Admin panel — pending requests */}
          {myClub.adminId === userId && myClub.pendingIds.length > 0 && (
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

          {/* Announcement */}
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
                {myClub.adminId === userId && (
                  <button onClick={() => { setAnnounceEdit(myClub.id); setAnnounceDraft(myClub.announcement ?? ''); }}
                    className="text-slate-500 hover:text-slate-300 shrink-0"><Settings size={12}/></button>
                )}
              </div>
            ) : myClub.adminId === userId ? (
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
          const isMine     = club.id === myClubId;
          const isPending  = myClubPendingIds.includes(club.id);
          const hasClub    = myClubId !== null;
          const isExpanded = expandedId === club.id;
          const isAdmin    = club.adminId === userId;
          const full       = club.memberIds.length >= club.maxMembers;
          const meetsMMR   = !club.minMMR; // in real app would check user MMR

          return (
            <div key={club.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors
              ${isMine ? 'border-emerald-500/30' : 'border-slate-800'}`}>
              {/* Main row */}
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

                  {/* Action button */}
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

              {/* Expanded detail */}
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
