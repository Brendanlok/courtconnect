'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { LogMatchModal } from '@/components/LogMatchModal';
import {
  CalendarDays, Plus, Users, MapPin, Clock, Check, X, UserPlus,
  ChevronRight, Swords, Trophy, Search, Edit3, Trash2, Bell,
} from 'lucide-react';
import type { UserProfile, MatchType } from '@/types';

type PlannedStatus = 'pending' | 'confirmed' | 'cancelled';

interface PlannedMatch {
  id: string;
  format: MatchType;
  date: string;       // ISO date string
  time: string;       // e.g. "18:30"
  venue: string;
  notes?: string;
  invitedUids: string[];
  confirmedUids: string[];
  declinedUids: string[];
  status: PlannedStatus;
  loggedMatchId?: string;
}

const FORMAT_LABELS: Record<MatchType, string> = {
  MS: 'Men\'s Singles',
  WS: 'Women\'s Singles',
  MD: 'Men\'s Doubles',
  WD: 'Women\'s Doubles',
  MX: 'Mixed Doubles',
};

const FORMATS: MatchType[] = ['MS', 'WS', 'MD', 'WD', 'MX'];

const SEED_PLANNED: PlannedMatch[] = [
  {
    id: 'pm1',
    format: 'MD',
    date: '2026-07-08',
    time: '19:00',
    venue: 'Setia Alam Sports Complex',
    notes: 'Bring shuttlecocks',
    invitedUids: ['p2', 'p3'],
    confirmedUids: ['p2'],
    declinedUids: [],
    status: 'pending',
  },
  {
    id: 'pm2',
    format: 'MS',
    date: '2026-07-12',
    time: '08:00',
    venue: 'Bukit Jalil National Aquatic Centre',
    invitedUids: ['p1'],
    confirmedUids: ['p1'],
    declinedUids: [],
    status: 'confirmed',
  },
];

