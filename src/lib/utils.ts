import type { Tier, MalaysiaState, CountryCode, Match } from '@/types';

// Matches next.config.ts's basePath — needed when building absolute links
// (QR codes, share links, email redirect URLs) since window.location.origin
// alone doesn't include a subpath like /courtconnect on GitHub Pages.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Referral capture: an invite link opens the app at `/?ref=<username>`. The
// referrer's username has to survive the entire unauthenticated flow (signup
// form -> email verification -> return visit -> username picker) before
// AuthContext can resolve and attach it, so it's parked in localStorage
// rather than passed through component state. Captured once on app boot
// (AuthGate), consumed once at signup completion (AuthContext.completeProfile).
const REFERRAL_KEY = 'cc_referral';
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) try { localStorage.setItem(REFERRAL_KEY, ref.toLowerCase()); } catch { /* ignore */ }
}
// Read-only — use this to resolve who referred someone. Consume (below) only
// once signup has actually succeeded, so a failed attempt that gets retried
// doesn't lose the code first (was previously removed up front regardless of
// whether the signup it was meant for ever completed).
export function peekReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(REFERRAL_KEY); } catch { return null; }
}
export function consumeReferral(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const ref = localStorage.getItem(REFERRAL_KEY);
    localStorage.removeItem(REFERRAL_KEY);
    return ref;
  } catch { return null; }
}

