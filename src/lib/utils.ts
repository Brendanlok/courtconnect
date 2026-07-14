import type { Tier, MalaysiaState, CountryCode } from '@/types';

// Matches next.config.ts's basePath — needed when building absolute links
// (QR codes, share links, email redirect URLs) since window.location.origin
// alone doesn't include a subpath like /courtconnect on GitHub Pages.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// /players/[username]/ only pre-renders the demo roster (static export) — a
// real account's username 404s there, so real players route through
// /profile/?uid=X instead (works for any signed-in account).
export function profileHref(p: { uid: string; username: string; isDummy?: boolean }): string {
  return p.isDummy || p.uid === 'me' ? `/players/${p.username}/` : `/profile/?uid=${p.uid}`;
}

// Same static-export limitation as profileHref, for clubs: /clubs/[id]/ only
// pre-renders the demo roster's club ids, so a real (user-created) club 404s
// there — route it through /clubs/view/?id=X instead.
export function clubHref(c: { id: string; isDummy?: boolean }): string {
  return c.isDummy ? `/clubs/${c.id}/` : `/clubs/view/?id=${c.id}`;
}

export function getTier(mmr: number): Tier {
  if (mmr < 800)  return 'Beginner';
  if (mmr < 1000) return 'Bronze';
  if (mmr < 1300) return 'Silver';
  if (mmr < 1600) return 'Gold';
  if (mmr < 2000) return 'Platinum';
  if (mmr < 2400) return 'Diamond';
  return 'Elite';
}

const TIER_THRESHOLDS: Record<Tier, [number, number]> = {
  Beginner: [0,    800],
  Bronze:   [800,  1000],
  Silver:   [1000, 1300],
  Gold:     [1300, 1600],
  Platinum: [1600, 2000],
  Diamond:  [2000, 2400],
  Elite:    [2400, 3000],
};

export function tierProgress(mmr: number, tier: Tier): number {
  const [lo, hi] = TIER_THRESHOLDS[tier];
  return Math.min(100, Math.round(((mmr - lo) / (hi - lo)) * 100));
}

export function nextTier(tier: Tier): { name: Tier | null; threshold: number } {
  const order: Tier[] = ['Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
  const idx = order.indexOf(tier);
  const next = order[idx + 1] ?? null;
  return { name: next, threshold: next ? TIER_THRESHOLDS[next][0] : TIER_THRESHOLDS['Elite'][1] };
}

export const TIER_STYLE: Record<Tier, { bg: string; text: string; border: string; icon: string }> = {
  Beginner: { bg:'bg-slate-500/20',   text:'text-slate-400',   border:'border-slate-500/40',   icon:'○' },
  Bronze:   { bg:'bg-amber-900/20',   text:'text-amber-500',   border:'border-amber-700/40',   icon:'◉' },
  Silver:   { bg:'bg-slate-400/20',   text:'text-slate-300',   border:'border-slate-400/40',   icon:'◈' },
  Gold:     { bg:'bg-yellow-500/20',  text:'text-yellow-400',  border:'border-yellow-500/40',  icon:'◆' },
  Platinum: { bg:'bg-cyan-600/20',    text:'text-cyan-400',    border:'border-cyan-600/40',    icon:'◆' },
  Diamond:  { bg:'bg-violet-600/20',  text:'text-violet-400',  border:'border-violet-600/40',  icon:'◈' },
  Elite:    { bg:'bg-red-600/20',     text:'text-red-400',     border:'border-red-600/40',     icon:'★' },
};

// Higher-tier players can belong to more clubs at once — same thresholds as the tier system.
const CLUB_LIMIT_BY_TIER: Record<Tier, number> = {
  Beginner: 1, Bronze: 1, Silver: 2, Gold: 2, Platinum: 3, Diamond: 4, Elite: 5,
};

export function maxClubsForTier(tier: Tier): number {
  return CLUB_LIMIT_BY_TIER[tier] ?? 1;
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const f = -diff;
    if (f < 3600000)  return `in ${Math.floor(f/60000)}m`;
    if (f < 86400000) return `in ${Math.floor(f/3600000)}h`;
    return `in ${Math.floor(f/86400000)}d`;
  }
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' });
}

export function calcMMRChange(winnerMMR: number, loserMMR: number, k = 32) {
  const exp = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
  const delta = Math.round(k * (1 - exp));
  return { gain: delta, loss: -delta };
}

// The app doesn't collect precise GPS location, so real distance between two
// real accounts can't be computed exactly — this uses each player's named
// area/state as a rough proxy: same area ≈ across town, same state ≈ still a
// fair drive, different state ≈ not nearby. Demo players keep their seeded
// exact distKm; this is only ever consulted when that's absent.
export function approxDistanceKm(a: { area: string; state: MalaysiaState }, b: { area: string; state: MalaysiaState }): number {
  if (a.area.trim() && a.area.trim().toLowerCase() === b.area.trim().toLowerCase()) return 3;
  if (a.state === b.state) return 40;
  return 999;
}

