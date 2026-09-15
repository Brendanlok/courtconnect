-- APPLIED (confirmed 2026-09-15 via a live REST probe on the new users
-- column — header never updated when Lok ran it, same stale pattern as 0008).

alter table users add column if not exists inactivity_reminder_sent_at timestamptz;
