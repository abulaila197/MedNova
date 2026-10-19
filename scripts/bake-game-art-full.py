"""Bakes the full-screen Games page pictures (Yazan, 2026-10-18) into the body-area WebPs GameArt draws.

Each picture is a full phone screen (Flow, 768 x 1376): plain navy on top, the scene lower right.
It is laid over the 282 x 615 design screen like CSS cover (nudged right), cut to the body area
(BODY_TOP..ART_END), and made transparent where it must melt into the app backdrop:
  - the scene's own top and bottom edges (some pictures have a hard band there) fade out softly,
  - a big curve clears the upper left so the title stays readable, and the scene's upper left
    tucks under the text's lower right (decision: "tucked, bigger"),
  - the art is gone before the planets on the arc, so a gap stays between them,
  - wherever the picture is just its own navy sky it turns clear, so no box edge shows,
  - the left and right screen edges fade softly (2026-10-19).
Run: python3 scripts/bake-game-art-full.py   (needs Pillow, numpy)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, SH, TOP, END = 282, 615, 72, 580  # design screen, body top, art end (src/features/games/fit.ts)
SCALE = 3
NUDGE = 0.7  # 0 = keep the left edge, 1 = keep the right edge, when the picture is wider than the screen
PLANET_Y = 524  # screen y of the swipe dots, where the middle planet sat before the arc was removed (fit.ts: BODY_TOP + DOTS_Y)
TEXT_DROP = 14  # the title block sits this much lower than when the curve was tuned (2026-10-18)
CLEAR = 580  # screen y where the window ends; it sits under the dock

# Scene band in picture px (of 1376): fade in over [a, b] at the top and out over [c, d] at the bottom.
# a/d sit on (or just inside) any hard band edge, so no straight line survives.
BAND = {  # tall pictures (Yazan 2026-10-18 v2): scenes run from under the title down to the arc
    'the-wheels-of-chaos': (60, 260, 1150, 1300),
    'case-files-unsolved': (150, 330, 1150, 1300),
    'nova-crossword': (220, 380, 1150, 1300),
    'nova-medicordle': (300, 440, 1150, 1300),
    'the-streak-master': (150, 320, 1150, 1300),
    'trust-me-not': (200, 360, 1150, 1300),
    'the-conqueror': (302, 440, 1150, 1300),
    'the-riddler': (60, 240, 1150, 1300),
    'the-silent-artist': (302, 440, 1150, 1300),
    'the-diagnostic-pursuit': (172, 330, 1150, 1300),
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
    # Yazan 2026-10-18: each scene's lowest part lands behind the middle planet, wherever the overlap ends up
    pix = np.asarray(src).astype(np.float64) / 255
    sky0 = np.median(pix[:20].reshape(-1, 3), axis=0)
    rows = np.where((np.linalg.norm(pix - sky0, axis=2) > 0.25)[:, 300:].mean(axis=1) > 0.06)[0]
    bottom = rows.max()
    oy = PLANET_Y - bottom * s
    c, d = bottom - 140, bottom + 30  # the scene's foot fades out behind the planet
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
    # 2026-10-19 (Yazan): a soft fade at the screen's left and right edges, so no hard edge shows beside the next page
    sides = smooth(X, 0, 16) * (1 - smooth(X, W - 16, W))
    alpha = band * curve * nav * key * sides
    img = Image.fromarray(np.round(np.dstack([rgb, alpha]) * 255).astype(np.uint8), 'RGBA')
    dst = os.path.join(ROOT, 'assets/games/baked/dark', f'{k}.webp')
    img.save(dst, 'WEBP', quality=88, method=6)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
