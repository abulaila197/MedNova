-- Epic chest odds (Yazan 2026-10-18): Rare 50, Epic 40, Legendary 10.
create or replace function public.chest_odds(kind text) returns jsonb
language sql immutable set search_path = '' as $$
  select case kind
    when 'wooden' then '{"common":70,"uncommon":24,"rare":5,"epic":1}'::jsonb
    when 'golden' then '{"common":50,"uncommon":30,"rare":14,"epic":5,"legendary":1}'::jsonb
    when 'diamond' then '{"common":30,"uncommon":32,"rare":22,"epic":12,"legendary":4}'::jsonb
    when 'epic' then '{"rare":50,"epic":40,"legendary":10}'::jsonb
  end
$$;
