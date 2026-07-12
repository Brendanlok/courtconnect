'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';
import type { UserProfile, Match, Conversation, Tournament, Challenge, Club, Notification, ClubMessage, CourtPosition, CourtProfile, Tier } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS, TOURNAMENTS as SEED_TOURNAMENTS, CLUBS as SEED_CLUBS } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { maxClubsForTier, getTier } from '@/lib/utils';
import { onAuthStateChanged } from 'firebase/auth';
import { ME as ME_DATA, PLAYERS as ALL_PLAYERS } from '@/lib/data';
import {
  saveMatch, saveUserProfile, saveOpenToPlay, loadUserProfile,
  saveTournamentReg, deleteTournamentReg,
  loadConversations,
  subscribeChallengesFor, sendChallengeDoc, updateChallengeStatus, type StoredChallenge,
  subscribeMySharedConversations, sendSharedMessage, chatIdFor, type SharedConversation, type SharedParticipant,
  subscribeEndorsementsReceived, setEndorsementDoc,
  subscribeClubs, ensureSeedClubsExist, createClubDoc, updateClubDoc, deleteClubDoc,
  addClubMember, removeClubMember, addClubPending, removeClubPending, setClubModerator,
  sendClubMessageDoc, subscribeClubMessages,
  subscribeMyRealMatches, sendMatchDoc, confirmSharedMatch, disputeSharedMatch, cancelSharedMatch,
  markMatchMmrApplied, type StoredMatch,
} from '@/lib/firestoreService';

// A uid is "real" (a genuine Firebase-authenticated account) if it isn't the
// local demo user ('me') or one of the static seed players from lib/data.ts.
const isRealUid = (uid: string) => uid !== 'me' && !ALL_PLAYERS.some(p => p.uid === uid) && uid !== ME_DATA.uid;

// Normalizes a Firestore-shared challenge into the app's local, 'me'-centric
// Challenge shape — same convention already used for matches (player1Id: 'me'
// locally, real uid only on the shared doc).
function toLocalChallenge(c: StoredChallenge, myUid: string): Challenge {
  return {
    id: c.id,
    fromId: c.fromUid === myUid ? 'me' : c.fromUid, fromName: c.fromName, fromUsername: c.fromUsername,
    toId: c.toUid === myUid ? 'me' : c.toUid, toName: c.toName, toUsername: c.toUsername,
    format: c.format as Challenge['format'], venue: c.venue, date: c.date, message: c.message,
    status: c.status, createdAt: c.createdAt,
  };
}

