-- APPLIED 2026-07-26 by Lok in the Supabase SQL editor.
-- Backs real Web Push (background/closed-app notifications). Still needs the
-- send-push Edge Function deployed (see supabase/functions/send-push) before
-- an actual push message can go out — subscribeToPush() below already works
-- against this table, but nothing sends the notification until that's live.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(uid) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Owner-only, same shape as notifications: a user's own push endpoints are
-- theirs to add/read/remove. The send-push Edge Function reads across all
-- rows using the service-role key, which bypasses RLS by design.
create policy "push subscriptions owner only" on push_subscriptions for all using (auth.uid() = user_id);

-- The `notifications` table already existed (from the original Firebase-era
-- schema) but nothing ever wrote to it — every notification in this app is
-- computed client-side from realtime subscriptions, which only run while the
-- recipient's own tab happens to be open. That means a closed app never
-- learns "you got a message" at all, so there's nothing for a push webhook to
-- fire on. Fix: sendSharedMessage/sendChallengeDoc now also insert a real
-- notifications row for the recipient at write time (see supabaseService.ts).
-- That needs the SENDER to be able to insert a row addressed to someone else,
-- which the existing owner-only policy blocks (auth.uid() = user_id) — same
-- "any signed-in insert" shape already used for venues.
create policy "any signed-in insert" on notifications for insert with check (auth.uid() is not null);
