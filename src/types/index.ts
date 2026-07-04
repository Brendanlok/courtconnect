export type Tier = 'Beginner' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Elite';
export type MatchType = 'MS' | 'WS' | 'MD' | 'WD' | 'MX';
export type MatchStatus = 'Pending' | 'Confirmed' | 'Disputed';

export type MalaysiaState =
  | 'Kuala Lumpur' | 'Selangor' | 'Penang' | 'Johor' | 'Perak'
  | 'Kedah' | 'Kelantan' | 'Terengganu' | 'Pahang' | 'Negeri Sembilan'
  | 'Melaka' | 'Perlis' | 'Sabah' | 'Sarawak' | 'Putrajaya' | 'Labuan';

export interface UserProfile {
  uid: string;
  username: string;          // e.g. @lokkai
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
  endorsements?: Record<string, number>; // skill → count
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
}

export interface Tournament {
  id: string;
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
  participants?: string[];  // display names of registered players
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
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type ClubPurpose = 'Competitive' | 'Recreational' | 'Training' | 'Social' | 'Youth';

export interface Club {
  id: string;
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
  adminId: string;          // uid of creator/admin
  memberIds: string[];      // uids of accepted members
  pendingIds: string[];     // uids of pending join requests
  avgMMR: number;
  topPlayers: string[];
  tags: string[];
  foundedYear: number;
  announcement?: string;
}

export interface Notification {
  id: string;
  type: 'challenge_received' | 'challenge_accepted' | 'challenge_declined' | 'partner_request' | 'club_request' | 'club_accepted' | 'club_declined' | 'match_pending';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

export interface AuthUser {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  provider: 'email' | 'google';
  passwordHash?: string; // stored as-is for demo (not real hashing)
}

export interface Conversation {
  id: string;
  participant: UserProfile;
  lastMessage: string;
  lastAt: string;
  unread: number;
  messages: Message[];
}
