#!/usr/bin/env python3
"""Builds src/games/imposter/data/pairs.json from scripts/imposter/families.txt (Yazan 2026-11-04, point 20).

Each family becomes a ring of pairs (1-2, 2-3, ..., last-1; a family of two gives one pair), so every word is in at
most two pairs and both words of a pair are always close relatives. Each group is then trimmed to its quota by
taking pairs off the biggest families first. Run: python3 scripts/imposter/build.py
"""
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'scripts', 'imposter', 'families.txt')
OUT = os.path.join(ROOT, 'src', 'games', 'imposter', 'data', 'pairs.json')

SYSTEMS = ['Respiratory', 'Cardiovascular', 'Digestive', 'Nervous', 'Endocrine', 'Renal and urinary',
           'Musculoskeletal', 'Reproductive', 'Blood and immune', 'Skin']
KINDS = {'disease': 36, 'symptom': 10, 'investigation': 7, 'treatment': 7}
SUBJECTS = ['Anatomy', 'Physiology', 'Biochemistry', 'Pharmacology', 'Pathology', 'Microbiology']
PER_SUBJECT = 100


def entry(raw):
    parts = [p.strip() for p in raw.split('/') if p.strip()]
    return {'word': parts[0], 'alts': parts[1:]}


def ring(members):
    if len(members) < 2:
        return []
    if len(members) == 2:
        return [(members[0], members[1])]
    return [(members[i], members[(i + 1) % len(members)]) for i in range(len(members))]


def main():
    groups = defaultdict(list)  # (subtype, category, kind/topic) -> [(family, [pairs])]
    for n, line in enumerate(open(SRC, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        sub, cat, kt, fam, words = [x.strip() for x in line.split('|')]
        members = [entry(w) for w in words.split(';') if w.strip()]
        key = (sub, cat, kt if sub == 'clinical' else '')
        groups[key].append((fam, kt, ring(members)))

    quotas = {('clinical', s, k): q for s in SYSTEMS for k, q in KINDS.items()}
    quotas.update({('basic', s, ''): PER_SUBJECT for s in SUBJECTS})
    out = {'clinical': [], 'basic': []}
    short = []
    for key, q in quotas.items():
        fams = [[fam, kt, list(ps)] for fam, kt, ps in groups.get(key, [])]
        total = sum(len(f[2]) for f in fams)
        if total < q:
            short.append(f'{key}: {total} < {q}')
            continue
        while total > q:  # trim the biggest family's last (closing) pair
            big = max(fams, key=lambda f: len(f[2]))
            big[2].pop()
            total -= 1
        for fam, kt, ps in fams:
            for a, b in ps:
                p = {'subtype': key[0], 'category': key[1], 'a': a, 'b': b, 'family': fam}
                if key[0] == 'clinical':
                    p['kind'] = key[2]
                else:
                    p['topic'] = kt
                out[key[0]].append(p)
    if short:
        sys.exit('Not enough pairs:\n' + '\n'.join(short))
    pairs = []
    for sub, prefix in (('clinical', 'c'), ('basic', 'b')):
        for i, p in enumerate(out[sub], 1):
            pairs.append({'id': f'{prefix}{i:03d}', **p})
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'pairs': pairs}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(pairs)} pairs written')


if __name__ == '__main__':
    main()
