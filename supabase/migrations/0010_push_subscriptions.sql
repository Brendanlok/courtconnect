-- NOT YET APPLIED — Lok needs to run this in the Supabase SQL editor.
-- Backs real Web Push (background/closed-app notifications). Until Lok runs
-- this AND deploys the send-push Edge Function (see supabase/functions/send-push),
-- subscribeToPush() below degrades to a no-op — same graceful pattern as every
-- prior migration in this file before it's applied.

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
