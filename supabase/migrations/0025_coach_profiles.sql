-- Phase 6 (scoped 2026-08-12): a coach profile a user opts into from
-- Settings, discoverable publicly via a curated view (same pattern as
-- users_public/tournaments_public). Deliberately self-reported only — no
-- certification/verification columns, no rating/review columns, no payment
-- fields. Contact happens through the existing conversations/DM system
-- (already correctly RLS'd to participants only), so no new messaging
-- infra is needed here.

create table coach_profiles (
  user_id uuid primary key references users(uid) on delete cascade,
  bio text,
  hourly_rate numeric,
  currency text not null default 'MYR',
  specialties text[],       -- e.g. Beginners, Juniors, Doubles Strategy, Footwork
  areas text[],              -- venues/areas served, free text
  years_experience int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table coach_profiles enable row level security;

-- Owner-only on the base table — discovery goes through the curated public
-- view below (used by both the public /find-a-coach/ page and the in-app
-- one), not this table directly, so it doesn't need a broad authenticated
-- read policy the way tournaments/clubs do.
create policy "owner read" on coach_profiles for select using (auth.uid() = user_id);
create policy "owner insert" on coach_profiles for insert with check (auth.uid() = user_id);
create policy "owner update" on coach_profiles for update using (auth.uid() = user_id);
create policy "owner delete" on coach_profiles for delete using (auth.uid() = user_id);

-- Curated public view, joined with users_public for display info (name,
-- photo, state) — same anon-safe source everything else on the public site
-- already uses, no new PII exposure. Only active listings.
create view public.coach_profiles_public as
select
  cp.user_id, cp.bio, cp.hourly_rate, cp.currency, cp.specialties, cp.areas, cp.years_experience,
  u.username, u.display_name, u.photo_url, u.state
from public.coach_profiles cp
join public.users_public u on u.uid = cp.user_id
where cp.is_active = true;

grant select on public.coach_profiles_public to anon, authenticated;
