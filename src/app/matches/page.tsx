'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { PLAYERS } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { LogMatchModal } from '@/components/LogMatchModal';
import { LiveMatchModal } from '@/components/LiveMatchModal';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import {
  CalendarDays, Plus, MapPin, Clock, Check, X, UserPlus,
  Swords, Trophy, Search, Edit3, Trash2, Bell, User, AlertTriangle, Radio, Eye,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { savePlannedMatch, deletePlannedMatch } from '@/lib/firestoreService';
import { loadPausedMatch } from '@/lib/pausedMatch';
import type { UserProfile, MatchType, Match } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlannedStatus = 'pending' | 'confirmed' | 'cancelled';
type PlanMode = 'plan' | 'live'; // 'live' = Record Live flow

interface SlotPlayer {
  uid: string;
  displayName: string;
  username: string;
  gender?: 'Male' | 'Female';
  country?: string;
}

// Extra lifecycle state layered on top of `status` once live scoring starts
type LiveState = 'live' | 'confirming' | 'completed';

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
  liveRecord?: boolean; // created via Record Live — live scoring enabled once all confirmed
  liveState?: LiveState; // set once the match has actually been played
}

// Friendly status vocabulary shown to the user
function displayStatus(m: PlannedMatch): { label: string; className: string } {
  if (m.status === 'cancelled')
    return { label: 'Cancelled', className: 'bg-red-500/15 text-red-400 border-red-500/25' };
  if (m.liveState === 'completed')
    return { label: 'Completed', className: 'bg-slate-700 text-slate-300 border-slate-600' };
  if (m.liveState === 'confirming')
    return { label: 'Confirming Result', className: 'bg-blue-500/15 text-blue-400 border-blue-500/25' };
  if (m.liveState === 'live')
    return { label: 'Live Now', className: 'bg-rose-500/15 text-rose-400 border-rose-500/25 animate-pulse' };
  if (m.status === 'confirmed')
    return { label: 'Ready to Play', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
  return { label: 'Awaiting RSVPs', className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
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

// A plan is confirmed once every slot is filled and every non-organiser player has accepted
function derivePlanStatus(teamA: (SlotPlayer | null)[], teamB: (SlotPlayer | null)[], accepted: string[]): PlannedStatus {
  const slots = [...teamA, ...teamB];
  const allFilled   = slots.every(s => s !== null);
  const allAccepted = slots.every(s => s === null || s.uid === 'me' || accepted.includes(s.uid));
  return allFilled && allAccepted ? 'confirmed' : 'pending';
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
  const { user, matches, addNotification, challenges, acceptChallenge, declineChallenge, confirmMatch, disputeMatch } = useApp();
  const [tab,      setTab]      = useState<'history' | 'planned'>('planned');
  const [watchCode, setWatchCode] = useState('');
  const [watchErr,  setWatchErr]  = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [logOpen,     setLogOpen]     = useState(false);
  const [liveOpen,    setLiveOpen]    = useState(false);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null); // planned match to start live scoring
  const [planOpen,    setPlanOpen]    = useState(false);
  const [planMode,    setPlanMode]    = useState<PlanMode>('plan');
  const [editId,      setEditId]      = useState<string | null>(null);
  const [cancelId,    setCancelId]    = useState<string | null>(null);

  const { ref: cancelPanelRef, dialogProps: cancelDialogProps } = useModalA11y(!!cancelId, () => setCancelId(null), 'Cancel this match?');

  const myMatches = matches.filter(m =>
    m.player1Id === 'me' || m.player2Id === 'me' ||
    m.player1PartnerId === 'me' || m.player2PartnerId === 'me'
  );

  const me: SlotPlayer = {
    uid: 'me',
    displayName: user.displayName,
    username: user.username,
    gender: user.gender,
    country: user.country ?? 'Malaysia',
  };

  const [planned, setPlanned] = useState<PlannedMatch[]>(() =>
    SEED_PLANNED.map(m => ({
      ...m,
      teamA: m.teamA.map((s, i) => i === 0 ? me : s),
    }))
  );

  // liveState only lives in this page's memory — a paused live match, however,
  // is remembered in localStorage (see LiveMatchModal). Reconcile the two on
  // mount so switching tabs and coming back doesn't make a paused match look
  // like it never started.
  useEffect(() => {
    const ref = loadPausedMatch();
    if (!ref?.plannedMatchId) return;
    setPlanned(prev => prev.map(m =>
      m.id === ref.plannedMatchId && !m.liveState ? { ...m, liveState: 'live' } : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPlan = (id?: string, mode: PlanMode = 'plan') => { setEditId(id ?? null); setPlanMode(mode); setPlanOpen(true); };

  const handleSavePlan = (pm: PlannedMatch) => {
    const base = planMode === 'live' ? { ...pm, liveRecord: true } : pm;
    const pmFinal = base.status === 'cancelled' ? base : { ...base, status: derivePlanStatus(base.teamA, base.teamB, base.accepted) };
    setPlanned(prev => editId
      ? prev.map(p => p.id === editId ? pmFinal : p)
      : [pmFinal, ...prev]);
    setPlanOpen(false);
    // Persist to Firestore
    const uid = auth.currentUser?.uid;
    if (uid) savePlannedMatch(uid, pmFinal).catch(() => {});
    // Notify all invited players
    const invited = [...pmFinal.teamA, ...pmFinal.teamB].filter((s): s is SlotPlayer => s !== null && s.uid !== 'me');
    invited.forEach(p => {
      addNotification({
        id: `notif_${Date.now()}_${p.uid}`,
        type: 'match_invite',
        title: editId ? 'Match Updated' : pmFinal.liveRecord ? 'Live Match Invite' : 'Match Invite',
        body: editId
          ? `${user.displayName} updated a planned match you're in (${pmFinal.venue}, ${pmFinal.date}).`
          : `${user.displayName} invited you to a ${FORMAT_LABELS[pmFinal.format]} at ${pmFinal.venue} on ${pmFinal.date}.${pmFinal.liveRecord ? ' (Live recorded match — please confirm to enable live scoring.)' : ''}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
  };

  // Convert an accepted challenge into a planned match
  const handleAcceptChallenge = (challengeId: string) => {
    const ch = challenges.find(c => c.id === challengeId);
    if (!ch) return;
    acceptChallenge(challengeId);
    const isDoubles = ['MD', 'WD', 'MX'].includes(ch.format);
    const opponent: SlotPlayer = { uid: ch.toId, displayName: ch.toName, username: ch.toUsername };
    const [datePart, timeRaw] = ch.date.split('T');
    const timePart = timeRaw ? timeRaw.slice(0, 5) : '09:00';
    const teamA = isDoubles ? [me, null] : [me];
    const teamB = isDoubles ? [opponent, null] : [opponent];
    // "Simulate accept" means the opponent has accepted the invite right away
    const accepted = ['me', opponent.uid];
    const pm: PlannedMatch = {
      id: `pm_ch_${Date.now()}`,
      format: ch.format,
      date: datePart,
      time: timePart,
      venue: ch.venue,
      notes: ch.message,
      teamA, teamB,
      accepted,
      declined: [],
      status: derivePlanStatus(teamA, teamB, accepted),
    };
    setPlanned(prev => [pm, ...prev]);
  };

  // Demo: simulate an invited (non-organiser) player accepting their slot in a plan
  const handleSimulateAccept = (planId: string, uid: string) => {
    setPlanned(prev => prev.map(m => {
      if (m.id !== planId || m.status === 'cancelled') return m;
      const accepted = m.accepted.includes(uid) ? m.accepted : [...m.accepted, uid];
      return { ...m, accepted, status: derivePlanStatus(m.teamA, m.teamB, accepted) };
    }));
  };

  const handleCancelMatch = (id: string) => {
    const match = planned.find(m => m.id === id);
    setPlanned(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' as const } : m));
    setCancelId(null);
    const uid = auth.currentUser?.uid;
    if (uid && match) savePlannedMatch(uid, { ...match, status: 'cancelled' }).catch(() => {});
    // Notify all parties
    const all = match ? [...match.teamA, ...match.teamB].filter((s): s is SlotPlayer => s !== null && s.uid !== 'me') : [];
    all.forEach(p => {
      addNotification({
        id: `notif_cancel_${Date.now()}_${p.uid}`,
        type: 'match_pending',
        title: 'Match Cancelled',
        body: `${user.displayName} cancelled the planned match at ${match?.venue ?? 'the venue'}.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
  };

  // A confirmed match becomes "Live Now" the moment recording/scoring actually starts
  const handleOpenLiveRecord = (id: string) => {
    setPlanned(prev => prev.map(m => m.id === id ? { ...m, liveState: 'live' } : m));
    setLiveMatchId(id);
    setLiveOpen(true);
  };

  // Once the host taps Log Result, the planned match moves to "Confirming Result"
  // until every opponent has confirmed the score (handled via confirmMatch in AppContext)
  const handleMatchLogged = (plannedMatchId: string) => {
    setPlanned(prev => prev.map(m => m.id === plannedMatchId ? { ...m, liveState: 'confirming' } : m));
  };

  // Once the logged Match flips to Confirmed (all opponents confirmed), mark the
  // linked planned match as fully Completed.
  useEffect(() => {
    const confirmedIds = new Set(
      matches.filter(m => m.status === 'Confirmed' && m.plannedMatchId).map(m => m.plannedMatchId!)
    );
    if (confirmedIds.size === 0) return;
    setPlanned(prev => prev.map(m =>
      m.liveState === 'confirming' && confirmedIds.has(m.id) ? { ...m, liveState: 'completed' } : m
    ));
  }, [matches]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track, plan, and log your games</p>
        </div>
        <button onClick={() => openPlan()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shrink-0">
          <Plus size={13}/> Plan Match
        </button>
      </div>

      {/* Watch a live match */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-3">
          <Eye size={13} className="text-blue-400"/> Watch a Live Match
        </p>
        <div className="flex gap-2">
          <input
            value={watchCode}
            onChange={e => { setWatchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setWatchErr(''); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && watchCode.length === 6) {
                window.location.href = `/live/?code=${watchCode}`;
              }
            }}
            maxLength={6}
            placeholder="Enter 6-digit code"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono tracking-widest uppercase outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => {
              if (watchCode.length !== 6) { setWatchErr('Enter the full 6-character code.'); return; }
              window.location.href = `/live/?code=${watchCode}`;
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            Join
          </button>
        </div>
        {watchErr && <p className="text-xs text-red-400 mt-1.5">{watchErr}</p>}
        <p className="text-[11px] text-slate-600 mt-2">Get the code from whoever is scoring the match.</p>
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
          {/* Pending challenges sent by me — awaiting opponent response */}
          {challenges.filter(c => c.fromId === 'me' && c.status === 'pending').map(ch => (
            <div key={ch.id} className="bg-slate-900 border border-amber-500/25 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                    <Swords size={11}/> Challenge Sent · Awaiting Response
                  </p>
                  <p className="font-bold text-sm">{FORMAT_LABELS[ch.format]} vs {ch.toName}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={10}/> {ch.venue}
                    <span className="mx-1">·</span>
                    <Bell size={10}/> {new Date(ch.date).toLocaleDateString('en-MY', { weekday:'short', day:'numeric', month:'short' })}
                  </p>
                  {ch.message && <p className="text-xs text-slate-500 mt-1 italic">"{ch.message}"</p>}
                </div>
                <button onClick={() => declineChallenge(ch.id)}
                  className="text-[11px] text-slate-500 hover:text-red-400 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shrink-0">
                  Cancel
                </button>
              </div>
              {/* Demo: simulate opponent accepting */}
              <button onClick={() => handleAcceptChallenge(ch.id)}
                className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold transition-colors">
                ✓ Simulate: {ch.toName} accepts
              </button>
            </div>
          ))}

          {planned.length === 0 && challenges.filter(c => c.fromId === 'me' && c.status === 'pending').length === 0 ? (
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
                onCancel={() => setCancelId(m.id)}
                onLiveRecord={() => handleOpenLiveRecord(m.id)}
                onSimulateAccept={uid => handleSimulateAccept(m.id, uid)}
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
            myMatches.map(m => <MatchHistoryCard key={m.id} match={m} onClick={() => setSelectedMatch(m)}/>)
          )}
        </div>
      )}

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)}
        onConfirm={selectedMatch?.status === 'Pending' ? () => { confirmMatch(selectedMatch.id); setSelectedMatch(null); } : undefined}
        onDispute={selectedMatch?.status === 'Pending'  ? () => { disputeMatch(selectedMatch.id);  setSelectedMatch(null); } : undefined}
      />

      {logOpen  && <LogMatchModal  open={true} onClose={() => setLogOpen(false)}/>}
      {liveOpen && (
        <LiveMatchModal
          open={true}
          onClose={() => { setLiveOpen(false); setLiveMatchId(null); }}
          onMatchLogged={handleMatchLogged}
          onMatchCancelled={handleCancelMatch}
          plannedMatch={liveMatchId ? planned.find(m => m.id === liveMatchId) ?? null : null}
        />
      )}

      {planOpen && (
        <PlanMatchModal
          existing={planned.find(p => p.id === editId) ?? null}
          me={me}
          onSave={handleSavePlan}
          onClose={() => setPlanOpen(false)}
          hostName={user.displayName}
        />
      )}

      {/* Cancel match confirmation */}
      {cancelId && (
        <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setCancelId(null)}>
          <div ref={cancelPanelRef} {...cancelDialogProps} className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 outline-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-400"/>
              </div>
              <div>
                <p className="font-bold text-sm">Cancel this match?</p>
                <p className="text-xs text-slate-400 mt-0.5">All invited players will be notified.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCancelId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                Keep Match
              </button>
              <button onClick={() => handleCancelMatch(cancelId)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors">
                Yes, Cancel
              </button>
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

function PlannedCard({ match: m, me, onEdit, onLog, onCancel, onLiveRecord, onSimulateAccept }: {
  match: PlannedMatch; me: SlotPlayer;
  onEdit: () => void; onLog: () => void; onCancel: () => void; onLiveRecord: () => void;
  onSimulateAccept: (uid: string) => void;
}) {
  const { addNotification } = useApp();
  const [removeTarget, setRemoveTarget] = useState<SlotPlayer | null>(null);
  const dateObj = new Date(m.date + 'T' + m.time);
  const isPast  = dateObj < new Date();
  const dateStr = dateObj.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
  const borderClass = m.status === 'confirmed' ? 'border-emerald-500/25' : m.status === 'cancelled' ? 'border-red-500/20 opacity-60' : 'border-slate-800';
  const status = displayStatus(m);

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden ${borderClass}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold">{FORMAT_LABELS[m.format]}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${status.className}`}>{status.label}</span>
              {isPast && m.status !== 'cancelled' && <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">Past</span>}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays size={10}/> {dateStr} · {m.time}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {m.venue}</p>
            {m.notes && <p className="text-[11px] text-slate-500 italic">{m.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {m.status !== 'cancelled' && <button onClick={onEdit} aria-label="Edit match" className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><Edit3 size={13}/></button>}
            {m.status !== 'cancelled' && <button onClick={onCancel} title="Cancel match" aria-label="Cancel match" className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"><Trash2 size={13}/></button>}
          </div>
        </div>

        {/* Slots grid */}
        <div className="grid grid-cols-2 gap-2">
          <TeamSlots label={m.teamA.some(s => s?.uid === 'me') ? 'Team A (You)' : 'Team A'} slots={m.teamA} accepted={m.accepted} declined={m.declined} meUid="me"
            onRemovePlayer={m.status !== 'cancelled' ? p => setRemoveTarget(p) : undefined}
            onSimulateAccept={m.status !== 'cancelled' ? onSimulateAccept : undefined}/>
          <TeamSlots label="Team B" slots={m.teamB} accepted={m.accepted} declined={m.declined} meUid="me"
            onRemovePlayer={m.status !== 'cancelled' ? p => setRemoveTarget(p) : undefined}
            onSimulateAccept={m.status !== 'cancelled' ? onSimulateAccept : undefined}/>
        </div>

        {/* Remove player confirmation */}
        {removeTarget && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-400 shrink-0"/>
              <p className="text-xs font-semibold text-red-300">Remove {removeTarget.displayName} from this match?</p>
            </div>
            <p className="text-[11px] text-slate-400">They will be notified that they've been removed.</p>
            <div className="flex gap-2">
              <button onClick={() => setRemoveTarget(null)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors">Keep</button>
              <button onClick={() => {
                addNotification({
                  id: `notif_remove_${Date.now()}_${removeTarget.uid}`,
                  type: 'match_invite',
                  title: 'Removed from Match',
                  body: `You have been removed from the planned ${FORMAT_LABELS[m.format]} at ${m.venue}.`,
                  read: false,
                  createdAt: new Date().toISOString(),
                });
                setRemoveTarget(null);
              }}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors">Remove</button>
            </div>
          </div>
        )}

        {/* Actions — only on confirmed matches that haven't been played yet */}
        {m.status === 'confirmed' && !m.liveState && (
          <div className="flex gap-2 pt-0.5 flex-wrap">
            <button onClick={onLog}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white rounded-xl text-xs font-bold transition-colors">
              <Trophy size={11}/> Log Match
            </button>
            <button onClick={onLiveRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Radio size={11}/><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>Record Live
            </button>
          </div>
        )}
        {m.liveState === 'live' && (
          <div className="flex gap-2 pt-0.5 flex-wrap">
            <button onClick={onLiveRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Radio size={11}/> Continue Recording
            </button>
          </div>
        )}
        {m.liveState === 'confirming' && (
          <p className="text-[11px] text-blue-400 flex items-center gap-1.5 pt-0.5">
            <Clock size={11}/> Waiting on the other player{m.teamB.filter(Boolean).length > 1 ? 's' : ''} to confirm the score.
          </p>
        )}
      </div>
    </div>
  );
}

function TeamSlots({ label, slots, accepted, declined, meUid, onRemovePlayer, onSimulateAccept }: {
  label: string; slots: (SlotPlayer | null)[]; accepted: string[]; declined: string[]; meUid: string;
  onRemovePlayer?: (player: SlotPlayer) => void;
  onSimulateAccept?: (uid: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      {slots.map((s, i) => {
        if (!s) {
          return (
            <div key={i} className="flex items-center gap-1.5 border border-dashed border-slate-700 rounded-xl px-2.5 py-2 min-h-[44px]">
              <User size={11} className="text-slate-600"/><span className="text-[11px] text-slate-600">Invite pending</span>
            </div>
          );
        }
        const isMe = s.uid === meUid;
        const isAcc = accepted.includes(s.uid);
        const isDec = declined.includes(s.uid);
        return (
          <div key={i} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 min-h-[44px] ${isMe ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800'}`}>
            <Avatar name={s.displayName} className="!w-5 !h-5 !text-[9px] shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate">{s.displayName}</p>
              <p className="text-[10px] text-slate-500">@{s.username}</p>
            </div>
            {isMe   && <span className="text-[9px] text-emerald-400 font-bold shrink-0">You</span>}
            {!isMe && isAcc  && <Check size={10} className="text-emerald-400 shrink-0"/>}
            {!isMe && isDec  && <X size={10} className="text-red-400 shrink-0"/>}
            {!isMe && !isAcc && !isDec && (
              onSimulateAccept ? (
                <button onClick={() => onSimulateAccept(s.uid)} title={`Simulate: ${s.displayName} accepts`}
                  className="flex items-center gap-0.5 text-[9px] text-amber-400 hover:text-emerald-400 font-semibold shrink-0 transition-colors">
                  <Clock size={10}/> Accept?
                </button>
              ) : <Clock size={10} className="text-amber-400 shrink-0"/>
            )}
            {!isMe && onRemovePlayer && (
              <button onClick={() => onRemovePlayer(s)} className="ml-1 text-slate-600 hover:text-red-400 shrink-0 transition-colors">
                <X size={10}/>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Match history card ───────────────────────────────────────────────────────

function MatchHistoryCard({ match: m, onClick }: { match: import('@/types').Match; onClick: () => void }) {
  const isPending = m.status === 'Pending';
  const iWon = m.winnerId === 'me';
  const myScore  = m.games.map(g => g.p1).join('-');
  const oppScore = m.games.map(g => g.p2).join('-');
  const date = new Date(m.playedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <button onClick={onClick}
      className={`w-full text-left bg-slate-900 border rounded-2xl p-4 space-y-2 hover:border-slate-700 transition-colors ${isPending ? 'border-amber-500/25' : iWon ? 'border-emerald-500/20' : 'border-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isPending ? 'bg-amber-500/15 text-amber-400' : iWon ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {isPending ? '?' : iWon ? 'W' : 'L'}
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
        {isPending
          ? <span className="text-xs text-amber-400 font-medium">Tap to confirm or dispute</span>
          : m.mmrChange !== undefined && (
            <span className={`text-xs font-bold ${m.mmrChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.mmrChange >= 0 ? '+' : ''}{m.mmrChange} MMR
            </span>
          )}
      </div>
      {m.venue && <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin size={9}/>{m.venue}</p>}
    </button>
  );
}

// ─── Plan match modal ─────────────────────────────────────────────────────────

type SlotKey = { team: 'A' | 'B'; idx: number };

function PlayerSearchDropdown({ gender, exclude, onSelect, onClose, selfPlayer, userCountry }: {
  gender: 'Male' | 'Female' | null;
  exclude: string[];
  onSelect: (p: SlotPlayer) => void;
  onClose: () => void;
  selfPlayer?: SlotPlayer; // show at top as "(Self)"
  userCountry?: string;
}) {
  const [q, setQ] = useState('');
  const showSelf = selfPlayer && !exclude.includes(selfPlayer.uid) && (!gender || selfPlayer.gender === gender) &&
    (!q || selfPlayer.displayName.toLowerCase().includes(q.toLowerCase()) || selfPlayer.username.toLowerCase().includes(q.toLowerCase()));
  const candidates = PLAYERS
    .filter(p => !exclude.includes(p.uid))
    .filter(p => p.uid !== selfPlayer?.uid) // selfPlayer shown separately
    .filter(p => !gender || p.gender === gender)
    .filter(p => !userCountry || (p.country ?? 'Malaysia') === userCountry)
    .filter(p => !q || p.displayName.toLowerCase().includes(q.toLowerCase()) || p.username.toLowerCase().includes(q.toLowerCase()))
    .slice(0, showSelf ? 5 : 6);

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
        {showSelf && selfPlayer && (
          <button onClick={() => { onSelect(selfPlayer); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 border-b border-slate-700/50 transition-colors text-left">
            <Avatar name={selfPlayer.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold truncate">{selfPlayer.displayName}</p>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold shrink-0">Self</span>
              </div>
              <p className="text-[10px] text-slate-500">@{selfPlayer.username}</p>
            </div>
            {selfPlayer.gender && <GenderDot gender={selfPlayer.gender}/>}
          </button>
        )}
        {candidates.length === 0 && !showSelf ? (
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

function SlotPicker({ slot, label, genderRequired, exclude, selfPlayer, isSelfSlot, onSet, onClear }: {
  slot: SlotPlayer | null;
  label: string;
  genderRequired: 'Male' | 'Female' | null;
  exclude: string[];
  selfPlayer: SlotPlayer;   // current user, shown at top of picker
  isSelfSlot?: boolean;     // visual hint that this is the default-self slot
  onSet: (p: SlotPlayer) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isFilledBySelf = slot?.uid === selfPlayer.uid;

  return (
    <div className="relative">
      {slot ? (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 min-h-[44px] border
          ${isFilledBySelf ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-slate-800 border-slate-700'}`}>
          <Avatar name={slot.displayName} className="!w-6 !h-6 !text-[10px] shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold truncate">{slot.displayName}</p>
              {isFilledBySelf && <span className="text-[9px] text-emerald-400 font-bold shrink-0">You</span>}
            </div>
            <p className="text-[10px] text-slate-500">@{slot.username}</p>
          </div>
          {slot.gender && <GenderDot gender={slot.gender}/>}
          <button onClick={onClear} aria-label={`Remove ${slot.displayName}`} className="text-slate-500 hover:text-red-400 shrink-0"><X size={12}/></button>
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
          selfPlayer={selfPlayer}
          userCountry={selfPlayer.country}
          onSelect={onSet}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function PlanMatchModal({ existing, me, onSave, onClose, hostName: _ }: {
  existing: PlannedMatch | null;
  me: SlotPlayer;
  onSave: (pm: PlannedMatch) => void;
  onClose: () => void;
  hostName?: string;
}) {
  const [format, setFormat] = useState<MatchType>(existing?.format ?? 'MS');
  const [date,   setDate]   = useState(existing?.date ?? '');
  const [time,   setTime]   = useState(existing?.time ?? '');
  const [venue,  setVenue]  = useState(existing?.venue ?? '');
  const [notes,  setNotes]  = useState(existing?.notes ?? '');

  const { teamSize } = slotsForFormat(format);

  // slot A0 starts empty (user can add anyone incl. themselves)
  const initTeamA = (): (SlotPlayer | null)[] => {
    if (existing?.format === format) return existing.teamA;
    return teamSize === 1 ? [null] : [null, null];
  };
  const initTeamB = (): (SlotPlayer | null)[] => {
    if (existing?.format === format) return existing.teamB;
    return teamSize === 1 ? [null] : [null, null];
  };

  const [teamA, setTeamA] = useState<(SlotPlayer | null)[]>(initTeamA);
  const [teamB, setTeamB] = useState<(SlotPlayer | null)[]>(initTeamB);

  const { ref: panelRef, dialogProps } = useModalA11y(true, onClose, existing ? 'Edit Match' : 'Plan a Match');

  // Derive available formats based on currently-selected players' genders
  const allSelected = [...teamA, ...teamB].filter((s): s is SlotPlayer => s !== null);
  const hasMale   = allSelected.some(s => s.gender === 'Male');
  const hasFemale = allSelected.some(s => s.gender === 'Female');
  const allMale   = allSelected.length > 0 && allSelected.every(s => s.gender === 'Male');
  const allFemale = allSelected.length > 0 && allSelected.every(s => s.gender === 'Female');
  const formatDisabled = (f: MatchType): boolean => {
    if (f === 'MS' || f === 'MD') return hasFemale;
    if (f === 'WS' || f === 'WD') return hasMale;
    if (f === 'MX') return allMale || allFemale;
    return false;
  };

  // Reset slots when format changes
  const changeFormat = (f: MatchType) => {
    if (formatDisabled(f)) return;
    setFormat(f);
    const { teamSize: ts } = slotsForFormat(f);
    const keptA0 = teamA[0] ?? null; // preserve whoever is in A0
    setTeamA(ts === 1 ? [keptA0] : [keptA0, null]);
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
    if (teamSize === 1) return team === 'A' ? 'Player A' : 'Player B';
    return team === 'A' ? `Team A player ${idx + 1}` : `Team B player ${idx + 1}`;
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-bold text-sm">{existing ? 'Edit Match' : 'Plan a Match'}</p>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white"><X size={16}/></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-semibold">Format</label>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map(f => {
                const disabled = formatDisabled(f);
                return (
                  <button key={f} onClick={() => changeFormat(f)} disabled={disabled}
                    title={disabled ? 'Incompatible with selected players' : undefined}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      format === f ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : disabled ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed line-through'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    {f}
                  </button>
                );
              })}
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
                    selfPlayer={me}
                    isSelfSlot={idx === 0}
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
                    selfPlayer={me}
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
          <Button variant="secondary" onClick={onClose} className="flex-1 py-2 font-medium">Cancel</Button>
          <Button onClick={save} disabled={!date || !time || !venue} className="flex-1 py-2 font-bold">
            {existing ? 'Save Changes' : 'Send Invites'}
          </Button>
        </div>
      </div>
    </div>
  );
}
