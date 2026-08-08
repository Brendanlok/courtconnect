-- NOT YET APPLIED — Lok runs this in the Supabase SQL editor (no automated
-- migration runner in this project; see every other migration in this folder).
--
-- Referral / invite tracking: who invited each new signup. Referral *count*
-- ("N friends joined via your invite") is computed on demand with a count
-- query against users_public, not a denormalized counter column — referral
-- volume is far too low right now for a counter to be worth keeping in sync
-- (see countReferrals() in supabaseService.ts).

alter table users add column if not exists referred_by uuid references users(uid) on delete set null;

-- users_public needs referred_by too — countReferrals() filters by it, and
-- RLS restricts the base `users` table to owner-only reads (see 0003), so a
-- query for "who did I refer" (rows that aren't mine) has to go through the
-- view. Re-declaring the full view rather than an incremental grant since
-- Postgres has no "add column to view" — this is 0003's view plus the one
-- new column, nothing else has touched it since.
drop view if exists public.users_public;
create view public.users_public as
select
  uid, username, is_dummy, display_name, mmr, tier, placement_matches_played,
  global_rank, state, area, wins, losses, total_matches, bio, available,
  open_to_play, gender, discipline_mmr, looking_for_partner, preferred_formats,
  joined_at, country, country_code, region, endorsements, photo_url, is_private,
  followers_count, following_count, clip_credits, clip_badge, court_profile, privacy,
  referred_by
from public.users;

grant select on public.users_public to anon, authenticated;
