# Finishes the start-flow bake (see src/features/start/baked.ts). Run from the repo root after:
#   CHROME=<chromium> node scripts/bake-start-art/bake-sky.mjs <tmp> 720 1560
#   CHROME=<chromium> node scripts/bake-start-art/bake-halo.mjs assets/motion/mednova-wordmark.json <tmp>/halo-raw.png
#   python3 scripts/bake-start-art/finish.py <tmp>
# (the .mjs files import Playwright from /opt/node-tools; point them at any Playwright install.)
# Veils and halo keep only Chromium's alpha over their one exact colour; the slide 3 photo gets Scene's 'top' fade
# (26 * 1.4 design px over the photo's drawn height at the 282 px design width) in its alpha, lossless.
import base64, json, shutil, sys
import numpy as np
from PIL import Image

tmp = sys.argv[1]
out = 'assets/onboarding/baked'
shutil.copy(f'{tmp}/sky.png', f'{out}/sky.png')
def recolour(src, dst, rgb):
    a = Image.open(src).convert('RGBA').getchannel('A')
    o = Image.new('RGBA', a.size, rgb + (0,)); o.putalpha(a); o.save(dst, optimize=True)
for i in (1, 2, 3):
    recolour(f'{tmp}/veil-{i}.png', f'{out}/veil-{i}.png', (7, 10, 28))
im = Image.open('assets/onboarding/nova-community.jpg').convert('RGB')
W, H = im.size
fade = 26 * 1.4 / (1.18 * (282 - 36) * (1376 / 768)) * H
A = np.round(np.clip((np.arange(H) + 0.5) / fade, 0, 1) * 255).astype('uint8')[:, None].repeat(W, 1)
Image.fromarray(np.dstack([np.asarray(im), A]), 'RGBA').save(f'{out}/nova-community-fade.webp', lossless=True, quality=100, method=6)
recolour(f'{tmp}/halo-raw.png', f'{tmp}/halo.png', (159, 230, 255))
j = json.load(open('assets/motion/mednova-wordmark.json'))
k = next(i for i, l in enumerate(j['layers']) if l['nm'] == 'halo')
old = j['layers'][k]
j['assets'] = [{'id': 'halo_baked', 'w': 992, 'h': 310, 'u': '', 'p': 'data:image/png;base64,' + base64.b64encode(open(f'{tmp}/halo.png', 'rb').read()).decode(), 'e': 1}]
j['layers'][k] = {'ddd': 0, 'ind': old['ind'], 'ty': 2, 'nm': 'halo', 'refId': 'halo_baked', 'sr': 1,
    'ks': {'o': {'a': 0, 'k': 100}, 'r': {'a': 0, 'k': 0}, 'p': {'a': 0, 'k': [-40, -40, 0]}, 'a': {'a': 0, 'k': [0, 0, 0]}, 's': {'a': 0, 'k': [100, 100, 100]}},
    'ao': 0, 'ip': old['ip'], 'op': old['op'], 'st': old['st'], 'bm': 0, 'tt': old['tt']}
open('assets/motion/mednova-wordmark-baked.json', 'w').write(json.dumps(j, separators=(',', ':')))
