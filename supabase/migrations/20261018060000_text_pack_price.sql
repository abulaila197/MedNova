-- Text sticker packs cut to 30 tokens (Yazan 2026-10-18). Chest packs (arcade, comic, chrome) stay unsold.
create or replace function public.style_price(item text) returns int
language sql immutable set search_path = '' as $$
  select case item
    when 'frame:normal' then 0 when 'frame:bronze' then 60 when 'frame:silver' then 150 when 'frame:gold' then 350
    when 'frame:platinum' then 700 when 'frame:stethoscope' then 500 when 'frame:helix' then 800 when 'frame:neuron' then 850
    when 'frame:pulse' then 900 when 'frame:laurel' then 1000 when 'frame:aurora' then 1100 when 'frame:nova' then 1200
    when 'title:medical_student' then 0
    when 'title:intern' then 40 when 'title:night_owl' then 40 when 'title:coffee_powered' then 40
    when 'title:resident' then 100 when 'title:differential_hunter' then 100 when 'title:ward_whisperer' then 100
    when 'title:chief_resident' then 250 when 'title:the_diagnostician' then 250 when 'title:pager_legend' then 250
    when 'title:attending' then 500 when 'title:consultant' then 500 when 'title:riddle_master' then 500
    when 'title:head_of_department' then 1000 when 'title:professor' then 1000
    when 'effect:confetti' then 80 when 'effect:trophy' then 120 when 'effect:medal' then 150 when 'effect:pulse_wave' then 200
    when 'effect:too_easy' then 250 when 'effect:mic_drop' then 300 when 'effect:flatline' then 350 when 'effect:spotlight' then 400
    when 'pack:class' then 30 when 'pack:study' then 30 when 'pack:oncall' then 30
  end
$$;