export function skillMatch(a: number, b: number) {
  return Math.max(0, Math.round(100 - (Math.abs(a - b) / 600) * 100));
}

export const MATCH_TYPE_LABEL: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles",
  MD: "Men's Doubles", WD: "Women's Doubles", MX: "Mixed Doubles",
};

// ─── Availability grid ────────────────────────────────────────────────────────

export const DAY_IDS    = ['mon','tue','wed','thu','fri','sat','sun'] as const;
export const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
export const SLOT_IDS   = ['6_9am','9am_12pm','12_3pm','3_6pm','6_9pm','9pm_12am'] as const;
export const SLOT_LABELS = ['6–9am','9–12pm','12–3pm','3–6pm','6–9pm','9–12am'] as const;

export function formatAvailability(available: string): string {
  if (!available) return '';
  const ids = available.split(',').map(s => s.trim()).filter(Boolean);
  const byDay: Record<string, string[]> = {};
  for (const id of ids) {
    const day = id.split('_')[0];
    const dayIdx = (DAY_IDS as readonly string[]).indexOf(day);
    if (dayIdx >= 0) {
      const slotKey = id.slice(day.length + 1);
      const slotIdx = (SLOT_IDS as readonly string[]).indexOf(slotKey);
      const slotLabel = slotIdx >= 0 ? SLOT_LABELS[slotIdx] : slotKey;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(slotLabel);
    }
  }
  if (Object.keys(byDay).length === 0) return ids.join(', ');
  return Object.entries(byDay)
    .map(([day, slots]) => `${DAY_LABELS[(DAY_IDS as readonly string[]).indexOf(day)]}: ${slots.join(', ')}`)
    .join(' · ');
}

// ─── Postcode lookup ──────────────────────────────────────────────────────────

