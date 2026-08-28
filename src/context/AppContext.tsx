'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react';
import type { UserProfile, Match, Conversation, Tournament, Challenge, Club, Notification, ClubMessage, CourtPosition, CourtProfile, Tier, Venue, SeasonHistoryEntry } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS, TOURNAMENTS as SEED_TOURNAMENTS, CLUBS as SEED_CLUBS } from '@/lib/data';
import { auth, onAuthStateChanged } from '@/lib/supabase';
import { maxClubsForTier, getTier, BASE_PATH, isCalibrating } from '@/lib/utils';
import { resubmitWinner, resignedMmrChange } from '@/lib/matchDispute';
import { BADGES, computeEarnedBadgeIds } from '@/lib/achievements';
import { generateBracket, reportBracketResult as computeBracketResult, undoBracketResult as computeUndoBracketResult, bracketChampion } from '@/lib/bracketGen';
import { ME as ME_DATA, PLAYERS as ALL_PLAYERS } from '@/lib/data';
import {
  saveMatch, saveUserProfile, saveOpenToPlay, loadUserProfile,
  saveTournamentReg, deleteTournamentReg, loadTournamentRegs,
  loadConversations,
  subscribeChallengesFor, sendChallengeDoc, updateChallengeStatus, type StoredChallenge,
  subscribeMySharedConversations, sendSharedMessage, chatIdFor, type SharedConversation, type SharedParticipant,
  subscribeEndorsementsReceived, setEndorsementDoc, loadEndorsementsGiven,
  followUser, unfollowUser, respondToFollowRequest, subscribeFollowing, subscribeIncomingFollowRequests,
  subscribeClubs, ensureSeedClubsExist, createClubDoc, updateClubDoc, deleteClubDoc,
  addClubMember, removeClubMember, addClubPending, removeClubPending, setClubModerator,
  sendClubMessageDoc, subscribeClubMessages, sendSystemClubMessage,
  subscribeTournaments, ensureSeedTournamentsExist, createTournamentDoc, updateTournamentDoc, unregisterTournamentParticipant,
  addTournamentPending, removeTournamentPending, approveTournamentRequest, registerForTournament,
  lookupUserByUsername, notifyUser, subscribeMyNotifications, markNotificationReadRemote,
  deleteNotificationRemote, deleteAllNotificationsRemote,
  subscribeMyRealMatches, sendMatchDoc, confirmSharedMatch, disputeSharedMatch, resubmitSharedMatch, cancelSharedMatch,
  markMatchMmrApplied, type StoredMatch,
  loadAllRealUsers,
  subscribeVenues,
  saveSeasonHistoryEntry, loadSeasonHistory,
  subscribeOnlinePresence,
} from '@/lib/supabaseService';
import { seasonNumberForDate, softResetMmr } from '@/lib/seasons';

// A uid is "real" (a genuine Supabase-authenticated account) if it isn't the
// local demo user ('me') or one of the static seed players from lib/data.ts.
const isRealUid = (uid: string) => uid !== 'me' && !ALL_PLAYERS.some(p => p.uid === uid) && uid !== ME_DATA.uid;

// Normalizes a Supabase-shared challenge into the app's local, 'me'-centric
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
    email: '', mmr: p?.mmr ?? 1000, tier: (p?.tier as Tier) ?? 'Beginner',
    globalRank: 0, state: 'Kuala Lumpur', area: '',
    stats: { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
    photoURL: p?.photoURL ?? null,
    placementMatchesPlayed: p?.placementMatchesPlayed,
  };
  const readAt = lastRead[c.id] ?? '';
  // conversations.last_message/last_at can't actually be written past the
  // first message (no UPDATE policy on that table, see DEVLOG) — messages
  // is always fresh (loaded straight from conversation_messages), so derive
  // the preview + sort key from the real last message instead of the row.
  const last = c.messages[c.messages.length - 1];
  return {
    id: c.id, participant,
    lastMessage: last?.text ?? c.lastMessage, lastAt: last?.sentAt ?? c.lastAt,
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
  // pointLog/liveStats sides were captured as 'a' = reporter (always stored
  // as player1), 'b' = opponent — same orientation as games' p1/p2, so flip
  // them the same way when the viewer is the non-reporting side.
  const flipSide = (s: 'a' | 'b'): 'a' | 'b' => (s === 'a' ? 'b' : 'a');
  return {
    id: sm.id, type: sm.type as Match['type'],
    player1Id: my.id, player1Name: my.name, player1Username: my.username,
    player2Id: opp.id, player2Name: opp.name, player2Username: opp.username,
    winnerId: sm.winnerId === myUid ? 'me' : opp.id,
    games: amP1 ? sm.games : sm.games.map(g => ({ p1: g.p2, p2: g.p1 })),
    status: sm.status,
    mmrChange: myDelta,
    mode: sm.mode,
    playedAt: sm.playedAt,
    location: sm.location,
    pendingConfirmations: sm.pendingConfirmations.map(u => u === myUid ? 'me' : u),
    disputedBy: sm.disputedBy === undefined ? undefined : (sm.disputedBy === myUid ? 'me' : sm.disputedBy),
    recordedLive: sm.recordedLive,
    liveStats: sm.liveStats && (amP1 ? sm.liveStats : {
      ...sm.liveStats,
      maxWinStreak: { ...sm.liveStats.maxWinStreak, side: flipSide(sm.liveStats.maxWinStreak.side) },
    }),
    pointLog: sm.pointLog && (amP1 ? sm.pointLog : sm.pointLog.map(g => g.map(flipSide))),
    clipUrl: sm.clipUrl, shuttleHits: sm.shuttleHits,
  };
}

// Same normalization for clubs: real Supabase uids on the shared clubs
// row, translated to the local 'me' convention for display/equality checks.
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

// Same normalization for tournaments: hostUid is a real Supabase uid on the
// shared row, translated to 'me' for the signed-in host's own display/equality
// checks (e.g. TournamentRow's `t.hostUid === 'me'`).
function toLocalTournament(t: Tournament, myUid: string): Tournament {
  const translate = (uid: string) => uid === myUid ? 'me' : uid;
  return {
    ...t,
    hostUid: t.hostUid === myUid ? 'me' : t.hostUid,
    pendingRequesterIds: (t.pendingRequesterIds ?? []).map(translate),
  };
}

