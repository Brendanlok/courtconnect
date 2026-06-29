import type { UserProfile, Match, Tournament, Conversation } from '@/types';

export const ME: UserProfile = {
  uid: 'me', username: 'lokkai', displayName: 'Lok Kai', email: 'lok@example.com',
  mmr: 1847, tier: 'Platinum', globalRank: 128,
  state: 'Selangor', area: 'Petaling Jaya',
  stats: { wins: 47, losses: 22, totalMatches: 69 },
  bio: 'Competitive singles player. Always looking for a good match 🏸',
  available: 'Weekday evenings',
  openToPlay: false,
  joinedAt: '2025-01-10',
};

export const PLAYERS: UserProfile[] = [];

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
    state:'Selangor', venue:'Sport Planet PJ', date:'2025-06-05',
    organiser:'PJ Badminton Club',
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
  { id:'t2', name:'Weekend Warriors Cup', type:'MX', status:'Upcoming', prizePool:0, entryFee:0, maxPlayers:16, currentPlayers:8, state:'Kuala Lumpur', venue:'Bukit Jalil Sports Complex', date:'2025-06-21', time:'09:00', organiser:'KL Smashers', isPrivate:true, description:'Casual mixed doubles fun tournament. Open to all skill levels. Free entry, bring your own partner!', tags:['Mixed','Free','Casual'] },
  { id:'t3', name:'Diamond League Round 3', type:'MS', status:'Upcoming', prizePool:1200, entryFee:50, minMMR:2000, maxPlayers:32, currentPlayers:20, state:'Selangor', venue:'Stadium Shah Alam', date:'2025-07-05', organiser:'Malaysia Badminton Federation', description:'Premier elite singles league. Top ranked players only. Prize money auto-distributed after final.', tags:['Singles','Elite','Prize'] },
  { id:'t4', name:'Penang Open Championship', type:'MD', status:'Upcoming', prizePool:800, entryFee:30, maxPlayers:8, currentPlayers:4, state:'Penang', venue:'Penang Sports Arena', date:'2025-07-12', organiser:'Penang BA', description:'Annual doubles championship for northern Malaysia. Register as a pair.', tags:['Doubles','Prize'] },
  { id:'t5', name:'KL Club Championship', type:'MD', status:'Completed', prizePool:300, entryFee:15, maxPlayers:8, currentPlayers:8, state:'Kuala Lumpur', venue:'Stadium Putra', date:'2025-05-15', organiser:'KL Smashers', description:'Monthly club doubles tournament. Results finalised.', tags:['Doubles','Completed'] },
];

export const CONVERSATIONS: Conversation[] = [];
