-- Lighter online updates (Yazan 2026-11-01, group 10): phones keep asking for the match state once a second, but
-- when nothing changed since their last answer the server sends back only the clock, not the whole state.
-- The phone sends the fingerprint (md5) of the last state it got; the state is still worked out exactly as before
-- (the same function, with the same checks and the same "advance the match" steps), only the answer is smaller.
-- Old phones keep calling the state functions directly and are not affected.
create or replace function public.poll_state(fn text, m uuid, seen text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  j jsonb;
  h text;
begin
  -- Only the match state functions can be asked for, by exact name (no free text reaches the query).
  if fn not in ('dp_state', 'race_state', 'cq_state', 'wc_state', 'cc_state', 'pw_state', 'im_state', 'tmn_state') then
    raise exception 'unknown state %', fn;
  end if;
  execute format('select to_jsonb(public.%I($1))', fn) into j using m;
  if j is null or jsonb_typeof(j) <> 'object' then
    return j;
  end if;
  -- `now` is the server clock, new on every answer, so it is left out of the fingerprint.
  h := md5((j - 'now')::text);
  if seen is not null and seen = h then
    return jsonb_build_object('now', j -> 'now', 'same', true);
  end if;
  return j || jsonb_build_object('h', h);
end;
$$;

revoke all on function public.poll_state(text, uuid, text) from public, anon;
grant execute on function public.poll_state(text, uuid, text) to authenticated;

-- Check: should return true.
select exists (select 1 from pg_proc where proname = 'poll_state') as poll_state_ready;
