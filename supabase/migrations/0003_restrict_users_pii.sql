-- The "public read" policy on users exposed every column — including email,
-- birthday, and postcode — to anyone with the anon key (i.e. publicly), not
-- just the safe leaderboard/profile fields the app actually displays for
-- other players. Lock the base table to owner-only reads and expose a public
-- view with just the non-sensitive columns for leaderboard/discovery/lookup.
drop policy if exists "public read" on users;
create policy "owner read" on users for select using (auth.uid() = uid);

create view public.users_public as
select
  uid, username, is_dummy, display_name, mmr, tier, placement_matches_played,
  global_rank, state, area, wins, losses, total_matches, bio, available,
  open_to_play, gender, discipline_mmr, looking_for_partner, preferred_formats,
  joined_at, country, country_code, region, endorsements, photo_url, is_private,
  followers_count, following_count, clip_credits, clip_badge, court_profile, privacy
from public.users;

grant select on public.users_public to anon, authenticated;
