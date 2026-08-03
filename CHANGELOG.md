# CourtConnect — Development Changelog

> Format: `[YYYY-MM-DD]` | Priority: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
> Status: ✅ Done · 🚧 In Progress · 📋 Planned

---

## [2026-08-03] — Fix + Feature: real online/offline presence in chat

### 🟡 Medium
- ✅ Fixed: chat showed every contact as "Online" unconditionally — it was a hardcoded
  label, not real data.
- ✅ Built real presence tracking via Supabase Realtime — chat now shows accurate
  online/offline status per contact, no schema changes needed.

## [2026-08-03] — Feature: Club Pro Phase 1 (manual flag, no billing yet)

### 🟡 Medium
- ✅ New Club Settings screen (name/description/colour/member cap), reachable from a
  club's Admin tab — first way to edit a club after creation besides the announcement.
- ✅ Clubs flagged `isPro` (manually granted, no in-app toggle yet) get a raised member
  cap (500 vs. 200 free) and a new Analytics tab (avg MMR, member count, most active
  members). `supabase/migrations/0018_club_pro.sql` needs Lok to run in the Supabase SQL
  editor before the flag can be set on any club.

## [2026-08-03] — Feature: real cross-account Follow

### 🟠 High
- ✅ Follow feature now works between real accounts, not just localStorage. Public
  accounts follow immediately; private accounts require the target's approval via a new
  "Follow requests" inbox in the notification panel. `supabase/migrations/
  0016_follow_requests.sql` — needs Lok to run in the Supabase SQL editor for private
  requests and live follower/following counts (public following works without it).

## [2026-08-01] — Fix: missing RLS update policy on season_history (ranked seasons)

### 🔴 Critical
- ✅ `supabase/migrations/0015_season_history_update_policy.sql` — `season_history` (from
  0014, ranked seasons) only had an INSERT policy, but its one write path is an upsert
  that explicitly expects update-on-conflict. Two tabs/devices for the same user both
  crossing a season boundary would silently drop the second write. Needs Lok to run in
  the Supabase SQL editor.

---

## [2026-07-27] — Chore: storage bucket migration for existing avatar/clip upload

### 🟡 Medium
- ✅ `supabase/migrations/0013_storage_buckets.sql` — repeatable, idempotent creation of the
  `avatars` (public) and `clips` (private) Storage buckets + RLS policies that the existing
  photo-upload and match-clip-recording features already depend on. Previously only documented
  as a manual dashboard step. Needs Lok to run in the Supabase SQL editor.

---

## [2026-07-26] — Feature: full tournament bracket system + champion tracking

### 🟠 High
- **Real tournaments can now actually be played out.** Host taps "Start Tournament" once 2+ people
  are signed up → generates a real single-elimination bracket (random seeding, byes handled). Host
  reports each live match's winner, the bracket progresses round to round automatically, and the
  final match's winner becomes the tournament's tracked champion — shown as a banner on the
  tournament, a new "Champion" achievement badge, and a real push notification to the winner.
- **🔴 Needs Lok:** run `0012_tournament_champion.sql` — bracket play works without it, only the
  champion fields won't persist until then.
- **More push notification types**: club join accepted/declined and tournament request
  accepted/declined now reach the recipient even with the app closed, same as messages/challenges
  shipped earlier today.
- **Paused-match indicator** — turned out to already be live (Home, BottomNav, Sidebar) from a
  prior session; roadmap item was just stale.

## [2026-07-26] — Feature: weekly recap card, real Web Push foundation, 2 new milestone badges

### 🟠 High
**Why:** Lok asked to build on 4 pitched feature ideas. Head-to-head stats and milestone badges
turned out to already be shipped from prior sessions — built the other two.

- **Weekly Recap card on Home** — this week's MMR delta, matches played, wins, and best win, with
  a native Web Share API share button.
- **2 new milestone badges** — `first_ten` (10 matches), `half_century` (50 matches), alongside the
  existing `century_club` (100).
- **Real Web Push notifications — foundation shipped, needs one-time setup:** the existing Settings
  toggle only ever fired notifications while the app tab was open in the background, never when
  fully closed. New: VAPID-keyed push subscriptions, a service-worker `push` handler, an Edge
  Function to send the actual push, and the two highest-traffic notification types (new message,
  challenge received) now write a real row the moment they happen instead of only existing in the
  recipient's own browser session.
- **🔴 Needs Lok:** run `0010_push_subscriptions.sql`, deploy the `send-push` Edge Function with the
  VAPID private key as a secret, and wire a Database Webhook — exact steps in today's DEVLOG entry.
  Nothing regresses until then; the existing in-background notification behavior is unchanged.

