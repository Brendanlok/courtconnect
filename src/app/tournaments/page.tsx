'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronDown, ChevronUp, MapPin, Users, Lock, Trophy, Plus, Globe, EyeOff,
         AlertTriangle, X, Filter, Info, Eye } from 'lucide-react';
import { MATCH_TYPE_LABEL, MY_STATES } from '@/lib/utils';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import type { Tournament, BracketMatch, MatchType, MalaysiaState } from '@/types';

type VisFilter = 'All' | 'Public' | 'Private';
type EligFilter = 'All' | 'Eligible';

// Mock Malaysian badminton venue suggestions for autocomplete
const VENUE_SUGGESTIONS = [
  'Sport Planet PJ, No.5 Jalan SS7/19, 47301 Petaling Jaya, Selangor',
  'Sport Planet Sunway, Jalan PJS 11/28A, 47500 Subang Jaya, Selangor',
  'Sport Planet Ampang, Jalan Ampang Utama 2/2, 68000 Ampang, Selangor',
  'Stadium Putra, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Bukit Jalil Sports Complex, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Stadium Badminton Cheras, Jalan Manis 6, 56000 Cheras, Kuala Lumpur',
  'Axiata Arena, Jalan Stadium, 57000 Bukit Jalil, Kuala Lumpur',
  'Stadium Shah Alam, Persiaran Majlis, 40150 Shah Alam, Selangor',
  'Penang Sports Arena, Jalan Batu Uban, 11700 Georgetown, Penang',
  'Komtar Jbcc, Jalan Wong Ah Fook, 80000 Johor Bahru, Johor',
  'Dewan Badminton Kepong, Jalan Kepong, 52100 Kepong, Kuala Lumpur',
  'Stadium Juara, Jalan 3/27B, 40150 Shah Alam, Selangor',
  'Multi Sports Hall USJ, Jalan USJ 10/1A, 47620 Subang Jaya, Selangor',
  'KL Sports City, Jalan Hang Tuah, 55200 Kuala Lumpur',
  'Ipoh Badminton Hall, Jalan Raja Musa Aziz, 30450 Ipoh, Perak',
  'Alor Setar Sports Complex, Jalan Darul Aman, 05100 Alor Setar, Kedah',
  'Kuching Sports Complex, Jalan Stadium, 93350 Kuching, Sarawak',
  'Kota Kinabalu Sports School, Jalan Universititi, 88400 Kota Kinabalu, Sabah',
];

// ─── Participants Modal ────────────────────────────────────────────────────────

