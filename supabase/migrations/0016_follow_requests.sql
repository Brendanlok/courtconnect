-- NOT YET APPLIED — Lok needs to run this in the Supabase SQL editor.
--
-- The `friends` table has existed since 0001_init.sql with an "owner only"
-- RLS policy (auth.uid() = user_id, covering select/insert/update/delete on
-- your own rows) — but nothing ever wrote to it. followPlayer/unfollowPlayer
-- (AppContext.tsx) only ever touched localStorage, so following a real
-- account never synced across devices or actually notified them. See DEVLOG
-- 2026-08-02/2026-08-03.
--
-- Following a PUBLIC real account already works with zero schema change (the
-- existing 0001 policy covers insert/delete of your own row). This migration
-- adds what's still missing:
--   1. status column, so following a PRIVATE account creates a 'pending' row
--      instead of an immediate follow — matching the existing isPrivate /
--      "Only approved followers" promise in Settings > Privacy.
--   2. two new policies so the TARGET of a request (not just the requester)
--      can see it and accept/decline it — the original policy only ever let
--      the row's creator (user_id) touch it.
--   3. a trigger to keep users.followers_count/following_count (existing
--      columns, never incremented by anything) in sync, so public counts on
--      a profile stay a cheap column read instead of exposing the full
--      relationship graph via a public-read policy.

alter table friends add column if not exists status text not null default 'accepted' check (status in ('pending', 'accepted'));

-- Let the target of a follow/request see it (original policy only covered
-- rows where auth.uid() = user_id, i.e. what YOU sent — not what's aimed at YOU).
create policy "see incoming follows" on friends for select using (auth.uid() = friend_id);

-- Let the target accept a pending request (flip status) or decline/remove it
-- (delete) — same two actions a private account needs to manage its inbox.
create policy "target can accept" on friends for update using (auth.uid() = friend_id) with check (auth.uid() = friend_id);
create policy "target can decline" on friends for delete using (auth.uid() = friend_id);

create or replace function friends_update_counts() returns trigger as $$
begin
  if (tg_op = 'INSERT' and new.status = 'accepted') then
    update users set following_count = coalesce(following_count, 0) + 1 where uid = new.user_id;
    update users set followers_count = coalesce(followers_count, 0) + 1 where uid = new.friend_id;
  elsif (tg_op = 'DELETE' and old.status = 'accepted') then
    update users set following_count = greatest(coalesce(following_count, 0) - 1, 0) where uid = old.user_id;
    update users set followers_count = greatest(coalesce(followers_count, 0) - 1, 0) where uid = old.friend_id;
  elsif (tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted') then
    update users set following_count = coalesce(following_count, 0) + 1 where uid = new.user_id;
    update users set followers_count = coalesce(followers_count, 0) + 1 where uid = new.friend_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger friends_counts_trigger
after insert or update or delete on friends
for each row execute function friends_update_counts();