interface AppCtx {
  user: UserProfile;
  // True until the real signed-in profile has been fetched (or confirmed
  // absent) — while true, `user` is still the local seed/cached placeholder,
  // not the real account. AuthGate uses this to hold the splash screen
  // instead of ever painting the wrong profile's numbers on load.
  profileLoading: boolean;
  matches: Match[];
  addMatch: (m: Match) => void;
  confirmMatch: (id: string, uid?: string) => void;
  disputeMatch: (id: string) => void;
  resubmitMatch: (id: string, games: { p1: number; p2: number }[]) => void;
  cancelPendingMatch: (id: string) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  conversations: Conversation[];
  setConversations: (c: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  sendRealMessage: (otherUid: string, otherProfile: SharedParticipant, text: string) => void;
  markRealConvRead: (chatId: string) => void;
  allRealPlayers: UserProfile[];
  venues: Venue[];
  totalUnread: number;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  tournaments: Tournament[];
  addTournament: (t: Tournament) => Promise<string | null>;
  registrations: Record<string, { registeredAt: string }>;
  myTournamentPendingIds: string[]; // private tournaments I've requested to join
  registerTournament: (id: string) => void;
  unregisterTournament: (id: string) => void;
  requestToJoin: (id: string) => void;
  cancelRequest: (id: string) => void;
  acceptTournamentRequest: (tournamentId: string, uid: string) => void;
  declineTournamentRequest: (tournamentId: string, uid: string) => void;
  startTournamentBracket: (tournamentId: string) => void;
  reportBracketResult: (tournamentId: string, matchId: string, winnerName: string, score?: string) => void;
  undoBracketResult: (tournamentId: string, matchId: string) => void;
  editTournament: (id: string, patch: Partial<Tournament>) => Promise<string | null>;
  cancelTournament: (id: string) => Promise<string | null>;
  challenges: Challenge[];
  sendChallenge: (c: Challenge) => void;
  acceptChallenge: (id: string) => void;
  declineChallenge: (id: string) => void;
  cancelChallenge: (id: string) => void;
  isRealChallengeId: (id: string) => boolean;
  // Clubs
  clubs: Club[];
  myClubIds: string[];
  clubLimit: number;                     // max clubs allowed at the user's current tier
  joinClub: (id: string) => void;        // join public club
  requestJoinClub: (id: string) => void; // request to join private club
  cancelClubRequest: (id: string) => void;
  leaveClub: (id: string) => void;
  createClub: (c: Club) => Promise<string | null>;
  updateClub: (id: string, patch: Partial<Club>) => Promise<string | null>;
  acceptClubMember: (clubId: string, uid: string) => void;
  declineClubMember: (clubId: string, uid: string) => void;
  disbandClub: (id: string) => Promise<string | null>;
  assignModerator: (clubId: string, uid: string) => void;
  removeModerator: (clubId: string, uid: string) => void;
  myClubPendingIds: string[];            // clubs I've requested to join
  inviteToClub: (clubId: string, targetUid: string) => void;
  sendClubMessage: (clubId: string, text: string) => void;
  // Follow
  following: string[];
  followRequestsSent: string[];
  followPlayer: (uid: string, isTargetPrivate?: boolean) => void;
  unfollowPlayer: (uid: string) => void;
  incomingFollowRequests: string[];      // real accounts with a pending request to follow me
  respondToFollowRequest: (requesterUid: string, accept: boolean) => void;
  onlineUids: Set<string>;               // real uids currently connected (Supabase Presence)
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
  deleteNotif: (id: string) => void;
  clearAllNotifs: () => void;
  // Achievements
  earnedBadgeIds: string[];
  // Ranked seasons
  pastSeasons: SeasonHistoryEntry[];
  seasonRecap: SeasonHistoryEntry | null;
  dismissSeasonRecap: () => void;
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [pastSeasons, setPastSeasons] = useState<SeasonHistoryEntry[]>([]);
  const [seasonRecap, setSeasonRecap] = useState<SeasonHistoryEntry | null>(null);
  // Matches logged against demo/seed opponents have no backend row (no real
  // uid to satisfy the matches table's FK), so localStorage is what makes
  // them survive a reload — same pattern as every other cc_* local-only
  // field in this file (courtProfile, clipCredits, etc.), just applied here
  // too. Without this, a demo-opponent match (and anything computed from it,
  // e.g. achievement badges) vanished the moment the page reloaded.
  const [matches,          setMatches]          = useState<Match[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_localMatches');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return SEED_MATCHES;
  });
  useEffect(() => {
    try { localStorage.setItem('cc_localMatches', JSON.stringify(matches)); } catch { /* ignore */ }
  }, [matches]);
  const [localConversations, setLocalConversations] = useState<Conversation[]>(SEED_CONVS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Tournaments live in Supabase now (see subscribeTournaments below), same
  // pattern as rawClubs — rawTournaments holds real Supabase uids on hostUid,
  // `tournaments` (translated for display) is derived further down.
  const [rawTournaments,   setRawTournaments]    = useState<Tournament[]>(SEED_TOURNAMENTS);
  const [registrations,    setRegistrations]    = useState<Record<string, { registeredAt: string }>>({});
  const [localChallenges,  setLocalChallenges]  = useState<Challenge[]>([]);
  // Real, cross-account challenges/conversations/endorsements — populated via
  // Supabase real-time listeners once signed in (see the effect below).
  const [realIncomingChallenges, setRealIncomingChallenges] = useState<StoredChallenge[]>([]);
  const [realOutgoingChallenges, setRealOutgoingChallenges] = useState<StoredChallenge[]>([]);
  const [realConversationDocs,   setRealConversationDocs]   = useState<SharedConversation[]>([]);
  const [realEndorsementCounts,  setRealEndorsementCounts]  = useState<Record<string, number>>({});
  const [realMatches,            setRealMatches]            = useState<StoredMatch[]>([]);
  // Every real signed-up account, fetched once per session (not a listener —
  // see loadAllRealUsers) and shared across every screen that needs the
  // ranking pool (Leaderboard, Players tab) instead of each page fetching
  // the whole users table on its own every time it's visited.
  const [allRealPlayers,         setAllRealPlayers]         = useState<UserProfile[]>([]);
  // Crowd-sourced venue directory, live-subscribed same as clubs — any
  // signed-in user adding a venue should show up for everyone immediately.
  const [venues,                 setVenues]                 = useState<Venue[]>([]);
  // Per-chat "last opened" timestamp for real conversations — device-local,
  // same idea as every other per-device UI preference here (openToPlay, etc.).
  const [realLastRead,           setRealLastRead]           = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_realLastRead');
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, string>;
          // Prune orphan pending_<uid> keys left by older builds (deep-link shell convs).
          const cleaned: Record<string, string> = Object.fromEntries(
            Object.entries(parsed).filter(([k]) => !k.startsWith('pending_'))
          );
          if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
            try { localStorage.setItem('cc_realLastRead', JSON.stringify(cleaned)); } catch { /* ignore */ }
          }
          return cleaned;
        }
      } catch { /* ignore */ }
    }
    return {};
  });
  // Clubs live in Supabase now (real, shared rows — see the real-time
  // subscription effect below) so two real accounts actually see the same
  // membership/pending/moderator state. rawClubs holds real Supabase uids;
  // `clubs` (translated for display) and myClubIds/myClubPendingIds are
  // derived from it further down, same 'me'-normalization as challenges.
  const [rawClubs,         setRawClubs]          = useState<Club[]>(SEED_CLUBS);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  // Local (demo-player) following state, localStorage-backed. Real-account
  // following is separate (realFollowingAccepted/Pending below, Supabase-synced)
  // — `following`/`followRequestsSent` in the context value merge both, same
  // pattern as `challenges` merging localChallenges + real*Challenges.
  const [localFollowing,         setLocalFollowing]        = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_following');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });
  const [localFollowRequestsSent, setLocalFollowRequestsSent] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cc_followRequestsSent');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });
  const [realFollowingAccepted,  setRealFollowingAccepted] = useState<string[]>([]);
  const [realFollowingPending,   setRealFollowingPending]  = useState<string[]>([]);
  const [incomingFollowRequests, setIncomingFollowRequests] = useState<string[]>([]);
  const [onlineUids, setOnlineUids] = useState<Set<string>>(new Set());
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

  // Load the real signed-in user's actual profile + conversations from Supabase.
  // Without this, the app just shows the local demo seed profile forever,
  // regardless of who's actually logged in — everything a real user set during
  // signup (username, name, etc.) would never appear anywhere.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      if (!authUser) return;
      // Fired concurrently, not one-after-another — these are independent
      // reads and awaiting them in sequence used to double+ the time to
      // first useful render for no reason.
      (async () => {
        try {
          const profile = await loadUserProfile(authUser.uid);
          if (profile) {
            // userRowToProfile always emits every key, so a column that
            // hasn't been migrated in yet (e.g. weekly_digest_sent_at before
            // 0022 is run) comes back as an explicit `undefined` — spreading
            // that as-is clobbers a good locally-cached value with nothing
            // every time this fires (every login/reload), which is exactly
            // what made the weekly digest re-fire every session instead of
            // every 7 days. Drop undefined keys so only columns Supabase
            // actually has an answer for can overwrite local state.
            const definedProfile = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));
            setUser(u => ({
              ...u, ...definedProfile,
              uid: 'me', // keep the app-wide local convention — the real uid lives in auth.currentUser
              tier: getTier(profile.mmr ?? u.mmr),
              // Signup never writes disciplineMMR (only top-level mmr) — without
              // this, a real account keeps showing the local demo seed's stale
              // per-discipline numbers forever (Home's "MMR" header reads
              // disciplineMMR when present, so it silently diverges from the
              // real mmr shown everywhere else).
              disciplineMMR: profile.disciplineMMR ?? {},
            }));
            // courtProfile lives in its own state (not on `user`), so the
            // spread above never picks it up — hydrate it separately or a
            // returning user's heatmap never survives a new device/browser.
            if (profile.courtProfile) setCourtProfile(profile.courtProfile);
          }
        } catch { /* Supabase unavailable — keep local/seed profile */ }
        finally { setProfileLoading(false); }
      })();
      (async () => {
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
        } catch { /* Supabase unavailable — keep seed convs */ }
      })();
      loadAllRealUsers(authUser.uid).then(setAllRealPlayers).catch(() => {});
      // Merge (not replace) — registerTournament already writes local/demo
      // entries into this same map, and the server copy is only authoritative
      // for real tournaments a signed-in account actually registered for.
      loadTournamentRegs(authUser.uid).then(regs => setRegistrations(r => ({ ...r, ...regs }))).catch(() => {});
      // Same gap as tournament registrations above — setEndorsementDoc writes
      // correctly but nothing ever loaded it back, so myEndorsements silently
      // reset to empty every reload (risking a double-endorse that looks like
      // a toggle-off since the UI thought the skill was never given).
      loadEndorsementsGiven(authUser.uid).then(given => setMyEndorsements(e => ({ ...e, ...given }))).catch(() => {});
      loadSeasonHistory(authUser.uid).then(setPastSeasons).catch(() => {});
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
  const prevTournamentsRef        = useRef<Tournament[]>([]);
  const prevMatchesRef             = useRef<StoredMatch[]>([]);
  // "have we run the diff at least once" per subscription — without this,
  // the very first callback after sign-in (prevXRef still at its initial [])
  // reads as "everything just changed" and re-fires a notification for every
  // already-existing pending challenge/unread message/unconfirmed match on
  // every reload, not just genuinely new ones. subscribeClubs/
  // subscribeClubMessages avoid this by construction (see their own diffs);
  // these three don't, so they need it explicitly.
  const challengesLoadedRef    = useRef(false);
  const conversationsLoadedRef = useRef(false);
  const matchesLoadedRef       = useRef(false);
  const followingLoadedRef     = useRef(false);
  const incomingFollowsLoadedRef = useRef(false);
  const prevFollowingPendingRef  = useRef<string[]>([]);
  const prevIncomingFollowsRef   = useRef<string[]>([]);
  const realUnsubsRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      realUnsubsRef.current.forEach(fn => fn());
      realUnsubsRef.current = [];
      if (!authUser) {
        setRealIncomingChallenges([]); setRealOutgoingChallenges([]);
        setRealConversationDocs([]); setRealEndorsementCounts({}); setRealMatches([]); setAllRealPlayers([]); setVenues([]);
        setRealFollowingAccepted([]); setRealFollowingPending([]); setIncomingFollowRequests([]); setOnlineUids(new Set());
        prevIncomingChallengesRef.current = []; prevOutgoingChallengesRef.current = [];
        prevConversationsRef.current = []; prevClubsRef.current = []; prevMatchesRef.current = []; prevTournamentsRef.current = [];
        prevFollowingPendingRef.current = []; prevIncomingFollowsRef.current = [];
        challengesLoadedRef.current = false; conversationsLoadedRef.current = false; matchesLoadedRef.current = false;
        followingLoadedRef.current = false; incomingFollowsLoadedRef.current = false;
        // Drop this account's DB-backed notifications so a different account
        // signing in on the same device doesn't briefly see them; local-only
        // ones (id-prefixed 'n_') are left alone, matching existing behavior.
        setNotifications(prev => prev.filter(n => n.id.startsWith('n_')));
        return;
      }
      const uid = authUser.uid;
      ensureSeedClubsExist(SEED_CLUBS).catch(() => {});
      ensureSeedTournamentsExist(SEED_TOURNAMENTS).catch(() => {});
      realUnsubsRef.current = [
        subscribeTournaments(docs => {
          const prev = prevTournamentsRef.current;
          docs.forEach(t => {
            const old = prev.find(p => p.id === t.id);
            if (!old) return; // first load — nothing "changed" yet, don't notify

            if (t.hostUid === uid) {
              (t.pendingRequesterIds ?? []).filter(p => !(old.pendingRequesterIds ?? []).includes(p))
                .forEach(() => addNotification({ type: 'tournament_join_request', title: 'Join Request', body: `Someone requested to join ${t.name}.`, meta: { tournamentId: t.id } }));
            }

            const oldPending = old.pendingRequesterIds ?? [];
            const newPending = t.pendingRequesterIds ?? [];
            if (oldPending.includes(uid) && !newPending.includes(uid)) {
              // No uid on the participants list to check directly (see approveTournamentRequest) —
              // currentPlayers only moves via register/approve/unregister, so "did it go up"
              // is a good-enough accept/decline signal at this scale.
              if (t.currentPlayers > old.currentPlayers) addNotification({ type: 'tournament_accepted', title: 'Request Approved', body: `Your request to join ${t.name} was accepted!` });
              else addNotification({ type: 'tournament_declined', title: 'Request Declined', body: `Your request to join ${t.name} was declined.` });
            }
          });
          prevTournamentsRef.current = docs;
          setRawTournaments(docs);
        }),
        subscribeChallengesFor('toUid', uid, docs => {
          const prev = prevIncomingChallengesRef.current;
          if (challengesLoadedRef.current) {
            docs.filter(d => d.status === 'pending' && !prev.some(p => p.id === d.id))
              .forEach(c => addNotification({ type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` }));
          }
          challengesLoadedRef.current = true;
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
          if (conversationsLoadedRef.current) {
            docs.forEach(d => {
              const oldCount = prev.find(p => p.id === d.id)?.messages.length ?? 0;
              const newFromOther = d.messages.slice(oldCount).filter(m => m.senderId !== uid);
              if (newFromOther.length === 0) return;
              const otherUid = d.participantUids.find(u => u !== uid) ?? '';
              const otherName = d.participants?.[otherUid]?.displayName ?? 'Someone';
              addNotification({ type: 'new_message', title: `New message from ${otherName}`, body: newFromOther[newFromOther.length - 1].text, linkTo: `${BASE_PATH}/chat/?realUid=${otherUid}` });
            });
          }
          conversationsLoadedRef.current = true;
          prevConversationsRef.current = docs;
          setRealConversationDocs(docs);
        }),
        // Rows written by notifyUser (tournament_win, inactivity_reminder,
        // weekly_digest, referral_joined) — previously only ever fired a push
        // and vanished once dismissed, with no trace in the bell/panel. Full
        // replace on each event, same "server is the source of truth" idiom
        // subscribeClubs uses; local-only entries (challenge/match-invite
        // etc., id-prefixed 'n_') are kept as-is alongside these.
        subscribeMyNotifications(uid, rows => {
          setNotifications(prev => {
            const local = prev.filter(n => n.id.startsWith('n_'));
            const remote = rows.map(r => ({ id: r.id, type: r.type, title: r.title, body: r.body, read: r.read, createdAt: r.createdAt, linkTo: r.linkTo } as Notification));
            return [...remote, ...local].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });
        }),
        subscribeEndorsementsReceived(uid, setRealEndorsementCounts),
        subscribeFollowing(uid, (accepted, pending) => {
          if (followingLoadedRef.current) {
            const prevPending = prevFollowingPendingRef.current;
            prevPending.filter(u => !pending.includes(u) && accepted.includes(u))
              .forEach(() => addNotification({ type: 'friend_accepted', title: 'Follow Request Accepted', body: 'They accepted your follow request.' }));
          }
          followingLoadedRef.current = true;
          prevFollowingPendingRef.current = pending;
          setRealFollowingAccepted(accepted);
          setRealFollowingPending(pending);
        }),
        subscribeIncomingFollowRequests(uid, requesters => {
          if (incomingFollowsLoadedRef.current) {
            const prev = prevIncomingFollowsRef.current;
            requesters.filter(u => !prev.includes(u))
              .forEach(() => addNotification({ type: 'friend_request', title: 'New Follow Request', body: 'Someone wants to follow you.' }));
          }
          incomingFollowsLoadedRef.current = true;
          prevIncomingFollowsRef.current = requesters;
          setIncomingFollowRequests(requesters);
        }),
        subscribeVenues(setVenues),
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
            } else if (!old.memberIds.includes(uid) && c.memberIds.includes(uid)) {
              // Direct admin invite (inviteToClub) skips the pending step
              // entirely — this is the only place that path gets notified.
              addNotification({ type: 'club_accepted', title: 'Added to Club', body: `You were added to ${c.name}.` });
            }
          });
          prevClubsRef.current = docs;
          setRawClubs(docs);
        }),
        subscribeMyRealMatches(uid, docs => {
          const prev = prevMatchesRef.current;
          if (matchesLoadedRef.current) {
            docs.forEach(d => {
              const old = prev.find(p => p.id === d.id);
              if (!old && d.pendingConfirmations.includes(uid)) {
                const oppName = d.reporterUid === d.player1Id ? d.player1Name : d.player2Name;
                addNotification({ type: 'match_pending', title: 'Match Result Reported', body: `${oppName} reported a match result — confirm or dispute it.` });
              } else if (old?.status === 'Pending' && d.status === 'Confirmed' && d.reporterUid === uid) {
                addNotification({ type: 'match_confirmed', title: 'Match Confirmed', body: 'Your opponent confirmed the match result.' });
              }
            });
          }
          matchesLoadedRef.current = true;
          prevMatchesRef.current = docs;
          setRealMatches(docs);
        }),
        subscribeOnlinePresence(uid, setOnlineUids),
      ];
    });
    return () => { unsubAuth(); realUnsubsRef.current.forEach(fn => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Applies each side's own MMR delta exactly once per confirmed real match.
  // Durable across reloads/devices via mmrAppliedBy on the shared doc (not
  // just in-memory state) — a match confirmed while this device was offline
  // still needs its delta applied the next time it's seen.
  // Bug fix 2026-07-28: this used to only call setUser (local React state),
  // never saveUserProfile — mmrAppliedBy WAS persisted, so on the next
  // reload/device those matches looked "already applied" and got skipped,
  // but the mmr/stats delta itself only ever lived in memory. Net effect:
  // every real user's mmr and win/loss record silently reverted to their
  // last-saved Supabase value (usually the 1200 signup default) on every
  // fresh session. Computing the batch here (not one setUser call per match)
  // also means a device that was offline for several confirmed matches does
  // one write instead of N.
  const mmrApplyingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const toApply = realMatches.filter(m =>
      m.status === 'Confirmed' && !m.mmrAppliedBy.includes(uid) && !mmrApplyingRef.current.has(m.id)
    );
    if (toApply.length === 0) return;
    toApply.forEach(m => mmrApplyingRef.current.add(m.id));

    let persisted: Partial<UserProfile> | null = null;
    setUser(u => {
      let mmr = u.mmr;
      let { wins, losses, totalMatches } = u.stats;
      // Placement/recalibration burn a slot only once a match is actually
      // Confirmed (bug fix 2026-08-09: used to increment at submit time, so
      // a match that never got confirmed — cancelled, opponent ghosted —
      // still permanently cost a calibration slot with no MMR ever applied).
      let placementMatchesPlayed = u.placementMatchesPlayed ?? 0;
      let recalibrationMatchesPlayed = u.recalibrationMatchesPlayed;
      let lastRecalibrationAt = u.lastRecalibrationAt;
      toApply.forEach(m => {
        // Casual/practice matches are recorded but never touch MMR, ranked
        // win/loss stats, or calibration — still get marked applied below so
        // this effect stops retrying them every render.
        if (m.mode === 'casual') return;
        const iWon = m.winnerId === uid;
        const delta = (m.reporterUid === uid ? m.mmrChange : m.mmrChange !== undefined ? -m.mmrChange : undefined) ?? 0;
        mmr += delta;
        if (iWon) wins++; else losses++;
        totalMatches++;
        const placementDone = placementMatchesPlayed >= 10;
        const recalActive = placementDone && (recalibrationMatchesPlayed ?? 5) < 5;
        if (!placementDone) {
          placementMatchesPlayed += 1;
        } else if (recalActive) {
          const played = (recalibrationMatchesPlayed ?? 0) + 1;
          if (played >= 5) { recalibrationMatchesPlayed = null; lastRecalibrationAt = new Date().toISOString(); }
          else recalibrationMatchesPlayed = played;
        }
      });
      const tier = getTier(mmr);
      const stats = { wins, losses, totalMatches };
      persisted = { mmr, tier, stats, placementMatchesPlayed, recalibrationMatchesPlayed, lastRecalibrationAt };
      // lastActiveAt only goes in local state here, not the `persisted` patch
      // above — it's a separate saveUserProfile call below (see there for why).
      return { ...u, ...persisted, lastActiveAt: new Date().toISOString() };
    });
    if (persisted) saveUserProfile(uid, persisted).catch(() => {});
    // Reliability (reliability.ts) reads last_active_at to tell "established"
    // from "stale" for OTHER players' profiles, not just your own inactivity
    // check. Deliberately a SEPARATE update from the mmr/stats/placement one
    // above: last_active_at needs migration 0031 applied in Supabase first
    // (see that file — not auto-applied), and PostgREST fails an UPDATE
    // *entirely* if any one column in it doesn't exist yet. Bundling it into
    // `persisted` would silently break real MMR/stats persistence for every
    // user until Lok runs that migration — keeping it separate means only
    // this one (non-critical) field fails to save until then, not the whole
    // profile update.
    saveUserProfile(uid, { lastActiveAt: new Date().toISOString() }).catch(() => {});

    toApply.forEach(m => markMatchMmrApplied(m.id, uid).catch(() => { mmrApplyingRef.current.delete(m.id); }));
  }, [realMatches]);

  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
    const uid = auth.currentUser?.uid;
    if (uid) saveOpenToPlay(uid, user.openToPlay ?? false).catch(() => {});
  }, [user.openToPlay]);

  const isRealMatchId = useCallback((id: string) => realMatches.some(m => m.id === id), [realMatches]);

  // A match against a real, singles opponent becomes a shared Supabase row
  // both accounts can see and confirm, instead of a local-only record only
  // the reporter ever sees — see toLocalMatch for how each side reads it
  // back. Doubles (or a demo opponent) keep the original local-only path.
  const addMatch      = useCallback((m: Match) => {
    const uid = auth.currentUser?.uid;
    // Playing at all resets the inactivity clock, regardless of ranked/casual
    // or whether the reminder ever actually fired for this dormancy cycle.
    if (uid) updateUser({ inactivityReminderSentAt: null });
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
        mode: m.mode,
        playedAt: m.playedAt,
        location: m.location,
        pendingConfirmations: [m.player2Id],
        mmrAppliedBy: [],
        pointLog: m.pointLog, recordedLive: m.recordedLive, liveStats: m.liveStats,
        clipUrl: m.clipUrl, shuttleHits: m.shuttleHits,
      };
      sendMatchDoc(stored).catch(() => {});
      // Optimistic local echo, same pattern as sendChallenge.
      setRealMatches(p => [stored, ...p.filter(x => x.id !== stored.id)]);
      return;
    }
    setMatches(p => [m, ...p]);
    if (uid) saveMatch(uid, m).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (m.mode !== 'casual') {
        const iWon = m.winnerId === 'me';
        const delta = m.mmrChange ?? 0;
        setUser(u => {
          // Placement/recalibration burn a slot only on confirm, same as MMR
          // above — see the real-match equivalent in the mmrApplyingRef effect.
          const placementDone = (u.placementMatchesPlayed ?? 0) >= 10;
          const recalActive = placementDone && (u.recalibrationMatchesPlayed ?? 5) < 5;
          const placementPatch = !placementDone
            ? { placementMatchesPlayed: (u.placementMatchesPlayed ?? 0) + 1 }
            : recalActive
            ? (() => {
                const played = (u.recalibrationMatchesPlayed ?? 0) + 1;
                return played >= 5
                  ? { recalibrationMatchesPlayed: null, lastRecalibrationAt: new Date().toISOString() }
                  : { recalibrationMatchesPlayed: played };
              })()
            : {};
          const mmr = u.mmr + delta;
          return {
            ...u, mmr, tier: getTier(mmr), ...placementPatch, lastActiveAt: new Date().toISOString(),
            stats: { wins: u.stats.wins + (iWon?1:0), losses: u.stats.losses + (iWon?0:1), totalMatches: u.stats.totalMatches + 1 },
          };
        });
      }
      return { ...m, status: 'Confirmed' as const, pendingConfirmations: [] };
    }));
  }, [isRealMatchId]);
  const disputeMatch  = useCallback((id: string) => {
    const realUid = auth.currentUser?.uid;
    if (isRealMatchId(id) && realUid) { disputeSharedMatch(id, realUid).catch(() => {}); return; }
    setMatches(p => p.map(m => m.id === id ? { ...m, status: 'Disputed' as const, disputedBy: 'me' } : m));
  }, [isRealMatchId]);
  // Re-submit model, not admin review — reuses the exact same pending-
  // confirmation flow as the initial report (there's no global moderator
  // role in this app, only club-scoped ones, so "admin review" would need
  // inventing a whole new system for a model this already covers).
  const resubmitMatch = useCallback((id: string, games: { p1: number; p2: number }[]) => {
    const realUid = auth.currentUser?.uid;
    if (isRealMatchId(id) && realUid) {
      const m = realMatches.find(x => x.id === id);
      if (!m) return;
      const amP1 = m.player1Id === realUid;
      const storedGames = amP1 ? games : games.map(g => ({ p1: g.p2, p2: g.p1 }));
      const newWinnerId = resubmitWinner(storedGames, m.player1Id, m.player2Id);
      const reporterMmrChange = resignedMmrChange(m.mmrChange, newWinnerId, m.reporterUid);
      resubmitSharedMatch(id, realUid, storedGames, newWinnerId, reporterMmrChange).catch(() => {});
      return;
    }
    setMatches(p => p.map(m => {
      if (m.id !== id) return m;
      const newWinnerId = resubmitWinner(games, 'me', m.player2Id);
      return {
        ...m, games, winnerId: newWinnerId,
        mmrChange: resignedMmrChange(m.mmrChange, newWinnerId, 'me'),
        status: 'Pending' as const, disputedBy: undefined,
      };
    }));
  }, [isRealMatchId, realMatches]);
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
        const { uid: _uid, username: _username, globalRank: _globalRank, stats: _stats, mmr: _mmr, tier: _tier, ...rest } = next;
        localStorage.setItem('cc_userProfile', JSON.stringify(rest));
      } catch { /* ignore */ }
      return next;
    });
    const uid = auth.currentUser?.uid;
    if (uid) saveUserProfile(uid, patch).catch(() => {});
  }, []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);

  // Tournaments — real Supabase rows now (see rawTournaments/subscribeTournaments
  // above), same translate-to-'me' + write-then-rely-on-subscription pattern as
  // clubs. myRealUid is declared here (not down by the clubs section) because
  // these callbacks need it too.
  const myRealUid = auth.currentUser?.uid ?? '';
  const tournaments: Tournament[] = useMemo(() => rawTournaments.map(t => toLocalTournament(t, myRealUid)), [rawTournaments, myRealUid]);

  const addTournament = useCallback(async (t: Tournament): Promise<string | null> => {
    if (!myRealUid) return 'Session expired. Please sign in again.';
    const stored: Tournament = { ...t, hostUid: myRealUid };
    try {
      await createTournamentDoc(stored);
      // Optimistic local echo — the subscription reconciles once Supabase confirms.
      setRawTournaments(p => [stored, ...p.filter(x => x.id !== stored.id)]);
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
  }, [myRealUid]);
  const registerTournament  = useCallback(async (id: string) => {
    const reg = { registeredAt: new Date().toISOString() };
    setRegistrations(r => ({ ...r, [id]: reg }));
    // registerForTournament re-checks capacity against the live row (not the
    // possibly-stale `tournaments` snapshot) before writing — same guard
    // addClubMember already applies to club joins.
    const ok = await registerForTournament(id, user.displayName, user.username).catch(() => false);
    if (!ok) {
      setRegistrations(r => { const n = { ...r }; delete n[id]; return n; });
      addNotification({ type: 'event_registered', title: 'Event Full', body: 'Sorry, this event just filled up.' });
      return;
    }
    addNotification({ type: 'event_registered', title: 'Event Registration', body: 'You have registered for the event!' });
    const uid = auth.currentUser?.uid;
    if (uid) saveTournamentReg(uid, id, reg).catch(() => {});
  }, [user.displayName, user.username]);
  const unregisterTournament = useCallback((id: string) => {
    setRegistrations(r => { const n = { ...r }; delete n[id]; return n; });
    // Atomic RPC (unregister_tournament_participant, migration 0029) closes
    // the decrement race a plain read-modify-write here used to have — same
    // fix as registerForTournament's earlier overbooking guard.
    unregisterTournamentParticipant(id, user.username).catch(() => {});
    const uid = auth.currentUser?.uid;
    if (uid) deleteTournamentReg(uid, id).catch(() => {});
  }, [user.username]);
  const requestToJoin = useCallback((id: string) => {
    if (!myRealUid) return;
    addTournamentPending(id, myRealUid).catch(() => {});
    addNotification({ type: 'tournament_request', title: 'Request Sent', body: 'Your request to join has been sent to the host.' });
  }, [myRealUid]);
  const cancelRequest = useCallback((id: string) => {
    if (!myRealUid) return;
    removeTournamentPending(id, myRealUid).catch(() => {});
  }, [myRealUid]);
  // Mirrors acceptClubMember: approveTournamentRequest returns false on a
  // silent server-side rejection (event filled up since the host saw the
  // request) rather than throwing, so this has to check the result instead
  // of assuming success — a host approving into a now-full event was told
  // "Request Approved" even though the requester was declined underneath.
  const acceptTournamentRequest = useCallback(async (tournamentId: string, uid: string) => {
    const ok = await approveTournamentRequest(tournamentId, toRealUid(uid, myRealUid)).catch(() => false);
    if (ok) {
      addNotification({ type: 'tournament_accepted', title: 'Request Approved', body: 'A player joined your event.' });
    } else {
      addNotification({ type: 'tournament_declined', title: 'Could Not Accept', body: 'This event is full — the request could not be approved.' });
    }
  }, [myRealUid]);
  const declineTournamentRequest = useCallback((tournamentId: string, uid: string) => {
    removeTournamentPending(tournamentId, toRealUid(uid, myRealUid), true).catch(() => {});
  }, [myRealUid]);

  // Host starts the event: generates a single-elimination bracket from the
  // signed-up participants (random seeding — no MMR-seeding UI exists) and
  // flips status to Active. Bracket UI was already built for the seed demo
  // tournaments; real ones just never had anything populating it before.
  const startTournamentBracket = useCallback((tournamentId: string) => {
    const t = tournaments.find(x => x.id === tournamentId);
    // Bail if already started — guards the double-tap race (button stays
    // visible until the subscription round-trips) that used to regenerate a
    // second random bracket and let two writes fight over which one sticks.
    if (!t || t.status === 'Active' || t.bracket || (t.participants ?? []).length < 2) return;
    const bracket = generateBracket(t.participants!);
    updateTournamentDoc(tournamentId, { status: 'Active', bracket }).catch(() => {});
    // Optimistic local patch (same fix as editTournament) — without this the
    // second tap above would still read the pre-bracket tournament until the
    // realtime subscription caught up.
    setRawTournaments(p => p.map(x => x.id === tournamentId ? { ...x, status: 'Active', bracket } : x));
    // Product idea: auto-share the bracket into the host club's chat, if this
    // event was hosted "as" a club (hostClubId — a real FK, unlike organiser
    // which is just the club's name for display). Individually-hosted events
    // have no hostClubId and nothing to post to.
    if (t.hostClubId) {
      sendSystemClubMessage(t.hostClubId, `🏆 Bracket's up for ${t.name}! Check the Tournaments tab to follow the matches.`).catch(() => {});
    }
  }, [tournaments]);

  // Host reports a live bracket match's result. Propagates the winner into
  // the next round same as reportBracketResult; if that was the final match,
  // also marks the tournament Completed and pushes the champion a real
  // notification (reaches them even with the app closed, same pattern as
  // sendChallengeDoc/sendSharedMessage).
  const reportBracketResult = useCallback((tournamentId: string, matchId: string, winnerUsername: string, score?: string) => {
    const t = tournaments.find(x => x.id === tournamentId);
    if (!t?.bracket) return;
    const updated = computeBracketResult(t.bracket, matchId, winnerUsername, score);
    const champion = bracketChampion(updated); // username, guaranteed unique - no name-collision risk
    const patch: Partial<Tournament> = { bracket: updated };
    if (champion) {
      patch.status = 'Completed';
      const participant = (t.participants ?? []).find(p => p.username === champion);
      if (participant) {
        patch.championUsername = participant.username;
        patch.championDisplayName = participant.displayName;
        lookupUserByUsername(participant.username).then(profile => {
          if (profile?.uid) notifyUser(profile.uid, { type: 'tournament_win', title: '🏆 Tournament Champion', body: `You won ${t.name}!`, linkTo: `${BASE_PATH}/tournaments/` });
        }).catch(() => {});
      }
    }
    updateTournamentDoc(tournamentId, patch).catch(() => {});
    // Optimistic local patch — without this, reporting two results
    // back-to-back (normal for a host clearing round 1) reads a stale local
    // bracket for the second call before the first write's realtime
    // round-trip lands, silently losing the first result. Same fix as
    // editTournament above.
    setRawTournaments(p => p.map(x => x.id === tournamentId ? { ...x, ...patch } : x));
  }, [tournaments]);

  // Host misclick recovery — no way to undo a reported result before today.
  // No-ops (via computeUndoBracketResult returning null) on a bye, a match
  // with no result yet, or one whose winner already has a result recorded
  // further into the bracket (host has to undo that one first). Reverts the
  // tournament back to Active if this was the championship match.
  const undoBracketResult = useCallback((tournamentId: string, matchId: string) => {
    const t = tournaments.find(x => x.id === tournamentId);
    if (!t?.bracket) return;
    const updated = computeUndoBracketResult(t.bracket, matchId);
    if (!updated) return;
    const patch: Partial<Tournament> = { bracket: updated };
    if (t.status === 'Completed') patch.status = 'Active';
    updateTournamentDoc(tournamentId, patch).catch(() => {});
    setRawTournaments(p => p.map(x => x.id === tournamentId ? { ...x, ...patch } : x));
  }, [tournaments]);

  // Host fixes a typo or changes plans after creation (name/venue/date/time/
  // description) — previously permanent (Notion "Tournament hosts can't edit
  // or cancel a hosted event"). Optimistically patches rawTournaments too
  // (found live: without this, re-opening Edit right after Save showed the
  // pre-edit data until the realtime subscription round-tripped or the page
  // reloaded — the write had already succeeded, the UI just hadn't caught
  // up) and surfaces a failure instead of swallowing it, same as
  // updateClub/disbandClub above.
  const editTournament = useCallback(async (id: string, patch: Partial<Tournament>): Promise<string | null> => {
    try {
      await updateTournamentDoc(id, patch);
      setRawTournaments(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
  }, []);

  // Host cancels a hosted event. Setting status to 'Cancelled' also drops it
  // from the public Events page (fetchPublicTournaments filters status ===
  // 'Upcoming') and every in-app tab (Active/Upcoming/Completed) without
  // needing a delete policy. Notifies already-registered participants —
  // same reasoning as handleCancelMatch's notify-all-parties for planned
  // matches, an event they signed up for just disappeared on them. Same
  // optimistic-update + error-surfacing fix as editTournament above.
  const cancelTournament = useCallback(async (id: string): Promise<string | null> => {
    const t = tournaments.find(x => x.id === id);
    try {
      await updateTournamentDoc(id, { status: 'Cancelled' });
      setRawTournaments(p => p.map(x => x.id === id ? { ...x, status: 'Cancelled' } : x));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
    (t?.participants ?? []).forEach(p => {
      lookupUserByUsername(p.username).then(profile => {
        if (profile?.uid) notifyUser(profile.uid, {
          type: 'tournament_cancelled', title: 'Event Cancelled',
          body: `${t?.name ?? 'An event'} you signed up for was cancelled by the host.`,
          linkTo: `${BASE_PATH}/tournaments/`,
        });
      }).catch(() => {});
    });
    return null;
  }, [tournaments]);

  const myTournamentPendingIds = useMemo(() =>
    tournaments.filter(t => (t.pendingRequesterIds ?? []).includes('me')).map(t => t.id),
  [tournaments]);

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
      // Optimistic local echo — the listener reconciles once Supabase confirms.
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
  // writes straight to Supabase (read-modify-write on the clubs row's array
  // columns — see mutateClubArray's ponytail note, not atomic under
  // concurrent edits) and relies on the live subscription above to reflect
  // the change back, rather than managing local copies.
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

  const joinClub = useCallback(async (id: string) => {
    const club = clubs.find(c => c.id === id);
    if (myClubIds.includes(id) || myClubIds.length >= clubLimit || !myRealUid) return;
    if (club?.minMMR && user.mmr < club.minMMR) return;
    // These client-side checks can be stale (another join/leave happened
    // since this render) - only show success once the server confirms it,
    // not optimistically, so a rejected join (club filled up, tier cap hit)
    // doesn't tell you "Joined!" when you weren't actually added.
    const joined = await addClubMember(id, myRealUid).catch(() => false);
    if (joined) addNotification({ type: 'club_accepted', title: 'Joined Club', body: `You joined a new club!` });
    else addNotification({ type: 'club_declined', title: 'Could not join', body: club?.name ? `${club.name} is full or unavailable right now.` : 'This club is full or unavailable right now.' });
  }, [clubs, myClubIds, clubLimit, myRealUid, user.mmr]);

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

  const createClub = useCallback(async (c: Club): Promise<string | null> => {
    if (!myRealUid) return 'Session expired. Please sign in again.';
    const stored: Club = {
      ...c,
      adminId: toRealUid(c.adminId, myRealUid),
      memberIds: c.memberIds.map(u => toRealUid(u, myRealUid)),
    };
    try {
      await createClubDoc(stored);
      // Optimistic local echo — the subscription reconciles once Supabase confirms.
      setRawClubs(p => [stored, ...p.filter(x => x.id !== stored.id)]);
      return null;
    } catch (e: unknown) {
      // Supabase errors (PostgrestError) are plain {message, code, ...}
      // objects, not Error instances - instanceof Error would miss them.
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
  }, [myRealUid]);

  // Same shape as createClub above: return an error message instead of
  // swallowing it, so callers can keep the edit UI open / show what went
  // wrong instead of assuming success and closing immediately. Also patches
  // rawClubs optimistically on success — found live: without this, reopening
  // the announcement/settings editor right after Save showed the pre-edit
  // data until the realtime subscription round-tripped or the page reloaded,
  // even though the write had already succeeded (same stale-UI bug just
  // fixed for editTournament). Every call site here only ever patches
  // non-uid fields (announcement/name/description/maxMembers/color), so a
  // raw spread is safe against rawClubs' real-uid shape.
  const updateClub = useCallback(async (id: string, patch: Partial<Club>): Promise<string | null> => {
    try {
      await updateClubDoc(id, patch);
      setRawClubs(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
  }, []);

  const disbandClub = useCallback(async (id: string): Promise<string | null> => {
    try {
      await deleteClubDoc(id);
      setRawClubs(p => p.filter(c => c.id !== id));
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      return msg || 'Something went wrong. Please try again.';
    }
  }, []);

  const assignModerator = useCallback((clubId: string, uid: string) => {
    setClubModerator(clubId, toRealUid(uid, myRealUid), true).catch(() => {});
  }, [myRealUid]);

  const removeModerator = useCallback((clubId: string, uid: string) => {
    setClubModerator(clubId, toRealUid(uid, myRealUid), false).catch(() => {});
  }, [myRealUid]);

  // Mirrors acceptTournamentRequest/approveTournamentRequest: addClubMember
  // returns false on a silent server-side rejection (club filled up since
  // the admin saw the request) rather than throwing, so this has to check
  // the result instead of assuming success like the old version did — an
  // admin approving a request into a full club was told "Member Accepted"
  // and the requester was left stuck in pending forever with no notice.
  const acceptClubMember = useCallback(async (clubId: string, uid: string) => {
    const realUid = toRealUid(uid, myRealUid);
    const joined = await addClubMember(clubId, realUid).catch(() => false);
    if (joined) {
      addNotification({ type: 'club_accepted', title: 'Member Accepted', body: 'A new member joined your club.' });
    } else {
      removeClubPending(clubId, realUid, true).catch(() => {});
      addNotification({ type: 'club_declined', title: 'Could Not Accept', body: 'This club is full — the request could not be approved.' });
    }
  }, [myRealUid]);

  const declineClubMember = useCallback((clubId: string, uid: string) => {
    removeClubPending(clubId, toRealUid(uid, myRealUid), true).catch(() => {});
  }, [myRealUid]);

  const inviteToClub = useCallback((clubId: string, targetUid: string) => {
    // Admin inviting another player — adds them immediately, matching the
    // existing (consent-free) demo behavior; now persisted for real. The
    // invited player is notified via the subscribeClubs diff below (their
    // own memberIds change), not here.
    addClubMember(clubId, targetUid).catch(() => {});
    addNotification({ type: 'club_accepted', title: 'Invite Sent', body: 'Player has been added to the club.' });
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
  // member of — NOT the full clubs table. One Supabase listener per
  // club I've joined (bounded by the per-tier club cap, so at most a handful
  // per user), reconciled as myClubIds changes rather than tearing down and
  // recreating every subscription on every unrelated re-render: no cleanup
  // is returned from this effect itself (the ref persists across renders and
  // add/remove is handled explicitly in the body); a separate mount-only
  // effect below handles the true-unmount case.
  const clubMsgUnsubsRef = useRef<Record<string, () => void>>({});
  // Tracks the last-seen message id per club, not the full array — the
  // subscription is a sliding window of the most recent 10 messages, not an
  // append-only history, so `msgs.length` stops changing (pinned at 10) once
  // a club passes 10 total messages, and diffing by array length went silent
  // forever past that point. Diffing by id survives the window sliding.
  const lastSeenClubMsgIdRef = useRef<Record<string, string | undefined>>({});
  useEffect(() => {
    if (!myRealUid) return;
    const wanted = new Set(myClubIds);
    Object.keys(clubMsgUnsubsRef.current).forEach(id => {
      if (wanted.has(id)) return;
      clubMsgUnsubsRef.current[id]();
      delete clubMsgUnsubsRef.current[id];
      delete lastSeenClubMsgIdRef.current[id];
    });
    myClubIds.forEach(id => {
      if (clubMsgUnsubsRef.current[id]) return;
      const clubName = clubs.find(c => c.id === id)?.name ?? 'Club';
      clubMsgUnsubsRef.current[id] = subscribeClubMessages(id, msgs => {
        const lastSeenId = lastSeenClubMsgIdRef.current[id];
        if (lastSeenId !== undefined) {
          const seenIdx = msgs.findIndex(m => m.id === lastSeenId);
          // seenIdx === -1 means the last-seen message aged out of the
          // window (a burst of >10 new messages) - treat the whole window
          // as new rather than silently dropping the notification.
          const newFromOthers = (seenIdx === -1 ? msgs : msgs.slice(seenIdx + 1)).filter(m => m.senderId !== myRealUid);
          if (newFromOthers.length > 0) {
            const last = newFromOthers[newFromOthers.length - 1];
            addNotification({ type: 'club_message', title: clubName, body: `${last.senderName}: ${last.text}` });
          }
        }
        lastSeenClubMsgIdRef.current[id] = msgs[msgs.length - 1]?.id;
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
      const uid = auth.currentUser?.uid;
      if (uid) saveUserProfile(uid, { clipCredits: next, clipBadge: badge }).catch(() => {});
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
      const uid = auth.currentUser?.uid;
      if (uid) saveUserProfile(uid, { courtProfile: next }).catch(() => {});
      return next;
    });
  }, []);

  const followPlayer = useCallback((uid: string, isTargetPrivate?: boolean) => {
    if (isRealUid(uid)) {
      // Real target: write straight to the shared `friends` table (optimistic
      // local echo below, reconciled once subscribeFollowing's next snapshot
      // lands) — no fake timer, the target's own accept action is what moves
      // a pending row to accepted (see respondToFollowRequest).
      const realUid = auth.currentUser?.uid;
      if (!realUid) return;
      if (isTargetPrivate) setRealFollowingPending(p => p.includes(uid) ? p : [...p, uid]);
      else setRealFollowingAccepted(p => p.includes(uid) ? p : [...p, uid]);
      followUser(realUid, user.displayName, uid, !!isTargetPrivate).catch(() => {});
      return;
    }
    const targetName = ALL_PLAYERS.find(p => p.uid === uid)?.displayName ?? 'this player';
    if (isTargetPrivate) {
      setLocalFollowRequestsSent(p => {
        const next = p.includes(uid) ? p : [...p, uid];
        try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
      addNotification({ type: 'friend_request', title: 'Follow Request Sent', body: `Your follow request to ${targetName} is pending approval.` });
      // Demo accounts auto-accept after a short delay to simulate a real accept flow —
      // but only if the request hasn't been cancelled (unfollowPlayer) in the meantime.
      setTimeout(() => {
        let stillPending = false;
        setLocalFollowRequestsSent(p => {
          stillPending = p.includes(uid);
          if (!stillPending) return p;
          const next = p.filter(id => id !== uid);
          try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        if (!stillPending) return;
        setLocalFollowing(p => {
          const next = p.includes(uid) ? p : [...p, uid];
          try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        addNotification({ type: 'friend_accepted', title: 'Follow Request Accepted', body: `${targetName} accepted your follow request.` });
      }, 2500);
      return;
    }
    setLocalFollowing(p => {
      const next = p.includes(uid) ? p : [...p, uid];
      try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [user.displayName]);

  const unfollowPlayer = useCallback((uid: string) => {
    if (isRealUid(uid)) {
      const realUid = auth.currentUser?.uid;
      if (!realUid) return;
      setRealFollowingAccepted(p => p.filter(id => id !== uid));
      setRealFollowingPending(p => p.filter(id => id !== uid));
      unfollowUser(realUid, uid).catch(() => {});
      return;
    }
    setLocalFollowRequestsSent(p => {
      if (!p.includes(uid)) return p;
      const next = p.filter(id => id !== uid);
      try { localStorage.setItem('cc_followRequestsSent', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setLocalFollowing(p => {
      const next = p.filter(id => id !== uid);
      try { localStorage.setItem('cc_following', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const respondToFollowRequestAction = useCallback((requesterUid: string, accept: boolean) => {
    const realUid = auth.currentUser?.uid;
    if (!realUid) return;
    setIncomingFollowRequests(p => p.filter(id => id !== requesterUid));
    respondToFollowRequest(realUid, user.displayName, requesterUid, accept).catch(() => {});
  }, [user.displayName]);

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

  const markNotifRead    = useCallback((id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    // Safe no-op for local-only ids (challenge/match-invite etc.) — nothing
    // in the DB matches those, so the UPDATE just affects zero rows.
    markNotificationReadRemote(id).catch(() => {});
  }, []);
  const markAllNotifsRead = useCallback(() => setNotifications(p => {
    p.filter(n => !n.read && !n.id.startsWith('n_')).forEach(n => { markNotificationReadRemote(n.id).catch(() => {}); });
    return p.map(n => ({ ...n, read: true }));
  }), []);
  const unreadNotifCount  = notifications.filter(n => !n.read).length;
  const deleteNotif = useCallback((id: string) => {
    setNotifications(p => p.filter(n => n.id !== id));
    // Safe no-op for local-only ids, same reasoning as markNotifRead above.
    deleteNotificationRemote(id).catch(() => {});
  }, []);
  const clearAllNotifs = useCallback(() => {
    setNotifications([]);
    if (myRealUid) deleteAllNotificationsRemote(myRealUid).catch(() => {});
  }, [myRealUid]);

  // Sends a message in a real cross-account conversation (shared Supabase row,
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
    // Optimistic local echo — the subscription reconciles once Supabase confirms.
    setRealConversationDocs(prev => {
      const existing = prev.find(c => c.id === chatId);
      if (existing) {
        return prev.map(c => c.id === chatId
          ? { ...c, messages: [...c.messages, msg], lastMessage: msg.text, lastAt: msg.sentAt }
          : c);
      }
      return [...prev, { id: chatId, participantUids: [realUid, otherUid], participants, messages: [msg], lastMessage: msg.text, lastAt: msg.sentAt }];
    });
  }, [user.displayName, user.username, user.tier, user.mmr, user.photoURL]);

  const markRealConvRead = useCallback((chatId: string) => {
    // ponytail: shell conversations from ?realUid= deep links have a transient
    // pending_<uid> id — marking them read leaves an orphan key in cc_realLastRead forever.
    if (chatId.startsWith('pending_')) return;
    setRealLastRead(prev => {
      const next = { ...prev, [chatId]: new Date().toISOString() };
      try { localStorage.setItem('cc_realLastRead', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Combine local/demo state with the real, Supabase-synced cross-account
  // state. myRealUid (declared above, next to the club logic) is '' when
  // signed out, so isRealUid-keyed lookups just fall through to nothing
  // rather than mismatching against a stale uid. Deduped by id: the
  // optimistic echo in sendChallenge and the incoming/outgoing subscriptions
  // update independently, so a challenge can briefly exist in two of these
  // lists at once — without this, ChallengesSection renders it twice
  // (reported as a duplicate "Declined" row on Home).
  const challenges: Challenge[] = useMemo(() => {
    const merged = [
      ...localChallenges,
      ...realIncomingChallenges.map(c => toLocalChallenge(c, myRealUid)),
      ...realOutgoingChallenges.map(c => toLocalChallenge(c, myRealUid)),
    ];
    return [...new Map(merged.map(c => [c.id, c])).values()];
  }, [localChallenges, realIncomingChallenges, realOutgoingChallenges, myRealUid]);
  const conversations: Conversation[] = useMemo(() => [
    ...localConversations,
    ...realConversationDocs.map(c => toLocalConversation(c, myRealUid, realLastRead)),
  ].sort((a, b) => b.lastAt.localeCompare(a.lastAt)), [localConversations, realConversationDocs, myRealUid, realLastRead]);
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const allMatches: Match[] = useMemo(() => [
    ...matches,
    ...realMatches.map(m => toLocalMatch(m, myRealUid)),
  ].sort((a, b) => b.playedAt.localeCompare(a.playedAt)), [matches, realMatches, myRealUid]);

  // Recomputed live from match history on every render — no separate
  // award/persist step, so there's nothing to migrate or get out of sync.
  const earnedBadgeIds = useMemo(() => computeEarnedBadgeIds(allMatches, user, tournaments), [allMatches, user, tournaments]);
  const prevBadgeIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const prev = prevBadgeIdsRef.current;
    if (prev !== null) {
      earnedBadgeIds.filter(id => !prev.includes(id)).forEach(id => {
        const badge = BADGES.find(b => b.id === id);
        if (badge) addNotification({ type: 'badge_earned', title: 'Achievement unlocked', body: `${badge.name} — ${badge.description}`, linkTo: `${BASE_PATH}/profile/#achievements` });
      });
    }
    prevBadgeIdsRef.current = earnedBadgeIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedBadgeIds]);

  // Ranked season rollover — see src/lib/seasons.ts for the season-boundary
  // math and softResetMmr formula. No cron/server exists in this static-export
  // app, so this effect IS the cron: whichever client of this user happens to
  // load next after a season boundary has passed performs the rollover for
  // their own account (RLS only allows writing your own season_history row).
  const seasonRollingOverRef = useRef(false);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || profileLoading || seasonRollingOverRef.current) return;
    const closingSeason = user.seasonNumber ?? 1;
    const currentSeason = seasonNumberForDate(new Date());
    if (currentSeason <= closingSeason) return;
    seasonRollingOverRef.current = true;

    const mmrEnd = user.mmr;
    const tierEnd = getTier(mmrEnd);
    const entry: SeasonHistoryEntry = { seasonNumber: closingSeason, mmrEnd, tierEnd, endedAt: new Date().toISOString() };
    const nextMmr = softResetMmr(mmrEnd);
    const nextTier = getTier(nextMmr);

    saveSeasonHistoryEntry(uid, entry).catch(() => {});
    saveUserProfile(uid, { mmr: nextMmr, tier: nextTier, seasonNumber: currentSeason }).catch(() => {});
    setUser(u => ({ ...u, mmr: nextMmr, tier: nextTier, seasonNumber: currentSeason }));
    setPastSeasons(prev => [entry, ...prev.filter(p => p.seasonNumber !== entry.seasonNumber)]);
    setSeasonRecap(entry);
  }, [user.mmr, user.seasonNumber, profileLoading]);
  const dismissSeasonRecap = useCallback(() => setSeasonRecap(null), []);

  // Inactivity: a player who's finished placement but hasn't played in 90+
  // days gets re-placed — same 10-match calibration as a new account,
  // re-using placementMatchesPlayed rather than inventing a parallel field.
  // Their MMR keeps updating off real match results the whole time (nothing
  // here touches user.mmr); this only hides it and pulls them off the
  // leaderboard until they've played 10 fresh matches. A one-time reminder
  // fires ~2 weeks before the cutoff so an at-risk player gets a heads up.
  // ponytail: no server cron exists in this static-export app (see the
  // season-rollover effect above) — this only runs for a client that
  // actually loads during the window, same "whichever client loads next"
  // pattern. A user who never reopens the app won't be reminded; upgrade to
  // a scheduled Supabase Edge Function (send-push already has the pipeline)
  // if reaching fully-dormant users becomes worth the infra.
  const INACTIVITY_DAYS = 90;
  const REMINDER_AT_DAYS = 75;
  const inactivityCheckedRef = useRef(false);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || profileLoading || inactivityCheckedRef.current) return;
    if ((user.placementMatchesPlayed ?? 0) < 10) return; // already calibrating
    const lastActive = allMatches.length > 0 ? new Date(allMatches[0].playedAt) : new Date(user.joinedAt);
    const daysInactive = (Date.now() - lastActive.getTime()) / 86_400_000;
    inactivityCheckedRef.current = true;

    if (daysInactive >= INACTIVITY_DAYS) {
      updateUser({ placementMatchesPlayed: 0, inactivityReminderSentAt: null });
    } else if (daysInactive >= REMINDER_AT_DAYS && !user.inactivityReminderSentAt) {
      const daysLeft = Math.max(1, Math.ceil(INACTIVITY_DAYS - daysInactive));
      notifyUser(uid, {
        type: 'inactivity_reminder',
        title: '⏳ Your MMR is about to go on hold',
        body: `You haven't played in a while — log a ranked match in the next ${daysLeft} days to keep your rank visible.`,
        linkTo: `${BASE_PATH}/`,
      });
      updateUser({ inactivityReminderSentAt: new Date().toISOString() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.placementMatchesPlayed, user.inactivityReminderSentAt, user.joinedAt, allMatches, profileLoading]);

  // Weekly digest: a positive counterpart to the inactivity warning above —
  // "here's your week" for anyone who's actually been playing, not a nag.
  // Same client-triggered pattern (no server cron in this static-export
  // app): checked once per session on load, at most once per 7 days, and
  // only sent when there's something to report (silently resets the clock
  // otherwise so a dormant week doesn't queue up a stale digest for later).
  const DIGEST_INTERVAL_DAYS = 7;
  const digestCheckedRef = useRef(false);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || profileLoading || digestCheckedRef.current) return;
    const lastSent = user.weeklyDigestSentAt ? new Date(user.weeklyDigestSentAt) : new Date(user.joinedAt);
    const daysSinceSent = (Date.now() - lastSent.getTime()) / 86_400_000;
    if (daysSinceSent < DIGEST_INTERVAL_DAYS) return;
    digestCheckedRef.current = true;

    const weekAgo = Date.now() - DIGEST_INTERVAL_DAYS * 86_400_000;
    const weekMatches = allMatches.filter(m => m.status === 'Confirmed' && new Date(m.playedAt).getTime() >= weekAgo);
    if (weekMatches.length === 0) { updateUser({ weeklyDigestSentAt: new Date().toISOString() }); return; }

    const wins = weekMatches.filter(m => m.winnerId === 'me').length;
    const losses = weekMatches.length - wins;
    const mmrDelta = weekMatches.reduce((s, m) => s + (m.mmrChange ?? 0), 0);
    const mmrPart = isCalibrating(user) ? '' : `, MMR ${mmrDelta >= 0 ? '+' : ''}${mmrDelta}`;
    notifyUser(uid, {
      type: 'weekly_digest',
      title: '📅 Your week in review',
      body: `${weekMatches.length} match${weekMatches.length === 1 ? '' : 'es'} played — ${wins}W ${losses}L${mmrPart}.`,
      linkTo: `${BASE_PATH}/`,
    });
    updateUser({ weeklyDigestSentAt: new Date().toISOString() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.weeklyDigestSentAt, user.joinedAt, allMatches, profileLoading]);

  const combinedPlayerEndorsements = useMemo(() => {
    const meCounts: Record<string, number> = { ...(playerEndorsements.me ?? {}) };
    for (const [skill, cnt] of Object.entries(realEndorsementCounts)) {
      meCounts[skill] = (meCounts[skill] ?? 0) + cnt;
    }
    return { ...playerEndorsements, me: meCounts };
  }, [playerEndorsements, realEndorsementCounts]);

  // Merge local (demo-player) following state with real-account state, same
  // pattern as `challenges` merging localChallenges + real*Challenges.
  const following = useMemo(() => [...localFollowing, ...realFollowingAccepted], [localFollowing, realFollowingAccepted]);
  const followRequestsSent = useMemo(() => [...localFollowRequestsSent, ...realFollowingPending], [localFollowRequestsSent, realFollowingPending]);

  return (
    <Ctx.Provider value={{
      user, profileLoading, matches: allMatches, addMatch, confirmMatch, disputeMatch, resubmitMatch, cancelPendingMatch, updateUser,
      conversations, setConversations: setLocalConversations, sendRealMessage, markRealConvRead, allRealPlayers, venues, totalUnread, sidebarCollapsed, toggleSidebar,
      tournaments, addTournament, registrations, myTournamentPendingIds,
      registerTournament, unregisterTournament, requestToJoin, cancelRequest,
      acceptTournamentRequest, declineTournamentRequest, startTournamentBracket, reportBracketResult,
      undoBracketResult, editTournament, cancelTournament,
      challenges, sendChallenge, acceptChallenge, declineChallenge, cancelChallenge, isRealChallengeId,
      clubs, myClubIds, clubLimit, joinClub, requestJoinClub, cancelClubRequest, leaveClub, createClub, updateClub,
      acceptClubMember, declineClubMember, disbandClub, assignModerator, removeModerator, myClubPendingIds,
      inviteToClub, sendClubMessage,
      following, followRequestsSent, followPlayer, unfollowPlayer,
      incomingFollowRequests, respondToFollowRequest: respondToFollowRequestAction,
      onlineUids,
      clipCredits, awardClipCredits, courtProfile, saveCourtPositions,
      myEndorsements, playerEndorsements: combinedPlayerEndorsements, endorsePlayer,
      notifications, unreadNotifCount, addNotification, markNotifRead, markAllNotifsRead, deleteNotif, clearAllNotifs,
      earnedBadgeIds,
      pastSeasons, seasonRecap, dismissSeasonRecap,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
