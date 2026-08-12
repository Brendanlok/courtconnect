-- 0027 revoked EXECUTE from PUBLIC but re-verifying with the anon key
-- afterward (and after a schema-cache reload) still showed the call
-- succeeding — ruling out a cache issue. Best-supported remaining
-- explanation: Supabase projects commonly set up
-- `alter default privileges in schema public grant execute on functions
-- to anon, authenticated` at project creation (outside this repo's tracked
-- migrations, so it wouldn't show up in a search here) — which grants
-- `anon` an EXPLICIT execute privilege at function-creation time, separate
-- from and unaffected by revoking the implicit PUBLIC grant.
--
-- This targets the anon role directly rather than relying on PUBLIC
-- inheritance, so it closes the gap regardless of which exact mechanism
-- granted it.

revoke execute on function register_tournament_participant(text, text, text) from anon;
revoke execute on function add_club_member_atomic(text, uuid) from anon;
