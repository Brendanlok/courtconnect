-- The original "public read" policies (0001_init.sql) on matches, tournaments,
-- clubs, club_messages, and live_matches were all `using (true)` with no role
-- restriction — readable by the anon key, not just signed-in users. Same bug
-- class 0003_restrict_users_pii.sql already fixed for `users` (which had the
-- identical wide-open policy, exposing PII), just never applied here.
--
-- Found 2026-08-12 while scoping a public tournament-directory page: matches
-- exposed every match ever played (both players' real uids); tournaments
-- exposed the full participants list + pending join requests + host uid;
-- clubs exposed the full club list; club_messages exposed actual chat
-- content; live_matches exposed in-progress live scoring sessions. None of
-- this needs to be — or ever was intended to be — readable without signing
-- in first.
--
-- Fix: require auth.uid() is not null (blocks anon, changes nothing for any
-- signed-in user — verified every current query already only ever reads
-- these tables while authenticated, see supabaseService.ts). All five tables
-- get the same broad any-authenticated-user gate, not per-row ownership —
-- real features genuinely need cross-user reads: browsing tournaments to
-- join, discovering clubs, joining a live match by code, reading a club's
-- chat, and (the one that ruled out a stricter "participant only" policy on
-- matches) subscribeMatchesAmong() reads OTHER club members' matches against
-- each other to compute the club ladder — not just the current user's own.
--
-- NOT fixed here (separate, bigger change, flagged not guessed): club_messages
-- is still readable by ANY authenticated user for ANY club, not just members —
-- there's no membership check in the policy. Tightening that needs an actual
-- membership-lookup policy (checking clubs.member_ids), which is a real
-- redesign of that table's RLS, not a one-line role gate like this migration.

drop policy if exists "public read" on matches;
create policy "auth read" on matches for select using (auth.uid() is not null);

drop policy if exists "public read" on tournaments;
create policy "auth read" on tournaments for select using (auth.uid() is not null);

drop policy if exists "public read" on clubs;
create policy "auth read" on clubs for select using (auth.uid() is not null);

drop policy if exists "public read" on club_messages;
create policy "auth read" on club_messages for select using (auth.uid() is not null);

drop policy if exists "public read" on live_matches;
create policy "auth read" on live_matches for select using (auth.uid() is not null);

-- Curated public view for the Events directory (courtconnect.github.io/rankings-
-- style public page) — same pattern as users_public. Only non-private
-- tournaments, only the fields a public listing actually needs: no
-- participants (real names), no pending_requester_ids, no host_uid, no
-- bracket (contains usernames). is_private itself isn't exposed either —
-- filtered into the view's WHERE clause instead of trusting every future
-- caller to filter it client-side.
create view public.tournaments_public as
select
  id, country, name, type, status, prize_pool, entry_fee, min_mmr, max_mmr,
  max_players, current_players, state, venue, date, time, tags, description,
  organiser, champion_username, champion_display_name
from public.tournaments
where is_dummy is not true and (is_private is null or is_private = false);

grant select on public.tournaments_public to anon, authenticated;
