-- S1 / AP1 / LV1: account deletion failed (FK violation, 500) for anyone who hosted an online room.
-- Deleting the auth user cascades profiles -> rooms (host) -> matches, but race_results.match_id and
-- cw_claims.match_id had no ON DELETE action, so the other players' rows blocked the whole delete.
-- They were the only two NO ACTION foreign keys in public; every other match child table cascades.
alter table public.race_results
  drop constraint race_results_match_id_fkey,
  add constraint race_results_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade;

alter table public.cw_claims
  drop constraint cw_claims_match_id_fkey,
  add constraint cw_claims_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade;
