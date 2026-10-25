-- Names and safety (Yazan 2026-10-25, list #1 #2 #54): bigger bad-word list, paid name change that doubles each time,
-- and no name may look like a friend code (or the other way round).

-- Same list and rules as src/lib/names.ts (badwords.json); keep both in sync. "whole" now also holds the
-- badwords-list words picked for The Imposter (a few harmless ones like god, hell and Wang left out).
create or replace function public.name_is_clean(name text) returns boolean
language sql immutable set search_path = '' as $$
  with f as (select translate(lower(coalesce(name, '')), '013457', 'oieast') as folded)
  select not exists (select 1 from f, unnest(array['fuck','fuk','fck','shit','cunt','bitch','biatch','whore','slut','nigger','nigga','faggot','dickhead','motherf','asshole','bastard','wank','jizz','porn','pussy','cocksuck','retard','rapist','hitler','kkk','dildo','blowjob','handjob','milf','skank','twat']) w where position(w in replace(f.folded, '_', '')) > 0)
     and not exists (select 1 from f, unnest(regexp_split_to_array(f.folded, '_+')) p where p = any(array['anal','anus','arrse','arse','ass','asses','assfucker','assfukka','asshole','assholes','asswhole','ballbag','balls','ballsack','bastard','beastial','beastiality','bellend','bestial','bestiality','biatch','bitch','bitcher','bitchers','bitches','bitchin','bitching','bloody','blowjob','blowjobs','boiolas','bollock','bollok','boner','boob','boobs','booobs','boooobs','booooobs','booooooobs','breasts','buceta','bugger','bum','butt','butthole','buttmuch','buttplug','cawk','chink','cipa','clit','clitoris','clits','cnut','cock','cockface','cockhead','cockmunch','cockmuncher','cocks','cocksuck','cocksucked','cocksucker','cocksucking','cocksucks','cocksuka','cocksukka','cok','cokmuncher','coksucka','coon','crap','cum','cummer','cumming','cums','cumshot','cunilingus','cunillingus','cunnilingus','cunt','cuntlick','cuntlicker','cuntlicking','cunts','cyalis','cyberfuc','cyberfuck','cyberfucked','cyberfucker','cyberfuckers','cyberfucking','dick','dickhead','dicks','dildo','dildos','dirsa','dlck','doggin','dogging','donkeyribber','doosh','duche','dyke','ejaculate','ejaculated','ejaculates','ejaculating','ejaculatings','ejaculation','ejakulate','fag','fagging','faggitt','faggot','faggs','fagot','fagots','fags','fannyflaps','fannyfucker','fanyy','fatass','fcuk','fcuker','fcuking','feck','fecker','felching','fellate','fellatio','fingerfuck','fingerfucked','fingerfucker','fingerfuckers','fingerfucking','fingerfucks','fistfuck','fistfucked','fistfucker','fistfuckers','fistfucking','fistfuckings','fistfucks','flange','fook','fooker','fuck','fucka','fucked','fucker','fuckers','fuckhead','fuckheads','fuckin','fucking','fuckings','fuckingshitmotherfucker','fuckme','fucks','fuckwhit','fuckwit','fudgepacker','fuk','fuker','fukker','fukkin','fuks','fukwhit','fukwit','fux','gangbang','gangbanged','gangbangs','gaylord','gaysex','goatse','goddamn','goddamned','hardcoresex','heshe','hoar','hoare','hoe','hoer','hoes','homo','hore','horniest','horny','hotsex','jackoff','jap','jism','jiz','jizm','jizz','kawk','knob','knobead','knobed','knobend','knobhead','knobjocky','knobjokey','kock','kondum','kondums','kum','kummer','kumming','kums','kunilingus','labia','lusting','masochist','masterbate','masterbation','masterbations','masturbate','mofo','mothafuck','mothafucka','mothafuckas','mothafuckaz','mothafucked','mothafucker','mothafuckers','mothafuckin','mothafucking','mothafuckings','mothafucks','motherfuck','motherfucked','motherfucker','motherfuckers','motherfuckin','motherfucking','motherfuckings','motherfuckka','motherfucks','muff','mutha','muthafecker','muthafuckker','muther','mutherfucker','nazi','nigga','niggah','niggas','niggaz','nigger','niggers','nob','nobhead','nobjocky','nobjokey','nude','nudes','numbnuts','nutsack','orgasim','orgasims','orgasm','orgasms','pecker','penis','penisfucker','phonesex','phuck','phuk','phuked','phuking','phukked','phukking','phuks','phuq','pigfucker','pimpis','piss','pissed','pisser','pissers','pisses','pissflaps','pissin','pissing','pissoff','poop','porn','porno','pornography','pornos','prick','pricks','pron','pube','pusse','pussi','pussies','pussy','pussys','rape','rectum','retard','rimjaw','rimming','sadist','schlong','screwing','scroat','scrote','scrotum','semen','sex','sexy','shag','shagger','shaggin','shagging','shemale','shit','shitdick','shite','shited','shitey','shitfuck','shitfull','shithead','shiting','shitings','shits','shitted','shitter','shitters','shitting','shittings','shitty','skank','slut','sluts','smegma','smut','snatch','spac','spunk','suck','teets','teez','testical','testicle','tit','titfuck','tits','titt','tittiefucker','titties','tittyfuck','tittywank','titwank','tosser','turd','twat','twathead','twatty','twunt','twunter','vagina','viagra','vulva','wank','wanker','wanky','whoar','whore','willies','xrated','xxx']));
$$;

-- A name that reads like someone's friend code would confuse "find friends by code" and invite redeeming.
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select name ~ '^[A-Za-z0-9_]{3,16}$' and public.name_is_clean(name)
     and not exists (select 1 from public.profiles where friend_code = upper(name))
     and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.username = name::extensions.citext
          and (u.confirmed_at is not null or coalesce(u.is_anonymous, false)));
