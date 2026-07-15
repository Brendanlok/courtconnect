-- APPLIED 2026-07-15 by Lok — confirmed live via `select tablename,
-- policyname from pg_policies where cmd = 'DELETE'`, all 6 rows present.
--
-- CRITICAL: zero DELETE policies exist anywhere in this schema (confirmed
-- by grepping every migration for "for delete" — none). RLS defaults to
-- deny when no permissive policy exists for an operation, even with other
-- policies (select/insert/update) already in place on the same table. Every
-- real .delete() call in the app is silently a no-op:
--
-- - deleteAccountData() (supabaseService.ts) deletes from planned_matches,
--   tournament_registrations, friends, and finally users — NONE of it
--   actually happens. A user who deletes their account today keeps every
--   row in the database. This is a real privacy/compliance gap, not just a
--   UX bug — "delete my account" should actually delete data.
-- - unregisterTournament() deletes from tournament_registrations — doesn't
--   happen, so a "cancelled" registration still exists server-side even
--   though loadTournamentRegs (wired up earlier today) would still show it
--   as registered on the next reload, silently undoing the unregister.
-- - disbandClub() deletes the clubs row — doesn't happen, so a "disbanded"
--   club still exists and still shows up everywhere (public read is `using
--   (true)`) even for the admin who just tried to remove it.
-- - setEndorsementDoc() (every single endorsePlayer call, not just
--   unendorsing) does delete-then-reinsert to replace a skill set — the
--   delete step silently fails, so old endorsement rows never clear out and
--   just keep accumulating alongside new ones each time someone re-endorses
--   the same player, inflating endorsement counts over time.
--
-- Unlike the clubs/court_sessions UPDATE bug (0005), there's no broad-vs-
-- precise tradeoff to weigh here — each policy below is scoped to exactly
-- who the app already intends to allow deleting that row (the row's own
-- owner, or the club admin). Safe to run as one block.

create policy "own delete" on users for delete using (auth.uid() = uid);
create policy "own delete" on planned_matches for delete using (auth.uid() = host_uid);
create policy "own delete" on tournament_registrations for delete using (auth.uid() = user_id);
create policy "own delete" on endorsements for delete using (auth.uid() = from_uid);
create policy "admin delete" on clubs for delete using (auth.uid() = admin_id);
create policy "own delete" on friends for delete using (auth.uid() = user_id); -- table is unused by app code as of today, harmless to include