// /players/[username]/ only pre-renders the demo roster (static export) — a
// real account's username 404s there, so real players route through
// /profile/?uid=X instead (works for any signed-in account). The current
// user's own entries carry the local 'me' sentinel uid rather than their
// real one (e.g. the leaderboard row for "you"), so uid==='me' needs its own
// branch too — routing it through /players/${username}/ 404s the same way,
// since your real username isn't in the pre-rendered demo roster either.
// /profile/ with no uid already means "whoever is signed in", which is
// exactly this case.
export function profileHref(p: { uid: string; username: string; isDummy?: boolean }): string {
  if (p.uid === 'me') return '/profile/';
  return p.isDummy ? `/players/${p.username}/` : `/profile/?uid=${p.uid}`;
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

// A player is "calibrating" — a brand-new account still on its first 10
// ranked matches, or a returning account re-placed after 90+ days inactive
// (see AppContext's inactivity effect) — whenever placementMatchesPlayed
// hasn't reached 10. Their MMR keeps updating normally behind the scenes;
// this just gates whether it's *shown* (own profile, others' profiles,
// leaderboard rank). Seed/demo players never carry this field and must
// never be treated as calibrating just because it's unset.
export const CALIBRATION_GAMES = 10;
export function isCalibrating(p: { isDummy?: boolean; placementMatchesPlayed?: number | null }): boolean {
  return !p.isDummy && (p.placementMatchesPlayed ?? 0) < CALIBRATION_GAMES;
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

// Local calendar date as YYYY-MM-DD, offset by whole days. NOT
// `new Date().toISOString().slice(0,10)` — that converts to UTC first, which
// silently shows/files "today" as the wrong calendar day for roughly 8 hours
// a day in Malaysia (UTC+8), right around when someone posts availability
// for tonight. Bug found + fixed 2026-08-05, see DEVLOG.
export function localDateISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// Builds a minimal .ics file for a tournament and triggers a browser download —
// so a registered player can drop the event straight into their phone calendar.
// Floating local time (no Z/TZID): correct for the device that downloads it,
// which is what matters for a same-country in-person event.
export function downloadTournamentIcs(t: { id: string; name: string; date: string; time?: string; venue: string; state: string }): void {
  const [y, m, d] = t.date.split('-').map(Number);
  const [hh, mm] = (t.time || '09:00').split(':').map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // assume 2hr block
  // Local (not UTC) clock digits — toISOString() would shift the displayed
  // time by the browser's UTC offset, which is wrong for a floating-time event.
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (dt: Date) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  const escape = (s: string) => s.replace(/([,;])/g, '\\$1');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CourtConnect//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@courtconnect`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(t.name)}`,
    `LOCATION:${escape(`${t.venue}, ${t.state}`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${t.name.replace(/[^a-z0-9]+/gi, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// winnerMMR/loserMMR must be the ACTUAL match outcome's sides — gain is the
// winner's delta, loss is the loser's delta, both correctly asymmetric based
// on how big an upset it was. Do not call this with "my side" always first;
// see previewMMRChange below for computing both hypothetical outcomes before
// the result is known.
// Standard badminton rules: win by 2, first to 21, hard cap at 30 (30-29 ends
// the game regardless of margin). No draws. Shared by every place a game
// score can be entered or corrected (LogMatchModal, MatchDetailModal's
// dispute-resubmit flow) — validate here once instead of per-caller.
export function isValidGameScore(p1: number, p2: number): boolean {
  if (p1 === p2) return false;
  const hi = Math.max(p1, p2), lo = Math.min(p1, p2);
  if (hi > 30) return false;
  if (hi === 30) return true;
  return hi >= 21 && hi - lo >= 2;
}

export function calcMMRChange(winnerMMR: number, loserMMR: number, k = 32, marginMult = 1) {
  const exp = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
  const delta = Math.round(k * marginMult * (1 - exp));
  return { gain: delta, loss: -delta };
}

// Margin-of-victory multiplier from the actual game scores: a narrow win
// (e.g. 21-19) sits near 1x, a dominant sweep (e.g. 21-5, 21-8) tops out at
// 1.3x — nudging the base MMR-difference formula rather than overriding it.
// Capped both ends so one lopsided game can't swing MMR more than a big
// rating gap already does. Only known once scores are in, so previews shown
// before scores are entered (see previewMMRChange) can't use this.
export function marginMultiplier(games: { p1: number; p2: number }[]): number {
  const p1Total = games.reduce((s, g) => s + g.p1, 0);
  const p2Total = games.reduce((s, g) => s + g.p2, 0);
  const diff = Math.abs(p1Total - p2Total);
  return Math.min(1.3, Math.max(0.85, 0.85 + diff / 100));
}

// For a preview shown before the outcome is known (e.g. Log a Match's "Win:
// +X / Loss: -Y" before scores are entered). Computing gain and loss from a
// single calcMMRChange(myMMR, oppMMR) call — as if "my side" were always the
// winner — silently swaps the two: an underdog who loses as expected would
// get charged a near-max penalty instead of ~0, and a favorite upset would
// barely lose anything instead of taking the near-max hit. Deriving each
// branch from its own actual-outcome call keeps both correct.
export function previewMMRChange(myMMR: number, oppMMR: number, k = 32, mMult = 1) {
  return {
    gain: calcMMRChange(myMMR, oppMMR, k, mMult).gain,
    loss: calcMMRChange(oppMMR, myMMR, k, mMult).loss,
  };
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

// Doubles synergy: confirmed record for `myUid` when teamed with `partnerUid`
// specifically (not partner's overall record). Used to show a "won 4/5 with
// Zack" badge when picking a teammate, same data source as the profile-page
// Doubles Partners section.
export function partnerRecord(matches: Match[], myUid: string, partnerUid: string): { wins: number; losses: number } | null {
  let wins = 0, losses = 0;
  for (const m of matches) {
    if (m.status !== 'Confirmed' || m.type === 'MS' || m.type === 'WS') continue;
    const iAmP1 = m.player1Id === myUid;
    const iAmP2 = m.player2Id === myUid;
    if (!iAmP1 && !iAmP2) continue;
    const myPartnerId = iAmP1 ? m.player1PartnerId : m.player2PartnerId;
    if (myPartnerId !== partnerUid) continue;
    if (m.winnerId === myUid) wins++; else losses++;
  }
  return wins + losses > 0 ? { wins, losses } : null;
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

export function getCountryByName(name: string): CountryData {
  return COUNTRIES.find(c => c.name === name) ?? COUNTRIES[0];
}
