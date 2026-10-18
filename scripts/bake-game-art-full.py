"""Bakes the full-screen Games page pictures (Yazan, 2026-10-18) into the body-area WebPs GameArt draws.

Each picture is a full phone screen (Flow, 768 x 1376): plain navy on top, the scene lower right.
It is laid over the 282 x 615 design screen like CSS cover (nudged right), cut to the body area
(BODY_TOP..ART_END), and made transparent where it must melt into the app backdrop:
  - the scene's own top and bottom edges (some pictures have a hard band there) fade out softly,
  - a big curve clears the upper left so the title stays readable, and the scene's upper left
    tucks under the text's lower right (decision: "tucked, bigger"),
  - the last stretch above the nav fades out.
Run: python3 scripts/bake-game-art-full.py   (needs Pillow, numpy)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, SH, TOP, END = 282, 615, 72, 540  # design screen, body top, art end (src/features/games/fit.ts)
SCALE = 3
NUDGE = 0.7  # 0 = keep the left edge, 1 = keep the right edge, when the picture is wider than the screen

# Scene band in picture px (of 1376): fade in over [a, b] at the top and out over [c, d] at the bottom.
# a/d sit on (or just inside) any hard band edge, so no straight line survives.
BAND = {
    'nova-crossword': (380, 520, 1130, 1260),
    'nova-medicordle': (330, 440, 1020, 1150),
    'the-conqueror': (400, 540, 950, 1070),
    'the-streak-master': (470, 600, 1110, 1240),
    'the-wheels-of-chaos': (480, 620, 1030, 1150),
    'the-riddler': (304, 440, 950, 1068),
    'case-files-unsolved': (304, 450, 950, 1068),
    'trust-me-not': (420, 540, 1090, 1230),
    'the-diagnostic-pursuit': (406, 510, 880, 972),
    'the-silent-artist': (474, 590, 950, 1068),
}


def smooth(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


os.makedirs(os.path.join(ROOT, 'assets/games/baked/dark'), exist_ok=True)
for k, (a, b, c, d) in BAND.items():
    src = Image.open(os.path.join(ROOT, f'assets/games/full/{k}.jpg')).convert('RGB')
    pw, ph = src.size
    s = max(W / pw, SH / ph)  # design px per picture px
    ox = (W - pw * s) * NUDGE
    oy = (SH - ph * s) / 2
    ow, oh = W * SCALE, (END - TOP) * SCALE
    X, Y = np.meshgrid((np.arange(ow) + 0.5) / SCALE, TOP + (np.arange(oh) + 0.5) / SCALE)
    # sample the picture: resize the whole thing, then crop the body window
    big = src.resize((round(pw * s * SCALE), round(ph * s * SCALE)), Image.LANCZOS)
    canvas = Image.new('RGB', (ow, oh))
    canvas.paste(big, (round(ox * SCALE), round((oy - TOP) * SCALE)))
    rgb = np.asarray(canvas).astype(np.float64) / 255
    py = (Y - oy) / s  # picture row under each pixel
    band = smooth(py, a, b) * (1 - smooth(py, c, d))
    curve = smooth(np.hypot(X / W, Y / (0.52 * SH)), 0.86, 1.12)  # clears the title corner
    nav = 1 - smooth(Y, END - 44, END)
    alpha = band * curve * nav
    img = Image.fromarray(np.round(np.dstack([rgb, alpha]) * 255).astype(np.uint8), 'RGBA')
    dst = os.path.join(ROOT, 'assets/games/baked/dark', f'{k}.webp')
    img.save(dst, 'WEBP', quality=88, method=6)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
