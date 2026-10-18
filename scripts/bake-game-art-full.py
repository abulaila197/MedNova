"""Bakes the full-screen Games page pictures (Yazan, 2026-10-18) into the body-area WebPs GameArt draws.

Each picture is a full phone screen (Flow, 768 x 1376): plain navy on top, the scene lower right.
It is laid over the 282 x 615 design screen like CSS cover (nudged right), cut to the body area
(BODY_TOP..ART_END), and made transparent where it must melt into the app backdrop:
  - the scene's own top and bottom edges (some pictures have a hard band there) fade out softly,
  - a big curve clears the upper left so the title stays readable, and the scene's upper left
    tucks under the text's lower right (decision: "tucked, bigger"),
  - the art is gone before the planets on the arc, so a gap stays between them,
  - wherever the picture is just its own navy sky it turns clear, so no box edge shows.
Run: python3 scripts/bake-game-art-full.py   (needs Pillow, numpy)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, SH, TOP, END = 282, 615, 72, 540  # design screen, body top, art end (src/features/games/fit.ts)
SCALE = 3
NUDGE = 0.7  # 0 = keep the left edge, 1 = keep the right edge, when the picture is wider than the screen
# Each scene moves up by its own amount so its upper left meets the text corner the way Case Files does (Yazan 2026-10-18).
# CORNER: picture row (of 1376) where the scene's upper-left part begins; Case Files is the reference.
CORNER = {
    'case-files-unsolved': 340, 'the-riddler': 450, 'the-conqueror': 450, 'the-wheels-of-chaos': 480,
    'the-diagnostic-pursuit': 500, 'the-silent-artist': 520, 'trust-me-not': 560,
    'nova-medicordle': 600, 'nova-crossword': 600, 'the-streak-master': 620,
}
TEXT_DROP = 37  # the title block sits this much lower than when the curve was tuned
CLEAR = 490  # screen y where the art is fully gone, a clear gap above the swipe dots and planets

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
    up = min(55, -7 + 0.7 * (CORNER[k] - 340) * s)
    oy = (SH - ph * s) / 2 - up
    ow, oh = W * SCALE, (END - TOP) * SCALE
    X, Y = np.meshgrid((np.arange(ow) + 0.5) / SCALE, TOP + (np.arange(oh) + 0.5) / SCALE)
    # sample the picture: resize the whole thing, then crop the body window
    big = src.resize((round(pw * s * SCALE), round(ph * s * SCALE)), Image.LANCZOS)
    canvas = Image.new('RGB', (ow, oh))
    canvas.paste(big, (round(ox * SCALE), round((oy - TOP) * SCALE)))
    rgb = np.asarray(canvas).astype(np.float64) / 255
    py = (Y - oy) / s  # picture row under each pixel
    band = smooth(py, a + 6, b) * (1 - smooth(py, c, d - 6))
    curve = smooth(np.hypot(X / W, (Y - TEXT_DROP) / (0.52 * SH)), 0.7, 1.0)  # clears the title corner, scene tucks under the text
    nav = 1 - smooth(Y, CLEAR - 56, CLEAR)
    # the picture's own navy sky melts away, so no tinted box is left where it meets the app navy
    sky = np.median(np.asarray(src)[:20].reshape(-1, 3), axis=0) / 255
    key = smooth(np.linalg.norm(rgb - sky, axis=2), 0.04, 0.17)
    alpha = band * curve * nav * key
    img = Image.fromarray(np.round(np.dstack([rgb, alpha]) * 255).astype(np.uint8), 'RGBA')
    dst = os.path.join(ROOT, 'assets/games/baked/dark', f'{k}.webp')
    img.save(dst, 'WEBP', quality=88, method=6)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
