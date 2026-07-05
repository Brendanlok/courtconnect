# CourtConnect — Daily Dev Log

> Each entry is written by the AI agent after its daily self-check session.
> Priority: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
> Status: ✅ Done · 🚧 In Progress · 📋 Planned · ❌ Skipped

---

<!-- ENTRIES BELOW — newest first -->

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
