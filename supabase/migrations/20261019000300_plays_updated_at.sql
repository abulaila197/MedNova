-- AP6: phones pull plays and play_items incrementally (src/lib/sync.ts pullSince), by a server-set updated_at.
-- plays.uploaded_at is set once on insert, so a play upserted again when it finishes would be missed; updated_at is
-- set on every insert and update by the trigger below. Existing rows get the migration time (one full pull, then
-- incremental). Apply BEFORE shipping the app build that filters on updated_at (until then its pull returns an error
-- and brings nothing down).
alter table public.plays add column if not exists updated_at timestamptz not null default now();
alter table public.play_items add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger plays_touch_updated_at before insert or update on public.plays
  for each row execute function public.touch_updated_at();
create trigger play_items_touch_updated_at before insert or update on public.play_items
  for each row execute function public.touch_updated_at();

create index if not exists plays_user_updated_idx on public.plays (user_id, updated_at);
create index if not exists play_items_user_updated_idx on public.play_items (user_id, updated_at);
