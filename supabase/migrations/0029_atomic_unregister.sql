-- Closes the tournament withdrawal race flagged in the To-Do board (found
-- during a code audit): unregisterTournament did a plain client-side
-- read-modify-write (current_players: t.currentPlayers - 1 from a possibly
-- stale snapshot), the same race register_tournament_participant (migration
-- 0026) was written to close for joins. Two concurrent withdrawals, or a
-- withdrawal racing a registration, can under/over-count current_players.
--
-- Mirrors register_tournament_participant: SELECT ... FOR UPDATE locks the
-- row for the call's duration so concurrent calls serialize instead of both
-- reading the same stale count.

create or replace function unregister_tournament_participant(
  p_tournament_id text, p_username text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_participants jsonb;
begin
  select current_players, participants into v_current, v_participants
  from tournaments where id = p_tournament_id
  for update;

  if v_current is null then
    return false; -- tournament not found
  end if;

  update tournaments
  set current_players = greatest(0, current_players - 1),
      participants = (
        select coalesce(jsonb_agg(p), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_participants, '[]'::jsonb)) p
        where p->>'username' != p_username
      )
  where id = p_tournament_id;

  return true;
end;
$$;

-- 0026 shipped with this same function type (security definer) and left the
-- default PUBLIC execute grant in place, letting anon mutate tournament data
-- with no login at all until 0027/0028 closed it after the fact (see
-- DEVLOG 2026-08-13b). Revoke public/anon up front this time instead of
-- repeating that gap.
revoke execute on function unregister_tournament_participant(text, text) from public;
revoke execute on function unregister_tournament_participant(text, text) from anon;
grant execute on function unregister_tournament_participant(text, text) to authenticated;
