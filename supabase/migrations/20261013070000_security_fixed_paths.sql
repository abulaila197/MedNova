-- Fixed search path on the 6 pure helper functions (Supabase advisor 0011).
alter function public.wallet_exp_cap(text, text, jsonb) set search_path = '';
alter function public.wallet_level(bigint) set search_path = '';
alter function public.wallet_level_tokens(integer) set search_path = '';
alter function public.daily_prize(integer) set search_path = '';
alter function public.achievement_goal(text, integer) set search_path = '';
alter function public.free_amount(text) set search_path = '';
-- Wheels online needs a signed-in player, so guests can no longer call its state and swipe.
revoke execute on function public.wc_state(uuid) from public, anon;
revoke execute on function public.wc_swipe(uuid, integer, boolean) from public, anon;
grant execute on function public.wc_state(uuid) to authenticated, service_role;
grant execute on function public.wc_swipe(uuid, integer, boolean) to authenticated, service_role;
