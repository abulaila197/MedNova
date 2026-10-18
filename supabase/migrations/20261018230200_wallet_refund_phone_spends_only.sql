-- S3: wallet_sync accepted a 'refund' of ANY own 'spend' row, including the final server purchases
-- written by style_buy / token_spend (style items, gifts, glow, booster, second chance; ids 's' + uuid).
-- A crafted call refunded them while the item stayed owned: unlimited free tokens.
-- Now only a phone-made spend (the -1..-10 rows wallet_sync itself accepts; phone ids are never 's...')
-- can be refunded, and a phone 'spend' may not use the server's 's' id space.
-- Everything else is unchanged from the live definition.
create or replace function public.wallet_sync(entries jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  e jsonb;
  p public.plays;
  sp public.wallet_ledger;
  refused text[] := '{}';
  ok boolean;
  at_ timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  for e in select * from jsonb_array_elements(coalesce(entries, '[]'::jsonb)) loop
    ok := false;
    if exists (select 1 from public.wallet_ledger where id = e->>'id') then
      continue;
    end if;
    at_ := least(now(), greatest(now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
    if e->>'kind' = 'exp' then
      select * into p from public.plays where id = e->>'play_id' and user_id = uid and status = 'finished';
      ok := found
        and (e->>'exp')::int between 0 and public.wallet_exp_cap(p.game, p.mode, p.settings)
        and (e->>'exp')::int <= p.exp_earned
        and coalesce((e->>'tokens')::int, 0) = 0
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'exp' and play_id = p.id)
        and (select count(*) from public.wallet_ledger w where w.user_id = uid and w.kind = 'exp'
               and w.at >= date_trunc('day', at_) and w.at < date_trunc('day', at_) + interval '1 day') < 60;
    elsif e->>'kind' = 'spend' then
      ok := (e->>'tokens')::int between -10 and -1 and coalesce((e->>'exp')::int, 0) = 0
        and e->>'id' not like 's%';
    elsif e->>'kind' = 'refund' then
      select * into sp from public.wallet_ledger where id = e->>'reason' and user_id = uid and kind = 'spend';
      ok := found and (e->>'tokens')::int = -sp.tokens
        -- Only phone spends can be undone; server purchases (style_buy, token_spend) are final.
        and sp.id not like 's%' and sp.tokens between -10 and -1
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'refund' and reason = sp.id);
    end if;
    if ok then
      insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, play_id, at)
      values (e->>'id', uid, e->>'kind', coalesce((e->>'exp')::int, 0), coalesce((e->>'tokens')::int, 0),
              coalesce(e->>'reason', ''), e->>'play_id', at_);
    else
      refused := refused || (e->>'id');
    end if;
  end loop;
  return jsonb_build_object('refused', to_jsonb(refused));
end $function$;
