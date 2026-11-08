-- Nova Password: the referee's copy of the 1,000-term bank (names and forbidden words for the clue check). The
-- nova-password edge function fills it once from src/games/password/data/terms.json at a pinned commit, then reads it.
create table if not exists public.pw_terms (
  id text primary key,
  name text not null,
  bank text not null,
  category text not null,
  forbidden text[] not null
);
alter table public.pw_terms enable row level security;
-- No policies: only the referee (service role) reads it.
