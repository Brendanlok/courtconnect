-- NOT YET APPLIED — Lok runs this in the Supabase SQL editor (no automated
-- migration runner in this project; see every other migration in this folder).
--
-- Home venue: the signup quiz's "Where do you play?" step now optionally
-- captures the court a player usually plays at (free text, via the same
-- VenueInput autocomplete used elsewhere), on top of country + region.
-- Region alone is a weak matchmaking signal in a dense metro (everyone in
-- KL is "Selangor"); the home venue is the first venue-level signal on the
-- profile. Nullable, no backfill — existing accounts just have none until
-- they set one in Settings > Location.

alter table users add column if not exists home_venue text;

-- users_public needs it too so it shows on OTHER players' profiles, same as
-- every other cross-user field. CREATE OR REPLACE with the new column
-- appended at the end (Postgres allows that on a view with dependents —
-- coach_profiles_public JOINs this — as long as existing output columns
-- aren't reordered/removed/retyped). This is 0031_reliability.sql's view
-- plus home_venue, nothing else changed.
create or replace view public.users_public as
select
  uid, username, is_dummy, display_name, mmr, tier, placement_matches_played,
  global_rank, state, area, wins, losses, total_matches, bio, available,
  open_to_play, gender, discipline_mmr, looking_for_partner, preferred_formats,
  joined_at, country, country_code, region, endorsements, photo_url, is_private,
  followers_count, following_count, clip_credits, clip_badge, court_profile, privacy,
  referred_by, last_active_at, home_venue
from public.users;

grant select on public.users_public to anon, authenticated;
