-- A custom case's diagnosis is picked from the game's answer list, so it can be played like a Diagnostic Pursuit case.
alter table public.custom_cases add column if not exists answer_id text;

create or replace function public.save_case(c jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(trim(coalesce(c->>'diagnosis', ''))) < 2 or length(trim(coalesce(c->>'presentation', ''))) < 10 then raise exception 'missing'; end if;
  if (select count(*) from public.custom_cases x where x.user_id = uid and x.created_at > now() - interval '1 day') >= 20 then raise exception 'too many'; end if;
  insert into public.custom_cases (user_id, diagnosis, answer_id, field, gender, age, presentation, history, exam, investigation, findings)
  values (uid, left(trim(c->>'diagnosis'), 120), nullif(left(trim(coalesce(c->>'answer_id', '')), 120), ''), nullif(left(trim(coalesce(c->>'field', '')), 40), ''), c->>'gender', (c->>'age')::int,
          left(trim(c->>'presentation'), 1500), left(trim(coalesce(c->>'history', '')), 600), left(trim(coalesce(c->>'exam', '')), 600),
          left(trim(coalesce(c->>'investigation', '')), 600),
          coalesce((select array_agg(left(trim(x), 300)) from jsonb_array_elements_text(coalesce(c->'findings', '[]'::jsonb)) x where trim(x) <> ''), '{}'))
  returning id into rid;
  return rid;
end $$;

-- Playing your own case is practice: it never counts toward the hunt or achievements.
create or replace function public.hunt_progress(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with fin as (select game, mode, standings from public.plays where user_id = uid and status = 'finished' and not (settings ? 'custom')),
  days as (select (substr(reason, 5))::date d from public.wallet_ledger where user_id = uid and kind = 'daily' and reason like 'day:%'),
  runs as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from (select distinct d from days) x) y group by g),
  multi as (select g, m from (values
      ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g)
      cross join (values ('offline'),('online')) b(m)
    union all values ('the-conqueror','online'), ('trust-me-not','online')),
  solo as (select g from (values ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(distinct game) from fin), 10),
    'atlas', jsonb_build_array(coalesce((select max(n) from runs), 0), 7),
    'nova', jsonb_build_array((select count(distinct reason) from public.wallet_ledger where user_id = uid and reason in
       ('free:tiktok','free:instagram','free:facebook','free:youtube','free:channel','free:community','free:listing','free:feedback',
        'free:story:0','free:story:1','free:story:2','free:story:3','free:story:4')), 13),
    'pip', jsonb_build_array((select count(*) from fin where mode = 'online'), 50),
    'yara', jsonb_build_array(coalesce((select count(*) from public.player_progress pp, jsonb_object_keys(coalesce(pp.value->'done', '{}'::jsonb))
       where pp.user_id = uid and pp.key = 'learn:review'), 0), 100),
    'yazan', jsonb_build_array((select count(*) from public.friendships where status = 'accepted' and uid in (user_a, user_b)), 10),
    'layla', jsonb_build_array(
       (select count(*) from multi where exists (select 1 from fin where fin.game = multi.g and fin.mode = multi.m
          and jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb))
     + (select count(*) from solo where exists (select 1 from fin where fin.game = solo.g and fin.mode = 'solo')), 26),
    'omar', jsonb_build_array((select count(*) from fin), 300)
  );
$$;
revoke all on function public.hunt_progress(uuid) from public, anon, authenticated;
