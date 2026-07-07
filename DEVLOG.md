# CourtConnect — Daily Dev Log

## [2026-07-07 07:15] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start. Audited 3 unaudited user commits since the last session (00:28–00:45: Live tab removal, profile photo/avatar link fixes, follow system + leaderboard Following tab) — all matched frozen nav decisions and had no regressions. Found and fixed one real cross-cutting bug: several modals never unmounted on close, leaving stale form/profile-edit data behind on reopen.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟠 | Audit commits `bb85ce3`, `637cf56`, `f397e75` (Live tab removal, avatar/link fixes, follow system) | ✅ | No regressions — Live tab removal matches frozen BottomNav/Sidebar spec exactly; avatar/Link changes verified safe (grid `display` blockifies the `<a>` so removing `w-full` doesn't break layout) |
| 3 | 🟠 | Modal remount audit (prompted by re-checking the frozen SettingsModal-unmount note) | ✅ | Found `QRModal`, `LogMatchModal`, and `SettingsModal` were mounted unconditionally (via `open` prop + internal `if (!open) return null`) in `Topbar.tsx`, and `LogMatchModal` likewise in `src/app/page.tsx` — only `matches/page.tsx` and `PlayerProfileClient.tsx`'s SettingsModal usage followed the correct unmount-on-close pattern |

### Issues Found
- 🟠 [src/components/Topbar.tsx](src/components/Topbar.tsx) + [src/app/page.tsx](src/app/page.tsx) — `QRModal`, `LogMatchModal`, and `SettingsModal` were rendered unconditionally with only an `open` prop gating their return value (`if (!open) return null`), so the components never unmount between opens. Since none of these components reset their internal `useState` on reopen, closing without submitting/saving and reopening later showed stale data: `LogMatchModal` kept a previously-picked opponent/teammate, match type, and game scores from an abandoned attempt (real risk of submitting a match with the wrong opponent/scores); `SettingsModal` kept unsaved edited fields instead of the current profile; `QRModal`'s `copied` flag could stay stuck. `matches/page.tsx`'s `LogMatchModal` and `PlayerProfileClient.tsx`'s `SettingsModal` already used the correct `open && <Modal open={true} .../>` unmount pattern (matches the frozen SettingsModal note) — the other two call sites had drifted from it.

### Improvements Made
- [src/components/Topbar.tsx](src/components/Topbar.tsx) — `QRModal`, `LogMatchModal`, `SettingsModal` now rendered as `{stateVar && <Modal open={true} .../>}` so each unmounts on close and gets fresh state next open.
- [src/app/page.tsx](src/app/page.tsx) — same fix applied to the Home page's `LogMatchModal` instance.
- Verified via `npx next build` (clean, no TS errors) after the fix. Could not verify live in the browser this session — the app requires real Firebase auth with no headless/demo login path, consistent with prior sessions' notes.

### Feature Ideas / Upcoming Plans
(Carried over, still open)
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce remaining Privacy settings (plannedMatches, friendList, eventHistory) | Match History and Club Membership are enforced; these 3 still have no display surface on the profile | Medium-Large — needs new profile sections, not just visibility checks |
| Club chat / per-club message board | Now appears partially covered by ClubDetailClient — verify in a future session | Re-check scope, may already be done |
| "Following" list surfaced somewhere (e.g. Players page filter) | Follow system now exists (`following` in AppContext) but the only place to see it is the leaderboard's Following tab | Small — reuse existing `following` state on Players page |

### Critical Alerts
None.

### 📊 Daily Summary (18:00)
- Sessions run: 2
- Total fixes deployed: 3
- Build status: ✅ Healthy
- Telegram summary: ✅ Sent


## [2026-07-07 00:20] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start (user landed a large batch of new work since the 21:10 session: Live Score page, Onboarding flow, Club chat/detail page, Chat Firestore persistence, profile photo upload, QR-code-as-profile-link). Note: the user was actively editing the app live in a parallel session while this audit ran (their own dev server was occupying the port, and new commits landed mid-session), so this session's scope was audit-and-fix only, no new features started, to avoid colliding with in-progress work.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🔴 | Audit ~20 unaudited files from the Live/Onboarding/Chat/Club batch (commits since 21:10) | ✅ | Found 2 confirmed 🔴 regressions — see below |

