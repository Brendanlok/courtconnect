export type Tier = 'Beginner' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Elite';
export type MatchType = 'MS' | 'WS' | 'MD' | 'WD' | 'MX';
export type MatchStatus = 'Pending' | 'Confirmed' | 'Disputed' | 'Cancelled';

export type MalaysiaState =
  | 'Kuala Lumpur' | 'Selangor' | 'Penang' | 'Johor' | 'Perak'
  | 'Kedah' | 'Kelantan' | 'Terengganu' | 'Pahang' | 'Negeri Sembilan'
  | 'Melaka' | 'Perlis' | 'Sabah' | 'Sarawak' | 'Putrajaya' | 'Labuan';

export type CountryCode = 'MY' | 'SG' | 'ID' | 'TH' | 'PH' | 'VN' | 'CN' | 'JP' | 'KR' | 'IN' | 'AU' | 'GB' | 'US' | 'OTHER';

export interface UserProfile {
  uid: string;
  username: string;          // e.g. @lokkai
  isDummy?: boolean;         // seed/demo profile
  displayName: string;
  email: string;
  mmr: number;
  tier: Tier;
  placementMatchesPlayed?: number; // undefined or <10 = still in calibration
  globalRank: number;
  state: MalaysiaState;
  area: string;              // e.g. "Petaling Jaya"
  stats: { wins: number; losses: number; totalMatches: number };
  bio?: string;
  available?: string;
  openToPlay?: boolean;
  gender?: 'Male' | 'Female';
  postcode?: string;
  disciplineMMR?: Partial<Record<MatchType, number>>;
  lookingForPartner?: boolean;
  preferredFormats?: MatchType[];
  distKm?: number;
  joinedAt: string;
  birthday?: string;                     // ISO date e.g. "1997-04-15"
  country?: string;                      // e.g. "Malaysia" (default)
  countryCode?: CountryCode;             // e.g. "MY"
  region?: string;                       // state/province for non-MY users
  endorsements?: Record<string, number>; // skill → count
  photoURL?: string | null;
  isPrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  clipCredits?: number;
  clipBadge?: 'Camera' | 'Director' | 'Studio' | 'Broadcaster';
  courtProfile?: CourtProfile;
  privacy?: {
    matchHistory:  'public' | 'friends' | 'private';
    plannedMatches:'public' | 'friends' | 'private';
    friendList:    'public' | 'friends' | 'private';
    clubMembership:'public' | 'friends' | 'private';
    eventHistory:  'public' | 'friends' | 'private';
  };
}

export interface Match {
  id: string;
  type: MatchType;
  // Singles: player1 = me, player2 = opponent
  // Doubles: player1 = me, player1Partner = teammate, player2 = opp1, player2Partner = opp2
  player1Id: string;
  player1Name: string;
  player1Username: string;
  player1PartnerId?: string;
  player1PartnerName?: string;
  player1PartnerUsername?: string;
  player2Id: string;
  player2Name: string;
  player2Username: string;
  player2PartnerId?: string;
  player2PartnerName?: string;
  player2PartnerUsername?: string;
  winnerId?: string;
  games: { p1: number; p2: number }[];
  status: MatchStatus;
  mmrChange?: number;
  playedAt: string;
  location?: string;
  venue?: string;
  pendingConfirmations?: string[]; // opponent uids who still need to confirm this result
  disputedBy?: string;             // uid who last disputed this match, if status is 'Disputed' — only they can propose a corrected score
  plannedMatchId?: string;         // links back to the PlannedMatch this was logged from, if any
  recordedLive?: boolean;          // scored point-by-point in real time via Live Match, not typed in after the fact
  liveStats?: LiveMatchStats;      // only present when recordedLive is true
  pointLog?: ('a' | 'b')[][];      // rally-by-rally winner log, one array per game; only present when recordedLive is true
  clipUrl?: string;                // recorded video, if Live Match was played in video mode and the clip was uploaded
  shuttleHits?: number[];          // detected shuttle-hit timestamps (seconds into clipUrl), if any were found
}

// Point-by-point telemetry captured while a match is scored live. Everything
// here is derived purely from timestamps + the point log — no video/motion
// analysis involved.
export interface LiveMatchStats {
  durationSec: number;          // start to finish, whole match
  gameDurationsSec: number[];   // one entry per completed game
  pointGapsSec: number[];       // time between each point, across the whole match
  avgPointGapSec: number;
  longestGapSec: number;
  shortestGapSec: number;
  maxWinStreak: { side: 'a' | 'b'; count: number };
  biggestComebackPoints: number; // largest point deficit overcome within a single won game
}

