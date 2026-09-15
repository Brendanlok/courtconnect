-- APPLIED (confirmed 2026-09-15 via a live REST probe on the new users
-- columns — header never updated when Lok ran it, same stale pattern as 0008).

alter table users add column if not exists recalibration_matches_played int;
alter table users add column if not exists last_recalibration_at timestamptz;
