"""Bakes each Games page drawing with its arc fade into one transparent WebP.

The phone used to draw every drawing through three stacked SVG masks (plus a colour
matrix in light mode), ten pages at once, which is heavy for Android. The result is the
same picture, so we draw it once here. Geometry comes from src/features/games/fit.ts.

Run: python3 scripts/bake-game-art.py   (needs Node 22+, Pillow, numpy)
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCALE = 3  # output px per design px
KEYS = ['trust-me-not', 'the-conqueror', 'case-files-unsolved', 'nova-crossword', 'nova-medicordle',
        'the-diagnostic-pursuit', 'the-riddler', 'the-silent-artist', 'the-streak-master', 'the-wheels-of-chaos']

js = """
import(process.argv[1]).then((m) => {
  const fits = {};
  for (const mode of ['dark', 'light']) for (const k of JSON.parse(process.argv[2])) fits[mode + '/' + k] = m.fitArt(k, mode);
  console.log(JSON.stringify({ fits, W: m.W, BODY_TOP: m.BODY_TOP, ART_B: m.ART_B, ART_END: m.ART_END }));
});
"""
fit_ts = os.path.join(ROOT, 'src/features/games/fit.ts')
out = subprocess.run(['node', '--experimental-strip-types', '--no-warnings', '-e', js, fit_ts, json.dumps(KEYS)],
                     check=True, capture_output=True, text=True).stdout
G = json.loads(out)
W, TOP, ART_B, END = G['W'], G['BODY_TOP'], G['ART_B'], G['ART_END']
H = END - TOP


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def sat_matrix(s, k=1.0, o=0.0):
    m = np.array([
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ]) * k
    return m, o


for mode in ['dark', 'light']:
    os.makedirs(os.path.join(ROOT, 'assets/games/baked', mode), exist_ok=True)
    for k in KEYS:
        f = G['fits'][f'{mode}/{k}']
        ow, oh = W * SCALE, H * SCALE
        # design coords of each output pixel centre
        xs = (np.arange(ow) + 0.5) / SCALE
        ys = TOP + (np.arange(oh) + 0.5) / SCALE
        X, Y = np.meshgrid(xs, ys)

        src = Image.open(os.path.join(ROOT, f'assets/games/{mode}/{k}.jpg')).convert('RGB')
        # place the drawing: (x, y, w, h) in design px, preserveAspectRatio none
        sw, sh = round(f['w'] * SCALE), round(f['h'] * SCALE)
        big = src.resize((sw, sh), Image.LANCZOS)
        canvas = Image.new('RGB', (ow, oh), (0, 0, 0))
        canvas.paste(big, (round(f['x'] * SCALE), round((f['y'] - TOP) * SCALE)))
        rgb = np.asarray(canvas).astype(np.float64) / 255

        if mode == 'light':
            m, o = sat_matrix(0.78, 0.72 * 1.06, 0.5 * (1 - 1.06)) if k == 'the-streak-master' else sat_matrix(0.78)
            rgb = np.clip(rgb @ m.T + o, 0, 1)

        # the three fade masks (arc, vertical, horizontal), multiplied: the phone used to draw these live
        d = np.hypot((X + 0.1 * W) / (1.4 * W), (Y + 0.04 * ART_B) / (0.92 * ART_B))
        m1 = ramp(d, 0.52, 0.74)
        p = Y / END
        base = np.where(p < 0.26, 0, np.where(p < 0.46, (p - 0.26) / 0.2, np.where(p <= 0.82, 1, np.maximum(0, (1 - p) / 0.18))))
        m2 = base * ramp(Y, f['y'], f['y'] + 40) * (1 - ramp(Y, f['y'] + f['h'] - 40, f['y'] + f['h']))
        m3 = ramp(X, f['x'], f['x'] + 40) * (1 - ramp(X, f['x'] + f['w'] - 40, f['x'] + f['w']))
        inside = (X >= f['x']) & (X <= f['x'] + f['w']) & (Y >= f['y']) & (Y <= f['y'] + f['h'])
        a = m1 * m2 * m3 * inside

        rgba = np.dstack([rgb, a]) * 255
        img = Image.fromarray(np.round(rgba).astype(np.uint8), 'RGBA')
        dst = os.path.join(ROOT, 'assets/games/baked', mode, f'{k}.webp')
        img.save(dst, 'WEBP', quality=86, method=6)
        print(dst, os.path.getsize(dst) // 1024, 'KB')
