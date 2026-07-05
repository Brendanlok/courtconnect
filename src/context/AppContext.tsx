'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { UserProfile, Match, Conversation, Tournament, Challenge, Club, Notification } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS, TOURNAMENTS as SEED_TOURNAMENTS, CLUBS as SEED_CLUBS } from '@/lib/data';
import { auth } from '@/lib/firebase';
import {
  saveMatch, saveUserProfile, saveOpenToPlay,
  saveTournamentReg, deleteTournamentReg,
  saveClubMembership, saveFriend, removeFriendRecord,
} from '@/lib/firestoreService';

interface AppCtx {
  user: UserProfile;
  matches: Match[];
  addMatch: (m: Match) => void;
  confirmMatch: (id: string) => void;
  disputeMatch: (id: string) => void;
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
  // Clubs
  clubs: Club[];
  myClubId: string | null;
  joinClub: (id: string) => void;        // join public club
  requestJoinClub: (id: string) => void; // request to join private club
  cancelClubRequest: (id: string) => void;
  leaveClub: () => void;
  createClub: (c: Club) => void;
  updateClub: (id: string, patch: Partial<Club>) => void;
  acceptClubMember: (clubId: string, uid: string) => void;
  declineClubMember: (clubId: string, uid: string) => void;
  disbandClub: (id: string) => void;
  assignModerator: (clubId: string, uid: string) => void;
  removeModerator: (clubId: string, uid: string) => void;
  myClubPendingIds: string[];            // clubs I've requested to join
  // Friends
  friends: string[];                     // accepted friend uids
  outgoingFriendRequests: string[];      // uids I've sent a request to
  incomingFriendRequests: string[];      // uids who sent me a request
  sendFriendRequest: (uid: string) => void;
  cancelFriendRequest: (uid: string) => void;
  acceptFriendRequest: (uid: string) => void;
  declineFriendRequest: (uid: string) => void;
  removeFriend: (uid: string) => void;
  // Endorsements
  myEndorsements: Record<string, string[]>;            // targetUid → skills I've endorsed
  playerEndorsements: Record<string, Record<string, number>>; // targetUid → skill → count
  endorsePlayer: (targetUid: string, skill: string) => void;
  // Notifications
  notifications: Notification[];
  unreadNotifCount: number;
  addNotification: (n: Notification) => void;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
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
  const [challenges,       setChallenges]       = useState<Challenge[]>([]);
  const [clubs,            setClubs]            = useState<Club[]>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('cc_myClubId');
      if (savedId) {
        return SEED_CLUBS.map(c => c.id === savedId && !c.memberIds.includes('me')
          ? { ...c, memberIds: [...c.memberIds, 'me'] }
          : c);
      }
    }
    return SEED_CLUBS;
  });
  const [myClubId,         setMyClubId]         = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cc_myClubId') ?? null;
    return null;
  });
  const [myClubPendingIds, setMyClubPendingIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('cc_myClubPendingIds') ?? '[]'); } catch { return []; }
    }
    return [];
  });
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [friends,                setFriends]               = useState<string[]>([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<string[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<string[]>(['p2', 'p4']); // seed: two players already sent requests
  const [myEndorsements,   setMyEndorsements]   = useState<Record<string, string[]>>({});
  const [playerEndorsements, setPlayerEndorsements] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
  }, [user.openToPlay]);

  useEffect(() => {
    if (myClubId) localStorage.setItem('cc_myClubId', myClubId);
    else localStorage.removeItem('cc_myClubId');
  }, [myClubId]);

  useEffect(() => {
    localStorage.setItem('cc_myClubPendingIds', JSON.stringify(myClubPendingIds));
  }, [myClubPendingIds]);

  const addMatch      = useCallback((m: Match) => setMatches(p => [m, ...p]), []);
  const confirmMatch  = useCallback((id: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== id || m.status !== 'Pending') return m;
      const iWon = m.winnerId === 'me';
      const delta = m.mmrChange ?? 0;
      setUser(u => ({
        ...u, mmr: u.mmr + delta,
        stats: { wins: u.stats.wins + (iWon?1:0), losses: u.stats.losses + (iWon?0:1), totalMatches: u.stats.totalMatches + 1 },
      }));
      return { ...m, status: 'Confirmed' as const };
    }));
  }, []);
  const disputeMatch  = useCallback((id: string) => setMatches(p => p.map(m => m.id === id ? { ...m, status: 'Disputed' as const } : m)), []);
  const updateUser    = useCallback((patch: Partial<UserProfile>) => setUser(u => ({ ...u, ...patch })), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);
  const totalUnread   = conversations.reduce((s, c) => s + c.unread, 0);

  const addTournament       = useCallback((t: Tournament) => setTournaments(ts => [t, ...ts]), []);
  const registerTournament  = useCallback((id: string) => {
    setRegistrations(r => ({ ...r, [id]: { registeredAt: new Date().toISOString() } }));
    setTournaments(ts => ts.map(t => t.id === id ? {
      ...t,
      currentPlayers: t.currentPlayers + 1,
      participants: [...(t.participants ?? []), { displayName: user.displayName, username: user.username }],
    } : t));
  }, [user.displayName]);
  const unregisterTournament = useCallback((id: string) => {
    setRegistrations(r => { const n = { ...r }; delete n[id]; return n; });
    setTournaments(ts => ts.map(t => t.id === id ? {
      ...t,
      currentPlayers: Math.max(0, t.currentPlayers - 1),
      participants: (t.participants ?? []).filter(p => p.username !== user.username),
    } : t));
  }, [user.displayName]);
  const requestToJoin = useCallback((id: string) => setPendingRequests(r => ({ ...r, [id]: { requestedAt: new Date().toISOString() } })), []);
  const cancelRequest = useCallback((id: string) => setPendingRequests(r => { const n = { ...r }; delete n[id]; return n; }), []);

  const sendChallenge    = useCallback((c: Challenge) => {
    setChallenges(p => [c, ...p]);
    addNotif({ type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` });
  }, []);
  const acceptChallenge  = useCallback((id: string) => {
    setChallenges(p => p.map(c => c.id === id ? { ...c, status: 'accepted' as const } : c));
    addNotif({ type: 'challenge_accepted', title: 'Challenge Accepted', body: 'Your match challenge was accepted!' });
  }, []);
  const declineChallenge = useCallback((id: string) => {
    setChallenges(p => p.map(c => c.id === id ? { ...c, status: 'declined' as const } : c));
  }, []);

  // Club actions
  const joinClub = useCallback((id: string) => {
    setMyClubId(prev => {
      if (prev) setClubs(cs => cs.map(c => c.id === prev ? { ...c, memberIds: c.memberIds.filter(m => m !== 'me') } : c));
      setClubs(cs => cs.map(c => c.id === id ? { ...c, memberIds: [...c.memberIds, 'me'] } : c));
      return id;
    });
    addNotif({ type: 'club_accepted', title: 'Joined Club', body: `You joined a new club!` });
  }, []);

  const requestJoinClub = useCallback((id: string) => {
    setMyClubPendingIds(p => [...p, id]);
    setClubs(cs => cs.map(c => c.id === id ? { ...c, pendingIds: [...c.pendingIds, 'me'] } : c));
    addNotif({ type: 'club_request', title: 'Request Sent', body: 'Your request to join the club has been sent.' });
  }, []);

  const cancelClubRequest = useCallback((id: string) => {
    setMyClubPendingIds(p => p.filter(x => x !== id));
    setClubs(cs => cs.map(c => c.id === id ? { ...c, pendingIds: c.pendingIds.filter(x => x !== 'me') } : c));
  }, []);

  const leaveClub = useCallback(() => {
    setMyClubId(prev => {
      if (prev) setClubs(cs => cs.map(c => c.id === prev ? { ...c, memberIds: c.memberIds.filter(m => m !== 'me') } : c));
      return null;
    });
  }, []);

  const createClub = useCallback((c: Club) => {
    setClubs(cs => [c, ...cs]);
    setMyClubId(c.id);
  }, []);

  const updateClub = useCallback((id: string, patch: Partial<Club>) => {
    setClubs(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const disbandClub = useCallback((id: string) => {
    setClubs(cs => cs.filter(c => c.id !== id));
    setMyClubId(null);
  }, []);

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
    addNotif({ type: 'club_accepted', title: 'Member Accepted', body: 'A new member joined your club.' });
  }, []);

  const declineClubMember = useCallback((clubId: string, uid: string) => {
    setClubs(cs => cs.map(c => c.id === clubId
      ? { ...c, pendingIds: c.pendingIds.filter(x => x !== uid) }
      : c));
  }, []);

  const sendFriendRequest = useCallback((uid: string) => {
    setOutgoingFriendRequests(p => [...p, uid]);
  }, []);

  const cancelFriendRequest = useCallback((uid: string) => {
    setOutgoingFriendRequests(p => p.filter(id => id !== uid));
  }, []);

  const acceptFriendRequest = useCallback((uid: string) => {
    setIncomingFriendRequests(p => p.filter(id => id !== uid));
    setFriends(p => [...p, uid]);
  }, []);

  const declineFriendRequest = useCallback((uid: string) => {
    setIncomingFriendRequests(p => p.filter(id => id !== uid));
  }, []);

  const removeFriend = useCallback((uid: string) => {
    setFriends(p => p.filter(id => id !== uid));
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

  // Notifications
  const addNotif = (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    setNotifications(p => [{
      ...n, id: `n_${Date.now()}_${Math.random()}`, read: false, createdAt: new Date().toISOString(),
    }, ...p]);
  };
  const addNotification  = useCallback((n: Notification) => setNotifications(p => [n, ...p]), []);
  const markNotifRead    = useCallback((id: string) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const markAllNotifsRead = useCallback(() => setNotifications(p => p.map(n => ({ ...n, read: true }))), []);
  const unreadNotifCount  = notifications.filter(n => !n.read).length;

  return (
    <Ctx.Provider value={{
      user, matches, addMatch, confirmMatch, disputeMatch, updateUser,
      conversations, setConversations, totalUnread, sidebarCollapsed, toggleSidebar,
      tournaments, addTournament, registrations, pendingRequests,
      registerTournament, unregisterTournament, requestToJoin, cancelRequest,
      challenges, sendChallenge, acceptChallenge, declineChallenge,
      clubs, myClubId, joinClub, requestJoinClub, cancelClubRequest, leaveClub, createClub, updateClub,
      acceptClubMember, declineClubMember, disbandClub, assignModerator, removeModerator, myClubPendingIds,
      friends, outgoingFriendRequests, incomingFriendRequests,
      sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
      myEndorsements, playerEndorsements, endorsePlayer,
      notifications, unreadNotifCount, addNotification, markNotifRead, markAllNotifsRead,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
