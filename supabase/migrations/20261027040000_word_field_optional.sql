-- Add a word (Yazan 2026-10-27): the field (Silent Artist) and the category (Imposter) are typed by the player
-- and optional; an empty one is saved as ''.

create or replace function public.word_clean(game text, w jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare t text := left(trim(coalesce(w->>'name', '')), 80); x jsonb; n int;
begin
  case game
  when 'the-silent-artist' then
    if length(t) < 2 then raise exception 'missing'; end if;
    x := jsonb_build_object('name', t, 'field', left(trim(coalesce(w->>'field', '')), 40),
      'aliases', coalesce((select jsonb_agg(left(trim(a), 60)) from (select a from jsonb_array_elements_text(coalesce(w->'aliases', '[]')) a where trim(a) <> '' limit 2) z), '[]'));
  when 'nova-medicordle' then
    t := upper(regexp_replace(coalesce(w->>'word', ''), '[^A-Za-z]', '', 'g'));
    if length(t) not between 6 and 15 or length(trim(coalesce(w->>'definition', ''))) < 5 then raise exception 'missing'; end if;
    x := jsonb_build_object('word', t, 'definition', left(trim(w->>'definition'), 200));
  when 'the-streak-master' then
    n := jsonb_array_length(coalesce(w->'choices', '[]'));
    if length(trim(coalesce(w->>'stem', ''))) < 10 or n not between 4 and 6
       or exists (select 1 from jsonb_array_elements_text(w->'choices') c where trim(c) = '')
       or coalesce((w->>'answer')::int, -1) not between 0 and n - 1 then raise exception 'missing'; end if;
    x := jsonb_build_object('stem', left(trim(w->>'stem'), 400), 'answer', (w->>'answer')::int,
      'choices', (select jsonb_agg(left(trim(c), 120)) from jsonb_array_elements_text(w->'choices') c));
  when 'imposter' then
    if length(trim(coalesce(w->>'a', ''))) < 2 or length(trim(coalesce(w->>'b', ''))) < 2
       or lower(trim(w->>'a')) = lower(trim(w->>'b')) then raise exception 'missing'; end if;
    x := jsonb_build_object('a', left(trim(w->>'a'), 80), 'b', left(trim(w->>'b'), 80), 'category', left(trim(coalesce(w->>'category', '')), 40));
  when 'nova-password' then
    if length(t) < 2 or (select count(*) from jsonb_array_elements_text(coalesce(w->'forbidden', '[]')) f where trim(f) <> '') <> 5 then raise exception 'missing'; end if;
    x := jsonb_build_object('name', t, 'forbidden', (select jsonb_agg(left(lower(trim(f)), 40)) from jsonb_array_elements_text(w->'forbidden') f where trim(f) <> ''));
  else raise exception 'game';
  end case;
  return x;
end $$;