const PC_LOC: Record<string, { city: string; state: MalaysiaState }> = {
  '01':{ city:'Kangar',           state:'Perlis'          },
  '02':{ city:'Arau',             state:'Perlis'          },
  '05':{ city:'Alor Setar',       state:'Kedah'           },
  '06':{ city:'Pendang',          state:'Kedah'           },
  '07':{ city:'Langkawi',         state:'Kedah'           },
  '08':{ city:'Sungai Petani',    state:'Kedah'           },
  '09':{ city:'Kulim',            state:'Kedah'           },
  '10':{ city:'Georgetown',       state:'Penang'          },
  '11':{ city:'Penang Island',    state:'Penang'          },
  '12':{ city:'Kepala Batas',     state:'Penang'          },
  '13':{ city:'Penang',           state:'Penang'          },
  '14':{ city:'Bukit Mertajam',   state:'Penang'          },
  '15':{ city:'Kota Bharu',       state:'Kelantan'        },
  '16':{ city:'Pasir Mas',        state:'Kelantan'        },
  '17':{ city:'Tanah Merah',      state:'Kelantan'        },
  '18':{ city:'Gua Musang',       state:'Kelantan'        },
  '20':{ city:'Kuala Terengganu', state:'Terengganu'      },
  '21':{ city:'Kuala Terengganu', state:'Terengganu'      },
  '22':{ city:'Besut',            state:'Terengganu'      },
  '23':{ city:'Dungun',           state:'Terengganu'      },
  '24':{ city:'Kemaman',          state:'Terengganu'      },
  '25':{ city:'Kuantan',          state:'Pahang'          },
  '26':{ city:'Temerloh',         state:'Pahang'          },
  '27':{ city:'Jerantut',         state:'Pahang'          },
  '28':{ city:'Mentakab',         state:'Pahang'          },
  '30':{ city:'Ipoh',             state:'Perak'           },
  '31':{ city:'Ipoh',             state:'Perak'           },
  '32':{ city:'Teluk Intan',      state:'Perak'           },
  '33':{ city:'Batu Gajah',       state:'Perak'           },
  '34':{ city:'Taiping',          state:'Perak'           },
  '35':{ city:'Slim River',       state:'Perak'           },
  '36':{ city:'Teluk Intan',      state:'Perak'           },
  '40':{ city:'Shah Alam',        state:'Selangor'        },
  '41':{ city:'Klang',            state:'Selangor'        },
  '42':{ city:'Port Klang',       state:'Selangor'        },
  '43':{ city:'Kajang',           state:'Selangor'        },
  '44':{ city:'Rawang',           state:'Selangor'        },
  '45':{ city:'Tanjung Karang',   state:'Selangor'        },
  '46':{ city:'Petaling Jaya',    state:'Selangor'        },
  '47':{ city:'Subang Jaya',      state:'Selangor'        },
  '48':{ city:'Kuala Selangor',   state:'Selangor'        },
  '50':{ city:'City Centre',      state:'Kuala Lumpur'    },
  '51':{ city:'Kuala Lumpur',     state:'Kuala Lumpur'    },
  '52':{ city:'Kepong',           state:'Kuala Lumpur'    },
  '53':{ city:'Setapak',          state:'Kuala Lumpur'    },
  '54':{ city:'Titiwangsa',       state:'Kuala Lumpur'    },
  '55':{ city:'Chow Kit',         state:'Kuala Lumpur'    },
  '56':{ city:'Cheras',           state:'Kuala Lumpur'    },
  '57':{ city:'Cheras',           state:'Kuala Lumpur'    },
  '58':{ city:'Bangsar',          state:'Kuala Lumpur'    },
  '59':{ city:'Bangsar South',    state:'Kuala Lumpur'    },
  '60':{ city:'Sentul',           state:'Kuala Lumpur'    },
  '62':{ city:'Putrajaya',        state:'Putrajaya'       },
  '63':{ city:'Ampang',           state:'Selangor'        },
  '68':{ city:'Ampang',           state:'Selangor'        },
  '69':{ city:'Semenyih',         state:'Selangor'        },
  '70':{ city:'Seremban',         state:'Negeri Sembilan' },
  '71':{ city:'Port Dickson',     state:'Negeri Sembilan' },
  '72':{ city:'Kuala Pilah',      state:'Negeri Sembilan' },
  '73':{ city:'Tampin',           state:'Negeri Sembilan' },
  '75':{ city:'Melaka City',      state:'Melaka'          },
  '76':{ city:'Alor Gajah',       state:'Melaka'          },
  '77':{ city:'Jasin',            state:'Melaka'          },
  '79':{ city:'Pontian',          state:'Johor'           },
  '80':{ city:'Johor Bahru',      state:'Johor'           },
  '81':{ city:'Pasir Gudang',     state:'Johor'           },
  '82':{ city:'Kota Tinggi',      state:'Johor'           },
  '83':{ city:'Segamat',          state:'Johor'           },
  '84':{ city:'Muar',             state:'Johor'           },
  '85':{ city:'Batu Pahat',       state:'Johor'           },
  '86':{ city:'Kluang',           state:'Johor'           },
  '87':{ city:'Labuan',           state:'Labuan'          },
  '88':{ city:'Kota Kinabalu',    state:'Sabah'           },
  '89':{ city:'Keningau',         state:'Sabah'           },
  '90':{ city:'Sandakan',         state:'Sabah'           },
  '91':{ city:'Tawau',            state:'Sabah'           },
  '93':{ city:'Kuching',          state:'Sarawak'         },
  '94':{ city:'Sri Aman',         state:'Sarawak'         },
  '95':{ city:'Sibu',             state:'Sarawak'         },
  '96':{ city:'Miri',             state:'Sarawak'         },
  '97':{ city:'Bintulu',          state:'Sarawak'         },
  '98':{ city:'Limbang',          state:'Sarawak'         },
};

export function postcodeToLocation(postcode: string): { city: string; state: MalaysiaState } | null {
  if (!/^\d{5}$/.test(postcode.trim())) return null;
  return PC_LOC[postcode.slice(0, 2)] ?? null;
}

export function postcodeToCity(postcode: string): string | null {
  return postcodeToLocation(postcode)?.city ?? null;
}

export const MY_STATES = [
  'Kuala Lumpur','Selangor','Penang','Johor','Perak',
  'Kedah','Kelantan','Terengganu','Pahang','Negeri Sembilan',
  'Melaka','Perlis','Sabah','Sarawak','Putrajaya','Labuan',
];

// ─── Country data ─────────────────────────────────────────────────────────────

export interface CountryData {
  code: CountryCode;
  name: string;
  flag: string;
  regionLabel: string;    // "State", "Province", "Region"
  regions: string[];      // list of states/provinces, empty = free text
  hasPostcode: boolean;
  postcodeLen?: number;
  postcodePattern?: RegExp;
}

