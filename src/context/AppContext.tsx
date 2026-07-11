'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { UserProfile, Match, Conversation, Tournament, Challenge, Club, Notification, ClubMessage, CourtPosition, CourtProfile } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS, TOURNAMENTS as SEED_TOURNAMENTS, CLUBS as SEED_CLUBS } from '@/lib/data';
import { auth } from '@/lib/firebase';
import { maxClubsForTier, getTier } from '@/lib/utils';
import { onAuthStateChanged } from 'firebase/auth';
import { ME as ME_DATA, PLAYERS as ALL_PLAYERS } from '@/lib/data';
import {
  saveMatch, saveUserProfile, saveOpenToPlay,
  saveTournamentReg, deleteTournamentReg,
  saveClubMembership,
  loadConversations,
  subscribeChallengesFor, sendChallengeDoc, updateChallengeStatus, type StoredChallenge,
  subscribeMySharedConversations, sendSharedMessage, chatIdFor, type SharedConversation, type SharedParticipant,
  subscribeEndorsementsReceived, setEndorsementDoc,
} from '@/lib/firestoreService';

// A uid is "real" (a genuine Firebase-authenticated account) if it isn't the
// local demo user ('me') or one of the static seed players from lib/data.ts.
const isRealUid = (uid: string) => uid !== 'me' && !ALL_PLAYERS.some(p => p.uid === uid) && uid !== ME_DATA.uid;

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
  const [conversations,    setConversations]    = useState<Conversation[]>(SEED_CONVS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tournaments,      setTournaments]      = useState<Tournament[]>(SEED_TOURNAMENTS);
  const [registrations,    setRegistrations]    = useState<Record<string, { registeredAt: string }>>({});
  const [pendingRequests,  setPendingRequests]  = useState<Record<string, { requestedAt: string }>>({});
  const [localChallenges,  setLocalChallenges]  = useState<Challenge[]>([]);
  // Real, cross-account challenges/conversations/endorsements — populated via
  // Firestore real-time listeners once signed in (see the effect below).
  const [realChallengeDocs,     setRealChallengeDocs]     = useState<StoredChallenge[]>([]);
  const [realConversationDocs,  setRealConversationDocs]  = useState<SharedConversation[]>([]);
  const [realEndorsementCounts, setRealEndorsementCounts] = useState<Record<string, number>>({});
  // Migrate the old single-club localStorage key to the new array-based one.
  const readSavedClubIds = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('cc_myClubIds');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    const legacy = localStorage.getItem('cc_myClubId');
    return legacy ? [legacy] : [];
  };

  const [clubs,            setClubs]            = useState<Club[]>(() => {
    if (typeof window !== 'undefined') {
      const savedIds = readSavedClubIds();
      if (savedIds.length) {
        return SEED_CLUBS.map(c => savedIds.includes(c.id) && !c.memberIds.includes('me')
          ? { ...c, memberIds: [...c.memberIds, 'me'] }
          : c);
      }
    }
    return SEED_CLUBS;
  });
  const [myClubIds,        setMyClubIds]        = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedIds = readSavedClubIds();
      if (savedIds.length) return savedIds;
    }
    // Derive from seed data (e.g. 'me' seeded into c1)
    return SEED_CLUBS.filter(c => c.memberIds.includes('me')).map(c => c.id);
  });
  const [clubInvites,      setClubInvites]      = useState<string[]>([]);
  const [myClubPendingIds, setMyClubPendingIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('cc_myClubPendingIds') ?? '[]'); } catch { return []; }
    }
    return [];
  });
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

  // Load persisted conversations from Firestore on sign-in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) return;
      try {
        const stored = await loadConversations(authUser.uid);
        if (!stored.length) return;
        const allPlayers = [ME_DATA, ...ALL_PLAYERS];
        setConversations(prev => {
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

  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
    const uid = auth.currentUser?.uid;
    if (uid) saveOpenToPlay(uid, user.openToPlay ?? false).catch(() => {});
  }, [user.openToPlay]);

  useEffect(() => {
    localStorage.setItem('cc_myClubIds', JSON.stringify(myClubIds));
    localStorage.removeItem('cc_myClubId'); // fully migrated off the old singular key
  }, [myClubIds]);

  useEffect(() => {
    localStorage.setItem('cc_myClubPendingIds', JSON.stringify(myClubPendingIds));
  }, [myClubPendingIds]);

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
  const totalUnread   = conversations.reduce((s, c) => s + c.unread, 0);

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

  const sendChallenge    = useCallback((c: Challenge) => {
    setChallenges(p => [c, ...p]);
    addNotification({ type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` });
  }, []);
  const acceptChallenge  = useCallback((id: string) => {
    setChallenges(p => p.map(c => c.id === id ? { ...c, status: 'accepted' as const } : c));
    addNotification({ type: 'challenge_accepted', title: 'Challenge Accepted', body: 'Your match challenge was accepted!' });
  }, []);
  const declineChallenge = useCallback((id: string) => {
    setChallenges(p => p.map(c => c.id === id ? { ...c, status: 'declined' as const } : c));
  }, []);
  const cancelChallenge  = useCallback((id: string) => {
    setChallenges(p => p.map(c => c.id === id ? { ...c, status: 'cancelled' as const } : c));
  }, []);

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
      setPlayerEndorsements(pe => {
        const existing = pe[targetUid] ?? {};
        const newCount = Math.max(0, (existing[skill] ?? 0) + (isGiven ? -1 : 1));
        return { ...pe, [targetUid]: { ...existing, [skill]: newCount } };
      });
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

  return (
    <Ctx.Provider value={{
      user, matches, addMatch, confirmMatch, disputeMatch, cancelPendingMatch, updateUser,
      conversations, setConversations, totalUnread, sidebarCollapsed, toggleSidebar,
      tournaments, addTournament, registrations, pendingRequests,
      registerTournament, unregisterTournament, requestToJoin, cancelRequest,
      challenges, sendChallenge, acceptChallenge, declineChallenge, cancelChallenge,
      clubs, myClubIds, clubLimit, joinClub, requestJoinClub, cancelClubRequest, leaveClub, createClub, updateClub,
      acceptClubMember, declineClubMember, disbandClub, assignModerator, removeModerator, myClubPendingIds,
      clubInvites, inviteToClub, acceptClubInvite, declineClubInvite, sendClubMessage,
      following, followRequestsSent, followPlayer, unfollowPlayer,
      clipCredits, awardClipCredits, courtProfile, saveCourtPositions,
      myEndorsements, playerEndorsements, endorsePlayer,
      notifications, unreadNotifCount, addNotification, markNotifRead, markAllNotifsRead,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
