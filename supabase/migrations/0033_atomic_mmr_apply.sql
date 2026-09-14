-- Closes a real-money-line race in markMatchMmrApplied (supabaseService.ts):
-- when a match is Confirmed, both participants' clients react to the same
-- realtime event and each call markMatchMmrApplied(id, theirOwnUid) at
-- roughly the same time. The old client-side version did a plain
-- select-then-update of the live_stats.mmrAppliedBy array with no locking —
-- two concurrent calls can both read the array before either writes, so
-- whichever write lands second silently overwrites the first, dropping the
-- other player's uid from mmrAppliedBy. That player's client then sees
-- their own uid still missing on the next render/reload and re-applies
-- their MMR delta a second time (see the mmrApplyingRef effect in
-- AppContext.tsx, which relies on mmrAppliedBy as the durable "already
-- applied" guard). Same overbooking-race class as 0026/0029, same fix
-- shape: one Postgres function doing the whole read-check-write inside a
-- transaction with `SELECT ... FOR UPDATE` so concurrent calls serialize.

create or replace function mark_match_mmr_applied(p_match_id text, p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_extra jsonb;
  v_applied jsonb;
begin
  if auth.uid() is distinct from p_uid then
    raise exception 'uid mismatch';
  end if;

  select live_stats into v_extra from matches where id = p_match_id for update;

  if v_extra is null then
    v_extra := jsonb_build_object('reporterUid', p_uid::text, 'mmrAppliedBy', jsonb_build_array(p_uid::text));
  else
    v_applied := coalesce(v_extra->'mmrAppliedBy', '[]'::jsonb);
    if not (v_applied ? p_uid::text) then
      v_extra := jsonb_set(v_extra, '{mmrAppliedBy}', v_applied || jsonb_build_array(p_uid::text));
    end if;
  end if;

  update matches set live_stats = v_extra where id = p_match_id;
end;
$$;

-- Same lockdown as 0027/0028: revoke the default PUBLIC/anon execute grants
-- explicitly, only `authenticated` may call a SECURITY DEFINER function
-- that bypasses RLS.
grant execute on function mark_match_mmr_applied(text, uuid) to authenticated;
revoke execute on function mark_match_mmr_applied(text, uuid) from public;
revoke execute on function mark_match_mmr_applied(text, uuid) from anon;
