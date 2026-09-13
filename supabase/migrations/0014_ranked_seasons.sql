-- Ranked seasons: a soft MMR reset every SEASON_LENGTH_DAYS (src/lib/seasons.ts)
-- so climbing never fully stalls, plus a recap of each past season's final
-- rank. No cron/server exists in this static-export app, so rollover is
-- client-triggered: each user's own client checks on load whether the
-- current season number has moved past their stored one, and if so performs
-- its own rollover (see AppContext's season-rollover effect).
--
-- Only mmr_end/tier_end are snapshotted — win/loss record for a season is
-- derived on demand from matches.played_at falling in that season's date
-- range (same "derive from existing data" pattern as the club ladder and
-- rivalry records), so there's nothing to keep in sync here.

alter table users add column if not exists season_number int not null default 1;

create table season_history (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references users(uid) on delete cascade,
  season_number int not null,
  mmr_end int not null,
  tier_end text not null,
  ended_at timestamptz not null default now(),
  unique (uid, season_number)
);

alter table season_history enable row level security;

create policy "public read" on season_history for select using (true);
create policy "own insert" on season_history for insert with check (auth.uid() = uid);
