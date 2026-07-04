# CourtConnect — Development Changelog

> Format: `[YYYY-MM-DD]` | Priority: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
> Status: ✅ Done · 🚧 In Progress · 📋 Planned

---

## [2026-07-04] — Session 4: Tournament Overhaul + Home Redesign + QR Scan + PWA

### 🟠 Tournament Page — Full Overhaul
**Why:** The tournament page had flat, cluttered filter pills and several missing features (bracket always visible, no participant list, no venue suggestions, no way to distinguish hosted events).

- **Filter Dropdowns** — replaced all flat pill rows with 3 categorized `FilterDropdown` components: Visibility (All Events / Public / Private), Format (All Formats / MS / WS / MD / WD / MX), Eligibility (All MMR Levels / Eligible for Me). Consistent with Players and Leaderboard tabs.
- **"Request to Join" icon** — changed from `EyeOff` (eye) to `Plus` icon for semantic correctness.
- **Live Bracket only when Active** — bracket was previously shown for Upcoming + Completed. Now only rendered for `status === 'Active'` (live tournaments). Prevents spoilers and confusion.
- **Participant list for Upcoming tournaments**
  - Public: shows "X players signed up" + clickable "View" button → opens numbered participant modal with capacity bar
  - Private: shows count only with "Names hidden" label — protects participant privacy
  - Registered seed data added (t2: 8 names, t3: 20 names, t4: 4 names)
  - When user registers/unregisters, their name is added/removed from the live list
- **Venue autocomplete** — typing 2+ characters in the Venue Address field shows up to 5 matching Malaysian badminton venue suggestions (Sport Planet PJ, Bukit Jalil, Stadium Shah Alam, etc.). Click to fill.
- **Hosted-by-user highlighting** — tournaments created by the current user get amber border + "You're hosting" badge + float to top of any list. Host sets `hostUid: 'me'` on create.
- **User not auto-registered as host** — creating an event does not sign you up as a player. You can register separately or just manage.

**Files changed:** `src/types/index.ts`, `src/lib/data.ts`, `src/context/AppContext.tsx`, `src/app/tournaments/page.tsx`

---

### 🟡 Home Page — Visual Redesign
**Why:** The home page felt empty and soulless — plain text, grey stat cards, no personality, nothing actionable.

- **Hero Player Card** — replaces plain greeting with a rich card featuring: subtle green/amber glow backdrop, name + tier badge + location, MMR displayed prominently top-right, tier progress bar, two status toggles redesigned as compact inline buttons
- **Quick Actions row** — 3 large tappable tiles: Find Match (green/Zap), Find Partner (violet/Users), Events (amber/Trophy). Each navigates to the right page.
- **Upcoming Events section** — only appears if you've registered for events; shows each as a clickable amber card with venue + date
- **Stat row** — cleaner 3-column grid (Nat. Rank, Win Rate, Matches) with icons; discipline MMR (MS/MD/MX) as compact chip row below
- **Better empty states** — "No matches yet" shows racket emoji tile + "Log a Match" CTA; activity empty state shows icon + "Browse events →" link
- **Richer activity feed items** — Win/Loss as rounded squares with colored backgrounds, MMR changes as colored pill chips

**Files changed:** `src/app/page.tsx`

---

### 🟠 QR Code — Real Generation + Photo Scanning
**Why:** "Scan Opponent QR Code" was a non-functional button. QR codes in My QR Code modal were decorative SVGs with no actual data.

- **Real QR generation** — QRModal now uses `qrcode` library to draw an actual scannable QR code on a `<canvas>`, encoding `{"uid":"me","username":"lokkai","displayName":"Lok Kai"}`. Replaces the decorative hand-drawn SVG.
- **Photo-based scanning in Log Match** — two buttons: "Take Photo" (opens rear camera on mobile via `capture="environment"`) and "Upload Photo" (file picker for gallery)
- **Client-side decode** — `jsqr` reads pixel data from the image drawn on an offscreen canvas. No server, no internet required. Dynamically imported to avoid SSR issues.
- **Auto-fill on success** — decoded `uid` or `username` matched against player database → Opponent field filled automatically
- **Three scan states** — Scanning (spinner + thumbnail), Success (green banner + player name), Error (red banner + reason + retry buttons)
- **Packages added:** `jsqr`, `qrcode`, `@types/qrcode`

**Files changed:** `src/components/QRModal.tsx`, `src/components/LogMatchModal.tsx`

---

