-- Closes the tournament/club overbooking race flagged in the To-Do board
-- ("Tournament/club registration capacity race not fully closed", found
-- during a code audit, commit bf963b2 narrowed but didn't close it).
--
-- registerForTournament/approveTournamentRequest/addClubMember all did a
-- plain select-then-update from the client: read current_players/member
-- count, check it against the cap in JS, then write. Two concurrent
-- requests can both read the same (not-yet-full) count before either
-- writes, so both pass the check and both write — the cap gets exceeded.
--
-- Fix: a Postgres function per resource that does the whole
-- check-then-write inside one transaction, using `SELECT ... FOR UPDATE`
-- to lock the row for the duration of the call — a second concurrent call
-- against the same row blocks until the first one's transaction finishes,
-- so it sees the already-updated count and correctly fails if that filled
-- the last slot. This can't be done as a single client-side `.update()`
-- because PostgREST's query builder has no way to express "set column =
-- column + 1, guarded by column < cap" as one atomic write.
--
-- Scope: only the count/capacity race described above. addClubMember's
-- separate tier-based "how many other clubs is this uid already in" check
-- stays as a plain pre-check in supabaseService.ts, unchanged — a race
-- there needs the same user to submit near-simultaneous join requests to
-- different clubs, a much narrower case than concurrent registration for
-- the same event, and not what was found/flagged.

create or replace function register_tournament_participant(
  p_tournament_id text, p_display_name text, p_username text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_max int;
begin
  select current_players, max_players into v_current, v_max
  from tournaments where id = p_tournament_id
  for update;

  if v_current is null then
    return false; -- tournament not found
  end if;
  if v_current >= v_max then
    return false; -- full
  end if;

  update tournaments
  set current_players = current_players + 1,
      participants = coalesce(participants, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('displayName', p_display_name, 'username', p_username))
  where id = p_tournament_id;

  return true;
end;
$$;

grant execute on function register_tournament_participant(text, text, text) to authenticated;

create or replace function add_club_member_atomic(p_club_id text, p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_ids uuid[];
  v_max_members int;
begin
  select member_ids, max_members into v_member_ids, v_max_members
  from clubs where id = p_club_id
  for update;

  if v_member_ids is null then
    return false; -- club not found
  end if;
  if p_uid = any(v_member_ids) then
    return true; -- already a member — idempotent, matches prior addClubMember behavior
  end if;
  if array_length(v_member_ids, 1) is not null and array_length(v_member_ids, 1) >= v_max_members then
    return false; -- full
  end if;

  update clubs
  set member_ids = array_append(member_ids, p_uid),
      pending_ids = array_remove(pending_ids, p_uid)
  where id = p_club_id;

  return true;
end;
$$;

grant execute on function add_club_member_atomic(text, uuid) to authenticated;
