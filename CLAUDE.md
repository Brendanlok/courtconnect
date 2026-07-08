@AGENTS.md

# CourtConnect

Badminton matchmaking + MMR ranking app for Malaysia. Live at Netlify, auto-deploys
on every push to `main` at https://github.com/Brendanlok/courtconnect.

# Stage: moving to real users

Build new features Firestore-first, not localStorage-first. The seed players in
`src/lib/data.ts` and the `cc_*` localStorage keys are legacy demo scaffolding —
prefer real Firebase data for anything new, and migrate old localStorage state
when touching a feature that uses it.

# Stack

- Next.js 16 App Router, `output: 'export'` (static — no server code, no API routes)
- Tailwind v4, lucide-react icons, recharts, Radix primitives in `src/components/ui/`
- Firebase: Auth + Firestore + Storage (`src/lib/firebase.ts`, `firestoreService.ts`)
- All components are client components (`'use client'`)

# Commands

- Build check (required before every deploy): `npx next build`
- Deploy: `git add -A && git commit && git push` (Netlify picks it up)
- Never deploy if the build fails.

# Conventions

- Navigation: `window.location.href = '/path/'` with trailing slash — NOT router.push,
  NOT bare paths (static export 404s without the slash).
- Dark slate theme: bg-slate-900 cards, border-slate-800, rounded-2xl, emerald-500
  accent for primary actions, amber for MMR, red tint for destructive actions.
- Global state lives in `src/context/AppContext.tsx`; add to it rather than new contexts.
- Types in `src/types/index.ts`; don't change the core data model without good reason.
- Seed/demo data in `src/lib/data.ts`.

# Gotchas

- `git push` fails intermittently on this machine (GitHub unreachable). Commits queue
  locally — always check `git log origin/main..main` at session start and push
  anything pending.
- A scheduled auto-dev agent also commits to this repo (commits named "auto-dev ..."
  or "Update <date>") and writes DEVLOG.md. Read the top DEVLOG entry at session
  start to avoid redoing or undoing its work.
- FROZEN DECISIONS live in `~/.claude/scheduled-tasks/courtconnect-auto-dev/SKILL.md`
  (BottomNav 5 links, Sidebar 6 links, no Live tab). Don't change nav without asking.
- Update DEVLOG.md (prepend entry) and CHANGELOG.md for significant feature work.