### 🟡 PWA — Progressive Web App
**Why:** The app is a mobile-first product but had no installability, no offline support, and no app icon — it looked like a website.

- **App icon** — custom SVG design: dark slate background + emerald green badminton racket (with string grid) + amber shuttlecock with white feathers. Generated as PNG at 10 sizes: 72, 96, 128, 144, 152, 192, 384, 512px + maskable (Android adaptive icons) + Apple touch icon (180px)
- **Web App Manifest** (`/manifest.json`) — `display: standalone` (removes browser chrome), `orientation: portrait-primary`, `theme_color: #059669` (emerald status bar on Android), `background_color: #020817` (splash screen), App Shortcuts: "Find Match" → /players/, "Events" → /tournaments/
- **Service Worker** (`/sw.js`) — precaches app shell on install, network-first for navigation (fresh when online), cache-first for static assets (fast loads). Old caches cleaned on each deploy.
- **Layout meta tags** — Apple Web App capable, status bar style, tile color, favicon chain
- **Install:** Android Chrome: banner after visit or ⋮ → "Add to Home Screen". iOS Safari: Share → "Add to Home Screen"

**Files changed:** `src/app/layout.tsx`, `public/manifest.json`, `public/sw.js`, `public/icons/*`, `scripts/gen-icons.mjs`

---

## [2026-07-03] — Session 3: Player Profile, Chat, Topbar, Leaderboard

### 🟠 Player Profile — Multiple Button Fixes
- **Edit Profile button** — wired to open `SettingsModal` (was non-functional)
- **Message button** — `onClick` navigates to `/chat/?uid={player.uid}`. Chat page creates new conversation if none exists for that uid, or opens existing one.
- **Challenge auto-open** — chat header Challenge button navigates to `/players/{username}/?challenge=1`; profile reads `?challenge=1` on mount and auto-opens `ChallengeModal`
- **Skill Match tooltip** — hover reveals popup explaining what skill match % means, shows actual MMR gap, gives qualitative label (⚡ Very even / 🟡 Moderate gap / 🔴 Large gap)
- **Skill Match label** — "Skill Match" text added above the progress bar in PlayerRow

### 🟠 Player Endorsements (DUPR-inspired)
**Why:** DUPR lets players endorse each other for specific skills, adding social credibility to profiles.
- 6 skills: Powerful Smash, Sharp Net Play, Great Footwork, Strong Defense, Smart Placement, Good Sportsmanship
- Endorsement counts shown as bar chart on player profiles
- Click to endorse, click again to remove (toggle)
- Endorsed skills show violet with ✓, hover turns red as "remove" cue
- `myEndorsements` and `playerEndorsements` in AppContext
- Seed data on p1 (Zack), p4 (Sarina), p6 (Khoo Hui Jin)

### 🟡 Community Feed
- `COMMUNITY_FEED` seed data (6 match results between players)
- Home page Activity section gets "Mine" / "🌐 Community" tabs
- Community tab shows recent match results from across the platform

### 🟡 Filter Dropdowns (shared component)
- New `FilterDropdown<T>` generic component in `src/components/ui/FilterDropdown.tsx`
- Replaces all flat pill button rows across Players, Partner Finder, Clubs, Leaderboard tabs
- Click-outside closes, active filter shown in emerald tint

### 🟡 Leaderboard Green Frame Fix
- Was `border-l-2 border-emerald-500` (left-only, conflicts with `divide-y`)
- Fixed to `shadow-[inset_0_0_0_1.5px_rgba(16,185,129,0.35)]` — inset box-shadow creates even 4-side border without layout impact

### 🟡 Chat — Message Button Flow
- Chat page `useEffect` on mount reads `?uid=` param
- Finds existing conversation or creates new one client-side
- `[ME, ...PLAYERS]` lookup so all known players can be started with

### 🟡 Location Switching in Topbar
- Location area is now a clickable button with `ChevronDown`
- Opens `LocationPicker` dropdown: GPS detection (`navigator.geolocation`) + manual state/city picker
- `coordsToState(lat, lng)` maps GPS coordinates to Malaysian state/area without external API
- Save calls `updateUser({ state, area })`

---

## [2026-07-02] — Session 2: Clubs Overhaul + Notifications + Partner Finder

### 🔴 Club System — Full Overhaul
**Why:** Clubs had no real functionality — no creation flow, no join/request system, no admin tools.

