'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
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
  addClubMember, removeClubMember, addClubPending, removeClubPending, setClubModerator, addClubMessageDoc,
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
function toLocalConversation(c: SharedConversation, myUid: string): Conversation {
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
  return {
    id: c.id, participant,
    lastMessage: c.lastMessage, lastAt: c.lastAt,
    unread: 0, // real-conversation unread tracking is a scoped-out follow-up
    messages: c.messages.map(m => ({ id: m.id, senderId: m.senderId === myUid ? 'me' : m.senderId, text: m.text, sentAt: m.sentAt })),
  };
}

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

  // Real-time cross-account sync: challenges, chat, and endorsements only exist
  // for genuinely authenticated users — local/demo state is untouched.
  const realUnsubsRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      realUnsubsRef.current.forEach(fn => fn());
      realUnsubsRef.current = [];
      if (!authUser) {
        setRealIncomingChallenges([]); setRealOutgoingChallenges([]);
        setRealConversationDocs([]); setRealEndorsementCounts({});
        return;
      }
      const uid = authUser.uid;
      ensureSeedClubsExist(SEED_CLUBS).catch(() => {});
      realUnsubsRef.current = [
        subscribeChallengesFor('toUid', uid, setRealIncomingChallenges),
        subscribeChallengesFor('fromUid', uid, setRealOutgoingChallenges),
        subscribeMySharedConversations(uid, setRealConversationDocs),
        subscribeEndorsementsReceived(uid, setRealEndorsementCounts),
        subscribeClubs(setRawClubs),
      ];
    });
    return () => { unsubAuth(); realUnsubsRef.current.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
    const uid = auth.currentUser?.uid;
    if (uid) saveOpenToPlay(uid, user.openToPlay ?? false).catch(() => {});
  }, [user.openToPlay]);

  const addMatch      = useCallback((m: Match) => {
    setMatches(p => [m, ...p]);
    const uid = auth.currentUser?.uid;
    if (uid) saveMatch(uid, m).catch(() => {});
  }, []);
  const confirmMatch  = useCallback((id: string, uid?: string) => {
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
  }, []);
  const disputeMatch  = useCallback((id: string) => setMatches(p => p.map(m => m.id === id ? { ...m, status: 'Disputed' as const } : m)), []);
  // Withdraws a match still waiting on other players' confirmation — for when an
  // opponent never responds. No MMR was ever applied for a Pending match, so
  // there's nothing to roll back.
  const cancelPendingMatch = useCallback((id: string) => setMatches(p => p.map(m =>
    m.id === id && m.status === 'Pending' ? { ...m, status: 'Cancelled' as const, pendingConfirmations: [] } : m
  )), []);
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
  const totalUnread   = localConversations.reduce((s, c) => s + c.unread, 0);

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
    addNotification({ type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` });
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

  // Club actions — how many clubs the user is allowed at once scales with MMR tier
  const clubLimit = maxClubsForTier(user.tier);

  const joinClub = useCallback((id: string) => {
    if (myClubIds.includes(id) || myClubIds.length >= clubLimit) return;
    const next = [...myClubIds, id];
    setMyClubIds(next);
    setClubs(cs => cs.map(c => c.id === id ? { ...c, memberIds: [...c.memberIds, 'me'] } : c));
    addNotification({ type: 'club_accepted', title: 'Joined Club', body: `You joined a new club!` });
    const uid = auth.currentUser?.uid;
    if (uid) saveClubMembership(uid, next).catch(() => {});
  }, [myClubIds, clubLimit]);

  const requestJoinClub = useCallback((id: string) => {
    if (myClubIds.length + myClubPendingIds.length >= clubLimit) return;
    setMyClubPendingIds(p => [...p, id]);
    setClubs(cs => cs.map(c => c.id === id ? { ...c, pendingIds: [...c.pendingIds, 'me'] } : c));
    addNotification({ type: 'club_request', title: 'Request Sent', body: 'Your request to join the club has been sent.' });
  }, [myClubIds, myClubPendingIds, clubLimit]);

  const cancelClubRequest = useCallback((id: string) => {
    setMyClubPendingIds(p => p.filter(x => x !== id));
    setClubs(cs => cs.map(c => c.id === id ? { ...c, pendingIds: c.pendingIds.filter(x => x !== 'me') } : c));
  }, []);

  const leaveClub = useCallback((id: string) => {
    const next = myClubIds.filter(x => x !== id);
    setMyClubIds(next);
    setClubs(cs => cs.map(c => c.id === id ? { ...c, memberIds: c.memberIds.filter(m => m !== 'me') } : c));
    const uid = auth.currentUser?.uid;
    if (uid) saveClubMembership(uid, next).catch(() => {});
  }, [myClubIds]);

  const createClub = useCallback((c: Club) => {
    const next = myClubIds.includes(c.id) ? myClubIds : [...myClubIds, c.id];
    setClubs(cs => [c, ...cs]);
    setMyClubIds(next);
    const uid = auth.currentUser?.uid;
    if (uid) saveClubMembership(uid, next).catch(() => {});
  }, [myClubIds]);

  const updateClub = useCallback((id: string, patch: Partial<Club>) => {
    setClubs(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const disbandClub = useCallback((id: string) => {
    const next = myClubIds.filter(x => x !== id);
    setClubs(cs => cs.filter(c => c.id !== id));
    setMyClubIds(next);
    const uid = auth.currentUser?.uid;
    if (uid) saveClubMembership(uid, next).catch(() => {});
  }, [myClubIds]);

  const assignModerator = useCallback((clubId: string, uid: string) => {
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, moderatorIds: [...(c.moderatorIds ?? []).filter(x => x !== uid), uid] }
      : c));
  }, []);

  const removeModerator = useCallback((clubId: string, uid: string) => {
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, moderatorIds: (c.moderatorIds ?? []).filter(x => x !== uid) }
      : c));
  }, []);

  const acceptClubMember = useCallback((clubId: string, uid: string) => {
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, memberIds: [...c.memberIds, uid], pendingIds: c.pendingIds.filter(x => x !== uid) }
      : c));
    addNotification({ type: 'club_accepted', title: 'Member Accepted', body: 'A new member joined your club.' });
  }, []);

  const declineClubMember = useCallback((clubId: string, uid: string) => {
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, pendingIds: c.pendingIds.filter(x => x !== uid) }
      : c));
  }, []);

  const inviteToClub = useCallback((clubId: string, targetUid: string) => {
    if (targetUid === 'me') {
      // Being invited by someone else — add pending invite + notification
      setClubInvites(p => [...p, clubId]);
      addNotification({ type: 'club_invite', title: 'Club Invitation', body: 'You have been invited to join a club!', meta: { clubId } });
    } else {
      // Admin inviting another player — simulate acceptance immediately (demo)
      setClubs(cs => cs.map(c => c.id === clubId && !c.memberIds.includes(targetUid)
        ? { ...c, memberIds: [...c.memberIds, targetUid] }
        : c));
      addNotification({ type: 'club_accepted', title: 'Invite Sent', body: 'Player has been added to the club.' });
    }
  }, []);

  const acceptClubInvite = useCallback((clubId: string) => {
    if (!myClubIds.includes(clubId) && myClubIds.length >= clubLimit) return;
    const next = myClubIds.includes(clubId) ? myClubIds : [...myClubIds, clubId];
    setClubInvites(p => p.filter(id => id !== clubId));
    setClubs(cs => cs.map(c => c.id === clubId && !c.memberIds.includes('me')
      ? { ...c, memberIds: [...c.memberIds, 'me'] }
      : c));
    setMyClubIds(next);
    addNotification({ type: 'club_accepted', title: 'Joined Club', body: 'You accepted the club invitation!' });
    const uid = auth.currentUser?.uid;
    if (uid) saveClubMembership(uid, next).catch(() => {});
  }, [myClubIds, clubLimit]);

  const declineClubInvite = useCallback((clubId: string) => {
    setClubInvites(p => p.filter(id => id !== clubId));
    addNotification({ type: 'club_declined', title: 'Invitation Declined', body: 'You declined the club invitation.' });
  }, []);

  const sendClubMessage = useCallback((clubId: string, text: string) => {
    const msg: ClubMessage = {
      id: `cm_${Date.now()}`,
      senderId: 'me',
      senderName: user.displayName,
      text,
      sentAt: new Date().toISOString(),
    };
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, clubMessages: [...(c.clubMessages ?? []), msg] }
      : c));
  }, [user.displayName]);

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

  // Notifications — single entry point: adds to the bell AND fires a phone/desktop
  // push notification (via the service worker when available) whenever the app
  // isn't the focused tab, so nothing that reaches the bell is silently missed.
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

  // Combine local/demo state with the real, Firestore-synced cross-account
  // state. myRealUid is '' when signed out, so isRealUid-keyed lookups just
  // fall through to nothing rather than mismatching against a stale uid.
  const myRealUid = auth.currentUser?.uid ?? '';
  const challenges: Challenge[] = [
    ...localChallenges,
    ...realIncomingChallenges.map(c => toLocalChallenge(c, myRealUid)),
    ...realOutgoingChallenges.map(c => toLocalChallenge(c, myRealUid)),
  ];
  const conversations: Conversation[] = [
    ...localConversations,
    ...realConversationDocs.map(c => toLocalConversation(c, myRealUid)),
  ].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const meEndorsementCounts: Record<string, number> = { ...(playerEndorsements.me ?? {}) };
  for (const [skill, cnt] of Object.entries(realEndorsementCounts)) {
    meEndorsementCounts[skill] = (meEndorsementCounts[skill] ?? 0) + cnt;
  }
  const combinedPlayerEndorsements = { ...playerEndorsements, me: meEndorsementCounts };

  return (
    <Ctx.Provider value={{
      user, matches, addMatch, confirmMatch, disputeMatch, cancelPendingMatch, updateUser,
      conversations, setConversations: setLocalConversations, sendRealMessage, totalUnread, sidebarCollapsed, toggleSidebar,
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
