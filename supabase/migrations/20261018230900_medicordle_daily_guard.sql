-- DEF-057: the Medicordle daily word pays its EXP at most once per style and day, and never for a day ahead of the
-- server's date (moving the phone clock forward opened a new paid daily each time). The day comes from the play's
-- item (play_items.game_data.day, days since 2026-10-01 by the phone's local date, uploaded before the ledger).
-- A trigger instead of a wallet_sync change, so it stacks with any other wallet_sync fix: a refused daily row is
-- still stored (the phone stops resending it) but with 0 EXP and a note.
create or replace function public.wallet_medicordle_daily_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  p public.plays;
  d int;
  today int := ((now() at time zone 'utc')::date - date '2026-10-01');
begin
  if new.kind <> 'exp' or coalesce(new.exp, 0) <= 0 or new.play_id is null then return new; end if;
  select * into p from public.plays where id = new.play_id;
  if not found or p.game <> 'nova-medicordle' or p.mode <> 'solo' or p.settings->>'word' is distinct from 'daily' then return new; end if;
  select (pi.game_data->>'day')::int into d from public.play_items pi
   where pi.play_id = p.id and pi.game_data ? 'day' and pi.game_data->>'day' ~ '^-?[0-9]+$' limit 1;
  if d is null then return new; end if; -- no day on record (older app): nothing to judge
  -- Local dates run at most one day ahead of UTC (UTC+14).
  if d > today + 1 or exists (
    select 1 from public.wallet_ledger w
      join public.plays q on q.id = w.play_id
      join public.play_items qi on qi.play_id = q.id
     where w.user_id = new.user_id and w.kind = 'exp' and w.exp > 0 and w.id <> new.id
       and q.game = 'nova-medicordle' and q.mode = 'solo' and q.settings->>'word' = 'daily'
       and coalesce(q.settings->>'style', 'classic') = coalesce(p.settings->>'style', 'classic')
       and qi.game_data->>'day' = d::text) then
    new.exp := 0;
    new.note := 'medicordle daily: day already paid or ahead of the server date';
  end if;
  return new;
end $function$;

create trigger wallet_medicordle_daily_guard
  before insert on public.wallet_ledger
  for each row execute function public.wallet_medicordle_daily_guard();