- **Create Club modal** — name, short name, description, purpose (Competitive/Recreational/Training/Social/Youth), state, max members, min MMR, public/private
- **Join flow** — Public clubs: direct join button. Private clubs: "Request to Join" → pending state
- **Share club link** — copy URL with `?tab=clubs&id=` query param
- **Admin controls** — accept/decline pending member requests
- **Club announcements** — admin can post announcements; **only visible to club members** (not public/non-members). Explicitly fixed after initial implementation showed announcements to everyone.
- **Seed data** — 5 clubs: KL Smashers (competitive, public), PJ Aces (social, public), Penang Eagles (elite, private), Subang United (recreational, public), Johor Blazers (training, private)

### 🟠 In-App Notifications
- `NotificationPanel` component (slide-in from topbar bell icon)
- 8 notification types: challenge received/accepted/declined, partner request, club request/accepted/declined, match pending
- Unread count badge on bell icon
- `addNotification`, `markNotifRead`, `markAllNotifsRead` in AppContext
- Triggered by challenge send/accept, club join requests

### 🟡 Clubs — "Request to Join" icon fix
- Changed from `EyeOff` to `Plus` icon (semantic improvement, carried forward to tournaments)

---

## [2026-07-01] — Session 1: Foundation

### 🔴 Core App Structure
- Next.js 16 App Router, static export (`output: 'export'`, `trailingSlash: true`)
- Tailwind CSS v4 with `@import "tailwindcss"` syntax
- `localStorage`-based auth (`cc_auth_users`, `cc_auth_session`)
- `AppContext` global state for all app data
- `AuthContext` + `AuthGate` for login/register flow

### 🔴 Player System
- `UserProfile` type with MMR, tier, rank, discipline MMR, bio, availability, location
- 7 seed players with realistic Malaysian badminton profiles
- Tier system: Beginner → Bronze → Silver → Gold → Platinum → Diamond → Elite
- MMR-based ranking system

### 🟠 Players Tab
- Player list with MMR, tier, win rate, skill match % relative to current user
- Filter by state + tier
- Clickable rows navigate to player profile

### 🟠 Player Profiles (`/players/[username]/`)
- Full profile page: bio, stats, MMR history (per discipline), head-to-head
- Challenge button → `ChallengeModal` (format, venue, date, message)
- Dynamic routes with `generateStaticParams` for all seed players

### 🟠 Partner Finder
- Players with `lookingForPartner: true` shown
- Filter by format preference
- Availability grid (Mon–Sun, morning/afternoon/evening)
- Send partner request

### 🟠 Leaderboard
- Global ranking table with MMR, tier, win rate
- "You" row highlighted (emerald glow)
- By State tab showing state-level rankings
- Podium (top 3) with crown icons

### 🟡 Log Match Modal
- Match type selection (MS/WS/MD/WD/MX)
- Player search (name or @username)
- Doubles: teammate + 2 opponents
- Score entry (best of 3 games, Game 3 optional)
- MMR preview (expected gain/loss before submitting)
- Venue search via Nominatim (OpenStreetMap) reverse geocoding + GPS
- Match submitted → Pending verification → Opponent confirms → MMR updates

### 🟡 Tournaments
- Active/Upcoming/Completed tabs
- Register / withdraw (with 12h penalty warning)
- Private tournaments: Request to Join flow
- Live bracket view (SVG tree layout)
- Host Event modal

### 🟡 Messages / Chat
- Conversation list + chat window
- Challenge button in chat header
- Unread count badges

### 🟢 QR Modal (decorative)
- Initial version: hand-drawn SVG QR code (not functional — replaced in Session 4)

---

## Planned / Backlog

| Feature | Priority | Notes |
|---|---|---|
| Real backend (Supabase/Firebase) | 🔴 | Currently all in-memory localStorage — data lost on refresh |
| Push notifications | 🟠 | Browser Push API for challenges, match confirmations |
| Real-time updates | 🟠 | WebSocket or Supabase realtime for live match scores |
| Player photos / avatars | 🟡 | Currently initials-only avatars |
| Match history export (PDF) | 🟡 | Download your match history as PDF |
| Dark/light theme toggle | 🟢 | Currently dark-only |
| Onboarding flow | 🟠 | New user setup wizard (pick tier, area, formats) |
| Google/Facebook OAuth | 🟠 | Currently email-only auth |
| Club chat rooms | 🟡 | Group messaging within clubs |
| Tournament bracket generation | 🟠 | Auto-generate brackets when tournament starts |
