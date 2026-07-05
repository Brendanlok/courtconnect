'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { LogMatchModal } from '@/components/LogMatchModal';
import {
  CalendarDays, Plus, MapPin, Clock, Check, X, UserPlus,
  Swords, Trophy, Search, Edit3, Trash2, Bell, User,
} from 'lucide-react';
import type { UserProfile, MatchType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlannedStatus = 'pending' | 'confirmed' | 'cancelled';

interface SlotPlayer {
  uid: string;
  displayName: string;
  username: string;
  gender?: 'Male' | 'Female';
}

interface PlannedMatch {
  id: string;
  format: MatchType;
  date: string;
  time: string;
  venue: string;
  notes?: string;
  // team A = organiser's team, team B = opponents
  teamA: (SlotPlayer | null)[];
  teamB: (SlotPlayer | null)[];
  // accepted / declined per uid
  accepted: string[];
  declined: string[];
  status: PlannedStatus;
}

const FORMAT_LABELS: Record<MatchType, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  MX: "Mixed Doubles",
};

const FORMATS: MatchType[] = ['MS', 'WS', 'MD', 'WD', 'MX'];

// Gender required for each slot: null = any
function slotGender(format: MatchType, team: 'A' | 'B', slot: number): 'Male' | 'Female' | null {
  if (format === 'MD') return 'Male';
  if (format === 'WD') return 'Female';
  if (format === 'MS') return null;  // already filtered by user's gender in practice
  if (format === 'WS') return null;
  // MX: each team needs 1 male + 1 female; slot 0 = first gender, slot 1 = second
  // For team A slot 0: pick based on user gender; for simplicity alternate
  return null;
}

function slotsForFormat(format: MatchType): { teamSize: number } {
  return { teamSize: format === 'MS' || format === 'WS' ? 1 : 2 };
}

// For MX, slot genders depend on user's gender
function getMXSlotGender(userGender: 'Male' | 'Female' | undefined, team: 'A' | 'B', slotIdx: number): 'Male' | 'Female' | null {
  if (!userGender) return null;
  // Team A slot 0 = user (already filled), slot 1 = opposite gender
  if (team === 'A') return slotIdx === 1 ? (userGender === 'Male' ? 'Female' : 'Male') : null;
  // Team B: slot 0 = Male, slot 1 = Female (or one of each)
  return slotIdx === 0 ? 'Male' : 'Female';
}

function getSlotGender(format: MatchType, team: 'A' | 'B', slotIdx: number, userGender?: 'Male' | 'Female'): 'Male' | 'Female' | null {
  if (format === 'MD') return 'Male';
  if (format === 'WD') return 'Female';
  if (format === 'MX') return getMXSlotGender(userGender, team, slotIdx);
  return null; // MS / WS — no gender constraint enforced
}

