import type { UserProfile, Match, Tournament, Conversation } from '@/types';

export const ME: UserProfile = {
  uid: 'me', username: 'lokkai', displayName: 'Lok Kai', email: 'lok@example.com',
  gender: 'Male',
  mmr: 1847, tier: 'Platinum', globalRank: 128,
  state: 'Selangor', area: 'Petaling Jaya', postcode: '47810',
  disciplineMMR: { MS: 1847, MD: 1823, MX: 1871 },
  stats: { wins: 47, losses: 22, totalMatches: 69 },
  bio: 'Competitive singles player. Always looking for a good match 🏸',
  available: 'mon_fri_evening,sat_morning,sat_evening',
  openToPlay: false,
  lookingForPartner: false,
  preferredFormats: ['MS', 'MD', 'MX'],
  joinedAt: '2025-01-10',
};

export const PLAYERS: UserProfile[] = [
  {
    uid: 'p1', username: 'zackaz', displayName: 'Zack Azhar', email: 'zack@example.com',
    gender: 'Male', mmr: 2156, tier: 'Diamond', globalRank: 42,
    state: 'Selangor', area: 'Subang Jaya', postcode: '47500',
    disciplineMMR: { MS: 2156, MD: 2089, MX: 2201 },
    stats: { wins: 89, losses: 31, totalMatches: 120 },
    bio: 'Former state-level player. Looking for a strong MD partner.',
    available: 'sat_morning,sat_afternoon,sun_morning',
    openToPlay: true, lookingForPartner: true, preferredFormats: ['MD', 'MX'],
    distKm: 3.2, joinedAt: '2024-06-12',
  },
  {
    uid: 'p2', username: 'faizhamdan', displayName: 'Faiz Hamdan', email: 'faiz@example.com',
    gender: 'Male', mmr: 1923, tier: 'Platinum', globalRank: 89,
    state: 'Selangor', area: 'Shah Alam', postcode: '40450',
    disciplineMMR: { MS: 1923, MD: 1891, MX: 1867 },
    stats: { wins: 61, losses: 28, totalMatches: 89 },
    bio: 'Casual doubles fan. Weekday evenings free.',
    available: 'mon_fri_evening,sat_evening',
    openToPlay: false, lookingForPartner: true, preferredFormats: ['MD', 'MX'],
    joinedAt: '2024-09-03',
  },
  {
    uid: 'p3', username: 'leeming', displayName: 'Lee Ming Xuan', email: 'lmx@example.com',
    gender: 'Male', mmr: 1654, tier: 'Platinum', globalRank: 156,
    state: 'Kuala Lumpur', area: 'Cheras', postcode: '56000',
    disciplineMMR: { MS: 1654, MD: 1712, MX: 1633 },
    stats: { wins: 44, losses: 19, totalMatches: 63 },
    available: 'sat_morning,sat_afternoon,sat_evening,sun_morning',
    openToPlay: false, lookingForPartner: false, preferredFormats: ['MD'],
    joinedAt: '2025-01-22',
  },
  {
    uid: 'p4', username: 'sarinaazmi', displayName: 'Sarina Azmi', email: 'sarina@example.com',
    gender: 'Female', mmr: 1789, tier: 'Platinum', globalRank: 112,
    state: 'Selangor', area: 'Petaling Jaya', postcode: '46100',
    disciplineMMR: { WS: 1789, WD: 1742, MX: 1801 },
    stats: { wins: 52, losses: 18, totalMatches: 70 },
    bio: 'WD specialist, also enjoy MX. Looking for a dedicated partner.',
    available: 'mon_fri_evening,sat_morning,sun_morning',
    openToPlay: true, lookingForPartner: true, preferredFormats: ['WD', 'MX'],
    distKm: 1.8, joinedAt: '2024-11-05',
  },
  {
    uid: 'p5', username: 'nurhanim', displayName: 'Nur Hanim Rashid', email: 'nurhanim@example.com',
    gender: 'Female', mmr: 1512, tier: 'Gold', globalRank: 234,
    state: 'Kuala Lumpur', area: 'Bangsar', postcode: '59000',
    disciplineMMR: { WS: 1512, WD: 1489, MX: 1553 },
    stats: { wins: 33, losses: 22, totalMatches: 55 },
    available: 'sat_afternoon,sat_evening,sun_afternoon',
    openToPlay: false, lookingForPartner: true, preferredFormats: ['WD', 'MX'],
    joinedAt: '2025-02-18',
  },
  {
    uid: 'p6', username: 'khoohuijin', displayName: 'Khoo Hui Jin', email: 'khoo@example.com',
    gender: 'Male', mmr: 2312, tier: 'Diamond', globalRank: 19,
    state: 'Selangor', area: 'Puchong', postcode: '47100',
    disciplineMMR: { MS: 2312, MD: 2287, MX: 2341 },
    stats: { wins: 118, losses: 22, totalMatches: 140 },
    bio: 'National circuit doubles specialist.',
    available: 'mon_fri_morning,sat_morning,sat_afternoon',
    openToPlay: false, lookingForPartner: false, preferredFormats: ['MD'],
    distKm: 9.1, joinedAt: '2024-03-01',
  },
];

