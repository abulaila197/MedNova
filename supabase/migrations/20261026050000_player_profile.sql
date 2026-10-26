-- Profile sheet for every player (Yazan 2026-10-26, pick B): friend_profile now opens for anyone you haven't blocked
-- (and who hasn't blocked you), from Find, room seats and the leaderboard. Tokens, friends-since and last seen stay
-- friends-only. `relation` says friend / incoming / outgoing / none so the sheet shows Challenge or Add friend.
create or replace function public.friend_profile(other uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind not in ('exp','convert')), 0) rest
    from public.wallet_ledger where user_id = friend_profile.other
  ), f as (
    select (select case when fr.status = 'accepted' then 'friend' when fr.requester = auth.uid() then 'outgoing' else 'incoming' end
              from public.friendships fr where fr.user_a = least(auth.uid(), friend_profile.other) and fr.user_b = greatest(auth.uid(), friend_profile.other)
               and fr.status <> 'none') rel,
           public.are_friends(auth.uid(), friend_profile.other) fr
  )
  select jsonb_build_object(
    'id', p.id, 'username', p.username::text, 'display_name', p.display_name, 'avatar', p.avatar,
    'relation', case when f.fr then 'friend' else coalesce(nullif(f.rel, 'friend'), 'none') end,
    'last_seen', case when f.fr then p.last_seen end,
    'level', public.wallet_level(s.exp),
    'tokens', case when f.fr then public.wallet_level_tokens(public.wallet_level(s.exp)) + s.rest end,
    'since', case when f.fr then (select coalesce(x.accepted_at, x.created_at) from public.friendships x where x.user_a = least(auth.uid(), friend_profile.other) and x.user_b = greatest(auth.uid(), friend_profile.other)) end,
    'characters', to_jsonb(array(select c from unnest(array['yazan','yara','omar','layla','atlas','nova','bolt','iris','pip',
        'sprocket','kit','vex','bulwark','echo','aurora','cortex','titan','bloop','pixel','nimbus','ember','zenith','linky','sovereign','admin']) with ordinality u(c, i)
      where public.avatar_open(friend_profile.other, c) order by i)))
  from public.profiles p, s, f
  where p.id = friend_profile.other and auth.uid() is not null and p.id <> auth.uid()
    and not exists (select 1 from public.blocks b where b.active and ((b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())));
$$;
revoke all on function public.friend_profile(uuid) from public, anon;
grant execute on function public.friend_profile(uuid) to authenticated;