$$;

-- New friend codes also skip any taken username.
create or replace function public.new_friend_code() returns text
language plpgsql set search_path = '' as $$
declare c text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c or username = c::extensions.citext);
  end loop;
  return c;
end $$;

-- The name only changes through change_name, so the price can't be skipped.
revoke update (display_name) on public.profiles from authenticated, anon;

-- 100 tokens for the first change, then double the last one. The sign-up name is free.
create or replace function public.name_change_cost(uid uuid default auth.uid()) returns int
language sql stable security definer set search_path = '' as $$
  select (100 * power(2, least(count(*), 20)))::int from public.wallet_ledger
   where user_id = uid and kind = 'spend' and reason like 'rename:%' and (uid = auth.uid() or public.is_admin());
$$;

create or replace function public.change_name(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := trim(name); cost int; bal int;
begin
  if uid is null or coalesce((select is_anonymous from auth.users where id = uid), false) then
    return jsonb_build_object('ok', false, 'why', 'guest');
  end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then return jsonb_build_object('ok', false, 'why', 'shape'); end if;
  if not public.name_is_clean(n) then return jsonb_build_object('ok', false, 'why', 'bad'); end if;
  if exists (select 1 from public.profiles where id = uid and username = n::extensions.citext and display_name = n) then
    return jsonb_build_object('ok', false, 'why', 'same');
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if exists (select 1 from public.profiles where friend_code = upper(n))
     or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                 where p.username = n::extensions.citext and p.id <> uid
                   and (u.confirmed_at is not null or coalesce(u.is_anonymous, false))) then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;
  cost := public.name_change_cost(uid);
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  -- Free the name from a sign-up that never confirmed its email (same as handle_new_user).
  update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
   where p.username = n::extensions.citext and p.id <> uid;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost, 'rename:' || n, null, now());
  update public.profiles set username = n, display_name = n, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true, 'cost', cost, 'next', cost * 2);
end $$;

revoke execute on function public.change_name(text) from anon, public;
grant execute on function public.change_name(text) to authenticated;
grant execute on function public.name_change_cost(uuid) to authenticated;
