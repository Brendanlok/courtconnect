'use client';
import { useState, useRef, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PLAYERS, ME } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { useModalA11y } from '@/hooks/useModalA11y';
import { timeAgo, maxClubsForTier, getTier } from '@/lib/utils';
import { lookupUserByUid, lookupUserByUsername, subscribeClubMessages, migrateLegacyClubMessages } from '@/lib/firestoreService';
import { auth } from '@/lib/firebase';
import {
  Shield, Users, Star, Lock, Globe, Crown, MessageCircle,
  Send, ArrowLeft, Megaphone, UserPlus, Trash2, ChevronRight,
  Search, Check, X, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type { UserProfile, ClubMessage } from '@/types';

const ALL_PLAYERS = [ME, ...PLAYERS];

const PURPOSE_COLOR: Record<string, string> = {
  Competitive:  'bg-red-500/20 text-red-400 border-red-500/30',
  Recreational: 'bg-green-500/20 text-green-400 border-green-500/30',
  Training:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Social:       'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Youth:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

type Tab = 'Overview' | 'Members' | 'Chat' | 'Admin';

export function ClubDetailClient({ clubId }: { clubId: string }) {
  const {
    user, clubs, myClubIds, myClubPendingIds,
    joinClub, requestJoinClub, cancelClubRequest, leaveClub,
    acceptClubMember, declineClubMember,
    updateClub, disbandClub,
    assignModerator, removeModerator,
    inviteToClub, sendClubMessage,
  } = useApp();

  const club = clubs.find(c => c.id === clubId);
  if (!club) return notFound();

  const isMember  = club.memberIds.includes('me');
  const isOwner   = club.adminId === 'me';
  const isMod     = (club.moderatorIds ?? []).includes('me');
  const canManage = isOwner || isMod;
  const isPending = club.pendingIds.includes('me');
  const hasRequested = myClubPendingIds.includes(clubId);
  const isFull    = club.memberIds.length >= club.maxMembers;

  // null = looked up and not found (so a deleted/bad uid isn't retried forever)
  const [realProfiles, setRealProfiles] = useState<Record<string, UserProfile | null>>({});

  // Members/pending requesters may be real accounts (not in the static demo
  // roster) — fetch their profiles on demand so they actually show up.
  // Deps are joined to primitive strings, not the raw arrays: `club` (and its
  // array fields) is recomputed fresh on every AppContext render regardless
  // of whether membership actually changed, so depending on the arrays
  // directly would re-run this on every unrelated app render.
  const memberKey  = club.memberIds.join(',');
  const pendingKey = club.pendingIds.join(',');
  useEffect(() => {
    const uids = [...memberKey.split(','), ...pendingKey.split(',')].filter(uid =>
      uid && uid !== 'me' && !ALL_PLAYERS.some(p => p.uid === uid) && !(uid in realProfiles)
    );
    if (uids.length === 0) return;
    let cancelled = false;
    Promise.all(uids.map(async uid => {
      const data = await lookupUserByUid(uid).catch(() => null);
      if (!data) return [uid, null] as const;
      const profile: UserProfile = {
        uid, username: data.username ?? uid, displayName: data.displayName ?? 'Player',
        email: '', mmr: data.mmr ?? 1200, tier: getTier(data.mmr ?? 1200),
        globalRank: 0, state: 'Kuala Lumpur', area: '',
        stats: data.stats ?? { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
        photoURL: data.photoURL ?? null,
      };
      return [uid, profile] as const;
    })).then(results => {
      if (cancelled) return;
      setRealProfiles(prev => ({ ...prev, ...Object.fromEntries(results) }));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, pendingKey]);

  const resolveProfile = (uid: string): UserProfile | undefined =>
    uid === 'me' ? user : ALL_PLAYERS.find(p => p.uid === uid) ?? realProfiles[uid] ?? undefined;

  const members: UserProfile[] = club.memberIds
    .map(resolveProfile)
    .filter((p): p is UserProfile => !!p);

  const pendingMembers: UserProfile[] = club.pendingIds
    .map(resolveProfile)
    .filter((p): p is UserProfile => !!p);

  // club.avgMMR is set once at creation and never recalculated — compute it
  // live from actual resolved members instead of trusting the stale field.
  // Falls back to the stored value only while member profiles are still
  // loading (members.length can lag club.memberIds.length briefly).
  const liveAvgMMR = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.mmr, 0) / members.length)
    : club.avgMMR;

  const [tab,           setTab]          = useState<Tab>('Overview');
  const [chatInput,     setChatInput]    = useState('');
  const [announce,      setAnnounce]     = useState(club.announcement ?? '');
  const [editAnnounce,  setEditAnnounce] = useState(false);
  const [inviteQuery,   setInviteQuery]  = useState('');
  const [realInviteName, setRealInviteName] = useState('');
  const [realInviteStatus, setRealInviteStatus] = useState<'idle' | 'loading' | 'not-found' | 'already-member' | 'sent'>('idle');
  const [disbandModal,  setDisbandModal] = useState(false);
  const [disbandInput,  setDisbandInput] = useState('');
  const [leaveModal,    setLeaveModal]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { ref: leaveModalRef,   dialogProps: leaveModalProps }   = useModalA11y(leaveModal,   () => setLeaveModal(false),   `Leave ${club.name}`);
  const { ref: disbandModalRef, dialogProps: disbandModalProps } = useModalA11y(disbandModal, () => setDisbandModal(false), `Disband ${club.name}`);

  // Club chat lives in a subcollection (clubs/{id}/messages), not embedded on
  // the club doc — scoped to this one club, not the full clubs listener.
  // Messages carry the real Firebase uid as senderId (written straight to
  // Firestore, never passed through the app's local 'me' translation), so
  // it's normalized here the same way toLocalClub does for membership.
  const [messages, setMessages] = useState<ClubMessage[]>(club.clubMessages ?? []);
  useEffect(() => {
    // Security rules restrict club chat reads to current members — don't
    // even attempt the subscription otherwise (it would just fail/no-op).
    if (!isMember) return;
    const myRealUid = auth.currentUser?.uid;
    const unsub = subscribeClubMessages(clubId, msgs =>
      setMessages(msgs.map(m => m.senderId === myRealUid ? { ...m, senderId: 'me' } : m))
    );
    return unsub;
  }, [clubId, isMember]);

  // One-time migration for clubs that still have the old embedded array —
  // idempotent (the field is cleared after migrating, so this naturally
  // becomes a no-op on future loads once it's run once for a given club).
  const legacyMigratedRef = useRef(false);
  useEffect(() => {
    // Security rules only let members write into the messages subcollection
    // or clear the legacy field — a non-member's attempt would just fail.
    if (!isMember) return;
    if (legacyMigratedRef.current) return;
    if (!club.clubMessages || club.clubMessages.length === 0) return;
    legacyMigratedRef.current = true;
    migrateLegacyClubMessages(clubId, club.clubMessages).catch(() => { legacyMigratedRef.current = false; });
  }, [clubId, club.clubMessages, isMember]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Keep announce in sync when club updates
  useEffect(() => {
    if (!editAnnounce) setAnnounce(club.announcement ?? '');
  }, [club.announcement, editAnnounce]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    sendClubMessage(clubId, chatInput.trim());
    setChatInput('');
  };

  const inviteRealPlayer = async () => {
    const clean = realInviteName.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    setRealInviteStatus('loading');
    const data = await lookupUserByUsername(clean).catch(() => null);
    if (!data || !data.uid) { setRealInviteStatus('not-found'); return; }
    if (club.memberIds.includes(data.uid) || club.pendingIds.includes(data.uid)) {
      setRealInviteStatus('already-member');
      return;
    }
    inviteToClub(clubId, data.uid);
    setRealInviteStatus('sent');
    setRealInviteName('');
  };

  const saveAnnouncement = () => {
    updateClub(clubId, { announcement: announce || undefined });
    setEditAnnounce(false);
  };

  // Players not already in a club (for invite search)
  const inviteable = ALL_PLAYERS.filter(p =>
    p.uid !== 'me' &&
    !club.memberIds.includes(p.uid) &&
    !club.pendingIds.includes(p.uid) &&
    p.displayName.toLowerCase().includes(inviteQuery.toLowerCase())
  );

  const tabs: Tab[] = ['Overview', 'Members', 'Chat', ...(canManage ? ['Admin' as Tab] : [])];

  const purposeClass = PURPOSE_COLOR[club.purpose] ?? 'bg-slate-700 text-slate-300 border-slate-600';

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Disband confirmation modal */}
      {leaveModal && (
        <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setLeaveModal(false)}>
          <div ref={leaveModalRef} {...leaveModalProps} className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 outline-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5"/>
              <div>
                <p className="font-semibold text-red-300">Leave {club.name}?</p>
                <p className="text-xs text-slate-400 mt-1">
                  You will lose access to club chat and member features.
                </p>
                {club.isPrivate && (
                  <p className="text-xs text-amber-400 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    ⚠️ This is a private club — you'll need to send a new join request and get approved again if you want to rejoin.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setLeaveModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={() => { leaveClub(clubId); setLeaveModal(false); }} className="flex-1">
                Leave Club
              </Button>
            </div>
          </div>
        </div>
      )}

      {disbandModal && (
        <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => { setDisbandModal(false); setDisbandInput(''); }}>
          <div ref={disbandModalRef} {...disbandModalProps} className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 outline-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5"/>
              <div>
                <p className="font-semibold text-red-300">Disband {club.name}?</p>
                <p className="text-xs text-slate-400 mt-1">This removes the club for all members. Type <span className="font-mono bg-slate-800 px-1 rounded">DISBAND</span> to confirm.</p>
              </div>
            </div>
            <input value={disbandInput} onChange={e => setDisbandInput(e.target.value)}
              placeholder="DISBAND" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-red-500 transition-colors"/>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setDisbandModal(false); setDisbandInput(''); }} className="flex-1">Cancel</Button>
              <Button variant="danger" disabled={disbandInput !== 'DISBAND'} onClick={() => { disbandClub(clubId); setDisbandModal(false); }} className="flex-1">
                Disband
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/players/" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors w-fit">
        <ArrowLeft size={15}/> Back to Players
      </Link>

      {/* Club header card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className={`w-16 h-16 ${club.color} rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0`}>
            {club.logoInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{club.name}</h1>
              {club.isPrivate
                ? <Lock size={13} className="text-slate-400"/>
                : <Globe size={13} className="text-slate-500"/>}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${purposeClass}`}>{club.purpose}</span>
              {isMember && <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">My Club</span>}
              {isOwner  && <span className="text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown size={9}/>Owner</span>}
              {isMod    && <span className="text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield size={9}/>Mod</span>}
            </div>
            <p className="text-xs text-slate-500 mt-1">{club.area} · {club.state} · Est. {club.foundedYear}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Members',  value: `${club.memberIds.length}/${club.maxMembers}` },
            { label: 'Avg MMR',  value: liveAvgMMR.toLocaleString() },
            { label: 'Min MMR',  value: club.minMMR ? club.minMMR.toLocaleString() : 'Open' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-base font-bold text-amber-400">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Join / Leave button */}
        {!isMember && (
          <div>
            {myClubIds.length >= maxClubsForTier(user.tier) ? (
              <p className="text-xs text-slate-500 text-center">
                You've reached your club limit for your tier ({maxClubsForTier(user.tier)}). Climb to a higher tier to join more.
              </p>
            ) : isFull ? (
              <p className="text-xs text-slate-500 text-center">Club is full.</p>
            ) : club.isPrivate ? (
              hasRequested || isPending ? (
                <button onClick={() => cancelClubRequest(clubId)}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors text-slate-300">
                  Cancel Request
                </button>
              ) : (
                <button onClick={() => requestJoinClub(clubId)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors">
                  Request to Join
                </button>
              )
            ) : (
              <button onClick={() => joinClub(clubId)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors">
                Join Club
              </button>
            )}
          </div>
        )}
        {isMember && !isOwner && (
          <button onClick={() => setLeaveModal(true)}
            className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-sm font-semibold transition-colors">
            Leave Club
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors
              ${tab === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'Chat' && <MessageCircle size={11} className="inline mr-1"/>}
            {t === 'Admin' && <Shield size={11} className="inline mr-1"/>}
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-sm text-slate-300 leading-relaxed">{club.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {club.tags.map(tag => (
                <span key={tag} className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>

          {/* Announcement */}
          {club.announcement && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
              <Megaphone size={16} className="text-amber-400 shrink-0 mt-0.5"/>
              <div>
                <p className="text-xs font-bold text-amber-400 mb-1">Club Announcement</p>
                <p className="text-sm text-slate-300">{club.announcement}</p>
              </div>
            </div>
          )}

          {/* Top players */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1.5"><Star size={12}/> Top Players</p>
            <div className="space-y-2">
              {members.slice(0, 5).map((p, i) => (
                <Link key={p.uid} href={`/players/${p.username}/`}
                  className="flex items-center gap-3 hover:bg-slate-800/50 rounded-xl px-2 py-1.5 transition-colors">
                  <span className="text-xs text-slate-600 w-4 shrink-0">#{i + 1}</span>
                  <Avatar name={p.displayName} size="sm" photoURL={(p as UserProfile & { photoURL?: string }).photoURL}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.displayName}</p>
                    <p className="text-[11px] text-slate-500">@{p.username}</p>
                  </div>
                  <TierBadge tier={p.tier}/>
                  <p className="text-xs text-amber-400 font-bold shrink-0">{p.mmr}</p>
                  <ChevronRight size={13} className="text-slate-600"/>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {tab === 'Members' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-semibold">{members.length} Members</p>
            {canManage && <span className="text-[11px] text-slate-500">{club.pendingIds.length} pending</span>}
          </div>
          <div className="divide-y divide-slate-800/60">
            {members.map(p => {
              const isAdmin = club.adminId === p.uid;
              const isModerator = (club.moderatorIds ?? []).includes(p.uid);
              return (
                <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/players/${p.username}/`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                    <Avatar name={p.displayName} size="sm" photoURL={(p as UserProfile & { photoURL?: string }).photoURL}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{p.displayName}</p>
                        {isAdmin    && <Crown size={11} className="text-amber-400 shrink-0"/>}
                        {isModerator && !isAdmin && <Shield size={11} className="text-blue-400 shrink-0"/>}
                        {p.uid === 'me' && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">You</span>}
                        {p.isDummy   && <span className="text-[9px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold">DEMO</span>}
                      </div>
                      <p className="text-[11px] text-slate-500">@{p.username}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <TierBadge tier={p.tier}/>
                      <p className="text-[11px] text-amber-400 font-bold mt-0.5">{p.mmr}</p>
                    </div>
                  </Link>
                  {isOwner && p.uid !== 'me' && (
                    <div className="flex gap-1 shrink-0">
                      {isModerator ? (
                        <button onClick={() => removeModerator(clubId, p.uid)}
                          className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 transition-colors">
                          −Mod
                        </button>
                      ) : (
                        <button onClick={() => assignModerator(clubId, p.uid)}
                          className="text-[10px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-400 transition-colors">
                          +Mod
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chat ── */}
      {tab === 'Chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden" style={{ height: '60vh' }}>
          {!isMember ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
              <MessageCircle size={28} className="opacity-30"/>
              <p className="text-sm">Join the club to participate in group chat.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <div className={`w-6 h-6 ${club.color} rounded-lg flex items-center justify-center text-white font-black text-[9px]`}>
                  {club.logoInitials}
                </div>
                <p className="text-sm font-semibold">{club.name}</p>
                <span className="text-[10px] text-slate-500 ml-auto">{members.length} members</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-600 py-8">No messages yet. Say hi!</p>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === 'me';
                  const sender = ALL_PLAYERS.find(p => p.uid === msg.senderId);
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && <Avatar name={msg.senderName} size="sm" className="mb-0.5 shrink-0"
                        photoURL={sender ? (sender as UserProfile & { photoURL?: string }).photoURL : undefined}/>}
                      <div className="max-w-[75%]">
                        {!isMe && <p className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</p>}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                          ${isMe ? 'bg-emerald-600/80 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                          {msg.text}
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-emerald-200/60' : 'text-slate-500'}`}>{timeAgo(msg.sentAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>
              <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Message the club…"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
                <button onClick={sendMessage} disabled={!chatInput.trim()} aria-label="Send message"
                  className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0">
                  <Send size={16}/>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Admin ── */}
      {tab === 'Admin' && canManage && (
        <div className="space-y-4">

          {/* Pending join requests */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-sm font-semibold">Pending Requests <span className="text-slate-500 font-normal">({pendingMembers.length})</span></p>
            </div>
            {pendingMembers.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-6">No pending requests.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {pendingMembers.map(p => (
                  <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={p.displayName} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.displayName}</p>
                      <p className="text-[11px] text-slate-500">{p.mmr} MMR · {p.tier}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => acceptClubMember(clubId, p.uid)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold transition-colors">
                        <Check size={12}/> Accept
                      </button>
                      <button onClick={() => declineClubMember(clubId, p.uid)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold transition-colors">
                        <X size={12}/> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invite a player */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-sm font-semibold">Invite a Player</p>
              <p className="text-xs text-slate-500 mt-0.5">Search for players not yet in the club.</p>
            </div>
            <div className="p-4 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={inviteQuery} onChange={e => setInviteQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
              </div>
              {inviteQuery.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {inviteable.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-3">No players found.</p>
                  ) : (
                    inviteable.slice(0, 8).map(p => (
                      <div key={p.uid} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-xl">
                        <Avatar name={p.displayName} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.displayName}</p>
                          <p className="text-[11px] text-slate-500">{p.mmr} MMR · {p.tier}</p>
                        </div>
                        <button onClick={() => { inviteToClub(clubId, p.uid); setInviteQuery(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold transition-colors shrink-0">
                          <UserPlus size={11}/> Invite
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Real accounts aren't in the demo roster search above — invite
                  one by their exact username instead. */}
              <div className="pt-2 border-t border-slate-800/60">
                <p className="text-[11px] text-slate-500 mb-1.5">Or invite a real account by exact username</p>
                <div className="flex gap-2">
                  <input value={realInviteName}
                    onChange={e => { setRealInviteName(e.target.value); setRealInviteStatus('idle'); }}
                    onKeyDown={e => e.key === 'Enter' && inviteRealPlayer()}
                    placeholder="@username"
                    className="flex-1 pl-3 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors"/>
                  <button onClick={inviteRealPlayer} disabled={!realInviteName.trim() || realInviteStatus === 'loading'}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition-colors shrink-0">
                    <UserPlus size={11}/> {realInviteStatus === 'loading' ? 'Inviting…' : 'Invite'}
                  </button>
                </div>
                {realInviteStatus === 'not-found' && <p className="text-xs text-red-400 mt-1.5">No account found with that username.</p>}
                {realInviteStatus === 'already-member' && <p className="text-xs text-amber-400 mt-1.5">Already a member or has a pending request.</p>}
                {realInviteStatus === 'sent' && <p className="text-xs text-emerald-400 mt-1.5">Added to the club.</p>}
              </div>
            </div>
          </div>

          {/* Edit announcement */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2"><Megaphone size={14}/> Announcement</p>
              {!editAnnounce && (
                <button onClick={() => setEditAnnounce(true)}
                  className="text-xs text-emerald-400 hover:underline">Edit</button>
              )}
            </div>
            {editAnnounce ? (
              <>
                <textarea value={announce} onChange={e => setAnnounce(e.target.value)} rows={3}
                  placeholder="Post a club-wide announcement…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 resize-none transition-colors"/>
                <div className="flex gap-2">
                  <button onClick={saveAnnouncement}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors">Save</button>
                  <button onClick={() => { setEditAnnounce(false); setAnnounce(club.announcement ?? ''); }}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">{club.announcement || <span className="text-slate-600 italic">No announcement posted.</span>}</p>
            )}
          </div>

          {/* Disband (owner only) */}
          {isOwner && (
            <button onClick={() => setDisbandModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 rounded-xl text-sm font-medium transition-colors">
              <Trash2 size={14}/> Disband Club
            </button>
          )}
        </div>
      )}
    </div>
  );
}
