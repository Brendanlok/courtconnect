-- NOT YET APPLIED — run this in the Supabase SQL editor before the
-- "who's playing this week" feature will work. It's additive-only (one new
-- table), doesn't touch any existing table.

create table availability (
  id uuid primary key default gen_random_uuid(),
  uid uuid references users(uid) on delete cascade not null,
  display_name text not null,
  username text not null,
  day date not null,
  time_label text not null,
  venue text,
  note text,
  created_at timestamptz not null default now()
);
create index on availability (day);
create index on availability (uid);

alter table availability enable row level security;

-- Public read (same as clubs/live_matches — any signed-in user browses who's
-- free to play). Insert/delete restricted to the entry's own owner. Both
-- INSERT and DELETE policies are required even though this looks like it
-- follows the same shape as every other owner-scoped table — 0006 found
-- RLS silently no-ops any operation with zero matching policies, so skipping
-- either one here would silently break posting or removing an entry.
create policy "public read" on availability for select using (true);
create policy "own insert" on availability for insert with check (auth.uid() = uid);
create policy "own delete" on availability for delete using (auth.uid() = uid);