export const MATCHES: Match[] = [];

export const MMR_HISTORY = [
  {date:'May 7', mmr:1680},{date:'May 10',mmr:1698},{date:'May 13',mmr:1683},
  {date:'May 16',mmr:1710},{date:'May 20',mmr:1728},{date:'May 23',mmr:1745},
  {date:'May 26',mmr:1740},{date:'May 29',mmr:1762},{date:'Jun 1', mmr:1780},
  {date:'Jun 2', mmr:1765},{date:'Jun 4', mmr:1825},{date:'Jun 5', mmr:1847},
];

export const TOURNAMENTS: Tournament[] = [
  {
    id:'t1', name:'PJ Badminton Open 2025', type:'MS', status:'Active',
    prizePool:500, entryFee:20, minMMR:1500, maxPlayers:16, currentPlayers:16,
    state:'Selangor', venue:'Sport Planet PJ, No. 5 Jalan SS 7/19, 47301 Petaling Jaya',
    date:'2025-06-05', time:'09:00', organiser:'PJ Badminton Club',
    description:'Annual open singles tournament for Selangor players. Double elimination format. All games best of 3.',
    tags:['Singles','Open','Prize'],
    bracket:[
      {id:'b1',round:1,player1:'Zack Azhar',  player2:'Wei Liang',   winner:'Zack Azhar',  score:'21-14, 21-18'},
      {id:'b2',round:1,player1:'Faiz Hamdan', player2:'Reza Malik',  winner:'Faiz Hamdan', score:'21-18, 21-19'},
      {id:'b3',round:1,player1:'Khoo Hui',    player2:'Lee Ming',    winner:'Khoo Hui',    score:'21-11, 21-14'},
      {id:'b4',round:1,player1:'Lok Kai',     player2:'Ahmad Rizal', winner:undefined,     score:undefined},
      {id:'b5',round:2,player1:'Zack Azhar',  player2:'Faiz Hamdan', winner:'Zack Azhar',  score:'21-19, 21-17'},
      {id:'b6',round:2,player1:'Khoo Hui',    player2:'TBD',         winner:undefined,     score:undefined},
      {id:'b7',round:3,player1:'Zack Azhar',  player2:'TBD',         winner:undefined,     score:undefined},
    ],
  },
  { id:'t2', name:'Weekend Warriors Cup', type:'MX', status:'Upcoming', prizePool:0, entryFee:0, maxPlayers:16, currentPlayers:8, state:'Kuala Lumpur', venue:'Bukit Jalil Sports Complex, Jalan Lembah Pantai, 57000 Kuala Lumpur', date:'2025-06-21', time:'09:00', organiser:'KL Smashers', isPrivate:true, description:'Casual mixed doubles fun tournament. Open to all skill levels. Free entry, bring your own partner!', tags:['Mixed','Free','Casual'] },
  { id:'t3', name:'Diamond League Round 3', type:'MS', status:'Upcoming', prizePool:1200, entryFee:50, minMMR:2000, maxPlayers:32, currentPlayers:20, state:'Selangor', venue:'Stadium Shah Alam, Persiaran Majlis, 40150 Shah Alam', date:'2025-07-05', time:'08:00', organiser:'Malaysia Badminton Federation', description:'Premier elite singles league. Top ranked players only. Prize money auto-distributed after final.', tags:['Singles','Elite','Prize'] },
  { id:'t4', name:'Penang Open Championship', type:'MD', status:'Upcoming', prizePool:800, entryFee:30, maxPlayers:8, currentPlayers:4, state:'Penang', venue:'Penang Sports Arena, Jalan Batu Uban, 11700 Penang', date:'2025-07-12', time:'10:00', organiser:'Penang BA', description:'Annual doubles championship for northern Malaysia. Register as a pair.', tags:['Doubles','Prize'] },
  { id:'t5', name:'KL Club Championship', type:'MD', status:'Completed', prizePool:300, entryFee:15, maxPlayers:8, currentPlayers:8, state:'Kuala Lumpur', venue:'Stadium Putra, Jalan Stadium, 57000 Kuala Lumpur', date:'2025-05-15', organiser:'KL Smashers', description:'Monthly club doubles tournament. Results finalised.', tags:['Doubles','Completed'] },
];

export const CONVERSATIONS: Conversation[] = [];
