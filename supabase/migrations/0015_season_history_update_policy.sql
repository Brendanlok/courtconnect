-- Same recurring bug class as 0005 (clubs/court_sessions) and the undocumented
-- conversations fix (see DEVLOG 2026-07-26): a table only has an INSERT policy,
-- but the actual write path is an upsert that can hit the UPDATE branch.
--
-- saveSeasonHistoryEntry() (supabaseService.ts) does:
--   supabase.from('season_history').upsert({...}, { onConflict: 'uid,season_number' })
-- explicitly expecting an update-on-conflict. season_history (0014) only has:
--   create policy "own insert" on season_history for insert with check (auth.uid() = uid);
-- No UPDATE policy exists, so any real conflict on (uid, season_number) — e.g. the
-- same user with two tabs/devices open both crossing the season boundary and both
-- calling saveSeasonHistoryEntry for the same closing season — silently fails on
-- the second write (0 rows affected, no thrown error; the call site is
-- `.catch(() => {})`).
--
-- Unlike the clubs/tournaments bug class, this one doesn't need the broad
-- "any authenticated user" widening — the correct actor for both INSERT and
-- UPDATE is always the same user (auth.uid() = uid), so the narrow policy is
-- also the precise one.

create policy "own update" on season_history for update using (auth.uid() = uid);
