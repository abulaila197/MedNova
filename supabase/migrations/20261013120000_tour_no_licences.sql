-- "Get to Know MedNova" no longer asks for the Licences page (Yazan 2026-10-13): 17 pages.
create or replace function public.tour_steps() returns text[]
language sql immutable set search_path = '' as $$
  select array['learn','shelf','newcase','community','wallpapers','profile','friends','leaderboard','achievements',
    'rounds','cards','store','style','faq','about','contact','privacy']
$$;
