-- Session 4 (Yazan 2026-10-13): English bad-word check on names, and account deletion clears game logs.

-- Same list and rules as src/lib/names.ts (badwords.json); keep both in sync.
create or replace function public.name_is_clean(name text) returns boolean
language sql immutable set search_path = '' as $$
  with f as (select translate(lower(coalesce(name, '')), '013457', 'oieast') as folded)
  select not exists (select 1 from f, unnest(array['fuck','fuk','fck','shit','cunt','bitch','biatch','whore','slut','nigger','nigga','faggot','dickhead','motherf','asshole','bastard','wank','jizz','porn','pussy','cocksuck','retard','rapist','hitler','kkk','dildo','blowjob','handjob','milf','skank','twat']) w where position(w in replace(f.folded, '_', '')) > 0)
     and not exists (select 1 from f, unnest(regexp_split_to_array(f.folded, '_+')) p where p = any(array['ass','arse','dick','dicks','cock','cocks','cum','tit','tits','fag','fags','sex','sexy','horny','nude','nudes','boob','boobs','nazi','rape','hoe','hoes','prick','piss','crap','suck','balls','butt']));
$$;

-- Sign-up check: a bad name reads as unavailable even when the app check is skipped.
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select name ~ '^[A-Za-z0-9_]{3,16}$' and public.name_is_clean(name)
     and not exists (select 1 from public.profiles where username = name::extensions.citext);
$$;

-- Any insert or rename of a profile with a bad username or display name is refused.
create or replace function public.profiles_clean_names() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.name_is_clean(new.username::text) or not public.name_is_clean(new.display_name) then
    raise exception 'name not allowed' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger profiles_clean_names before insert or update of username, display_name on public.profiles
  for each row execute function public.profiles_clean_names();

-- Deleting an account (the profile row goes with the login) also clears the online game logs:
-- they now point at the profile and cascade like every other owned row.
alter table public.race_results add constraint race_results_user_fk foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.cw_claims add constraint cw_claims_user_fk foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.sa_turns add constraint sa_turns_drawer_fk foreign key (drawer) references public.profiles(id) on delete cascade;
alter table public.cq_views add constraint cq_views_user_fk foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.tmn_views add constraint tmn_views_user_fk foreign key (user_id) references public.profiles(id) on delete cascade;