export default function MatchesPage() {
  const { user, matches, addMatch } = useApp();
  const [tab, setTab] = useState<'history' | 'planned'>('planned');
  const [planned, setPlanned] = useState<PlannedMatch[]>(SEED_PLANNED);
  const [planOpen, setPlanOpen] = useState(false);
  const [logOpen,  setLogOpen]  = useState(false);
  const [logForId, setLogForId] = useState<string | null>(null);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const myMatches = matches.filter(m =>
    m.player1Id === 'me' || m.player2Id === 'me' ||
    m.player1PartnerId === 'me' || m.player2PartnerId === 'me'
  );

  const openPlanModal = (id?: string) => {
    setEditId(id ?? null);
    setPlanOpen(true);
  };

  const openLogForPlanned = (id: string) => {
    setLogForId(id);
    setLogOpen(true);
  };

  const deletePlanned = (id: string) => {
    setPlanned(p => p.filter(m => m.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track, plan, and log your games</p>
        </div>
        <button onClick={() => openPlanModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0 mt-1">
          <Plus size={13}/> Plan Match
        </button>
      </div>

      {/* Tabs */}
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

      {/* Planned tab */}
      {tab === 'planned' && (
        <div className="space-y-3">
          {planned.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={32} className="text-slate-700"/>}
              title="No planned matches"
              desc="Tap Plan Match to schedule a game with friends."
              action={<button onClick={() => openPlanModal()} className="text-xs text-emerald-400 font-semibold">+ Plan your first match</button>}
            />
          ) : (
            planned.map(m => (
              <PlannedCard key={m.id} match={m}
                onEdit={() => openPlanModal(m.id)}
                onLog={() => openLogForPlanned(m.id)}
                onDelete={() => setDeleteId(m.id)}
              />
            ))
          )}
        </div>
      )}

      {/* History tab */}
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
            myMatches.map(m => <MatchHistoryCard key={m.id} match={m} userId="me"/>)
          )}
        </div>
      )}

      {/* Log match modal (standalone) */}
      {logOpen && !logForId && (
        <LogMatchModal onClose={() => setLogOpen(false)}/>
      )}

      {/* Plan / Edit modal */}
      {planOpen && (
        <PlanMatchModal
          planned={planned}
          editId={editId}
          user={user}
          onSave={(pm) => {
            setPlanned(prev => editId
              ? prev.map(p => p.id === editId ? pm : p)
              : [pm, ...prev]);
            setPlanOpen(false);
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-sm">Remove this planned match?</p>
            <p className="text-xs text-slate-400">This will cancel the match and remove it from your list.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Keep</button>
              <button onClick={() => deletePlanned(deleteId)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state helper ───────────────────────────────────────────────────────

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

// ─── Planned match card ───────────────────────────────────────────────────────

function PlannedCard({ match: m, onEdit, onLog, onDelete }: {
  match: PlannedMatch;
  onEdit: () => void;
  onLog: () => void;
  onDelete: () => void;
}) {
  const allP = PLAYERS;
  const invited = allP.filter(p => m.invitedUids.includes(p.uid));
  const confirmed = allP.filter(p => m.confirmedUids.includes(p.uid));
  const declined  = allP.filter(p => m.declinedUids.includes(p.uid));
  const pending   = invited.filter(p => !m.confirmedUids.includes(p.uid) && !m.declinedUids.includes(p.uid));

  const dateObj = new Date(m.date + 'T' + m.time);
  const isPast  = dateObj < new Date();
  const dateStr = dateObj.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });

  const statusColor = m.status === 'confirmed' ? 'border-emerald-500/25 bg-emerald-500/5'
    : m.status === 'cancelled' ? 'border-red-500/20 opacity-60'
    : 'border-slate-800';

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden ${statusColor}`}>
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">{FORMAT_LABELS[m.format]}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                m.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                : m.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/25'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
              }`}>
                {m.status === 'confirmed' ? 'Confirmed' : m.status === 'cancelled' ? 'Cancelled' : 'Pending'}
              </span>
              {isPast && m.status !== 'cancelled' && !m.loggedMatchId && (
                <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">Past</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><CalendarDays size={10}/> {dateStr} · {m.time}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={10}/> {m.venue}
            </div>
            {m.notes && (
              <p className="text-[11px] text-slate-500 italic">{m.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} title="Edit"
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <Edit3 size={13}/>
            </button>
            <button onClick={onDelete} title="Remove"
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
              <Trash2 size={13}/>
            </button>
          </div>
        </div>

        {/* Players row */}
        {invited.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Invited</p>
            <div className="flex flex-wrap gap-2">
              {invited.map(p => {
                const isConf = m.confirmedUids.includes(p.uid);
                const isDecl = m.declinedUids.includes(p.uid);
                return (
                  <div key={p.uid} className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2.5 py-1.5">
                    <Avatar name={p.displayName} className="!w-5 !h-5 !text-[9px]"/>
                    <span className="text-xs font-medium">{p.displayName}</span>
                    {isConf && <Check size={10} className="text-emerald-400"/>}
                    {isDecl && <X size={10} className="text-red-400"/>}
                    {!isConf && !isDecl && <Clock size={10} className="text-amber-400"/>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {isPast && !m.loggedMatchId && m.status !== 'cancelled' && (
            <button onClick={onLog}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Trophy size={11}/> Log Result
            </button>
          )}
          {!isPast && m.status === 'pending' && (
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium transition-colors">
              <UserPlus size={11}/> Invite More
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Match history card ───────────────────────────────────────────────────────

function MatchHistoryCard({ match: m, userId }: { match: import('@/types').Match; userId: string }) {
  const iWon = m.winnerId === userId;
  const myScore  = m.games.map(g => g.p1).join('-');
  const oppScore = m.games.map(g => g.p2).join('-');
  const oppName  = m.player2Name;
  const date = new Date(m.playedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`bg-slate-900 border rounded-2xl p-4 space-y-2 ${iWon ? 'border-emerald-500/20' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {iWon ? 'W' : 'L'}
          </span>
          <span className="text-sm font-semibold">vs {oppName}</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{m.type}</span>
        </div>
        <span className="text-xs text-slate-500">{date}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {myScore} <span className="text-slate-600 mx-1">·</span> {oppScore}
        </p>
        {m.mmrChange !== undefined && (
          <span className={`text-xs font-bold ${m.mmrChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {m.mmrChange >= 0 ? '+' : ''}{m.mmrChange} MMR
          </span>
        )}
      </div>
      {m.venue && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <MapPin size={9}/>{m.venue}
        </p>
      )}
    </div>
  );
}

// ─── Plan match modal ─────────────────────────────────────────────────────────

function PlanMatchModal({ planned, editId, user, onSave, onClose }: {
  planned: PlannedMatch[];
  editId: string | null;
  user: UserProfile;
  onSave: (pm: PlannedMatch) => void;
  onClose: () => void;
}) {
  const existing = planned.find(p => p.id === editId);
  const [format,  setFormat]  = useState<MatchType>(existing?.format ?? 'MS');
  const [date,    setDate]    = useState(existing?.date ?? '');
  const [time,    setTime]    = useState(existing?.time ?? '');
  const [venue,   setVenue]   = useState(existing?.venue ?? '');
  const [notes,   setNotes]   = useState(existing?.notes ?? '');
  const [query,   setQuery]   = useState('');
  const [invited, setInvited] = useState<string[]>(existing?.invitedUids ?? []);

  const candidates = PLAYERS.filter(p =>
    p.displayName.toLowerCase().includes(query.toLowerCase()) ||
    p.username.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const toggle = (uid: string) =>
    setInvited(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const save = () => {
    if (!date || !time || !venue) return;
    const pm: PlannedMatch = {
      id: editId ?? `pm${Date.now()}`,
      format, date, time, venue, notes: notes.trim() || undefined,
      invitedUids: invited,
      confirmedUids: existing?.confirmedUids ?? [],
      declinedUids: existing?.declinedUids ?? [],
      status: existing?.status ?? 'pending',
    };
    onSave(pm);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <p className="font-bold text-sm">{editId ? 'Edit Match' : 'Plan a Match'}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={16}/></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold">Format</label>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    format === f ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
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
            <label className="text-xs text-slate-400 font-semibold">Venue / Location</label>
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

          {/* Invite players */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-semibold">Invite Players</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
            </div>
            {invited.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {PLAYERS.filter(p => invited.includes(p.uid)).map(p => (
                  <span key={p.uid} className="flex items-center gap-1 text-xs bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-1 rounded-lg">
                    {p.displayName}
                    <button onClick={() => toggle(p.uid)}><X size={9}/></button>
                  </span>
                ))}
              </div>
            )}
            {query && (
              <div className="space-y-1">
                {candidates.map(p => (
                  <button key={p.uid} onClick={() => toggle(p.uid)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                    <Avatar name={p.displayName} className="!w-6 !h-6 !text-[10px]"/>
                    <span className="text-sm flex-1 text-left">{p.displayName}</span>
                    <span className="text-[11px] text-slate-500">@{p.username}</span>
                    {invited.includes(p.uid) && <Check size={12} className="text-emerald-400"/>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
          <button onClick={save} disabled={!date || !time || !venue}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors">
            {editId ? 'Save Changes' : 'Create Match'}
          </button>
        </div>
      </div>
    </div>
  );
}