// Normalizes a shared conversation doc into the local Conversation shape.
// Only the fields chat/page.tsx actually reads (name, username, tier, mmr,
// photo) are populated with real data; the rest are inert placeholders.
function toLocalConversation(c: SharedConversation, myUid: string, lastRead: Record<string, string>): Conversation {
  const otherUid = c.participantUids.find(u => u !== myUid) ?? c.participantUids[0];
  const p = c.participants?.[otherUid];
  const participant: UserProfile = {
    uid: otherUid,
    username: p?.username ?? otherUid,
    displayName: p?.displayName ?? 'Player',
    email: '', mmr: p?.mmr ?? 1200, tier: (p?.tier as Tier) ?? 'Beginner',
    globalRank: 0, state: 'Kuala Lumpur', area: '',
    stats: { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
    photoURL: p?.photoURL ?? null,
  };
  const readAt = lastRead[c.id] ?? '';
  return {
    id: c.id, participant,
    lastMessage: c.lastMessage, lastAt: c.lastAt,
    // Real conversations have no server-tracked read receipt — "unread" is
    // just "arrived after the last time this device opened this chat",
    // stored locally (cc_realLastRead), same as every other per-device UI
    // preference in this app (openToPlay, following, etc.).
    unread: c.messages.filter(m => m.senderId !== myUid && m.sentAt > readAt).length,
    messages: c.messages.map(m => ({ id: m.id, senderId: m.senderId === myUid ? 'me' : m.senderId, text: m.text, sentAt: m.sentAt })),
  };
}

// Normalizes a shared match doc into the local, player1-is-always-'me' shape
// every existing Match consumer already expects. mmrChange is stored from the
// reporter's perspective; the other side gets the zero-sum-negated value.
// pendingConfirmations is translated so 'me' appears only when it's genuinely
// this viewer's turn to act — an outstanding *opponent* uid (the reporter's
// view while waiting) is left as their real uid, never 'me'.
function toLocalMatch(sm: StoredMatch, myUid: string): Match {
  const amP1 = sm.player1Id === myUid;
  const my  = amP1 ? { id: 'me', name: sm.player1Name, username: sm.player1Username }
                   : { id: 'me', name: sm.player2Name, username: sm.player2Username };
  const opp = amP1 ? { id: sm.player2Id, name: sm.player2Name, username: sm.player2Username }
                   : { id: sm.player1Id, name: sm.player1Name, username: sm.player1Username };
  const myDelta = sm.mmrChange === undefined ? undefined : (sm.reporterUid === myUid ? sm.mmrChange : -sm.mmrChange);
  return {
    id: sm.id, type: sm.type as Match['type'],
    player1Id: my.id, player1Name: my.name, player1Username: my.username,
    player2Id: opp.id, player2Name: opp.name, player2Username: opp.username,
    winnerId: sm.winnerId === myUid ? 'me' : opp.id,
    games: amP1 ? sm.games : sm.games.map(g => ({ p1: g.p2, p2: g.p1 })),
    status: sm.status,
    mmrChange: myDelta,
    playedAt: sm.playedAt,
    location: sm.location,
    pendingConfirmations: sm.pendingConfirmations.map(u => u === myUid ? 'me' : u),
  };
}

// Same normalization for clubs: real Firebase uids on the shared Firestore
// doc, translated to the local 'me' convention for display/equality checks.
function toLocalClub(c: Club, myUid: string): Club {
  const translate = (uid: string) => uid === myUid ? 'me' : uid;
  return {
    ...c,
    adminId: translate(c.adminId),
    moderatorIds: (c.moderatorIds ?? []).map(translate),
    memberIds: c.memberIds.map(translate),
    pendingIds: c.pendingIds.map(translate),
    clubMessages: c.clubMessages?.map(m => ({ ...m, senderId: translate(m.senderId) })),
  };
}
const toRealUid = (localUid: string, myUid: string) => localUid === 'me' ? myUid : localUid;

interface AppCtx {
  user: UserProfile;
  matches: Match[];
  addMatch: (m: Match) => void;
  confirmMatch: (id: string, uid?: string) => void;
  disputeMatch: (id: string) => void;
  cancelPendingMatch: (id: string) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  conversations: Conversation[];
  setConversations: (c: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  sendRealMessage: (otherUid: string, otherProfile: SharedParticipant, text: string) => void;
  markRealConvRead: (chatId: string) => void;
  totalUnread: number;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  tournaments: Tournament[];
  addTournament: (t: Tournament) => void;
  registrations: Record<string, { registeredAt: string }>;
  pendingRequests: Record<string, { requestedAt: string }>;
  registerTournament: (id: string) => void;
  unregisterTournament: (id: string) => void;
  requestToJoin: (id: string) => void;
  cancelRequest: (id: string) => void;
  challenges: Challenge[];
  sendChallenge: (c: Challenge) => void;
  acceptChallenge: (id: string) => void;
  declineChallenge: (id: string) => void;
  cancelChallenge: (id: string) => void;
  // Clubs
  clubs: Club[];
  myClubIds: string[];
  clubLimit: number;                     // max clubs allowed at the user's current tier
  joinClub: (id: string) => void;        // join public club
  requestJoinClub: (id: string) => void; // request to join private club
  cancelClubRequest: (id: string) => void;
  leaveClub: (id: string) => void;
  createClub: (c: Club) => void;
  updateClub: (id: string, patch: Partial<Club>) => void;
  acceptClubMember: (clubId: string, uid: string) => void;
  declineClubMember: (clubId: string, uid: string) => void;
  disbandClub: (id: string) => void;
  assignModerator: (clubId: string, uid: string) => void;
  removeModerator: (clubId: string, uid: string) => void;
  myClubPendingIds: string[];            // clubs I've requested to join
  clubInvites: string[];                 // club IDs I've been invited to
  inviteToClub: (clubId: string, targetUid: string) => void;
  acceptClubInvite: (clubId: string) => void;
  declineClubInvite: (clubId: string) => void;
  sendClubMessage: (clubId: string, text: string) => void;
  // Follow
  following: string[];
  followRequestsSent: string[];
  followPlayer: (uid: string, isTargetPrivate?: boolean) => void;
  unfollowPlayer: (uid: string) => void;
  // Clip Credits & Court
  clipCredits: number;
  awardClipCredits: (amount: number) => void;
  courtProfile: CourtProfile | null;
  saveCourtPositions: (positions: CourtPosition[]) => void;
  // Endorsements
  myEndorsements: Record<string, string[]>;            // targetUid → skills I've endorsed
  playerEndorsements: Record<string, Record<string, number>>; // targetUid → skill → count
  endorsePlayer: (targetUid: string, skill: string) => void;
  // Notifications
  notifications: Notification[];
  unreadNotifCount: number;
  addNotification: (n: Notification | Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_userProfile');
        if (saved) return { ...ME, ...JSON.parse(saved) };
      } catch { /* ignore */ }
      const otp = localStorage.getItem('cc_openToPlay');
      if (otp !== null) return { ...ME, openToPlay: otp === 'true' };
    }
    return ME;
  });
  const [matches,          setMatches]          = useState<Match[]>(SEED_MATCHES);
  const [localConversations, setLocalConversations] = useState<Conversation[]>(SEED_CONVS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tournaments,      setTournaments]      = useState<Tournament[]>(SEED_TOURNAMENTS);
  const [registrations,    setRegistrations]    = useState<Record<string, { registeredAt: string }>>({});
  const [pendingRequests,  setPendingRequests]  = useState<Record<string, { requestedAt: string }>>({});
  const [localChallenges,  setLocalChallenges]  = useState<Challenge[]>([]);
  // Real, cross-account challenges/conversations/endorsements — populated via
  // Firestore real-time listeners once signed in (see the effect below).
  const [realIncomingChallenges, setRealIncomingChallenges] = useState<StoredChallenge[]>([]);
  const [realOutgoingChallenges, setRealOutgoingChallenges] = useState<StoredChallenge[]>([]);
  const [realConversationDocs,   setRealConversationDocs]   = useState<SharedConversation[]>([]);
  const [realEndorsementCounts,  setRealEndorsementCounts]  = useState<Record<string, number>>({});
  const [realMatches,            setRealMatches]            = useState<StoredMatch[]>([]);
  // Per-chat "last opened" timestamp for real conversations — device-local,
  // same idea as every other per-device UI preference here (openToPlay, etc.).
  const [realLastRead,           setRealLastRead]           = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_realLastRead');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return {};
  });
  // Clubs live in Firestore now (real, shared documents — see the real-time
  // subscription effect below) so two real accounts actually see the same
  // membership/pending/moderator state. rawClubs holds real Firebase uids;
  // `clubs` (translated for display) and myClubIds/myClubPendingIds are
  // derived from it further down, same 'me'-normalization as challenges.
  const [rawClubs,         setRawClubs]          = useState<Club[]>(SEED_CLUBS);
  const [clubInvites,      setClubInvites]       = useState<string[]>([]);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [following,              setFollowing]             = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_following');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });
  const [followRequestsSent,     setFollowRequestsSent]    = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_followRequestsSent');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });
  const [myEndorsements,   setMyEndorsements]   = useState<Record<string, string[]>>({});
  const [playerEndorsements, setPlayerEndorsements] = useState<Record<string, Record<string, number>>>({});
  const [clipCredits,      setClipCredits]      = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('cc_clipCredits') ?? '0', 10) || 0;
    }
    return 0;
  });
  const [courtProfile,     setCourtProfile]     = useState<CourtProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_courtProfile');
        if (saved) return JSON.parse(saved) as CourtProfile;
      } catch { /* ignore */ }
    }
    return null;
  });

  // Load the real signed-in user's actual profile + conversations from Firestore.
  // Without this, the app just shows the local demo seed profile forever,
  // regardless of who's actually logged in — everything a real user set during
  // signup (username, name, etc.) would never appear anywhere.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) return;
      try {
        const profile = await loadUserProfile(authUser.uid);
        if (profile) {
          setUser(u => ({
            ...u, ...profile,
            uid: 'me', // keep the app-wide local convention — the real uid lives in auth.currentUser
            tier: getTier(profile.mmr ?? u.mmr),
          }));
        }
      } catch { /* Firestore unavailable — keep local/seed profile */ }
      try {
        const stored = await loadConversations(authUser.uid);
        if (!stored.length) return;
        const allPlayers = [ME_DATA, ...ALL_PLAYERS];
        setLocalConversations(prev => {
          const merged = [...prev];
          stored.forEach(s => {
            const participant = allPlayers.find(p => p.uid === s.participantUid);
            if (!participant) return;
            const idx = merged.findIndex(c => c.id === s.id);
            const conv: Conversation = { id: s.id, participant, lastMessage: s.lastMessage, lastAt: s.lastAt, unread: s.unread, messages: s.messages };
            if (idx >= 0) merged[idx] = conv;
            else merged.unshift(conv);
          });
          return merged.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
        });
      } catch { /* Firestore unavailable — keep seed convs */ }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notifications — single entry point: adds to the bell AND fires a phone/desktop
  // push notification (via the service worker when available) whenever the app
  // isn't the focused tab, so nothing that reaches the bell is silently missed.
  // Declared here (ahead of the real-time subscription effect below) because
  // that effect calls it directly when a real cross-account event comes in.
  const addNotification = useCallback((n: Notification | Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const full: Notification = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      createdAt: new Date().toISOString(),
      ...n,
    } as Notification;
    setNotifications(p => [full, ...p]);

    if (typeof window === 'undefined' || document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const opts: NotificationOptions = {
        body: full.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: full.id,
        data: { linkTo: full.linkTo },
      };
      if (navigator.serviceWorker?.ready) {
        navigator.serviceWorker.ready
          .then(reg => reg.showNotification(full.title, opts))
          .catch(() => { try { new Notification(full.title, opts); } catch { /* ignore */ } });
      } else {
        new Notification(full.title, opts);
      }
    } catch { /* ignore */ }
  }, []);

  // Real-time cross-account sync: challenges, chat, clubs, and endorsements
  // only exist for genuinely authenticated users — local/demo state is
  // untouched. Each subscription diffs against the previous snapshot so a
  // genuine change (not just "app reconnected") fires a notification —
  // otherwise every real-time event would be silent until you happened to
  // reload the screen that shows it.
  const prevIncomingChallengesRef = useRef<StoredChallenge[]>([]);
  const prevOutgoingChallengesRef = useRef<StoredChallenge[]>([]);
  const prevConversationsRef      = useRef<SharedConversation[]>([]);
  const prevClubsRef              = useRef<Club[]>([]);
  const prevMatchesRef             = useRef<StoredMatch[]>([]);
  const realUnsubsRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      realUnsubsRef.current.forEach(fn => fn());
      realUnsubsRef.current = [];
      if (!authUser) {
        setRealIncomingChallenges([]); setRealOutgoingChallenges([]);
        setRealConversationDocs([]); setRealEndorsementCounts({}); setRealMatches([]);
        prevIncomingChallengesRef.current = []; prevOutgoingChallengesRef.current = [];
        prevConversationsRef.current = []; prevClubsRef.current = []; prevMatchesRef.current = [];
        return;
      }
      const uid = authUser.uid;
      ensureSeedClubsExist(SEED_CLUBS).catch(() => {});
      realUnsubsRef.current = [
        subscribeChallengesFor('toUid', uid, docs => {
          const prev = prevIncomingChallengesRef.current;
          docs.filter(d => d.status === 'pending' && !prev.some(p => p.id === d.id))
            .forEach(c => addNotification({ type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` }));
          prevIncomingChallengesRef.current = docs;
          setRealIncomingChallenges(docs);
        }),
        subscribeChallengesFor('fromUid', uid, docs => {
          const prev = prevOutgoingChallengesRef.current;
          docs.forEach(d => {
            const old = prev.find(p => p.id === d.id);
            if (old?.status !== 'pending') return;
            if (d.status === 'accepted') addNotification({ type: 'challenge_accepted', title: 'Challenge Accepted', body: `${d.toName} accepted your challenge!` });
            else if (d.status === 'declined') addNotification({ type: 'challenge_declined', title: 'Challenge Declined', body: `${d.toName} declined your challenge.` });
          });
          prevOutgoingChallengesRef.current = docs;
          setRealOutgoingChallenges(docs);
        }),
        subscribeMySharedConversations(uid, docs => {
          const prev = prevConversationsRef.current;
          docs.forEach(d => {
            const oldCount = prev.find(p => p.id === d.id)?.messages.length ?? 0;
            const newFromOther = d.messages.slice(oldCount).filter(m => m.senderId !== uid);
            if (newFromOther.length === 0) return;
            const otherUid = d.participantUids.find(u => u !== uid) ?? '';
            const otherName = d.participants?.[otherUid]?.displayName ?? 'Someone';
            addNotification({ type: 'new_message', title: `New message from ${otherName}`, body: newFromOther[newFromOther.length - 1].text, linkTo: `/chat/?realUid=${otherUid}` });
          });
          prevConversationsRef.current = docs;
          setRealConversationDocs(docs);
        }),
        subscribeEndorsementsReceived(uid, setRealEndorsementCounts),
        subscribeClubs(docs => {
          const prev = prevClubsRef.current;
          docs.forEach(c => {
            const old = prev.find(p => p.id === c.id);
            if (!old) return; // first load — nothing "changed" yet, don't notify

            const iManage = c.adminId === uid || (c.moderatorIds ?? []).includes(uid);
            if (iManage) {
              c.pendingIds.filter(p => !old.pendingIds.includes(p))
                .forEach(() => addNotification({ type: 'club_join_request', title: 'Join Request', body: `Someone requested to join ${c.name}.`, meta: { clubId: c.id } }));
            }

            // New club chat messages are handled by the separate,
            // per-my-club message subscription below — clubMessages is no
            // longer embedded on the club doc (see sendClubMessageDoc).

            if (old.pendingIds.includes(uid) && !c.pendingIds.includes(uid)) {
              if (c.memberIds.includes(uid)) addNotification({ type: 'club_accepted', title: 'Joined Club', body: `Your request to join ${c.name} was accepted!` });
              else addNotification({ type: 'club_declined', title: 'Request Declined', body: `Your request to join ${c.name} was declined.` });
            }
          });
          prevClubsRef.current = docs;
          setRawClubs(docs);
        }),
        subscribeMyRealMatches(uid, docs => {
          const prev = prevMatchesRef.current;
          docs.forEach(d => {
            const old = prev.find(p => p.id === d.id);
            if (!old && d.pendingConfirmations.includes(uid)) {
              const oppName = d.reporterUid === d.player1Id ? d.player1Name : d.player2Name;
              addNotification({ type: 'match_pending', title: 'Match Result Reported', body: `${oppName} reported a match result — confirm or dispute it.` });
            } else if (old?.status === 'Pending' && d.status === 'Confirmed' && d.reporterUid === uid) {
              addNotification({ type: 'match_confirmed', title: 'Match Confirmed', body: 'Your opponent confirmed the match result.' });
            }
          });
          prevMatchesRef.current = docs;
          setRealMatches(docs);
        }),
      ];
    });
    return () => { unsubAuth(); realUnsubsRef.current.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Applies each side's own MMR delta exactly once per confirmed real match.
  // Durable across reloads/devices via mmrAppliedBy on the shared doc (not
  // just in-memory state) — a match confirmed while this device was offline
  // still needs its delta applied the next time it's seen.
  const mmrApplyingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    realMatches.forEach(m => {
      if (m.status !== 'Confirmed' || m.mmrAppliedBy.includes(uid) || mmrApplyingRef.current.has(m.id)) return;
      mmrApplyingRef.current.add(m.id);
      const iWon = m.winnerId === uid;
      const delta = (m.reporterUid === uid ? m.mmrChange : m.mmrChange !== undefined ? -m.mmrChange : undefined) ?? 0;
      setUser(u => ({
        ...u, mmr: u.mmr + delta,
        stats: { wins: u.stats.wins + (iWon ? 1 : 0), losses: u.stats.losses + (iWon ? 0 : 1), totalMatches: u.stats.totalMatches + 1 },
      }));
      markMatchMmrApplied(m.id, uid).catch(() => { mmrApplyingRef.current.delete(m.id); });
    });
  }, [realMatches]);

  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
    const uid = auth.currentUser?.uid;
    if (uid) saveOpenToPlay(uid, user.openToPlay ?? false).catch(() => {});
  }, [user.openToPlay]);

  const isRealMatchId = useCallback((id: string) => realMatches.some(m => m.id === id), [realMatches]);

  // A match against a real, singles opponent becomes a shared Firestore doc
  // both accounts can see and confirm, instead of a local-only record only
  // the reporter ever sees — see toLocalMatch for how each side reads it
  // back. Doubles (or a demo opponent) keep the original local-only path.
  const addMatch      = useCallback((m: Match) => {
    const uid = auth.currentUser?.uid;
    if (uid && isRealUid(m.player2Id) && !m.player1PartnerId && !m.player2PartnerId) {
      const stored: StoredMatch = {
        id: m.id, type: m.type,
        participantUids: [uid, m.player2Id],
        reporterUid: uid,
        player1Id: uid, player1Name: m.player1Name, player1Username: m.player1Username,
        player2Id: m.player2Id, player2Name: m.player2Name, player2Username: m.player2Username,
        winnerId: toRealUid(m.winnerId ?? 'me', uid),
        games: m.games,
        status: 'Pending',
        mmrChange: m.mmrChange,
        playedAt: m.playedAt,
        location: m.location,
        pendingConfirmations: [m.player2Id],
        mmrAppliedBy: [],
      };
      sendMatchDoc(stored).catch(() => {});
      // Optimistic local echo, same pattern as sendChallenge.
      setRealMatches(p => [stored, ...p.filter(x => x.id !== stored.id)]);
      return;
    }
    setMatches(p => [m, ...p]);
    if (uid) saveMatch(uid, m).catch(() => {});
  }, []);
  const confirmMatch  = useCallback((id: string, uid?: string) => {
    const realUid = auth.currentUser?.uid;
    if (isRealMatchId(id) && realUid) {
      confirmSharedMatch(id, realUid).catch(() => {});
      return;
    }
    setMatches(prev => prev.map(m => {
      if (m.id !== id || m.status !== 'Pending') return m;

      // Multi-party confirmation: remove this uid from the pending list.
      // If others are still outstanding, stay Pending — don't apply MMR yet.
      if (uid && m.pendingConfirmations && m.pendingConfirmations.length > 0) {
        const remaining = m.pendingConfirmations.filter(u => u !== uid);
        if (remaining.length > 0) {
          return { ...m, pendingConfirmations: remaining };
        }
      }

      const iWon = m.winnerId === 'me';
      const delta = m.mmrChange ?? 0;
      setUser(u => ({
        ...u, mmr: u.mmr + delta,
        stats: { wins: u.stats.wins + (iWon?1:0), losses: u.stats.losses + (iWon?0:1), totalMatches: u.stats.totalMatches + 1 },
      }));
      return { ...m, status: 'Confirmed' as const, pendingConfirmations: [] };
    }));
  }, [isRealMatchId]);
  const disputeMatch  = useCallback((id: string) => {
    if (isRealMatchId(id)) { disputeSharedMatch(id).catch(() => {}); return; }
    setMatches(p => p.map(m => m.id === id ? { ...m, status: 'Disputed' as const } : m));
  }, [isRealMatchId]);
  // Withdraws a match still waiting on other players' confirmation — for when an
  // opponent never responds. No MMR was ever applied for a Pending match, so
  // there's nothing to roll back.
  const cancelPendingMatch = useCallback((id: string) => {
    if (isRealMatchId(id)) { cancelSharedMatch(id).catch(() => {}); return; }
    setMatches(p => p.map(m =>
      m.id === id && m.status === 'Pending' ? { ...m, status: 'Cancelled' as const, pendingConfirmations: [] } : m
    ));
  }, [isRealMatchId]);
  const updateUser    = useCallback((patch: Partial<UserProfile>) => {
    setUser(u => {
      const next = { ...u, ...patch };
      try {
        // persist all profile fields except seed-only ones
        const { uid, username, globalRank, stats, mmr, tier, ...rest } = next;
        localStorage.setItem('cc_userProfile', JSON.stringify(rest));
      } catch { /* ignore */ }
      return next;
    });
    const uid = auth.currentUser?.uid;
    if (uid) saveUserProfile(uid, patch).catch(() => {});
  }, []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);

  const addTournament       = useCallback((t: Tournament) => setTournaments(ts => [t, ...ts]), []);
  const registerTournament  = useCallback((id: string) => {
    const reg = { registeredAt: new Date().toISOString() };
    setRegistrations(r => ({ ...r, [id]: reg }));
    setTournaments(ts => ts.map(t => t.id === id ? {
      ...t,
      currentPlayers: t.currentPlayers + 1,
      participants: [...(t.participants ?? []), { displayName: user.displayName, username: user.username }],
    } : t));
    addNotification({ type: 'event_registered', title: 'Event Registration', body: 'You have registered for the event!' });
    const uid = auth.currentUser?.uid;
    if (uid) saveTournamentReg(uid, id, reg).catch(() => {});
  }, [user.displayName, user.username]);
  const unregisterTournament = useCallback((id: string) => {
    setRegistrations(r => { const n = { ...r }; delete n[id]; return n; });
    setTournaments(ts => ts.map(t => t.id === id ? {
      ...t,
      currentPlayers: Math.max(0, t.currentPlayers - 1),
      participants: (t.participants ?? []).filter(p => p.username !== user.username),
    } : t));
    const uid = auth.currentUser?.uid;
    if (uid) deleteTournamentReg(uid, id).catch(() => {});
  }, [user.username]);
  const requestToJoin = useCallback((id: string) => setPendingRequests(r => ({ ...r, [id]: { requestedAt: new Date().toISOString() } })), []);
  const cancelRequest = useCallback((id: string) => setPendingRequests(r => { const n = { ...r }; delete n[id]; return n; }), []);

  const isRealChallengeId = useCallback((id: string) =>
    realIncomingChallenges.some(c => c.id === id) || realOutgoingChallenges.some(c => c.id === id),
  [realIncomingChallenges, realOutgoingChallenges]);

  const sendChallenge    = useCallback((c: Challenge) => {
    const realUid = auth.currentUser?.uid;
    if (isRealUid(c.toId) && realUid) {
      const stored: StoredChallenge = {
        id: c.id, fromUid: realUid, fromName: c.fromName, fromUsername: c.fromUsername,
        toUid: c.toId, toName: c.toName, toUsername: c.toUsername,
        format: c.format, venue: c.venue, date: c.date, message: c.message,
        status: 'pending', createdAt: new Date().toISOString(),
      };
      sendChallengeDoc(stored).catch(() => {});
      // Optimistic local echo — the listener reconciles once Firestore confirms.
      setRealOutgoingChallenges(p => [stored, ...p.filter(x => x.id !== stored.id)]);
      return;
    }
    setLocalChallenges(p => [c, ...p]);
  }, []);
  const acceptChallenge  = useCallback((id: string) => {
    if (isRealChallengeId(id)) { updateChallengeStatus(id, 'accepted').catch(() => {}); return; }
    setLocalChallenges(p => p.map(c => c.id === id ? { ...c, status: 'accepted' as const } : c));
    addNotification({ type: 'challenge_accepted', title: 'Challenge Accepted', body: 'Your match challenge was accepted!' });
  }, [isRealChallengeId]);
  const declineChallenge = useCallback((id: string) => {
    if (isRealChallengeId(id)) { updateChallengeStatus(id, 'declined').catch(() => {}); return; }
    setLocalChallenges(p => p.map(c => c.id === id ? { ...c, status: 'declined' as const } : c));
  }, [isRealChallengeId]);
  const cancelChallenge  = useCallback((id: string) => {
    if (isRealChallengeId(id)) { updateChallengeStatus(id, 'cancelled').catch(() => {}); return; }
    setLocalChallenges(p => p.map(c => c.id === id ? { ...c, status: 'cancelled' as const } : c));
  }, [isRealChallengeId]);

  // Clubs — translated to the local 'me' convention for display; how many a
  // user can belong to at once scales with MMR tier. Every mutation below
  // writes straight to Firestore (arrayUnion/arrayRemove — safe under
  // concurrent edits from real members) and relies on the live subscription
  // above to reflect the change back, rather than managing local copies.
  const myRealUid = auth.currentUser?.uid ?? '';
  // Memoized: without this, `clubs` (and everything derived from it) would be
  // a brand-new array on every AppContext render — including ones triggered
  // by totally unrelated state elsewhere in the app — which cascades into
  // needless re-renders and re-fires any consumer effect keyed on these
  // arrays (which is exactly what happened in ClubDetailClient's real-member
  // profile lookup before it was hardened against unstable deps).
  const clubs: Club[] = useMemo(() => rawClubs.map(c => toLocalClub(c, myRealUid)), [rawClubs, myRealUid]);
  const myClubIds = useMemo(() => clubs.filter(c => c.memberIds.includes('me')).map(c => c.id), [clubs]);
  const myClubPendingIds = useMemo(() => clubs.filter(c => c.pendingIds.includes('me')).map(c => c.id), [clubs]);
  const clubLimit = maxClubsForTier(user.tier);

  const joinClub = useCallback((id: string) => {
    if (myClubIds.includes(id) || myClubIds.length >= clubLimit || !myRealUid) return;
    addClubMember(id, myRealUid).catch(() => {});
    addNotification({ type: 'club_accepted', title: 'Joined Club', body: `You joined a new club!` });
  }, [myClubIds, clubLimit, myRealUid]);

  const requestJoinClub = useCallback((id: string) => {
    if (myClubIds.length + myClubPendingIds.length >= clubLimit || !myRealUid) return;
    addClubPending(id, myRealUid).catch(() => {});
    addNotification({ type: 'club_request', title: 'Request Sent', body: 'Your request to join the club has been sent.' });
  }, [myClubIds, myClubPendingIds, clubLimit, myRealUid]);

  const cancelClubRequest = useCallback((id: string) => {
    if (!myRealUid) return;
    removeClubPending(id, myRealUid).catch(() => {});
  }, [myRealUid]);

  const leaveClub = useCallback((id: string) => {
    if (!myRealUid) return;
    removeClubMember(id, myRealUid).catch(() => {});
  }, [myRealUid]);

  const createClub = useCallback((c: Club) => {
    if (!myRealUid) return;
    const stored: Club = {
      ...c,
      adminId: toRealUid(c.adminId, myRealUid),
      memberIds: c.memberIds.map(u => toRealUid(u, myRealUid)),
    };
    createClubDoc(stored).catch(() => {});
  }, [myRealUid]);

  const updateClub = useCallback((id: string, patch: Partial<Club>) => {
    updateClubDoc(id, patch).catch(() => {});
  }, []);

  const disbandClub = useCallback((id: string) => {
    deleteClubDoc(id).catch(() => {});
  }, []);

  const assignModerator = useCallback((clubId: string, uid: string) => {
    setClubModerator(clubId, toRealUid(uid, myRealUid), true).catch(() => {});
  }, [myRealUid]);

  const removeModerator = useCallback((clubId: string, uid: string) => {
    setClubModerator(clubId, toRealUid(uid, myRealUid), false).catch(() => {});
  }, [myRealUid]);

  const acceptClubMember = useCallback((clubId: string, uid: string) => {
    addClubMember(clubId, toRealUid(uid, myRealUid)).catch(() => {});
    addNotification({ type: 'club_accepted', title: 'Member Accepted', body: 'A new member joined your club.' });
  }, [myRealUid]);

  const declineClubMember = useCallback((clubId: string, uid: string) => {
    removeClubPending(clubId, toRealUid(uid, myRealUid)).catch(() => {});
  }, [myRealUid]);

  const inviteToClub = useCallback((clubId: string, targetUid: string) => {
    if (targetUid === 'me') {
      // Being invited by someone else — add pending invite + notification.
      // (Kept local/session-only — a real per-account "invites received"
      // list is a scoped-out follow-up, same as the club migration itself.)
      setClubInvites(p => [...p, clubId]);
      addNotification({ type: 'club_invite', title: 'Club Invitation', body: 'You have been invited to join a club!', meta: { clubId } });
    } else {
      // Admin inviting another player — adds them immediately, matching the
      // existing (consent-free) demo behavior; now persisted for real.
      addClubMember(clubId, targetUid).catch(() => {});
      addNotification({ type: 'club_accepted', title: 'Invite Sent', body: 'Player has been added to the club.' });
    }
  }, []);

  const acceptClubInvite = useCallback((clubId: string) => {
    if ((!myClubIds.includes(clubId) && myClubIds.length >= clubLimit) || !myRealUid) return;
    setClubInvites(p => p.filter(id => id !== clubId));
    addClubMember(clubId, myRealUid).catch(() => {});
    addNotification({ type: 'club_accepted', title: 'Joined Club', body: 'You accepted the club invitation!' });
  }, [myClubIds, clubLimit, myRealUid]);

  const declineClubInvite = useCallback((clubId: string) => {
    setClubInvites(p => p.filter(id => id !== clubId));
    addNotification({ type: 'club_declined', title: 'Invitation Declined', body: 'You declined the club invitation.' });
  }, []);

  const sendClubMessage = useCallback((clubId: string, text: string) => {
    if (!myRealUid) return;
    const msg: ClubMessage = {
      id: `cm_${Date.now()}`,
      senderId: myRealUid,
      senderName: user.displayName,
      text,
      sentAt: new Date().toISOString(),
    };
    sendClubMessageDoc(clubId, msg).catch(() => {});
  }, [user.displayName, myRealUid]);

  // New-club-message notifications, scoped to only the clubs I'm actually a
  // member of — NOT the full clubs collection. One Firestore listener per
  // club I've joined (bounded by the per-tier club cap, so at most a handful
  // per user), reconciled as myClubIds changes rather than tearing down and
  // recreating every subscription on every unrelated re-render: no cleanup
  // is returned from this effect itself (the ref persists across renders and
  // add/remove is handled explicitly in the body); a separate mount-only
  // effect below handles the true-unmount case.
  const clubMsgUnsubsRef = useRef<Record<string, () => void>>({});
  const prevClubMsgsRef  = useRef<Record<string, ClubMessage[]>>({});
  useEffect(() => {
    if (!myRealUid) return;
    const wanted = new Set(myClubIds);
    Object.keys(clubMsgUnsubsRef.current).forEach(id => {
      if (wanted.has(id)) return;
      clubMsgUnsubsRef.current[id]();
      delete clubMsgUnsubsRef.current[id];
      delete prevClubMsgsRef.current[id];
    });
    myClubIds.forEach(id => {
      if (clubMsgUnsubsRef.current[id]) return;
      const clubName = clubs.find(c => c.id === id)?.name ?? 'Club';
      clubMsgUnsubsRef.current[id] = subscribeClubMessages(id, msgs => {
        const prev = prevClubMsgsRef.current[id] ?? [];
        if (prev.length > 0) {
          const newFromOthers = msgs.slice(prev.length).filter(m => m.senderId !== myRealUid);
          if (newFromOthers.length > 0) {
            const last = newFromOthers[newFromOthers.length - 1];
            addNotification({ type: 'club_message', title: clubName, body: `${last.senderName}: ${last.text}` });
          }
        }
        prevClubMsgsRef.current[id] = msgs;
      }, 10); // only need to detect new arrivals here, not full history
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubIds, myRealUid]);
  useEffect(() => () => { Object.values(clubMsgUnsubsRef.current).forEach(fn => fn()); }, []);

  const awardClipCredits = useCallback((amount: number) => {
    setClipCredits(prev => {
      const next = prev + amount;
      try { localStorage.setItem('cc_clipCredits', String(next)); } catch { /* ignore */ }
      // Determine badge tier
      const badge: UserProfile['clipBadge'] =
        next >= 50 ? 'Broadcaster' : next >= 20 ? 'Studio' : next >= 5 ? 'Director' : 'Camera';
      setUser(u => ({ ...u, clipCredits: next, clipBadge: badge }));
      return next;
    });
  }, []);

  const saveCourtPositions = useCallback((positions: CourtPosition[]) => {
    setCourtProfile(prev => {
      const next: CourtProfile = {
        positions: [...(prev?.positions ?? []), ...positions],
        totalMatches: (prev?.totalMatches ?? 0) + 1,
        lastUpdated: new Date().toISOString(),
      };
      try { localStorage.setItem('cc_courtProfile', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const followPlayer = useCallback((uid: string, isTargetPrivate?: boolean) => {
    const targetName = ALL_PLAYERS.find(p => p.uid === uid)?.displayName ?? 'this player';
    if (isTargetPrivate) {
      setFollowRequestsSent(p => {
        const next = p.includes(uid) ? p : [...p, uid];
        try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
      addNotification({ type: 'friend_request', title: 'Follow Request Sent', body: `Your follow request to ${targetName} is pending approval.` });
      // Demo accounts auto-accept after a short delay to simulate a real accept flow —
      // but only if the request hasn't been cancelled (unfollowPlayer) in the meantime.
      setTimeout(() => {
        let stillPending = false;
        setFollowRequestsSent(p => {
          stillPending = p.includes(uid);
          if (!stillPending) return p;
          const next = p.filter(id => id !== uid);
          try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        if (!stillPending) return;
        setFollowing(p => {
          const next = p.includes(uid) ? p : [...p, uid];
          try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        addNotification({ type: 'friend_accepted', title: 'Follow Request Accepted', body: `${targetName} accepted your follow request.` });
      }, 2500);
      return;
    }
    setFollowing(p => {
      const next = p.includes(uid) ? p : [...p, uid];
      try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const unfollowPlayer = useCallback((uid: string) => {
    setFollowRequestsSent(p => {
      if (!p.includes(uid)) return p;
      const next = p.filter(id => id !== uid);
      try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setFollowing(p => {
      const next = p.filter(id => id !== uid);
      try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Endorsements — toggle: endorse if not given, remove if already given
  const endorsePlayer = useCallback((targetUid: string, skill: string) => {
    setMyEndorsements(prev => {
      const already = prev[targetUid] ?? [];
      const isGiven = already.includes(skill);
      const next = isGiven ? already.filter(s => s !== skill) : [...already, skill];

      if (isRealUid(targetUid)) {
        // Real target: write to their endorsements subcollection. They see the
        // updated count live via their own subscribeEndorsementsReceived listener.
        const realUid = auth.currentUser?.uid;
        if (realUid) setEndorsementDoc(targetUid, realUid, next).catch(() => {});
      } else {
        setPlayerEndorsements(pe => {
          const existing = pe[targetUid] ?? {};
          const newCount = Math.max(0, (existing[skill] ?? 0) + (isGiven ? -1 : 1));
          return { ...pe, [targetUid]: { ...existing, [skill]: newCount } };
        });
      }
      return { ...prev, [targetUid]: next };
    });
  }, []);

  const markNotifRead    = useCallback((id: string) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotifsRead = useCallback(() => setNotifications(p => p.map(n => ({ ...n, read: true }))), []);
  const unreadNotifCount  = notifications.filter(n => !n.read).length;

  // Sends a message in a real cross-account conversation (shared Firestore doc,
  // not the per-user demo copy). otherProfile is only needed the first time —
  // it's what lets the recipient's own client render a header for this chat.
  const sendRealMessage = useCallback((otherUid: string, otherProfile: SharedParticipant, text: string) => {
    const realUid = auth.currentUser?.uid;
    if (!realUid || !text.trim()) return;
    const chatId = chatIdFor(realUid, otherUid);
    const msg = { id: `msg_${Date.now()}`, senderId: realUid, text: text.trim(), sentAt: new Date().toISOString() };
    const participants: Record<string, SharedParticipant> = {
      [realUid]: { displayName: user.displayName, username: user.username, tier: user.tier, mmr: user.mmr, photoURL: user.photoURL ?? null },
      [otherUid]: otherProfile,
    };
    sendSharedMessage(chatId, [realUid, otherUid], participants, msg).catch(() => {});
  }, [user.displayName, user.username, user.tier, user.mmr, user.photoURL]);

  const markRealConvRead = useCallback((chatId: string) => {
    setRealLastRead(prev => {
      const next = { ...prev, [chatId]: new Date().toISOString() };
      try { localStorage.setItem('cc_realLastRead', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Combine local/demo state with the real, Firestore-synced cross-account
  // state. myRealUid (declared above, next to the club logic) is '' when
  // signed out, so isRealUid-keyed lookups just fall through to nothing
  // rather than mismatching against a stale uid.
  const challenges: Challenge[] = useMemo(() => [
    ...localChallenges,
    ...realIncomingChallenges.map(c => toLocalChallenge(c, myRealUid)),
    ...realOutgoingChallenges.map(c => toLocalChallenge(c, myRealUid)),
  ], [localChallenges, realIncomingChallenges, realOutgoingChallenges, myRealUid]);
  const conversations: Conversation[] = useMemo(() => [
    ...localConversations,
    ...realConversationDocs.map(c => toLocalConversation(c, myRealUid, realLastRead)),
  ].sort((a, b) => b.lastAt.localeCompare(a.lastAt)), [localConversations, realConversationDocs, myRealUid, realLastRead]);
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const allMatches: Match[] = useMemo(() => [
    ...matches,
    ...realMatches.map(m => toLocalMatch(m, myRealUid)),
  ].sort((a, b) => b.playedAt.localeCompare(a.playedAt)), [matches, realMatches, myRealUid]);
  const combinedPlayerEndorsements = useMemo(() => {
    const meCounts: Record<string, number> = { ...(playerEndorsements.me ?? {}) };
    for (const [skill, cnt] of Object.entries(realEndorsementCounts)) {
      meCounts[skill] = (meCounts[skill] ?? 0) + cnt;
    }
    return { ...playerEndorsements, me: meCounts };
  }, [playerEndorsements, realEndorsementCounts]);

  return (
    <Ctx.Provider value={{
      user, matches: allMatches, addMatch, confirmMatch, disputeMatch, cancelPendingMatch, updateUser,
      conversations, setConversations: setLocalConversations, sendRealMessage, markRealConvRead, totalUnread, sidebarCollapsed, toggleSidebar,
      tournaments, addTournament, registrations, pendingRequests,
      registerTournament, unregisterTournament, requestToJoin, cancelRequest,
      challenges, sendChallenge, acceptChallenge, declineChallenge, cancelChallenge,
      clubs, myClubIds, clubLimit, joinClub, requestJoinClub, cancelClubRequest, leaveClub, createClub, updateClub,
      acceptClubMember, declineClubMember, disbandClub, assignModerator, removeModerator, myClubPendingIds,
      clubInvites, inviteToClub, acceptClubInvite, declineClubInvite, sendClubMessage,
      following, followRequestsSent, followPlayer, unfollowPlayer,
      clipCredits, awardClipCredits, courtProfile, saveCourtPositions,
      myEndorsements, playerEndorsements: combinedPlayerEndorsements, endorsePlayer,
      notifications, unreadNotifCount, addNotification, markNotifRead, markAllNotifsRead,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
