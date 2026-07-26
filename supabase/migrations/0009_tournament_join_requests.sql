-- NOT YET APPLIED — run this in the Supabase SQL editor, then update this
-- header. Written by auto-dev (2026-07-26 session), same bug class as
-- 0005 (self-service writes blocked by an actor-scoped UPDATE policy).
--
-- New column backing "Request to Join" for private tournaments
-- (see DEVLOG 2026-07-26 "real tournament persistence" entry + To-Do board):
alter table tournaments add column if not exists pending_requester_ids uuid[] not null default '{}';

-- Bundles the tournaments RLS fix already flagged in DEVLOG's 2026-07-26
-- entry (registerTournament/unregisterTournament silently no-op for any
-- non-host joiner) — the new request-to-join write hits the exact same
-- wall, so both are fixed by the same policy swap:
drop policy if exists "host update" on tournaments;
create policy "auth update" on tournaments for update using (auth.uid() is not null);
