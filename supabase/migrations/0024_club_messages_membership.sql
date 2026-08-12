-- Follow-up to 0023: that migration closed the anon-read hole on
-- club_messages (blocked the public key entirely) but left it readable by
-- ANY authenticated CourtConnect user for ANY club, not just members of that
-- club — there was never a membership check on the SELECT policy, only on
-- INSERT ("member insert", 0001_init.sql). Flagged separately at the time
-- since it needed its own real membership-lookup policy, not a one-line
-- role gate.
--
-- The app itself already treats this as member-only: ClubDetailClient only
-- fetches/subscribes to club_messages when `isMember` is true (client-side
-- check against club.memberIds) — this migration makes the database enforce
-- what the client already assumes, closing the gap where a signed-in user
-- could bypass the UI and query another club's chat directly via the API.
--
-- Mirrors the exact membership-check pattern the existing "member insert"
-- policy already uses (same subquery shape, just for select) — not a new
-- pattern invented for this fix.

drop policy if exists "auth read" on club_messages;
create policy "member read" on club_messages for select
  using (auth.uid() in (select unnest(member_ids) from clubs where id = club_id));