function ParticipantsModal({ tournament: t, onClose }: { tournament: Tournament; onClose: () => void }) {
  const participants = t.participants ?? [];
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm">{t.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{participants.length} / {t.maxPlayers} players signed up</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {participants.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No players signed up yet.</p>
          ) : (
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{p.displayName}</span>
                    <span className="text-xs text-slate-500 ml-1.5">@{p.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 pb-4">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width:`${Math.round((participants.length / t.maxPlayers) * 100)}%` }}/>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 text-right">{t.maxPlayers - participants.length} spots remaining</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Tournaments() {
  const { user, tournaments, addTournament, registrations, pendingRequests,
          registerTournament, unregisterTournament, requestToJoin, cancelRequest,
          updateUser, clubs } = useApp();

  const [tab,           setTab]         = useState<'Active'|'Upcoming'|'Completed'>('Active');
  const [visFilter,     setVisFilter]   = useState<VisFilter>('All');
  const [typeFilter,    setTypeFilter]  = useState<'All' | MatchType>('All');
  const [eligFilter,    setEligFilter]  = useState<EligFilter>('All');
  const [myEventsOnly,  setMyEventsOnly]= useState(false);
  const [hostOpen,      setHostOpen]    = useState(false);
  const [regTarget,     setRegTarget]   = useState<Tournament | null>(null);
  const [unregTarget,   setUnregTarget] = useState<Tournament | null>(null);
  const [viewParticipants, setViewParticipants] = useState<Tournament | null>(null);

  const isPenalty = (t: Tournament) => {
    const msUntil = new Date(t.date).getTime() - Date.now();
    return t.status === 'Active' || msUntil < 12 * 3600 * 1000;
  };

  const isMyEvent = (t: Tournament) =>
    t.hostUid === 'me' || t.organiser === user.displayName || !!registrations[t.id];

  const list = tournaments
    .filter(t => t.status === tab)
    .filter(t => visFilter === 'All' ? true : visFilter === 'Private' ? t.isPrivate : !t.isPrivate)
    .filter(t => typeFilter === 'All' || t.type === typeFilter)
    .filter(t => {
      if (eligFilter === 'All') return true;
      if (t.minMMR && user.mmr < t.minMMR) return false;
      if (t.maxMMR && user.mmr > t.maxMMR) return false;
      return true;
    })
    .filter(t => !myEventsOnly || isMyEvent(t))
    // hosted by user floats to top
    .sort((a, b) => {
      const aHost = isMyEvent(a);
      const bHost = isMyEvent(b);
      return (bHost ? 1 : 0) - (aHost ? 1 : 0);
    });

  const TABS = ['Active', 'Upcoming', 'Completed'] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-slate-400 text-sm mt-0.5">🇲🇾 Malaysia</p>
        </div>
        <button onClick={() => setHostOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors">
          <Plus size={14}/> Host
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t}
            <span className="ml-1.5 text-xs opacity-50">({tournaments.filter(x => x.status === t).length})</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-slate-500 shrink-0"/>
        <FilterDropdown<VisFilter>
          icon={<Globe size={11}/>}
          label="Visibility"
          value={visFilter}
          options={[
            { value: 'All',     label: 'All Events' },
            { value: 'Public',  label: 'Public',  prefix: <Globe size={11}/> },
            { value: 'Private', label: 'Private', prefix: <EyeOff size={11}/> },
          ]}
          onChange={setVisFilter}
        />
        <FilterDropdown<'All' | MatchType>
          label="Format"
          value={typeFilter}
          options={[
            { value: 'All', label: 'All Formats' },
            { value: 'MS',  label: "MS · Men's Singles" },
            { value: 'WS',  label: "WS · Women's Singles" },
            { value: 'MD',  label: "MD · Men's Doubles" },
            { value: 'WD',  label: "WD · Women's Doubles" },
            { value: 'MX',  label: 'MX · Mixed Doubles' },
          ]}
          onChange={setTypeFilter}
        />
        <FilterDropdown<EligFilter>
          label="Eligibility"
          value={eligFilter}
          options={[
            { value: 'All',      label: 'All MMR Levels' },
            { value: 'Eligible', label: 'Eligible for Me' },
          ]}
          onChange={setEligFilter}
        />
        <button
          onClick={() => setMyEventsOnly(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
            ${myEventsOnly
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
          <Trophy size={11}/> My Events
        </button>
      </div>

      {list.length === 0 && (
        <div className="text-center py-16 text-slate-500">No {tab.toLowerCase()} events match your filter.</div>
      )}

      <div className="space-y-3">
        {list.map(t => (
          <TournamentRow key={t.id} tournament={t} myMMR={user.mmr}
            myDisplayName={user.displayName}
            isRegistered={!!registrations[t.id]}
            isPending={!!pendingRequests[t.id]}
            onRegister={() => setRegTarget(t)}
            onUnregister={() => setUnregTarget(t)}
            onRequest={() => requestToJoin(t.id)}
            onCancelRequest={() => cancelRequest(t.id)}
            onViewParticipants={() => setViewParticipants(t)}
            myClubs={clubs.filter(c => c.adminId === 'me' || (c.moderatorIds ?? []).includes('me'))}/>
        ))}
      </div>

      {/* Modals */}
      {hostOpen && (
        <HostModal onClose={() => setHostOpen(false)} onSubmit={t => { addTournament(t); setHostOpen(false); }}/>
      )}
      {regTarget && (
        <RegisterWarningModal tournament={regTarget}
          onClose={() => setRegTarget(null)}
          onConfirm={() => { registerTournament(regTarget.id); setRegTarget(null); }}/>
      )}
      {unregTarget && (
        <UnregisterModal tournament={unregTarget} isPenalty={isPenalty(unregTarget)}
          onClose={() => setUnregTarget(null)}
          onConfirm={() => {
            if (isPenalty(unregTarget)) updateUser({ mmr: Math.max(0, user.mmr - 25) });
            unregisterTournament(unregTarget.id);
            setUnregTarget(null);
          }}/>
      )}
      {viewParticipants && (
        <ParticipantsModal tournament={viewParticipants} onClose={() => setViewParticipants(null)}/>
      )}
    </div>
  );
}

// ─── Tournament row ────────────────────────────────────────────────────────────

function TournamentRow({ tournament: t, myMMR, myDisplayName, isRegistered, isPending, onRegister, onUnregister, onRequest, onCancelRequest, onViewParticipants, myClubs }: {
  tournament: Tournament; myMMR: number; myDisplayName: string;
  isRegistered: boolean; isPending: boolean;
  onRegister: () => void; onUnregister: () => void;
  onRequest: () => void; onCancelRequest: () => void;
  onViewParticipants: () => void;
  myClubs: import('@/types').Club[];
}) {
  const [expanded, setExpanded] = useState(false);
  const spotsLeft   = t.maxPlayers - t.currentPlayers;
  const locked      = !!(t.minMMR && myMMR < t.minMMR) || !!(t.maxMMR && myMMR > t.maxMMR);
  const isFull      = spotsLeft <= 0 && !isRegistered;
  const fillPct     = Math.round((t.currentPlayers / t.maxPlayers) * 100);
  const isMyTourney = t.hostUid === 'me' || t.organiser === myDisplayName;
  // Can see full details if: public, or user is registered/host
  const canSeeDetails = !t.isPrivate || isRegistered || isMyTourney;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all
      ${isMyTourney
        ? 'bg-amber-500/5 border-amber-500/40'
        : t.status === 'Active'
          ? 'bg-slate-900 border-emerald-500/30'
          : 'bg-slate-900 border-slate-800'}`}>

      {/* Header row — always same layout across all tabs */}
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-slate-800/40 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="shrink-0">
          {t.status === 'Active'    && <span className="w-2 h-2 bg-emerald-400 rounded-full block animate-pulse"/>}
          {t.status === 'Upcoming'  && <span className="w-2 h-2 bg-amber-400 rounded-full block"/>}
          {t.status === 'Completed' && <span className="w-2 h-2 bg-slate-500 rounded-full block"/>}
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: name + visibility + format */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm">{t.name}</p>
            {t.isDummy && <span className="text-[9px] font-bold bg-slate-700 text-slate-400 px-1 py-0.5 rounded">DEMO</span>}
            {isMyTourney && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md shrink-0 font-semibold">Hosting</span>
            )}
            {isRegistered && !isMyTourney && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-md shrink-0 font-semibold">Joined</span>
            )}
            {t.isPrivate
              ? <span className="flex items-center gap-0.5 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md shrink-0"><EyeOff size={8}/> Private</span>
              : <span className="flex items-center gap-0.5 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md shrink-0"><Globe size={8}/> Public</span>}
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md shrink-0 font-semibold">{t.type}</span>
          </div>
          {/* Row 2: venue, date, players */}
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-0.5"><MapPin size={9}/> {canSeeDetails ? `${t.venue.split(',')[0]}, ${t.state}` : t.state}</span>
            <span>·</span>
            <span>{new Date(t.date).toLocaleDateString('en-MY', {day:'numeric',month:'short',year:'numeric'})}{t.time ? ` · ${t.time}` : ''}</span>
            {canSeeDetails && <><span>·</span><span className="flex items-center gap-0.5"><Users size={9}/> {t.currentPlayers}/{t.maxPlayers}</span></>}
          </p>
        </div>

        <div className="text-right shrink-0">
          {t.prizePool > 0
            ? <p className="text-sm font-bold text-amber-400">RM {t.prizePool.toLocaleString()}</p>
            : <p className="text-sm font-bold text-emerald-400">Free</p>}
          {t.entryFee > 0 && <p className="text-[10px] text-slate-500">RM {t.entryFee} entry</p>}
        </div>

        <span className="text-slate-500 shrink-0">
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          {/* Private gate for non-participants */}
          {!canSeeDetails ? (
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
              <EyeOff size={16} className="text-slate-500 shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-slate-300">Private Event</p>
                <p className="text-xs text-slate-500 mt-0.5">Details are only visible to registered participants and the host.</p>
              </div>
              {t.status === 'Upcoming' && !isMyTourney && (
                <div className="ml-auto shrink-0">
                  {isPending ? (
                    <button onClick={e => { e.stopPropagation(); onCancelRequest(); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-colors">
                      ⏳ Pending · Cancel
                    </button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); onRequest(); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                      <Plus size={11}/> Request to Join
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {t.description && <p className="text-sm text-slate-300 leading-relaxed">{t.description}</p>}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Detail label="Format"    value={`${t.type} · ${MATCH_TYPE_LABEL[t.type]}`}/>
                <Detail label="Players"   value={`${t.currentPlayers}/${t.maxPlayers}`}/>
                <Detail label="MMR Range" value={t.minMMR || t.maxMMR
                  ? `${t.minMMR?.toLocaleString() ?? '0'} – ${t.maxMMR?.toLocaleString() ?? '∞'}`
                  : 'Open'}/>
                <Detail label="Organiser" value={t.organiser ?? '—'}/>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Capacity</span>
                  <span>{t.status === 'Completed' ? 'Completed' : isFull ? 'Full' : `${spotsLeft} spots left`}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.status === 'Completed' ? 'bg-slate-500' : isFull ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width:`${fillPct}%` }}/>
                </div>
              </div>

              {/* Participants row — all statuses */}
              <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Users size={14} className="text-slate-400"/>
                  <span><span className="font-semibold text-white">{t.currentPlayers}</span> player{t.currentPlayers !== 1 ? 's' : ''} {t.status === 'Completed' ? 'participated' : 'signed up'}</span>
                </div>
                {t.currentPlayers > 0 && (
                  <button onClick={e => { e.stopPropagation(); onViewParticipants(); }}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                    <Eye size={13}/> View
                  </button>
                )}
              </div>

              {t.prizePool > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-1.5 rounded-xl">🥇 RM {Math.round(t.prizePool * 0.6)}</span>
                  <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-xl">🥈 RM {Math.round(t.prizePool * 0.3)}</span>
                  <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-xl">🥉 RM {Math.round(t.prizePool * 0.1)}</span>
                </div>
              )}

              {/* Bracket — Active and Completed */}
              {t.bracket && (t.status === 'Active' || t.status === 'Completed') && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">
                    {t.status === 'Active' ? 'Live Bracket' : 'Final Bracket'}
                  </p>
                  <BracketView bracket={t.bracket}/>
                </div>
              )}

              {/* Action buttons — Upcoming only */}
              {t.status === 'Upcoming' && (
                <div className="flex gap-2">
                  {isRegistered ? (
                    <button onClick={e => { e.stopPropagation(); onUnregister(); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-700 text-slate-300 hover:bg-red-500/15 hover:text-red-400 transition-colors">
                      ✓ Registered · Withdraw
                    </button>
                  ) : locked ? (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-slate-800 text-slate-500 cursor-not-allowed">
                      <Lock size={13}/>
                      {t.minMMR && myMMR < t.minMMR ? `Need ${t.minMMR.toLocaleString()} MMR min` : `Exceed ${t.maxMMR?.toLocaleString()} MMR max`}
                    </div>
                  ) : isFull ? (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-slate-800 text-slate-500 cursor-not-allowed">Full</div>
                  ) : isPending ? (
                    <button onClick={e => { e.stopPropagation(); onCancelRequest(); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 transition-colors">
                      ⏳ Request Pending · Cancel
                    </button>
                  ) : t.isPrivate ? (
                    <button onClick={e => { e.stopPropagation(); onRequest(); }}
                      className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                      <Plus size={13}/> Request to Join
                    </button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); onRegister(); }}
                      className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                      Register Now
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ─── Register Warning Modal ────────────────────────────────────────────────────

function RegisterWarningModal({ tournament: t, onClose, onConfirm }: {
  tournament: Tournament; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-bold">Confirm Registration</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="font-semibold text-sm">{t.name}</p>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <MapPin size={10}/>{t.venue.split(',')[0]} · {new Date(t.date).toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}
            </p>
            {t.entryFee > 0 && <p className="text-xs text-amber-400 mt-1 font-semibold">Entry fee: RM {t.entryFee}</p>}
          </div>

          <div className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5"/>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-amber-300">Commitment required</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  By registering, you commit to attending this event. You may withdraw at any time up until <span className="font-semibold text-white">12 hours before the event starts</span> with no penalty.
                </p>
                <p className="text-xs text-red-400 font-semibold leading-relaxed">
                  Withdrawing within 12 hours of the event start will result in a <span className="font-bold">−25 MMR penalty</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors">
              I Understand — Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Unregister / Penalty Modal ────────────────────────────────────────────────

function UnregisterModal({ tournament: t, isPenalty, onClose, onConfirm }: {
  tournament: Tournament; isPenalty: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-bold">Withdraw from Event</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="font-semibold text-sm">{t.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString('en-MY',{day:'numeric',month:'short',year:'numeric'})}</p>
          </div>

          {isPenalty ? (
            <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-4 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-semibold text-red-300">Late withdrawal penalty</p>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    This event starts within 12 hours (or is already active). Withdrawing now will deduct <span className="font-bold text-red-400">25 MMR</span> from your rating.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Are you sure you want to withdraw? Your spot will be freed up for other players.</p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
              Keep my spot
            </button>
            <button onClick={onConfirm}
              className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors ${isPenalty ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
              {isPenalty ? 'Withdraw (−25 MMR)' : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Venue autocomplete ────────────────────────────────────────────────────────

function VenueInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSugg, setShowSugg]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowSugg(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (v.length >= 2) {
      const q = v.toLowerCase();
      const matches = VENUE_SUGGESTIONS.filter(s => s.toLowerCase().includes(q)).slice(0, 5);
      setSuggestions(matches);
      setShowSugg(matches.length > 0);
    } else {
      setShowSugg(false);
    }
  };

  const pick = (s: string) => { onChange(s); setShowSugg(false); };

  return (
    <div className="relative" ref={ref}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0 && value.length >= 2) setShowSugg(true); }}
        placeholder="e.g. Sport Planet, No.5 Jalan SS7/19, 47301 Petaling Jaya"
        className={className}
      />
      {showSugg && (
        <div className="absolute top-full mt-1 left-0 right-0 z-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <p className="text-[10px] text-slate-500 px-3 pt-2 pb-1 font-semibold uppercase tracking-wide flex items-center gap-1">
            <MapPin size={9}/> Suggested venues
          </p>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700/50">
              <span className="font-medium text-white">{s.split(',')[0]}</span>
              <span className="text-slate-400">{s.substring(s.indexOf(','))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Host Event Modal ─────────────────────────────────────────────────────────

function HostModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (t: Tournament) => void }) {
  const { user, clubs } = useApp();

  // Clubs where user is owner or moderator — can host on behalf of club
  const myKeyClubs = clubs.filter(c => c.adminId === 'me' || (c.moderatorIds ?? []).includes('me'));

  const [name,       setName]       = useState('');
  const [type,       setType]       = useState<MatchType>('MS');
  const [date,       setDate]       = useState('');
  const [time,       setTime]       = useState('');
  const [venue,      setVenue]      = useState('');
  const [state,      setState]      = useState<MalaysiaState>(user.state);
  const [maxPlayers, setMaxPlayers] = useState<8|16|32>(16);
  const [entryFee,   setEntryFee]   = useState('');
  const [prize,      setPrize]      = useState('');
  const [minMMR,     setMinMMR]     = useState('');
  const [maxMMR,     setMaxMMR]     = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [visInfoOpen,setVisInfoOpen]= useState(false);
  const [desc,       setDesc]       = useState('');
  // 'me' = individual, otherwise = club id
  const [hostAs,     setHostAs]     = useState<'me' | string>('me');

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';

  const hostingClub = myKeyClubs.find(c => c.id === hostAs);

  const submit = () => {
    if (!name.trim() || !date || !venue.trim()) return;
    const t: Tournament = {
      id: `t_${Date.now()}`,
      name: name.trim(),
      type, date, time: time || undefined,
      venue: venue.trim(), state,
      status: 'Upcoming',
      prizePool:      prize      ? Number(prize)      : 0,
      entryFee:       entryFee   ? Number(entryFee)   : 0,
      minMMR:         minMMR     ? Number(minMMR)      : undefined,
      maxMMR:         maxMMR     ? Number(maxMMR)      : undefined,
      maxPlayers,     currentPlayers: 0,
      isPrivate,
      organiser:      hostingClub ? hostingClub.name : user.displayName,
      hostUid:        'me',
      description:    desc.trim() || undefined,
      tags: [MATCH_TYPE_LABEL[type], isPrivate ? 'Private' : 'Open'],
      participants: [],
    };
    onSubmit(t);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-400"/>
            <h2 className="font-bold">Host an Event</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {/* Host As — only shown for club key members */}
          {myKeyClubs.length > 0 && (
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">Host As</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setHostAs('me')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                    ${hostAs === 'me' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                  Individual
                </button>
                {myKeyClubs.map(c => (
                  <button key={c.id} onClick={() => setHostAs(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                      ${hostAs === c.id ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                    <div className={`w-3.5 h-3.5 rounded ${c.color} flex items-center justify-center text-[8px] font-bold text-white`}>{c.logoInitials?.[0]}</div>
                    {c.name}
                  </button>
                ))}
              </div>
              {hostingClub && (
                <p className="text-[10px] text-amber-400/80 mt-1.5">
                  This event will be listed under <span className="font-semibold">{hostingClub.name}</span>. You remain the host.
                </p>
              )}
            </div>
          )}

          {/* Name */}
          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Event Name *</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PJ Open 2025" className={`mt-1 ${inp}`}/>
          </label>

          {/* Format + Visibility — side by side, same height */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Format *</span>
              <select value={type} onChange={e => setType(e.target.value as MatchType)} className={`mt-1 ${inp}`}>
                {(['MS','WS','MD','WD','MX'] as MatchType[]).map(t => (
                  <option key={t} value={t}>{MATCH_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] text-slate-500 font-semibold">Visibility</span>
                <button type="button" onClick={() => setVisInfoOpen(o => !o)}
                  className="text-slate-600 hover:text-slate-400 transition-colors">
                  <Info size={12}/>
                </button>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-slate-700">
                <button onClick={() => setIsPrivate(false)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors
                    ${!isPrivate ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  <Globe size={11}/> Public
                </button>
                <button onClick={() => setIsPrivate(true)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors
                    ${isPrivate ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  <EyeOff size={11}/> Private
                </button>
              </div>
              {visInfoOpen && (
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-1.5 text-xs text-slate-300">
                  <p><span className="text-white font-semibold">Public</span> — Anyone who meets the MMR requirements can register directly.</p>
                  <p><span className="text-white font-semibold">Private</span> — Players must send a join request. You review and approve each one.</p>
                </div>
              )}
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Date *</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Start Time</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={`mt-1 ${inp}`}/>
            </label>
          </div>

          {/* Venue with autocomplete + State */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2">
              <span className="text-[11px] text-slate-500 font-semibold">
                Venue Address * <span className="text-slate-600 font-normal">— start typing for suggestions</span>
              </span>
              <VenueInput value={venue} onChange={setVenue} className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">State</span>
              <select value={state} onChange={e => setState(e.target.value as MalaysiaState)} className={`mt-1 ${inp}`}>
                {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {/* Capacity + Entry fee + Prize */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Max Players</span>
              <select value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value) as 8|16|32)} className={`mt-1 ${inp}`}>
                {[8,16,32].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Entry (RM)</span>
              <input type="number" min={0} value={entryFee} onChange={e => setEntryFee(e.target.value)} placeholder="0" className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Prize Pool (RM)</span>
              <input type="number" min={0} value={prize} onChange={e => setPrize(e.target.value)} placeholder="0" className={`mt-1 ${inp}`}/>
            </label>
          </div>

          {/* MMR limits */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Min MMR (optional)</span>
              <input type="number" min={0} value={minMMR} onChange={e => setMinMMR(e.target.value)} placeholder="No limit" className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Max MMR (optional)</span>
              <input type="number" min={0} value={maxMMR} onChange={e => setMaxMMR(e.target.value)} placeholder="No limit" className={`mt-1 ${inp}`}/>
            </label>
          </div>

          {/* Description */}
          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Description (optional)</span>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Format, rules, notes for participants…"
              className={`mt-1 ${inp} resize-none`}/>
          </label>
        </div>

        <div className="px-5 pb-5 flex gap-3 shrink-0 border-t border-slate-800 pt-4">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={!name.trim() || !date || !venue.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded-xl text-sm font-bold transition-colors">
            <Trophy size={14}/> Create Event
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bracket tree (Active / live only) ────────────────────────────────────────

const CARD_H   = 72;
const CARD_W   = 180;
const BASE_GAP = 12;
const CONN_W   = 36;

function roundGap(ri: number): number {
  return ri === 0 ? BASE_GAP : CARD_H + 2 * roundGap(ri - 1);
}

function roundTopPad(ri: number): number {
  if (ri === 0) return 0;
  const prevGap = roundGap(ri - 1);
  const prevPad = roundTopPad(ri - 1);
  const f1 = prevPad + CARD_H / 2;
  const f2 = f1 + CARD_H + prevGap;
  return (f1 + f2) / 2 - CARD_H / 2;
}

function BracketView({ bracket }: { bracket: BracketMatch[] }) {
  const rounds      = [...new Set(bracket.map(b => b.round))].sort();
  const byRound     = rounds.map(r => bracket.filter(b => b.round === r));
  const r1Count     = byRound[0]?.length ?? 1;
  const totalH      = r1Count * CARD_H + (r1Count - 1) * BASE_GAP;
  const ROUND_LABELS = ['QF', 'SF', 'Final', 'R4', 'R5'];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex mb-2">
        {byRound.map((_, ri) => (
          <div key={ri} className="flex items-center">
            <div style={{ width: CARD_W }} className="text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {ROUND_LABELS[rounds[ri] - 1] ?? `R${rounds[ri]}`}
              </span>
            </div>
            {ri < byRound.length - 1 && <div style={{ width: CONN_W }}/>}
          </div>
        ))}
      </div>

      <div className="flex" style={{ height: totalH }}>
        {byRound.map((matches, ri) => {
          const pad  = roundTopPad(ri);
          const gap  = roundGap(ri);
          const isLast = ri === byRound.length - 1;
          return (
            <div key={ri} className="flex items-start shrink-0">
              <div className="flex flex-col shrink-0" style={{ paddingTop: pad, gap }}>
                {matches.map(m => <BracketCard key={m.id} match={m}/>)}
              </div>
              {!isLast && (
                <svg width={CONN_W} height={totalH} className="shrink-0 overflow-visible">
                  {Array.from({ length: Math.ceil(matches.length / 2) }).map((_, i) => {
                    const m1Y = pad + i * 2 * (CARD_H + gap) + CARD_H / 2;
                    const m2Y = m1Y + CARD_H + gap;
                    const midY = (m1Y + m2Y) / 2;
                    const cx = CONN_W / 2;
                    const color = '#334155';
                    return (
                      <g key={i}>
                        <line x1={0}  y1={m1Y}  x2={cx}     y2={m1Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={0}  y1={m2Y}  x2={cx}     y2={m2Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={cx} y1={m1Y}  x2={cx}     y2={m2Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={cx} y1={midY} x2={CONN_W} y2={midY} stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketCard({ match: m }: { match: BracketMatch }) {
  const isLive = !m.winner && !!m.player1 && m.player1 !== 'TBD' && !!m.player2 && m.player2 !== 'TBD';
  return (
    <div style={{ width: CARD_W, height: CARD_H }}
      className={`rounded-xl overflow-hidden border text-sm flex flex-col
        ${isLive ? 'border-amber-500/50' : m.winner ? 'border-slate-700' : 'border-slate-800/80'}`}>
      {[m.player1, m.player2].map((name, i) => (
        <div key={i} className={`flex-1 px-3 flex items-center justify-between border-b last:border-0 border-slate-800
          ${name === m.winner ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
            : !name || name === 'TBD' ? 'text-slate-600' : 'text-slate-300'}`}>
          <span className="truncate text-xs">{name || 'TBD'}</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {m.score && name === m.winner && (
              <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{m.score}</span>
            )}
            {isLive && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"/>}
          </div>
        </div>
      ))}
    </div>
  );
}