export interface Tournament {
  id: string;
  isDummy?: boolean;
  country?: string;
  name: string;
  type: MatchType;
  status: 'Upcoming' | 'Active' | 'Completed';
  prizePool: number;
  entryFee: number;
  minMMR?: number;
  maxMMR?: number;
  maxPlayers: number;
  currentPlayers: number;
  state: MalaysiaState;
  venue: string;
  date: string;
  time?: string;
  isPrivate?: boolean;
  bracket?: BracketMatch[];
  tags: string[];
  description?: string;
  organiser?: string;
  hostUid?: string;         // uid of the user who created this tournament
  participants?: { displayName: string; username: string }[];
}

export interface BracketMatch {
  id: string;
  round: number;
  player1?: string;
  player2?: string;
  winner?: string;
  score?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
}

export interface Challenge {
  id: string;
  fromId: string;
  fromName: string;
  fromUsername: string;
  toId: string;
  toName: string;
  toUsername: string;
  format: MatchType;
  venue: string;
  date: string;       // ISO date string for proposed date/time
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

export type ClubPurpose = 'Competitive' | 'Recreational' | 'Training' | 'Social' | 'Youth';

export interface ClubMessage {
  id: string;
  senderId: string;    // uid ('me' or playerUid)
  senderName: string;
  text: string;
  sentAt: string;
}

export interface Club {
  id: string;
  isDummy?: boolean;
  name: string;
  shortName: string;
  description: string;
  purpose: ClubPurpose;
  state: MalaysiaState;
  area: string;
  logoInitials: string;
  color: string;
  maxMembers: number;
  minMMR?: number;
  isPrivate: boolean;
  adminId: string;          // uid of creator/owner (only one who can disband)
  moderatorIds?: string[];  // member uids assigned moderator rights by owner
  memberIds: string[];      // uids of accepted members
  pendingIds: string[];     // uids of pending join requests
  avgMMR: number;
  topPlayers: string[];
  tags: string[];
  foundedYear: number;
  announcement?: string;
  clubMessages?: ClubMessage[];
}

export interface Notification {
  id: string;
  type: 'challenge_received' | 'challenge_accepted' | 'challenge_declined' | 'partner_request' | 'club_request' | 'club_join_request' | 'club_accepted' | 'club_declined' | 'club_invite' | 'club_message' | 'match_pending' | 'match_invite' | 'match_confirmed' | 'new_message' | 'friend_request' | 'friend_accepted' | 'event_invite' | 'event_registered' | 'badge_earned';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
  meta?: Record<string, string>;
}

export interface CourtPosition {
  x: number; // 0–1, left baseline = 0, right baseline = 1
  y: number; // 0–1, top sideline = 0, bottom sideline = 1
}

export interface CourtProfile {
  positions: CourtPosition[];
  totalMatches: number;
  lastUpdated: string;
}

// Two-device shared tracking session — one phone at each end of the court
// (3/4 angle from the back), both tapping player positions into one combined
// heatmap and recording their own angle. Manual tap-tracking, not automatic
// video/CV tracking.
export interface CourtSession {
  id: string;
  joinCode: string;
  hostUid: string;
  status: 'active' | 'completed';
  positions: CourtPosition[];
  createdAt: string;
  plannedMatchId?: string;
  venue?: string;
}

export interface LiveMatchPlayer {
  uid: string;
  displayName: string;
  username: string;
}

export interface LiveGame {
  a: number;
  b: number;
  done: boolean;
  winningSide?: 'A' | 'B';
}

export interface LiveMatch {
  id: string;
  joinCode: string;           // 6-char uppercase code for others to join
  format: MatchType;
  teamA: LiveMatchPlayer[];
  teamB: LiveMatchPlayer[];
  teamAName: string;          // e.g. "Lok & Ahmad" or just "Lok"
  teamBName: string;
  venue: string;
  hostUid: string;
  bestOf: 1 | 3 | 5;
  status: 'active' | 'paused' | 'completed';
  currentGame: number;        // 0-indexed
  games: LiveGame[];          // scores per game
  gameWins: { a: number; b: number };
  winningSide?: 'A' | 'B';
  createdAt: string;
  completedAt?: string;
  clipUrl?: string;
  shuttleHits?: number[];      // detected shuttle-hit timestamps (seconds into clipUrl), set once audio analysis finishes
  recordMode?: 'manual' | 'video'; // how the host chose to record — camera session itself can't survive a pause
  liveStats?: LiveMatchStats;
  pointLog?: ('a' | 'b')[][];        // rally-by-rally winner log, one array per game — populated on completion
  activeSecondsAccumulated?: number; // running elapsed time banked so far, carried across a pause/resume
}

export interface Conversation {
  id: string;
  participant: UserProfile;
  lastMessage: string;
  lastAt: string;
  unread: number;
  messages: Message[];
}
