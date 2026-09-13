-- NOT YET APPLIED — Lok runs this in the Supabase SQL editor (no automated
-- migration runner in this project; see every other migration in this folder).
--
-- Rating reliability (see src/lib/reliability.ts): a DUPR-style confidence
-- signal layered on top of the existing calibration/recalibration fields,
-- distinct from AppContext's 90-day hard reset (0019_recalibration.sql /
-- inactivityReminderSentAt) — that reset forces a dormant rating back into
-- full calibration; this flags it "stale" earlier, well before that, while
-- the number is still shown. Needs one new column: the app already computes
-- "days since last match" for the signed-in user from their own full match
-- history (AppContext's inactivity effect), but that data isn't available
-- for anyone else's profile — last_active_at makes staleness checkable for
-- OTHER players too (e.g. the skill-match badge on their profile), the same
-- way placement_matches_played already makes calibration status checkable
-- for other players without a full match-history fetch.
--
-- Written on confirm, same moment MMR/stats/placement counters update (see
-- AppContext's mmrApplyingRef effect and the local confirmMatch branch) —
-- not on submit, matching the existing "counters only move on Confirm" rule
-- (2026-08-09 fix noted in that effect's comments).

alter table users add column if not exists last_active_at timestamptz;

-- users_public needs it too — the skill-match badge and any future
-- reliability-gated feature read another player's staleness through the
-- view, same as every other cross-user field (see 0003/0021). Re-declaring
-- the full view since Postgres has no "add column to view" — this is
-- 0021_referrals.sql's view plus the one new column, nothing else has
-- changed about its own definition since.
-- CREATE OR REPLACE, not DROP + CREATE (0021's pattern): coach_profiles_public
-- (0025_coach_profiles.sql) is JOINed against users_public, so a DROP fails
-- with "cannot drop view ... because other objects depend on it" — a real
-- dependency 0021 didn't have yet. REPLACE works with no CASCADE needed
-- because the new column (last_active_at) is only appended at the end —
-- Postgres allows that on a view with dependents; it only rejects
-- reordering/removing/retyping existing output columns.
create or replace view public.users_public as
select
  uid, username, is_dummy, display_name, mmr, tier, placement_matches_played,
  global_rank, state, area, wins, losses, total_matches, bio, available,
  open_to_play, gender, discipline_mmr, looking_for_partner, preferred_formats,
  joined_at, country, country_code, region, endorsements, photo_url, is_private,
  followers_count, following_count, clip_credits, clip_badge, court_profile, privacy,
  referred_by, last_active_at
from public.users;

grant select on public.users_public to anon, authenticated;
