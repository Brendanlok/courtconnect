-- Fixes a mistake in 0026: Postgres grants EXECUTE on a new function to
-- PUBLIC by default unless explicitly revoked. 0026 added an explicit
-- `grant ... to authenticated` but never revoked the default public access,
-- so that grant was redundant and the real gap (anon/PUBLIC could still
-- call both functions) stayed open. Confirmed live via curl with the anon
-- key: both functions returned `200 false` for a nonexistent row instead
-- of a permission-denied error, meaning the call itself was allowed.
--
-- These are SECURITY DEFINER functions — they run with elevated privileges
-- and bypass the RLS locked down in 0023-0025, which is exactly why an open
-- PUBLIC execute grant here mattered more than it would for an ordinary
-- function: it would have let an unauthenticated caller mutate tournament/
-- club data directly (fake registrations, membership) with no login at all.

revoke execute on function register_tournament_participant(text, text, text) from public;
revoke execute on function add_club_member_atomic(text, uuid) from public;

-- The authenticated grant from 0026 is untouched by the above (a separate
-- grant, not affected by revoking PUBLIC) — this only closes the anon gap.
