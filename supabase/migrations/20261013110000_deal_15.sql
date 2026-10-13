-- Weekly Style deal is 15% off (Yazan 2026-10-13, was 30%).
create or replace function public.style_deal(w int default public.week_index()) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'frame', 'frame:' || (array['bronze','silver','gold','platinum','stethoscope','helix','neuron','pulse','laurel','aurora','nova'])[((w * 7) % 11 + 11) % 11 + 1],
    'title', 'title:' || (array['intern','night_owl','coffee_powered','resident','differential_hunter','ward_whisperer','chief_resident',
      'the_diagnostician','pager_legend','attending','consultant','riddle_master','head_of_department','professor'])[((w * 5) % 14 + 14) % 14 + 1],
    'off', 15)
$$;

create or replace function public.style_cost(item text) returns int
language sql stable set search_path = '' as $$
  select case when public.style_price(item) is null then null
    when item in ((public.style_deal()->>'frame'), (public.style_deal()->>'title')) then round(public.style_price(item) * 0.85)::int
    else public.style_price(item) end
$$;
