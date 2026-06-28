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
  globalRank: number;
  state: MalaysiaState;
  area: string;              // e.g. "Petaling Jaya"
  stats: { wins: number; losses: number; totalMatches: number };
  bio?: string;
  available?: string;
  distKm?: number;
  joinedAt: string;
}

export interface Match {
  id: string;
  type: MatchType;
  player1Id: string;
  player1Name: string;
  player1Username: string;
  player2Id: string;
  player2Name: string;
  player2Username: string;
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
  maxPlayers: number;
  currentPlayers: number;
  state: MalaysiaState;
  venue: string;
  date: string;
  bracket?: BracketMatch[];
  tags: string[];
  description?: string;
  organiser?: string;
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

export interface Conversation {
  id: string;
  participant: UserProfile;
  lastMessage: string;
  lastAt: string;
  unread: number;
  messages: Message[];
}
