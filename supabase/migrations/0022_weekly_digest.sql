-- NOT YET APPLIED — Lok runs this in the Supabase SQL editor (no automated
-- migration runner in this project; see every other migration in this folder).

alter table users add column if not exists weekly_digest_sent_at timestamptz;