### Issues Found
- 🔴 [src/components/BottomNav.tsx](src/components/BottomNav.tsx) + [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — when the new "Live Score" nav link was added, the "Messages/Chat" link was replaced rather than added alongside it, in both the mobile bottom nav and the desktop sidebar. The unread-message badge logic (`totalUnread`) was deleted along with it. Since `/chat` has no other entry point in the app except a deep-link from a specific player's profile ("Message" button), the Chat feature — which the user was actively improving in the same commit range (Firestore persistence, header fixes) — became unreachable from primary navigation, with no way to know new messages had arrived.
- 🔴 [src/components/QRModal.tsx](src/components/QRModal.tsx) + [src/components/LogMatchModal.tsx](src/components/LogMatchModal.tsx) — `QRModal` was changed to encode a profile URL (`/players/<username>/`) in the QR code instead of the old `{"uid","username","displayName"}` JSON payload. But `QRScanner` inside `LogMatchModal` (used to scan an opponent's QR code and auto-fill them into a match) still only did `JSON.parse(result.data)` — parsing a URL string as JSON always throws, silently swallowed into an empty payload, so scanning any profile QR to add an opponent to a match always failed with "player not registered" after this change.

### Improvements Made
- [src/components/BottomNav.tsx](src/components/BottomNav.tsx) / [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — restored the Chat/Messages link (and its unread badge) alongside the new Live Score link instead of replacing it; BottomNav grid widened from 5 to 6 columns to fit both.
- [src/components/LogMatchModal.tsx](src/components/LogMatchModal.tsx) — `QRScanner`'s payload parser now also recognizes the new `/players/<username>/` URL format (regex-extracts the username) as a fallback when `JSON.parse` fails, so opponent QR scanning works again with the new QR format while still supporting the legacy JSON payload.
- Verified via `npx next build` (clean, no TS errors) after each fix. Could not verify live in the browser — a parallel session's dev server already held the preview port, and the app requires real Firebase auth with no headless/demo login path anyway, consistent with prior sessions.

### Feature Ideas / Upcoming Plans
(Carried over — untouched this session since the user's own batch of work already covers several of these)
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce remaining Privacy settings (plannedMatches, friendList, eventHistory) | Match History and Club Membership are enforced; these 3 still have no display surface on the profile | Medium-Large — needs new profile sections, not just visibility checks |
| Club chat / per-club message board | Now appears partially covered by the user's new ClubDetailClient — verify in a future session once the port is free | Re-check scope, may already be done |

### Critical Alerts
None — both 🔴 issues found this session were fixed and deployed within the session.


## [2026-07-06 21:10] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** One Telegram message was received but had no text content (empty payload), so there was nothing to act on. Build was clean at session start. A background audit of the three unaudited user commits since the last session (18:53, 19:37, 19:39 — Players card-height/username-row changes and the Challenge→PlannedMatch flow) found no critical bugs, but did surface one confirmed high-priority bug and one confirmed dead-code item, both fixed this session. Also picked up the next slice of the long-carried "Enforce Privacy settings" item: club membership is now gated by `privacy.clubMembership`.

### Telegram Commands Processed
None — the one pending message had empty text (no actionable content).

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟠 | Audit unaudited commits `869d6c9`, `230796a`, `70e8aba` (Players card height, username row, Challenge→PlannedMatch, Profile redesign) | ✅ | Found 1 confirmed 🟠 bug + 1 confirmed 🟡 dead-code item — see below |
| 3 | 🟢 | Feature: enforce `privacy.clubMembership` setting | ✅ | Implemented — see below |

### Issues Found
- 🟠 [src/app/matches/page.tsx](src/app/matches/page.tsx) — `handleAcceptChallenge` fired its own `addNotification({type:'match_confirmed', ...})` on top of the `addNotif({type:'challenge_accepted', ...})` already fired inside `AppContext.acceptChallenge`. One challenge-accept action produced two stacked notifications describing the same event. Fixed by removing the page-level duplicate; the shared `AppContext` notification (also used by the Home page's `ChallengesSection`) now fires exactly once.
- 🟡 [src/app/players/page.tsx](src/app/players/page.tsx) — `PlayerCard` (~66 lines) had zero call sites anywhere in `src` and had drifted out of sync with `RankRow` (still had the old `min-h-[76px]` value, missing the `@username` row and `overflow-hidden` added to `RankRow` in the 19:37 commit). Removed the dead component and its now-unused `skillMatch` import.

### Improvements Made
- [src/app/matches/page.tsx](src/app/matches/page.tsx) — removed duplicate notification on challenge accept (see above).
- [src/app/players/page.tsx](src/app/players/page.tsx) — removed dead `PlayerCard` component and unused import.
- [src/app/players/[username]/PlayerProfileClient.tsx](src/app/players/[username]/PlayerProfileClient.tsx) — profile header now shows a club-name chip when the viewed player belongs to a club, gated by `player.privacy.clubMembership` (`public`/`friends`/`private`) using the same visibility rule already established for Match History. Club lookup is `clubs.find(c => c.memberIds.includes(player.uid))` from `AppContext`. This is the second slice of "Enforce remaining Privacy settings" — `plannedMatches`, `friendList`, and `eventHistory` are still not displayed anywhere on the profile (not just unenforced — there's currently no UI surface for them at all, so enforcing those categories means building the display first, not just gating an existing one).
- Verified via `npx next build` (clean, no TS errors) after each change. Could not verify live in the browser this session — the app requires real Firebase auth with no headless/demo login path, consistent with prior sessions' notes.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce remaining Privacy settings (plannedMatches, friendList, eventHistory) | Match History and Club Membership are now enforced; these 3 have no display surface on the profile at all yet, so this is "build + gate" not just "gate" | Medium-Large — needs new profile sections, not just visibility checks on existing ones |
| Club chat / per-club message board | Clubs have one-way announcements only, no member discussion | Medium — new tab in Club detail view, reuse Chat's message list UI |
| Toast/snackbar for incoming friend + challenge requests | Blocked on a design call — app has no live multi-user simulation | Needs a design decision before scoping |

### Critical Alerts
None.


## [2026-07-06 18:20] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start; the only commits since the last logged session (02:47) were the DEVLOG write-up itself, so no new user work needed auditing. Picked up the long-carried-over "Enforce Privacy settings" feature idea and implemented the Match History slice of it.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟢 | Feature: enforce `privacy.matchHistory` setting | ✅ | Implemented — see below |

### Issues Found
None new — no unaudited commits since last session.

### Improvements Made
- [src/app/players/[username]/PlayerProfileClient.tsx](src/app/players/[username]/PlayerProfileClient.tsx) — Match History card and the derived Match Analytics section now respect `player.privacy.matchHistory` (`public`/`friends`/`private`) when viewed by someone other than the profile owner, checked against the `friends` list from `AppContext`. Private/friends-only profiles show an explanatory empty state instead of the match list. This is the first slice of the "Enforce Privacy settings" item carried over from prior sessions — `plannedMatches`, `friendList`, `clubMembership`, and `eventHistory` are not yet enforced anywhere (see below).
- Verified via `npx next build` (clean, no TS errors). Could not verify live in the browser this session — the app requires real Firebase auth with no headless/demo login path, consistent with prior sessions' notes.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce remaining Privacy settings (plannedMatches, friendList, clubMembership, eventHistory) | Match History is now enforced; the other 4 privacy categories still have zero effect anywhere | Medium — plannedMatches on `matches/page.tsx`, friendList/clubMembership on `players/page.tsx` and profile, eventHistory on `tournaments/page.tsx` |
| Club chat / per-club message board | Clubs have one-way announcements only, no member discussion | Medium — new tab in Club detail view, reuse Chat's message list UI |
| Toast/snackbar for incoming friend + challenge requests | Blocked on a design call — app has no live multi-user simulation | Needs a design decision before scoping |

### Critical Alerts
None.


## [2026-07-06 02:47] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start (already included the user's own new work on Events/Players filters, country/region dropdowns, Topbar branding). A background audit agent reviewed the newly-landed filter/dropdown/Topbar/SettingsModal changes and found 3 confirmed bugs, all fixed and deployed this session.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟠 | Audit `players/page.tsx`, `tournaments/page.tsx`, `leaderboard/page.tsx`, `matches/page.tsx`, `SettingsModal.tsx`, `Topbar.tsx`, `NotificationPanel.tsx` (recent user commits) | ✅ | Found 3 confirmed bugs — see below |

### Issues Found
- 🟡 [src/components/ui/FilterDropdown.tsx:24](src/components/ui/FilterDropdown.tsx) + call sites in [players/page.tsx](src/app/players/page.tsx) and [tournaments/page.tsx](src/app/tournaments/page.tsx) — `isDefault` was inferred from `value === options[0]?.value`, but the Country dropdown's `options[0]` is always `'All'` while its actual no-filter default is the user's own country, and the Region dropdown reorders the user's own region to `options[0]` whenever the selected country matches the user's home country. Result: both the Country filter (always) and the Region filter (for users with a home region set) rendered with the emerald "active filter" styling on page load, even though the user hadn't touched either filter.
- 🟢 [src/components/Topbar.tsx](src/components/Topbar.tsx) — `LocationPicker` component (~90 lines), `coordsToState` helper, `locationOpen` state, and the `MapPin`/`Navigation`/`X`/`MalaysiaState`/`MY_STATES`/`COUNTRIES`/`getCountryByName` imports were all dead code left over from a prior commit (b981a7d) that replaced the clickable location button with static "CourtConnect" branding but never removed the now-unreachable picker.
- 🟠 [src/components/SettingsModal.tsx:72](src/components/SettingsModal.tsx) — `save()` force-cast an arbitrary free-text `region` string to the `MalaysiaState` union type (`as import('@/types').MalaysiaState`) for non-Malaysia users, which would silently store invalid `MalaysiaState` values on `user.state` for any non-MY user who edits settings.

### Improvements Made
- [src/components/ui/FilterDropdown.tsx](src/components/ui/FilterDropdown.tsx) — added an explicit `defaultValue` prop so callers can declare what "no filter applied" means instead of relying on options-array ordering; wired it through in both Players and Tournaments pages (`defaultValue={userCountry}` for country, `defaultValue="All"` for region).
- [src/components/Topbar.tsx](src/components/Topbar.tsx) — removed the entire dead `LocationPicker`/`coordsToState`/`locationOpen` code path and its now-unused imports.
- [src/components/SettingsModal.tsx](src/components/SettingsModal.tsx) — for non-MY users, `state` now keeps `user.state` unchanged instead of being force-cast from the free-text region field.
- Verified via `npx next build` (clean, no TS errors). Could not verify live in the browser this session — the app requires real Firebase auth with no headless/demo login path, consistent with prior sessions' notes.

### Feature Ideas / Upcoming Plans
(Carried over from prior session, still open)
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce Privacy settings | Settings UI exists and persists but has zero effect anywhere | Medium-Large — needs a pass through `PlayerProfileClient`, `players/page.tsx`, `tournaments/page.tsx` |
| Club chat / per-club message board | Clubs have one-way announcements only, no member discussion | Medium — new tab in Club detail view, reuse Chat's message list UI |
| Toast/snackbar for incoming friend + challenge requests | Blocked on a design call — app has no live multi-user simulation | Needs a design decision before scoping |

### Critical Alerts
None.

### 📊 Daily Summary (18:00)
- Sessions run: 2
- Total fixes deployed: 4
- Build status: ✅ Healthy
- Telegram summary: ✅ Sent


> Each entry is written by the AI agent after its daily self-check session.
> Priority: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
> Status: ✅ Done · 🚧 In Progress · 📋 Planned · ❌ Skipped

---

## [2026-07-06 00:00] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start (already included the user's own `Record Live` / planned-match / privacy-settings work landed since the last auto-dev session at 20:19). Audited the newly-landed `matches/page.tsx`, `LiveMatchModal.tsx`, and `SettingsModal.tsx` changes; found and fixed a display bug in the Planned Matches card, and flagged (but did not fix) a bigger gap: the new Privacy settings UI saves preferences that are never read/enforced anywhere.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🔴 | Audit `matches/page.tsx`, `LiveMatchModal.tsx`, `SettingsModal.tsx`, `AuthGate.tsx` (recent commits since last session) | ✅ | Found 1 confirmed display bug + 1 confirmed incomplete-feature gap — see below |

### Issues Found
- 🟠 [src/app/matches/page.tsx:388](src/app/matches/page.tsx) — `PlannedCard`'s Team A slot rendering hardcoded `slots={[me, ...m.teamA.slice(1)]}`, always displaying the current user in Team A slot 0 regardless of what was actually saved. Since `PlanMatchModal`'s slot picker explicitly allows clearing/swapping slot A0 to a different player (comment: "freely clearable/swappable"), a user who reassigned themselves out of slot 0 (e.g. planning a match they're organizing for others) would see the card silently show themselves back in that slot — a display-only bug, the underlying saved data and downstream `LiveMatchModal` usage were unaffected.
- 🟠 [src/components/SettingsModal.tsx](src/components/SettingsModal.tsx) / [src/types/index.ts](src/types/index.ts) — New Privacy settings (Match History / Planned Matches / Friend List / Club Membership / Event History visibility) save a `user.privacy` object via `updateUser`, but no other file in the app reads `.privacy` — confirmed via full-codebase grep. The UI is fully functional and persists choices, but setting anything to "Friends" or "Only Me" currently has zero effect on what's actually shown on profile/leaderboard/club pages. Not fixed this session — enforcing it properly touches multiple pages (`PlayerProfileClient`, `players/page.tsx`, `tournaments/page.tsx`) and is a bigger scope than a quick fix; flagging for a dedicated session or user sign-off on which pages should respect it first.

### Improvements Made
- [src/app/matches/page.tsx](src/app/matches/page.tsx) — `PlannedCard` now passes `m.teamA` directly to `TeamSlots` instead of overriding slot 0 with the current user; label switches between "Team A (You)" and "Team A" based on whether the user is actually in that team. Verified via `npx next build` — could not verify live in the browser this session since the app's auth is real Firebase (no demo/guest login available to script through headlessly).

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Enforce Privacy settings | Settings UI exists and persists but has zero effect anywhere — misleading to users who set it expecting privacy | Medium-Large — needs a pass through `PlayerProfileClient`, `players/page.tsx` (Partner Finder/Clubs), `tournaments/page.tsx` to gate what's rendered per `privacy` level and viewer relationship (friend/stranger) |
| Club chat / per-club message board | Carried over — clubs have one-way announcements only, no member discussion | Medium — new tab in Club detail view, reuse Chat's message list UI against a club-scoped thread |
| Toast/snackbar for incoming friend + challenge requests | Carried over — still blocked on a design call: app has no live multi-user simulation to trigger an *incoming* event against | Needs a design decision before scoping |

### Critical Alerts
None.


## [2026-07-05 20:19] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start. Implemented the "Match history filter/search" feature from prior session's plan, and a background audit agent found + I fixed a real anti-cheat bypass in doubles matches.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟢 | Feature: Match history filter/search on profile pages | ✅ | Implemented per prior session's "Upcoming Plans" — see below |
| 3 | 🔴 | Audit Home/Tournaments/Chat/LogMatchModal/Topbar/AppContext (delegated) | ✅ | Found 1 confirmed bug + 1 latent bug in `LogMatchModal.tsx`'s anti-cheat logic — see below |

### Issues Found
- 🟠 [src/components/LogMatchModal.tsx:345](src/components/LogMatchModal.tsx) — `antiCheatCheck`'s max-3-per-week / max-2-per-day opponent limits only checked `opp1`, so in doubles (MD/WD/MX) a player could farm MMR against the same real opponent repeatedly by rotating which slot ("opp1" vs "opp2") they occupy each time, silently bypassing the anti-farming caps.
- 🟢 [src/components/LogMatchModal.tsx:367](src/components/LogMatchModal.tsx) — The daily-MMR-gain-cap rule only counted wins where the current user was `player1Id`, never `player2Id`. Not currently reachable (self-logged matches always set `player1Id: user.uid`), but a landmine if an opponent-initiated logging path is ever added.

### Improvements Made
- [src/app/players/[username]/PlayerProfileClient.tsx](src/app/players/[username]/PlayerProfileClient.tsx) — Added a search box (by opponent name/@username) and Result/Format filter dropdowns above the Match History list, reusing the existing `FilterDropdown` component and search-input pattern from Leaderboard. Verified via `npx next build` only — could not verify live in the browser this session because another concurrent session already had a `next dev` server holding the project's dev lock, and this project's dev script refuses to start a second instance even on a different port.
- [src/components/LogMatchModal.tsx](src/components/LogMatchModal.tsx) — `antiCheatCheck` now takes an array of opponent uids and checks match history against partner/opponent slots on both sides, closing the doubles farming bypass. Also widened the daily-MMR-cap win filter to count wins regardless of which `playerXId` slot the user occupies.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Club chat / per-club message board | Carried over — clubs have one-way announcements only, no member discussion | Medium — new tab in Club detail view, reuse Chat's message list UI against a club-scoped thread |
| Toast/snackbar for incoming friend + challenge requests | Carried over — still blocked on a design call: app has no live multi-user simulation to trigger an *incoming* event against | Needs a design decision before scoping |

### Critical Alerts
None.


<!-- ENTRIES BELOW — newest first -->

## [2026-07-05 19:03] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at session start. Audited the recently-landed Events/Clubs overhaul (unified layout, private gating, My Events filter, club hosting, localStorage persistence) via a background agent — most flagged findings turned out to be false positives on closer inspection, so no code changes were made this session.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean, no errors |
| 2 | 🔴 | Audit Events/Clubs overhaul (delegated) | ✅ | Agent flagged 2 "critical" issues; both verified false positives (see below) |
| 3 | 🟢 | Scan for no-op handlers / TODOs app-wide | ✅ | None found |

### Issues Found (verified false positives, no fix needed)
- ❌ Claimed: club-hosted tournaments never satisfy `isMyEvent()` since `organiser` is set to the club name, not `user.displayName`. **Verified false** — [src/app/tournaments/page.tsx:641](src/app/tournaments/page.tsx) always sets `hostUid: 'me'` on creation regardless of hosting club, and `isMyEvent()` (line 101-102) checks `hostUid === 'me'` first, so the host always matches.
- ❌ Claimed: Chat's `?uid=` deep-link effect is missing `convs` from its dependency array and won't fire if conversations already exist. **Verified false** — this app always navigates via full-page `window.location.href` reloads (project convention, never `router.push`), so the mount-once effect (`[]` deps) is the correct pattern; there's no client-side route transition where a stale-deps bug could manifest.
- 🟢 Noted but not actioned: `AppContext.tsx`'s `useState` initializers for `user`, `clubs`, `myClubId`, `myClubPendingIds` read `localStorage` synchronously guarded by `typeof window !== 'undefined'`. This is a long-standing pattern (present for `user.openToPlay` since earlier sessions) that can theoretically cause a hydration mismatch on the very first paint in a real SSR context. In practice this is a static-export app with no server render step the user actually sees pre-hydration, so it hasn't caused observed bugs — flagging only so a future session doesn't "rediscover" it as new.

### Improvements Made
None — audit did not surface any confirmed, actionable bug this session.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Match history filter/search on profile pages | `PlayerProfileClient` lists recent matches but has no way to filter by opponent, format, or win/loss — gets unwieldy as match count grows | Small — reuse the search/filter pattern already used in Players/Leaderboard |
| Club chat / per-club message board | Clubs have one-way announcements (owner/mod only) but no member discussion; Chat page is 1:1 only | Medium — new tab in Club detail view, reuse Chat's message list UI against a club-scoped thread |
| Toast/snackbar for incoming friend + challenge requests | Carried over three sessions now — still blocked on a design call: app has no live multi-user simulation, so there's no real trigger point for an *incoming* event to fire against while the user is active | Needs a design decision before scoping — flagging for the user rather than guessing |

### Critical Alerts
None.

### 📊 Daily Summary (18:00)
- Sessions run: 5 (00:20–00:38, 10:37–11:14 auto-dev, 11:23 quick pass, 12:08–12:41, 17:00 Events/Clubs overhaul)
- Total fixes deployed: 8+ (friend request system, new Matches page, Players page rework, Partner Finder bug fixes x2, Bo3 bracket score fix, Events/Clubs overhaul)
- Build status: ✅ Healthy (`npx next build` clean at 18:00 check)
- Telegram summary: ✅ Sent

## [2026-07-05 11:10] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was broken at session start (`Cannot find name 'FriendsTab'`) from the concurrent Players-tab refactor flagged as a critical alert last session — the user finished and committed that refactor (`3210377`) moments before this session started, so the build was already fixed and pushed by the time I checked. Audited the new `FriendsTab`/Partner Finder code and found + fixed two real bugs, plus verified everything live in the browser.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | Failed initially (`FriendsTab` undefined), but resolved itself — the user's own in-flight refactor from last session's critical alert landed and fixed it before I could touch the file |
| 2 | 🔴 | Audit refactored Players/Friends/Clubs page | ✅ | Found 2 real bugs in the new `FriendsTab` Partner Finder (see below) |
| 3 | 🟢 | Bo3 score display in tournament brackets | ✅ | Fixed — carried over from two prior sessions |
| 4 | 🟢 | Broader code audit (delegated) | ✅ | Ran a background audit agent; most other findings were minor `any`-typing/UX nitpicks not worth churn this session |

### Issues Found
- 🔴 [src/app/players/page.tsx:508](src/app/players/page.tsx) — Partner Finder's "Sent" button state was driven by a local `partnerSent` array that was never populated on send (only ever cleared on retract), so the button never flipped to "Sent" after actually sending a request via the real `onSend`/`sendFriendRequest`.
- 🔴 [src/app/players/page.tsx:646](src/app/players/page.tsx) — The Partner Finder's "Cancel Request" confirm dialog only mutated the dead local `partnerSent` state instead of calling the real `onCancel`/`cancelFriendRequest` — retracting a request from Partner Finder didn't actually cancel it in `AppContext`, leaving a phantom outgoing request.
- 🟢 [src/app/players/page.tsx:533](src/app/players/page.tsx) — A Partner Finder availability line rendered the literal text `\U0001f550` instead of a 🕐 clock emoji (Python-style unicode escape, not valid in JS/JSX).
- 🟢 [src/app/tournaments/page.tsx:825](src/app/tournaments/page.tsx) — `BracketCard` picked one arbitrary game's score fragment by row index instead of showing the full match score, silently dropping games in Bo3 matches (carried over from two prior sessions' "Upcoming Plans").

### Improvements Made
- Rewired Partner Finder's send/retract flow to use the real `outgoing` prop and `onCancel` callback instead of dead local state; verified live in the browser — sending a request now flips the button to "Sent", and retracting it correctly reverts to "Add Friend" (confirmed the underlying `outgoingFriendRequests` state actually changes, not just local UI state).
- Fixed the broken clock emoji escape in Partner Finder's availability line.
- `BracketCard` now shows the full match score (e.g. `18-21, 21-19, 21-17`) next to the winner instead of one arbitrary game fragment.
- Also had to clean up two environment snags mid-session: a leftover `next dev` process from an earlier diagnostic step was holding port 3199 and blocking the preview server restart (killed it), and a stale service worker registration in the preview browser was serving a cached pre-refactor JS bundle for `/players/` even after a hard reload (unregistered it + cleared caches) — worth knowing if a future session sees "phantom" old UI in the preview despite a clean build and correct source.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Toast/snackbar for incoming friend + challenge requests | Carried over twice now — re-evaluated this session: the app has no live multi-user simulation, so there's no real trigger point for a friend-request toast to fire against (incoming requests are just seed data present at load, not events that happen while you're active). Needs a design decision first: either simulate periodic fake incoming events, or scope the toast to actions the user themselves can trigger (e.g. their own outgoing request getting "auto-accepted" after a delay) | Needs a design call before scoping — flagging for the user rather than guessing |
| Club chat / per-club message board | Clubs currently have announcements (one-way, owner/mod only) but no member discussion; chat page is 1:1 only | Medium — new tab in Club detail view, reuse Chat's message list UI against a club-scoped thread |
| Match history filter/search on profile pages | `PlayerProfileClient` lists recent matches but has no way to filter by opponent, format, or win/loss — gets unwieldy as match count grows | Small — reuse the search/filter pattern already used in Players/Leaderboard |

### Critical Alerts
None.


## [2026-07-05 10:50] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean at the start of the session. Implemented the "Friends-aware Partner Finder" feature from last session's plan, then discovered `src/app/players/page.tsx` was being actively rewritten by a concurrent editing session live during this run — paused all further work on that file rather than risk clobbering it.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean at session start |
| 2 | 🟢 | Feature: Friends-aware Partner Finder | ✅ | Implemented per last session's "Upcoming Plans" — see below |
| 3 | 🔴 | Re-verify build before deploy | ❌ | Build now fails — see Critical Alerts. Not caused by my change; a concurrent edit landed on the same file mid-session |

### Issues Found
None newly found by audit — session was cut short by the concurrent-edit situation below before Phase 3 could proceed to other files.

### Improvements Made
- [src/app/players/page.tsx](src/app/players/page.tsx) — Implemented friends-aware Partner Finder: `PartnerFinder` now receives `friends` from `AppContext` (via `Players`), sorts candidates so accepted friends surface first, and shows a green "Friend" badge next to their name/tier. Verified live in the browser: accepted Faiz Hamdan's pending friend request, confirmed he re-sorted to the top of Partner Finder with the badge showing (had to clear the `.next` cache once — Turbopack Fast Refresh briefly served a stale module after the edit).

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Toast/snackbar for incoming friend + challenge requests | Carried over from last session — still not built | Medium — lightweight toast component + hook into `addNotif` calls |
| Bo3 score display in tournament brackets | Carried over from last session — still not built | Small — rework score parsing in `BracketCard` to map over all games |

### Critical Alerts
🔴 **Concurrent edit collision on `src/app/players/page.tsx`.** Partway through this session, the file started changing on disk independent of my own edits — a live refactor removing the standalone "Partner Finder" top-level tab in favor of a merged "Friends" tab (`TABS` narrowed to `['Players', 'Friends', 'Clubs']`, a `FriendsTab` component referenced but not yet defined, `PLAYER_SUBTABS` removed from module scope while still referenced elsewhere). I re-checked the diff twice ~20s apart and it kept growing, confirming an active editing session (not a one-shot linter pass). The build fails as of this write-up (`Cannot find name 'FriendsTab'`) — that failure is from the in-progress refactor, not from my Friends-aware Partner Finder change. Per the hard rule to never push a broken build, **I did not run any `git commit`/`git push` myself this session** and deliberately stopped touching this file so as not to overwrite whatever is mid-flight. **However:** something in this environment auto-commits and auto-pushes to `origin/main` on a timer independent of me (I watched it happen — commit `e0b1cfb "Update 2026-07-05 10:51"` landed with the broken `page.tsx` in it, and `origin/main` already matches it). That means the currently-broken build is live on `main` and Netlify's next build for it will likely fail, through no action of mine. If this was you editing live, no action needed — just finish and the next auto-push will carry a clean build. If it wasn't you, worth checking what's driving that auto-commit/auto-push loop.

## [2026-07-05 00:38] — Auto-Dev Session

**Trigger:** Scheduled (every 5 hours)
**Daily Summary:** No Telegram commands pending. Build was clean. Found and fixed a Friends feature bug that made added friends vanish on tab switch and left the Leaderboard's Friends tab totally disconnected from real friend data, plus a React Rules-of-Hooks violation on the player profile page and two smaller defensive/UX fixes.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean throughout the session |
| 2 | 🔴 | Audit Players/Leaderboard friends feature | ✅ | Friends list lived in local `useState` in `players/page.tsx`, reset every time the user left the Players tab; Leaderboard's "Friends" tab filtered against a hardcoded, unrelated seed array (`['p5','p7','p4']`) instead of the user's real friends |
| 3 | 🔴 | Audit chat/tournaments/profile/log-match/topbar (delegated) | ✅ | Found a Rules-of-Hooks violation in `PlayerProfileClient.tsx` and a possible null-deref in `LogMatchModal.tsx` submit; see below |
| 4 | 🟠 | Chat empty state | ✅ | "No conversations yet" message had no way to act on it |

### Issues Found
- 🔴 [src/app/players/page.tsx](src/app/players/page.tsx) & [src/app/leaderboard/page.tsx](src/app/leaderboard/page.tsx) — Friends were local component state (lost on tab switch) and the Leaderboard Friends tab read a hardcoded seed list unrelated to what the user actually added. Note: mid-fix, a friend *request* system (send/accept/decline/cancel/remove, `AppContext`) landed from another concurrent change — adapted the Leaderboard fix on top of that instead of the simpler toggle I'd started with.
- 🔴 [src/app/players/[username]/PlayerProfileClient.tsx:37](src/app/players/[username]/PlayerProfileClient.tsx) — `if (!staticPlayer) return notFound();` sat *before* several `useState` calls, violating the Rules of Hooks for any username not in the seed data (would throw "Rendered fewer hooks than expected" instead of a clean 404).
- 🔴 [src/components/LogMatchModal.tsx:423](src/components/LogMatchModal.tsx) — `submit()` used `mmrPreview!.gain`/`.loss` (non-null assertion) relying entirely on the disabled-button state to prevent a null call; added an explicit `if (!mmrPreview) return;` guard.
- 🟠 [src/app/chat/page.tsx:163](src/app/chat/page.tsx) — Empty conversations state was a dead-end message with no way to act; added a "Browse Players" link.

### Improvements Made
- Added `friends`/friend-request state to `AppContext` (accepted via a concurrent change) and wired the Leaderboard's Friends tab to it so adding a friend on the Players page now actually affects the Leaderboard, verified live in the browser (accepted a request from Faiz Hamdan, confirmed he appears in Leaderboard → Friends with correct rank).
- Moved all `useState` calls above the `notFound()` early return in `PlayerProfileClient.tsx`.
- Guarded `LogMatchModal.submit()` against a null `mmrPreview`.
- Gave the chat empty state a `MessageCircle` icon + "Browse Players" CTA.

### Feature Ideas / Upcoming Plans
| Feature | Why | Rough Scope |
|---|---|---|
| Friends-aware Partner Finder | Now that real friends exist, Partner Finder should badge/prioritize friends in the candidate list instead of treating everyone equally | Small — reuse `friends` from context, add a badge + sort-first in `PartnerFinder` |
| Toast/snackbar for incoming friend + challenge requests | Right now the only signal is the Topbar bell count; a real-time toast would make new requests feel alive | Medium — needs a lightweight toast component + hook into `addNotif` calls |
| Bo3 score display in tournament brackets | `BracketCard` score-splitting logic only ever shows game 1 or 2 of a match score string, silently dropping a 3rd game for best-of-3 | Small — rework the score parsing to map over all games instead of index 0/1 |

### Critical Alerts
None.

## [2026-07-04 22:15] — Auto-Dev Session

**Trigger:** Scheduled (23:00)
**Daily Summary:** No Telegram commands pending. Build was clean. Found and fixed one broken button on the Home page.

### Telegram Commands Processed
None pending.

### Agenda & Findings
| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Build health check | ✅ | `npx next build` clean, no errors |
| 2 | 🔴 | Code audit — broken functionality | ✅ | Home page "+ Log a Match" empty-state button had `onClick={() => {}}` — did nothing |
| 3 | 🟢 | Scan for other no-op handlers / TODOs | ✅ | None found elsewhere in `src/` |

### Issues Found
- 🔴 [src/app/page.tsx:327](src/app/page.tsx) — "+ Log a Match" button in the empty Recent Matches state was a no-op. Users clicking it got no feedback or modal.

### Improvements Made
- Wired the Home page's "+ Log a Match" button to open `LogMatchModal` (same modal already used by the Topbar's "Log Match" button), with local `logOpen` state. Verified in browser: clicking now opens the full match-logging flow (QR scan, opponent search, scores).

### Critical Alerts
None.


**Daily Summary:** First log entry — bootstrapping the logbook. No automated session has run yet. This entry documents the app's current state as a baseline for future daily checks.

### Current App State
- **Pages:** Home, Players, Leaderboard, Tournaments, Chat, Player Profiles
- **Auth:** localStorage-based email auth
- **State:** All in AppContext (in-memory, lost on refresh)
- **Deploy:** Netlify static export from GitHub `main`
- **PWA:** Installed, service worker active, app icons live

### Known Issues (as of today)
| # | Severity | Issue | Affects |
|---|---|---|---|
| 1 | 🔴 | Data not persisted — all state resets on page refresh | Every page |
| 2 | 🟠 | No real backend — changes only exist in current browser session | Auth, matches, clubs |
| 3 | 🟡 | Service worker may cache stale assets after deploy | PWA users |
| 4 | 🟡 | QR scan only matches seed players (UID must be in PLAYERS array) | Log Match |
| 5 | 🟢 | Avatar initials only — no photo upload | Profiles, Chat |

### Today's Agenda (no session ran — baseline only)
- [x] Create CHANGELOG.md with full history
- [x] Create DEVLOG.md (this file)
- [ ] Set up daily automated schedule

### 📊 Daily Summary (18:00)
- Sessions run: 1 (Session 4 — Tournament Overhaul, Home Redesign, QR Scan, PWA; see CHANGELOG.md)
- Total fixes deployed: 4
- Build status: ✅ Healthy
- Telegram summary: ✅ Sent

---

<!-- Template for future daily entries:

## [YYYY-MM-DD] — Daily Check-In #N

**Time Spent:** ~2 hrs
**Daily Summary:** [1–2 sentence summary of what was found + done]

### Agenda & Findings

| # | Priority | Task | Status | Finding |
|---|---|---|---|---|
| 1 | 🔴 | Check for TypeScript/build errors | ✅ | No errors |
| 2 | 🟠 | UX audit: tap targets, empty states | 🚧 | ... |
| 3 | 🟡 | Review new features for edge cases | ✅ | ... |

### Issues Found
**[Issue title]** — Severity: 🟠
- What: ...
- Where: `src/...`
- Why it matters: ...
- Fix plan: ...

### Improvements Made
- Brief description of what was changed and why

### Upcoming Plans
| Feature | ETA | Why |
|---|---|---|
| ... | ... | ... |

### Critical Alerts
> 🔴 **ALERT:** [anything the user must know about immediately]

-->