export const COUNTRIES: CountryData[] = [
  {
    code: 'MY', name: 'Malaysia', flag: '🇲🇾', regionLabel: 'State',
    regions: MY_STATES, hasPostcode: true, postcodeLen: 5, postcodePattern: /^\d{5}$/,
  },
  {
    code: 'SG', name: 'Singapore', flag: '🇸🇬', regionLabel: 'Region',
    regions: ['Central','East','North','North-East','West'],
    hasPostcode: true, postcodeLen: 6, postcodePattern: /^\d{6}$/,
  },
  {
    code: 'ID', name: 'Indonesia', flag: '🇮🇩', regionLabel: 'Province',
    regions: ['Bali','Banten','DKI Jakarta','East Java','East Kalimantan','East Nusa Tenggara',
              'Gorontalo','Jambi','Lampung','Maluku','North Kalimantan','North Maluku',
              'North Sulawesi','North Sumatra','Papua','Riau','Riau Islands','South Kalimantan',
              'South Sulawesi','South Sumatra','Southeast Sulawesi','West Java','West Kalimantan',
              'West Nusa Tenggara','West Papua','West Sulawesi','West Sumatra','Yogyakarta'],
    hasPostcode: true, postcodeLen: 5, postcodePattern: /^\d{5}$/,
  },
  {
    code: 'TH', name: 'Thailand', flag: '🇹🇭', regionLabel: 'Province',
    regions: ['Bangkok','Chiang Mai','Chiang Rai','Chonburi','Khon Kaen','Nakhon Ratchasima',
              'Nonthaburi','Pathum Thani','Phuket','Songkhla','Surat Thani','Udon Thani'],
    hasPostcode: true, postcodeLen: 5, postcodePattern: /^\d{5}$/,
  },
  {
    code: 'PH', name: 'Philippines', flag: '🇵🇭', regionLabel: 'Region',
    regions: ['NCR','CAR','Region I','Region II','Region III','Region IV-A','Region IV-B',
              'Region V','Region VI','Region VII','Region VIII','Region IX','Region X',
              'Region XI','Region XII','BARMM','Caraga'],
    hasPostcode: true, postcodeLen: 4, postcodePattern: /^\d{4}$/,
  },
  {
    code: 'VN', name: 'Vietnam', flag: '🇻🇳', regionLabel: 'Province',
    regions: ['Hanoi','Ho Chi Minh City','Da Nang','Hai Phong','Can Tho','Bien Hoa','Hue'],
    hasPostcode: true, postcodeLen: 6, postcodePattern: /^\d{6}$/,
  },
  {
    code: 'CN', name: 'China', flag: '🇨🇳', regionLabel: 'Province',
    regions: ['Beijing','Shanghai','Guangzhou','Shenzhen','Chengdu','Hangzhou','Wuhan',
              'Chongqing','Nanjing','Xi\'an','Tianjin','Suzhou'],
    hasPostcode: true, postcodeLen: 6, postcodePattern: /^\d{6}$/,
  },
  {
    code: 'JP', name: 'Japan', flag: '🇯🇵', regionLabel: 'Prefecture',
    regions: ['Tokyo','Osaka','Kyoto','Kanagawa','Aichi','Hokkaido','Fukuoka','Hyogo',
              'Saitama','Chiba','Hiroshima','Miyagi'],
    hasPostcode: true, postcodeLen: 7, postcodePattern: /^\d{7}$/,
  },
  {
    code: 'KR', name: 'South Korea', flag: '🇰🇷', regionLabel: 'Province',
    regions: ['Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Suwon','Ulsan',
              'Gyeonggi','Gyeongnam','Gyeongbuk','Jeonnam','Jeonbuk','Chungnam','Chungbuk','Gangwon','Jeju'],
    hasPostcode: true, postcodeLen: 5, postcodePattern: /^\d{5}$/,
  },
  {
    code: 'IN', name: 'India', flag: '🇮🇳', regionLabel: 'State',
    regions: ['Andhra Pradesh','Delhi','Gujarat','Karnataka','Kerala','Maharashtra',
              'Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal'],
    hasPostcode: true, postcodeLen: 6, postcodePattern: /^\d{6}$/,
  },
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', regionLabel: 'State',
    regions: ['ACT','New South Wales','Northern Territory','Queensland',
              'South Australia','Tasmania','Victoria','Western Australia'],
    hasPostcode: true, postcodeLen: 4, postcodePattern: /^\d{4}$/,
  },
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', regionLabel: 'Region',
    regions: ['England','Scotland','Wales','Northern Ireland'],
    hasPostcode: true, postcodeLen: 0, postcodePattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', regionLabel: 'State',
    regions: ['Alabama','Alaska','Arizona','California','Colorado','Florida','Georgia',
              'Hawaii','Illinois','New York','Ohio','Pennsylvania','Texas','Virginia','Washington'],
    hasPostcode: true, postcodeLen: 5, postcodePattern: /^\d{5}(-\d{4})?$/,
  },
  {
    code: 'OTHER', name: 'Other', flag: '🌐', regionLabel: 'Region',
    regions: [], hasPostcode: false,
  },
];

export function getCountryByCode(code: CountryCode): CountryData {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}
export function getCountryByName(name: string): CountryData {
  return COUNTRIES.find(c => c.name === name) ?? COUNTRIES[0];
}
