# Builds The Quiz Parade bank (Yazan 2026-10-24) from the Wheels, Conqueror and Trust Me Not banks.
# Types: mcq, tf, r2o (rule out 2), match, reverse, order, closest. Run from the MedNova repo root:
#   python3 /mnt/project-files/mednova/build/quiz-parade/build-bank.py <tmn-keys.json>
import json, re, sys, collections
keys = {r[0]: r[1] for r in json.load(open(sys.argv[1]))}
w = json.load(open('src/games/wheels/data/bank.json'))
c = json.load(open('src/games/conqueror/data/bank.json'))
t = json.load(open('src/games/trustmenot/data/questions.json'))
TMN_FIELD = {'BAN': 'anatomy', 'BBC': 'biochemistry', 'BMI': 'microbiology', 'BPA': 'pathology', 'BPC': 'pharmacology', 'BPH': 'physiology',
             'CEM': 'medicine', 'CIM': 'medicine', 'COG': 'obgyn', 'CPE': 'pediatrics', 'CPN': 'medicine', 'CSU': 'surgery'}
BASIC = {'anatomy', 'biochemistry', 'microbiology', 'pathology', 'pharmacology', 'physiology'}
out = []
def add(src, q, **kw):
    item = {'id': f"{src}:{q['id']}", 'style': kw.pop('style', q.get('style')), 'field': kw.pop('field', q.get('field')), 'prompt': q['prompt'], **kw}
    if q.get('explanation'): item['explain'] = q['explanation']
    out.append(item)
for q in w['questions']:
    s = q['style']
    if s == 'mcq' or s == 'reverse': add('wc', q, choices=q['choices'], answer=q['answer'])
    elif s == 'tf': add('wc', q, answer=q['answer'])
    elif s == 'r2o': add('wc', q, items=q['items'], out=q['out'])
    elif s == 'match': add('wc', q, pairs=q['pairs'])
for q in w['redemption']: add('wc', q, answer=q['answer'])
for q in c:
    s = q['style']
    if s == 'mcq': add('cq', q, choices=q['options'], answer=q['answer'])
    elif s == 'tf': add('cq', q, answer=q['answer'])
    elif s == 'match': add('cq', q, pairs=q['pairs'])
    elif s == 'order': add('cq', q, items=q['items'])
    elif s == 'closest': add('cq', q, answer=q['answer'], unit=q.get('unit', ''))
for k, q in t.items():
    out.append({'id': f'tmn:{k}', 'style': 'mcq', 'field': TMN_FIELD[k.split('-')[0]], 'prompt': q['q'], 'choices': q['c'], 'answer': keys[k]})
# drop repeats of the same question text
seen, bank, dup = set(), [], 0
for q in out:
    k = (q['style'], re.sub(r'\W+', ' ', q['prompt'].lower()).strip())
    if k in seen: dup += 1; continue
    seen.add(k); q['kind'] = 'basic' if q['field'] in BASIC else 'clinical'; bank.append(q)
flag = [q['id'] for q in bank if re.search(r'according to|\bnote:|\bAI\b|guideline', json.dumps(q), re.I)]
json.dump(bank, open('src/games/parade/data/bank.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(bank), 'questions;', dup, 'repeats dropped;', dict(collections.Counter(q['style'] for q in bank)))
print(dict(collections.Counter(q['field'] for q in bank)))
print('check by hand:', len(flag), flag[:20])