## [2026-07-26] — Feature: real tournament persistence + 3 smaller Tournaments fixes

### 🔴 Critical
**Why:** Scheduled 5am auto-dev audit; both open To-Do items still gated on Lok's
real-world testing, so this session swept fresh ground (Tournaments, Partner Finder).

- **Tournaments had zero backend persistence.** "Host an Event" only wrote to local
  React state — a hosted tournament vanished on refresh and was invisible to every other
  user/device. Wired into Supabase, mirroring the existing clubs architecture (real-time
  subscription, uid-translate pattern). Hosting a new tournament now persists and syncs.
- **🔴 Needs Lok:** registering for someone else's tournament won't yet persist the
  headcount — the `tournaments` table's UPDATE policy is host-only, same bug class
  already fixed for clubs/court_sessions in 0005. Exact SQL fix is in today's DEVLOG
  entry; couldn't apply it directly (no DB access, and a migrations-file write was
  blocked by the permission system this session runs under).

### 🟡 Medium
- **Participants Modal contradicted the tournament row it was opened from** — showed
  "No players signed up yet" under a "16 players participated" row. Now uses the same
  count (`currentPlayers`) in both places.
- **Host Event date field had no past-date guard**, unlike every other date picker in
  the app. Added `min={today}`.
- Deleted a dead unused prop (`myClubs`) threaded through every `TournamentRow`.

## [2026-07-26] — Fix: leaderboard state filter wrong for non-MY countries, unenforced club MMR minimum, Settings location/photo-upload bugs

### 🟠 High
**Why:** Scheduled 1am auto-dev audit; both open To-Do items were still gated on Lok's
real-world testing, so this session swept fresh ground instead.

- **Leaderboard "By State" tab returned wrong/empty results for every non-Malaysia
  country.** The state dropdown and filter always used Malaysia's state list regardless
  of the selected country filter. Now derives options and the filtered field (state vs.
  region) from the selected country itself.
- **A club's minimum-MMR requirement was never enforced.** A player below the MMR floor
  could join a public club instantly, despite the club's own settings promising otherwise.
  Enforced in the join action plus disabled/explained states in both club-join UIs.

### 🟡 Medium
- **Manually picking a state in Settings (postcode not resolved) silently didn't save.**
  The visible "state" dropdown updated the on-screen region but the saved `state` value
  kept its old value — affecting Leaderboard's "By State" and "Nearby" ranking for those
  users.
- **Avatar upload failures were invisible.** A failed upload looked identical to a
  successful one, with no error shown.

---

## [2026-07-25] — Fix: MMR calculation gave backwards gain/loss, spurious notification spam, broken chat link, capped win-streak display

### 🔴 Critical
**Why:** Requested audit across MMR, notifications, player profiles, and tournaments.

- **MMR calculation was backwards for the losing side on every ranked match logged
  through "Log a Match" (the highest-traffic flow).** An underdog who lost as expected
  got charged a near-max MMR penalty instead of losing almost nothing; a favorite who
  suffered an upset loss barely lost anything instead of taking a near-max hit. Root
  cause: the MMR preview (shown before the outcome is known) always passed "my side" as
  the winner argument to the Elo formula, silently swapping which side's expected-score
  math applied to the loss. Fixed with a dedicated `previewMMRChange` helper that
  correctly derives each branch, backed by a new regression test
  (`utils.selfcheck.ts`). `LiveMatchModal`'s live-scoring flow already computed this
  correctly and was untouched.

### 🟠 High
- **Real-time notifications re-fired on every app reload.** Three of five real-time
  subscriptions (incoming challenges, DM conversations, real-match confirmations) were
  missing the "don't notify on first load" guard that the clubs/club-chat subscriptions
  already had — so reopening the app with any pending challenge, unread DM, or
  unconfirmed match re-sent that same notification every time, not just once.
- **Clicking a "New message" notification 404'd on the live site.** Its link was missing
  the `BASE_PATH` prefix required under the GitHub Pages `/courtconnect` subpath.

### 🟡 Medium
- **A player's current win/loss streak silently capped at 7.** The streak counter reused
  the "last 7 matches" array meant for the recent-form dots, so a real 10-game streak
  displayed as "7W" instead of "10W".

### 📋 Noted, not fixed
- Private tournaments' "Request to Join" has no approval path anywhere in the code — a
  requester's state can never resolve. Needs a product decision (who approves, and
  where) before building, not a quick bug fix.

**Verified:** `npm test` (all self-checks incl. new MMR one) and `npx next build` clean.

