"""The Quiz Parade Online: prints SQL that loads the server answer keys (public.pq_keys) from bank.json.

n is each question's 1-based place in bank.json, so the app and the server agree on numbers. Re-run and apply the
output whenever the bank changes. Usage: python3 scripts/build-parade-keys.py [part] [parts] > keys.sql
"""
import json, sys
from pathlib import Path

bank = json.loads((Path(__file__).resolve().parent.parent / 'src/games/parade/data/bank.json').read_text())
LETTER = {'mcq': 'M', 'tf': 'T', 'r2o': 'R', 'match': 'X', 'order': 'O', 'reverse': 'V', 'closest': 'C'}

def token(q):
    st = q['style']
    if st in ('mcq', 'reverse'): a = str(q['answer'])
    elif st == 'tf': a = '1' if q['answer'] else '0'
    elif st == 'closest':
        v = q['answer']; a = repr(v) if isinstance(v, float) and not v.is_integer() else str(int(v))
    elif st == 'r2o': a = '.'.join(map(str, sorted(q['out'])))
    elif st == 'match': a = str(len(q['pairs']))
    else: a = str(len(q['items']))
    return LETTER[st] + q['kind'][0] + a

part, parts = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (0, 1)
size = -(-len(bank) // parts)
start = part * size
toks = ';'.join(token(q) for q in bank[start:start + size])
print(f"""insert into public.pq_keys(n, id, style, kind, key)
select {start} + o, 'n' || ({start} + o), s.style, case substr(tok, 2, 1) when 'c' then 'clinical' else 'basic' end,
  case substr(tok, 1, 1)
    when 'R' then jsonb_build_object('out', jsonb_build_array(split_part(substr(tok, 3), '.', 1)::int, split_part(substr(tok, 3), '.', 2)::int))
    when 'X' then jsonb_build_object('n', substr(tok, 3)::int) when 'O' then jsonb_build_object('n', substr(tok, 3)::int)
    when 'T' then jsonb_build_object('a', substr(tok, 3) = '1') when 'C' then jsonb_build_object('a', substr(tok, 3)::numeric)
    else jsonb_build_object('a', substr(tok, 3)::int) end
from regexp_split_to_table('{toks}', ';') with ordinality t(tok, o)
cross join lateral (select case substr(tok, 1, 1) when 'M' then 'mcq' when 'T' then 'tf' when 'R' then 'r2o' when 'X' then 'match'
  when 'O' then 'order' when 'V' then 'reverse' else 'closest' end as style) s
on conflict (n) do update set id = excluded.id, style = excluded.style, kind = excluded.kind, key = excluded.key;""")
