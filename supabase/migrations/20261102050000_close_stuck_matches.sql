-- Inspection 2026-11-02 (Yazan): a safety net that closes stuck online matches in every online mode.
-- A match is stuck when it is not done and either its room is already closed (or gone), or nobody in its room has
-- checked in for 15 minutes (a phone in a match checks in every 5 s). Such a match is marked done, and its room
-- closed. Runs every 10 minutes, and once now for the 8 stuck matches found today (21 Oct - 1 Nov).
create or replace function public.close_stuck_matches()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare n integer; v_rooms uuid[];
begin
  with stuck as (
    select m.id
    from public.matches m
    left join public.rooms r on r.id = m.room_id
    where m.phase <> 'done'
      and m.created_at < now() - interval '15 minutes'
      and (
        r.id is null
        or r.status = 'closed'
        or not exists (
          select 1 from public.room_players p
          where p.room_id = m.room_id and p.state in ('in', 'spectator')
            and p.last_ping > now() - interval '15 minutes'
        )
      )
  ), done as (
    update public.matches m set phase = 'done', ended_at = coalesce(m.ended_at, now())
    from stuck where m.id = stuck.id
    returning m.room_id
  )
  select array_agg(room_id) into v_rooms from done;
  n := coalesce(array_length(v_rooms, 1), 0);
  if n > 0 then
    update public.rooms set status = 'closed' where id = any(v_rooms) and status <> 'closed';
  end if;
  return n;
end $$;

revoke all on function public.close_stuck_matches() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'close-stuck-matches';
select cron.schedule('close-stuck-matches', '*/10 * * * *', 'select public.close_stuck_matches()');

select public.close_stuck_matches() as closed_now;