## [2026-07-25] — Fix: club ladder ranking bugs, venue autocomplete gap

### 🟡 Bug fix
**Why:** Auditing yesterday's shipment turned up 3 real issues past the surface-level check.

- Club ladder ranked a player with more losses above one with a better win rate (tiebreak
  used matches-played, not win rate).
- Ladder rank numbers (`#1, #2, #3…`) could show a gap while a member's profile was still
  loading.
- "Log a Match" — the app's most-used venue field — never actually got the shared venue
  directory despite yesterday's note; it now suggests crowd-sourced venue names alongside
  its existing GPS/live-location search instead of losing that search to a straight swap.

## [2026-07-25] — Feature: rally stats, venue directory, club ladder

### 🟢 New features
**Why:** Lok asked for 3 of 5 suggested feature ideas, built back to back.

- **Rally stats** on the match detail screen — rally count, longest rally, average hits
  per rally, computed from shuttle-hit detection that was already running on every clip.
- **Venue directory** — a real, crowd-sourced list of courts/halls (new "Venues" tab on
  Players). The venue autocomplete that used to only exist in the tournament form is now
  shared everywhere a match asks for a venue. Requires migration 0008 to be applied.
- **Club ladder** — a new "Ladder" tab on each club ranks members by wins in confirmed
  singles matches played against each other, computed from existing match history.
- Also: Track & Record's camera now shows a placement guide before the 4-corner tap
  calibration, so you can see roughly where the court should sit in frame first.

## [2026-07-24] — Fix: silent club invites, dead Accept/Decline UI removed

### 🟠 Bug fix
**Why:** A real user invited to a club was added as a full member immediately with zero
notification — no bell entry, no toast — while the app's own notification panel had a fully
wired Accept/Decline button pair that could never actually appear, because the code path
that would have created that notification was unreachable from any real invite flow.

- `inviteToClub` still adds the invited player immediately (unchanged, deliberate
  consent-free behavior) but now the invited player is actually told: an "Added to Club"
  notification fires via the same real-time diff that already tells players when their own
  join *request* is accepted or declined.
- Removed the dead `acceptClubInvite`/`declineClubInvite` functions and the Accept/Decline
  buttons in the notification panel — they were wired to a notification type that no live
  code path ever produced.

## [2026-07-24] — Feature: toast popups for friend + challenge requests

### 🟢 New feature
**Why:** The only signal for an incoming friend or challenge request was the Topbar bell
count — easy to miss. Picked up a scoped idea already flagged in DEVLOG's Feature Ideas list.

- A transient banner now pops at the top of the screen when someone sends you a challenge,
  accepts/declines one, sends/accepts a follow request, or invites you to a club — on top of
  the existing bell notification, not instead of it.
- Auto-dismisses after 5 seconds, capped at 3 banners visible at once, tap to jump straight
  to the relevant screen, or dismiss manually.

---

## [2026-07-24] — Fix: opponent search couldn't find real signed-up players

### 🔴 Critical fix
**Why:** `LogMatchModal`, `LiveMatchModal`, and the planned-match picker all searched only
the static seed/demo roster — a real user typing a real friend's name to log, live-score, or
schedule a match found nobody. QR-code scan was the only working path. The Players page
already merged in the live Supabase roster correctly; the three match-creation search boxes
never got the same fix.

- Opponent search in "Log a Match", live match creation, and "Schedule a Match" now includes
  every real signed-up player, not just the demo roster.

---

## [2026-07-21] — Feature: casual match logging, shareable match recap image, availability board

### 🟢 New features
**Why:** Lok picked all 3 remaining ideas from an earlier feature brainstorm.

- Log a match as Ranked or Casual/Practice — casual matches save to your history but never
  touch MMR, tier, win/loss record, or placement calibration.
- "Share Recap" button on confirmed matches generates a shareable image card and opens the
  native share sheet (WhatsApp, etc.), or downloads if sharing isn't supported.
- New "This Week" tab on Players — post when you're free to play, browse who else is.
  **Requires a Supabase migration Lok needs to run** (`0007_availability.sql`) before it
  works live.

---

## [2026-07-21] — Fixes: full-screen live recording, log-to-profile prompt, shuttle-hit tuning

### 🟠 Live recording UX
**Why:** The camera recording screen wasted a third of the screen on a score header that
was never actually tappable in any reachable flow, and the `/live` scoreboard page had no
way to save its result to your profile at all.

- Recording now goes full screen (score header only shows where live tap-scoring is real).
- `/live` page prompts to log the match to your profile once it's done — previously the
  result just evaporated when you left the page.
- Shuttle-hit auto-detect threshold raised to cut false positives from court/crowd noise.

