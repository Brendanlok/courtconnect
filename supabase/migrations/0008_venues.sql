-- NOT YET APPLIED — Lok needs to run this in the Supabase SQL editor.
-- Until then, subscribeVenues degrades to an empty list (see supabaseService.ts),
-- same graceful-no-op pattern as 0007_availability.sql before it was applied.

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  added_by uuid references users(uid) on delete set null,
  created_at timestamptz not null default now()
);
create index on venues (state);

alter table venues enable row level security;

-- Public read (shared directory, same as clubs/availability). Any signed-in
-- user can add a venue — no owner-scoped update/delete: this is a shared,
-- permanent resource, not a personal post, so unlike availability there's no
-- "own delete" policy. added_by uses ON DELETE SET NULL (not CASCADE like
-- availability.uid) so a venue survives its adder's account being deleted.
create policy "public read" on venues for select using (true);
create policy "any signed-in insert" on venues for insert with check (auth.uid() is not null);
