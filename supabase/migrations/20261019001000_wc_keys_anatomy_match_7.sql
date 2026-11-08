-- Wheels of Chaos: answer keys for bank 2142.1000.82.7xh9rq (anatomy-match-7 rewritten so every right-hand label is
-- distinct). keys.json only stores each match's length, so q/r/b are identical to the previous bank's row; only the
-- bank id changes. Copied from the live row 2142.1000.82.1uudeto (which matches the old keys.json). The old row stays
-- so a game already running on the old bank can finish.
insert into public.wc_keys (v, q, r, b)
select '2142.1000.82.7xh9rq', q, r, b from public.wc_keys where v = '2142.1000.82.1uudeto'
on conflict (v) do nothing;