---

## [2026-07-21] — Feature: Doubles Partners record on player profiles

### 🟢 Profile stats
**Why:** Doubles teammate identity was already stored on every match (`player1PartnerId`/
`player2PartnerId`) but never surfaced anywhere — a player had no way to see who they play
best with.

- New "Doubles Partners" card on player profiles (own and others'), next to Head to Head:
  confirmed doubles matches grouped by teammate, showing W-L record and win rate per partner,
  sorted by most matches played together.
- Pure client-side aggregation from existing match data — no schema change.

---

## [2026-07-15] — Cleanup + fix: dead code removed, tournament regs & planned matches now persist across reloads

### 🟠 Data persistence
**Why:** An over-engineering/dead-code audit turned up two real bugs — tournament
registrations and your own planned matches were written to the database correctly but never
loaded back, so both silently reset to nothing on every reload.

- Tournament registrations and planned matches now hydrate from the database on sign-in,
  merged with local state so nothing already on screen gets clobbered.
- Removed an abandoned "friends" feature (superseded by follow), a dead club-invite tracking
  list, and several unused helper functions/types — no behavior change, just less code.

---

## [2026-07-15] — Feature: disputed match resolution (re-submit model)

### 🟠 Match dispute resolution
**Why:** `disputeMatch` has always been a permanent dead end — no way to resolve a disputed
result. Lok delegated the model choice; re-submit was chosen over admin review since this app
has no global moderator role, and re-submit reuses the existing pending-confirmation flow
end to end.

- Disputing a result now lets the disputer propose a corrected score, sent back to the other
  side to confirm or dispute in turn — same mechanism as the original report.
- `Match`/`StoredMatch` gained `disputedBy` to gate who can propose the correction.

---

## [2026-07-15] — Fix: real 1:1 chat showed the other person as generic "Player"

### 🔴 Chat participant display
**Why:** The RLS-tightening migration (0003) added `users_public` for cross-user reads but
missed this one call site — found while following up on a note left during the club-limit fix.

- `loadParticipantsMap` now reads from `users_public` instead of the owner-read-only `users`
  table, so real conversations show the other person's actual name/tier/MMR/photo again.

---

## [2026-07-15] — Fix: per-user tier club limit bypassable via club-admin actions

### 🟠 Club tier-limit enforcement
**Why:** Same bug shape as the max_members fix, found by a targeted follow-up pass — a club
owner accepting a request or inviting a player could push that user over their own tier's club
count limit, since only the self-join paths checked it.

- `addClubMember` (`supabaseService.ts`) now also enforces `maxClubsForTier` on the target user,
  reading their tier via `users_public` since the caller is often not that user.

---

## [2026-07-15] — Fix: club membership could exceed its own max_members cap

### 🟠 Club capacity enforcement
**Why:** Autonomous bug-hunt found the owner's Accept/Invite paths had no capacity check at
all — only the self-serve Join button did, and only in the UI, not the underlying function.

- `addClubMember` (`supabaseService.ts`) now enforces `max_members` once, covering all four
  paths that route through it (self-join, accept request, admin invite, accept invite).

---

## [2026-07-15] — Feature: Pose-tracking heatmap Phase 1 (camera-view tap tracking)

### 🟡 Court tracking UX
**Why:** Tapping a separate abstract diagram while also watching the live camera feed was
unnecessary context-switching. Lok approved a one-time 4-corner calibration tap in exchange for
tapping the real camera picture directly.

- New `src/lib/courtCalibration.ts`: one-time 4-corner tap → homography → accurate court
  position from any camera angle. Self-check at `courtCalibration.selfcheck.ts`.
- `ClipRecorder.tsx`: opt-in `courtTapMode` — tap the live video to calibrate, then to mark
  positions. Other consumers of `ClipRecorder` unaffected.
- `CourtTrackModal.tsx`'s two-phone tracking flow now offers this alongside the existing
  abstract-diagram tap surface.

---

## [2026-07-15] — Fix: Live Match results permanently stuck "Pending", doubles MMR wrong

### 🔴 Live Match MMR pipeline
**Why:** Autonomous bug-hunt found Live Match's result-logging diverged from Log Match's
working pattern in four ways, all stemming from treating demo/seed opponents as if they could
confirm a match like a real account.

- Every Live Match result against an opponent (Live Match only ever offers demo/seed players)
  was permanently stuck "Pending" — MMR never applied, Confirm button never rendered.
- Doubles Live Matches used the wrong opponent's solo MMR instead of averaging both teams, and
  never recorded partner identities.
- Live Match never applied the placement K-factor or advanced placement match count.
- Anti-cheat's weekly-opponent-cap rule counted your own doubles partner as an opponent.

---

## [2026-07-12] — Backend migration: Firebase → Supabase

### 🔴 Full backend cutover (not yet deployed — pending user review)
**Why:** User data already migrated to Supabase Postgres; app code needed to follow.

- Replaced Firebase Auth + Firestore + Storage with Supabase Auth + Postgres + Storage across the whole app (`src/lib/supabase.ts`, `src/lib/supabaseService.ts`, `AuthContext`, `AppContext`, and every consuming screen/component).
- Firestore's `onSnapshot` listeners → Supabase Realtime `postgres_changes` channels.
- Removed the `firebase` dependency and Firestore-only test scaffolding.
- See DEVLOG for the full list of shipped changes, known gaps, and verification performed.

---

## [2026-07-09] — Live Match: Pause/Resume, Camera Layout, Point Log

### 🟠 Live Match — Pause & Resume Instead of Discard on Quit
**Why:** Telegram feedback — quitting mid-match (video or manual) only warned that progress would be lost; the user wanted an actual pause/resume instead of a dead end.

- Added `'paused'` to `LiveMatch.status`. Quitting a live match in progress (video or manual scoring) now sets the match to `paused` in Firestore instead of abandoning it — dialog copy updated to explain this.
- The join code + record mode are remembered locally so the plain "Live Match" setup screen shows a "Paused match" card (score, game, teams) with **Continue Match** / **Discard** — Continue restores the exact score state and drops straight back into scoring.
- Non-host viewers still get a plain "Quit" with no pause (pausing is a host-only action).

### 🟡 Live Match Camera — 1/3 Score, 2/3 Court
**Why:** Telegram feedback — the score header ate a large fixed slice of the screen, leaving too little room for the court in view.

- Video-record camera view now splits 1/3 (score header) / 2/3 (camera/court), instead of a fixed-height header. Playback controls now overlay the bottom of the court area (gradient backdrop) rather than reserving their own strip.

### 🟢 Live Match — Simplified Point Log Labels
**Why:** Telegram feedback — the per-rally point log table's "1a"/"1b"/"2a" labels were redundant since row color already shows the side.

- Point log cells now show just the running tally ("1", "2", "3"...); row color (emerald/rose) still distinguishes teams.

**Files changed:** `src/types/index.ts`, `src/components/LiveMatchModal.tsx`, `src/components/ClipRecorder.tsx`

---

## [2026-07-09] — Multi-Club Membership (MMR-Tiered)

### 🟠 Clubs — Multi-Club Membership Gated by MMR Tier
**Why:** Users could only belong to one club at a time. Product decision: allow multiple, with higher-MMR players earning the ability to join more.

- Club limit by tier: Beginner/Bronze = 1, Silver/Gold = 2, Platinum = 3, Diamond = 4, Elite = 5.
- Replaced the single `myClubId` model with `myClubIds: string[]` throughout — `AppContext`, the Clubs tab, club detail page, and the public profile's club card (now shows all of a player's clubs, not just one).
- `leaveClub` now takes a club ID (was global/no-arg). `joinClub`, `requestJoinClub`, and `acceptClubInvite` all check the tier limit (pending requests count toward the limit too, so you can't queue past your cap).
- "Create Club" and "Join"/"Request" buttons now disable with a "club limit reached" message instead of "already in a club" once at cap; a running "X/Y clubs joined" count shows on the Clubs tab.
- Migrated the old single-club localStorage/Firestore key (`cc_myClubId` / `myClubId`) to the new array-based one (`cc_myClubIds` / `myClubIds`) with a fallback read so existing users don't lose their club on upgrade.

**Files changed:** `src/lib/utils.ts`, `src/lib/firestoreService.ts`, `src/context/AppContext.tsx`, `src/app/players/page.tsx`, `src/app/clubs/[id]/ClubDetailClient.tsx`, `src/app/players/[username]/PlayerProfileClient.tsx`

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
| On-device pose tracking (real court heatmap) | 🟡 | Gated on Lok testing Phase 2 on an actual court |
| Auto-detect shuttle hits tuning | 🟢 | Heuristic shipped, threshold tuning gated on real-match testing |

_Everything else formerly listed here (Supabase backend, push notifications, realtime updates,
avatars, dark/light toggle, onboarding flow, Google OAuth, club chat, tournament brackets) has
shipped — see dated entries above. Facebook OAuth shipped 2026-07-28. Match history export (PDF)
was built then reverted same day — Lok decided it's not needed. Table was stale, corrected 2026-07-28._