const SEED_PLANNED: PlannedMatch[] = [
  {
    id: 'pm1',
    format: 'MD',
    date: '2026-07-08',
    time: '19:00',
    venue: 'Setia Alam Sports Complex',
    notes: 'Bring shuttlecocks',
    teamA: [null, null],
    teamB: [
      { uid: 'p3', displayName: 'Faiz Hamdan', username: 'faizhamdan', gender: 'Male' },
      null,
    ],
    accepted: ['p3'],
    declined: [],
    status: 'pending',
  },
  {
    id: 'pm2',
    format: 'MS',
    date: '2026-07-12',
    time: '08:00',
    venue: 'Bukit Jalil National Aquatic Centre',
    teamA: [null],
    teamB: [
      { uid: 'p1', displayName: 'Zack Azhar', username: 'zackaz', gender: 'Male' },
    ],
    accepted: ['p1'],
    declined: [],
    status: 'confirmed',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const { user, matches } = useApp();
  const [tab,      setTab]      = useState<'history' | 'planned'>('planned');
  const [planned,  setPlanned]  = useState<PlannedMatch[]>(SEED_PLANNED);
  const [logOpen,  setLogOpen]  = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const myMatches = matches.filter(m =>
    m.player1Id === 'me' || m.player2Id === 'me' ||
    m.player1PartnerId === 'me' || m.player2PartnerId === 'me'
  );

  const me: SlotPlayer = {
    uid: 'me',
    displayName: user.displayName,
    username: user.username,
    gender: user.gender,
  };

  const openPlan = (id?: string) => { setEditId(id ?? null); setPlanOpen(true); };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track, plan, and log your games</p>
        </div>
        <button onClick={() => openPlan()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0 mt-1">
          <Plus size={13}/> Plan Match
        </button>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('planned')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${tab === 'planned' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <CalendarDays size={13}/> Planned
          {planned.filter(m => m.status === 'pending').length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {planned.filter(m => m.status === 'pending').length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${tab === 'history' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <Swords size={13}/> History
        </button>
      </div>

      {tab === 'planned' && (
        <div className="space-y-3">
          {planned.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={32} className="text-slate-700"/>}
              title="No planned matches"
              desc="Tap Plan Match to schedule a game with friends."
              action={<button onClick={() => openPlan()} className="text-xs text-emerald-400 font-semibold">+ Plan your first match</button>}
            />
          ) : (
            planned.map(m => (
              <PlannedCard key={m.id} match={m} me={me}
                onEdit={() => openPlan(m.id)}
                onLog={() => setLogOpen(true)}
                onDelete={() => setDeleteId(m.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {myMatches.length === 0 ? (
            <EmptyState
              icon={<Swords size={32} className="text-slate-700"/>}
              title="No matches logged yet"
              desc="Log a match after playing to track your progress."
              action={
                <button onClick={() => setLogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium transition-colors">
                  <Plus size={12}/> Log a match
                </button>
              }
            />
          ) : (
            myMatches.map(m => <MatchHistoryCard key={m.id} match={m}/>)
          )}
        </div>
      )}

      {logOpen && <LogMatchModal open={true} onClose={() => setLogOpen(false)}/>}

      {planOpen && (
        <PlanMatchModal
          existing={planned.find(p => p.id === editId) ?? null}
          me={me}
          onSave={pm => {
            setPlanned(prev => editId
              ? prev.map(p => p.id === editId ? pm : p)
              : [pm, ...prev]);
            setPlanOpen(false);
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-sm">Remove this planned match?</p>
            <p className="text-xs text-slate-400">This will cancel the match and remove all invites.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Keep</button>
              <button onClick={() => { setPlanned(p => p.filter(m => m.id !== deleteId)); setDeleteId(null); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-14 space-y-3">
      <div className="flex justify-center">{icon}</div>
      <p className="text-sm font-semibold text-slate-400">{title}</p>
      <p className="text-xs text-slate-600">{desc}</p>
      {action && <div className="flex justify-center pt-1">{action}</div>}
    </div>
  );
}

function GenderDot({ gender }: { gender?: 'Male' | 'Female' | null }) {
  if (!gender) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${gender === 'Male' ? 'bg-sky-500/15 text-sky-400' : 'bg-pink-500/15 text-pink-400'}`}>
      {gender === 'Male' ? '♂' : '♀'}
    </span>
  );
}

// ─── Planned match card ───────────────────────────────────────────────────────

function PlannedCard({ match: m, me, onEdit, onLog, onDelete }: {
  match: PlannedMatch; me: SlotPlayer;
  onEdit: () => void; onLog: () => void; onDelete: () => void;
}) {
  const dateObj = new Date(m.date + 'T' + m.time);
  const isPast  = dateObj < new Date();
  const dateStr = dateObj.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
  const borderClass = m.status === 'confirmed' ? 'border-emerald-500/25' : m.status === 'cancelled' ? 'border-red-500/20 opacity-60' : 'border-slate-800';

  const allInvited = [...m.teamA, ...m.teamB].filter((s): s is SlotPlayer => s !== null && s.uid !== 'me');

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden ${borderClass}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold">{FORMAT_LABELS[m.format]}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                m.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                : m.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/25'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
              }`}>{m.status === 'confirmed' ? 'Confirmed' : m.status === 'cancelled' ? 'Cancelled' : 'Pending'}</span>
              {isPast && m.status !== 'cancelled' && <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">Past</span>}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays size={10}/> {dateStr} · {m.time}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {m.venue}</p>
            {m.notes && <p className="text-[11px] text-slate-500 italic">{m.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Edit3 size={13}/></button>
            <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"><Trash2 size={13}/></button>
          </div>
        </div>

        {/* Slots grid */}
        <div className="grid grid-cols-2 gap-2">
          <TeamSlots label="Team A (You)" slots={m.teamA} accepted={m.accepted} declined={m.declined} meUid="me"/>
          <TeamSlots label="Team B" slots={m.teamB} accepted={m.accepted} declined={m.declined} meUid="me"/>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          {isPast && m.status !== 'cancelled' && (
            <button onClick={onLog}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Trophy size={11}/> Log Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamSlots({ label, slots, accepted, declined, meUid }: {
  label: string; slots: (SlotPlayer | null)[]; accepted: string[]; declined: string[]; meUid: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      {slots.map((s, i) => {
        if (!s) {
          return (
            <div key={i} className="flex items-center gap-1.5 border border-dashed border-slate-700 rounded-xl px-2.5 py-2 text-slate-600">
              <User size={11}/><span className="text-[11px]">Invite pending</span>
            </div>
          );
        }
        const isMe = s.uid === meUid;
        const isAcc = accepted.includes(s.uid);
        const isDec = declined.includes(s.uid);
        return (
          <div key={i} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 ${isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800'}`}>
            <Avatar name={s.displayName} className="!w-5 !h-5 !text-[9px] shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate">{s.displayName}</p>
              <p className="text-[10px] text-slate-500">@{s.username}</p>
            </div>
            {isMe   && <span className="text-[9px] text-emerald-400 font-bold shrink-0">You</span>}
            {!isMe && isAcc  && <Check size={10} className="text-emerald-400 shrink-0"/>}
            {!isMe && isDec  && <X size={10} className="text-red-400 shrink-0"/>}
            {!isMe && !isAcc && !isDec && <Clock size={10} className="text-amber-400 shrink-0"/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Match history card ───────────────────────────────────────────────────────

function MatchHistoryCard({ match: m }: { match: import('@/types').Match }) {
  const iWon = m.winnerId === 'me';
  const myScore  = m.games.map(g => g.p1).join('-');
  const oppScore = m.games.map(g => g.p2).join('-');
  const date = new Date(m.playedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className={`bg-slate-900 border rounded-2xl p-4 space-y-2 ${iWon ? 'border-emerald-500/20' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {iWon ? 'W' : 'L'}
          </span>
          <div>
            <span className="text-sm font-semibold">vs {m.player2Name}</span>
            <span className="text-[11px] text-slate-500 ml-1">@{m.player2Username}</span>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{m.type}</span>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{date}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{myScore} · {oppScore}</p>
        {m.mmrChange !== undefined && (
          <span className={`text-xs font-bold ${m.mmrChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {m.mmrChange >= 0 ? '+' : ''}{m.mmrChange} MMR
          </span>
        )}
      </div>
      {m.venue && <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin size={9}/>{m.venue}</p>}
    </div>
  );
}

// ─── Plan match modal ─────────────────────────────────────────────────────────

type SlotKey = { team: 'A' | 'B'; idx: number };

function PlayerSearchDropdown({ gender, exclude, onSelect, onClose }: {
  gender: 'Male' | 'Female' | null;
  exclude: string[];
  onSelect: (p: SlotPlayer) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const candidates = PLAYERS
    .filter(p => !exclude.includes(p.uid))
    .filter(p => !gender || p.gender === gender)
    .filter(p => !q || p.displayName.toLowerCase().includes(q.toLowerCase()) || p.username.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
      <div className="p-2 border-b border-slate-700">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder={gender ? `Search ${gender} player…` : 'Search player…'}
            className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500"/>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {candidates.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">{gender ? `No ${gender.toLowerCase()} players found` : 'No players found'}</p>
        ) : candidates.map(p => (
          <button key={p.uid} onClick={() => { onSelect({ uid: p.uid, displayName: p.displayName, username: p.username, gender: p.gender }); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors text-left">
            <Avatar name={p.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{p.displayName}</p>
              <p className="text-[10px] text-slate-500">@{p.username}</p>
            </div>
            {p.gender && <GenderDot gender={p.gender}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

function SlotPicker({ slot, label, genderRequired, exclude, isMe, onSet, onClear }: {
  slot: SlotPlayer | null;
  label: string;
  genderRequired: 'Male' | 'Female' | null;
  exclude: string[];
  isMe?: boolean;
  onSet: (p: SlotPlayer) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (isMe && slot) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 min-h-[44px]">
        <Avatar name={slot.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{slot.displayName}</p>
          <p className="text-[10px] text-slate-500">@{slot.username} · You</p>
        </div>
        {slot.gender && <GenderDot gender={slot.gender}/>}
      </div>
    );
  }

  return (
    <div className="relative">
      {slot ? (
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 min-h-[44px]">
          <Avatar name={slot.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{slot.displayName}</p>
            <p className="text-[10px] text-slate-500">@{slot.username}</p>
          </div>
          {slot.gender && <GenderDot gender={slot.gender}/>}
          <button onClick={onClear} className="text-slate-500 hover:text-red-400 shrink-0"><X size={12}/></button>
        </div>
      ) : (
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 border border-dashed border-slate-600 hover:border-slate-500 rounded-xl px-3 py-2 min-h-[44px] transition-colors text-left">
          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <UserPlus size={10} className="text-slate-500"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-400">{label}</p>
            {genderRequired && <p className="text-[10px] text-slate-600">{genderRequired} only</p>}
          </div>
          {genderRequired && <GenderDot gender={genderRequired}/>}
        </button>
      )}
      {open && (
        <PlayerSearchDropdown
          gender={genderRequired}
          exclude={exclude}
          onSelect={onSet}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PlanMatchModal({ existing, me, onSave, onClose }: {
  existing: PlannedMatch | null;
  me: SlotPlayer;
  onSave: (pm: PlannedMatch) => void;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<MatchType>(existing?.format ?? 'MS');
  const [date,   setDate]   = useState(existing?.date ?? '');
  const [time,   setTime]   = useState(existing?.time ?? '');
  const [venue,  setVenue]  = useState(existing?.venue ?? '');
  const [notes,  setNotes]  = useState(existing?.notes ?? '');

  const { teamSize } = slotsForFormat(format);

  // teamA[0] = always the organiser (me)
  const initTeamA = (): (SlotPlayer | null)[] => {
    if (existing?.format === format) return existing.teamA.map((s, i) => i === 0 ? me : s);
    return teamSize === 1 ? [me] : [me, null];
  };
  const initTeamB = (): (SlotPlayer | null)[] => {
    if (existing?.format === format) return existing.teamB;
    return teamSize === 1 ? [null] : [null, null];
  };

  const [teamA, setTeamA] = useState<(SlotPlayer | null)[]>(initTeamA);
  const [teamB, setTeamB] = useState<(SlotPlayer | null)[]>(initTeamB);

  // Reset slots when format changes
  const changeFormat = (f: MatchType) => {
    setFormat(f);
    const { teamSize: ts } = slotsForFormat(f);
    setTeamA(ts === 1 ? [me] : [me, null]);
    setTeamB(ts === 1 ? [null] : [null, null]);
  };

  const allFilledUids = (): string[] =>
    [...teamA, ...teamB].filter((s): s is SlotPlayer => s !== null).map(s => s.uid);

  const setSlot = (team: 'A' | 'B', idx: number, p: SlotPlayer) => {
    if (team === 'A') setTeamA(prev => { const n = [...prev]; n[idx] = p; return n; });
    else              setTeamB(prev => { const n = [...prev]; n[idx] = p; return n; });
  };
  const clearSlot = (team: 'A' | 'B', idx: number) => {
    if (team === 'A') setTeamA(prev => { const n = [...prev]; n[idx] = null; return n; });
    else              setTeamB(prev => { const n = [...prev]; n[idx] = null; return n; });
  };

  const save = () => {
    if (!date || !time || !venue) return;
    const pm: PlannedMatch = {
      id: existing?.id ?? `pm${Date.now()}`,
      format, date, time, venue, notes: notes.trim() || undefined,
      teamA, teamB,
      accepted: existing?.accepted ?? [],
      declined: existing?.declined ?? [],
      status: existing?.status ?? 'pending',
    };
    onSave(pm);
  };

  const slotLabel = (team: 'A' | 'B', idx: number) => {
    if (team === 'A' && idx === 0) return 'You';
    if (teamSize === 1) return team === 'A' ? 'You' : 'Opponent';
    return team === 'A' ? `Your partner` : `Opponent ${idx + 1}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-bold text-sm">{existing ? 'Edit Match' : 'Plan a Match'}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16}/></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold">Format</label>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map(f => (
                <button key={f} onClick={() => changeFormat(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    format === f ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">{FORMAT_LABELS[format]}</p>
          </div>

          {/* Player slots */}
          <div className="space-y-3">
            <label className="text-xs text-slate-400 font-semibold">Players</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Team A */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Team A</p>
                {teamA.map((slot, idx) => (
                  <SlotPicker
                    key={idx}
                    slot={slot}
                    label={slotLabel('A', idx)}
                    genderRequired={getSlotGender(format, 'A', idx, me.gender)}
                    exclude={allFilledUids()}
                    isMe={idx === 0}
                    onSet={p => setSlot('A', idx, p)}
                    onClear={() => clearSlot('A', idx)}
                  />
                ))}
              </div>
              {/* Team B */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Team B</p>
                {teamB.map((slot, idx) => (
                  <SlotPicker
                    key={idx}
                    slot={slot}
                    label={slotLabel('B', idx)}
                    genderRequired={getSlotGender(format, 'B', idx, me.gender)}
                    exclude={allFilledUids()}
                    isMe={false}
                    onSet={p => setSlot('B', idx, p)}
                    onClear={() => clearSlot('B', idx)}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <Bell size={10}/> Invited players must accept before the match is confirmed.
            </p>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold">Venue</label>
            <input value={venue} onChange={e => setVenue(e.target.value)}
              placeholder="e.g. Setia Alam Sports Complex"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. bring extra shuttles"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex gap-2 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
          <button onClick={save} disabled={!date || !time || !venue}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors">
            {existing ? 'Save Changes' : 'Send Invites'}
          </button>
        </div>
      </div>
    </div>
  );
}
