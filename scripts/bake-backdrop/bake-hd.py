"""Bakes the page background in full phone resolution, with the film grain IN the picture (Yazan 2026-11-16, lag +
banding): the navy, the 3 glows (Backdrop.tsx SPOTS, at full resolution instead of a small squeezed picture: no colour steps), the medical
symbols (bake-symbols.mjs) and the grain (assets/textures/grain.png at 8%, tiled at its on-screen size). The page,
header, bottom bar and faded edges then all show this one picture and nothing is laid over it.
  python3 scripts/bake-backdrop/bake-hd.py base      -> /tmp page bases (no symbols, no grain)
  node scripts/bake-backdrop/bake-symbols.mjs       -> adds the symbols to the bases
  python3 scripts/bake-backdrop/bake-hd.py finish    -> adds the grain, writes assets/images/backdrop/*.webp
"""
import sys, math, os
import numpy as np
from PIL import Image

OUT = 'assets/images/backdrop'
TMP = os.environ.get('BAKE_TMP', '/tmp/mednova-bake')
os.makedirs(TMP, exist_ok=True)
SKY = np.array([0x0D, 0x17, 0x38], float)
STRENGTH = 0.55
# x, y, rx, ry, rot (deg), rgb, alpha: Backdrop.tsx SPOTS
SPOTS = [(1.02, -0.02, 0.95, 0.32, -32, (120, 110, 255), 0.55), (0.92, 0.04, 0.5, 0.14, -32, (110, 200, 255), 0.5), (-0.05, 1.02, 0.85, 0.28, -28, (90, 140, 255), 0.42)]
# name, width, height (px), design width the screen shows across (dp): grain tiles every 160 dp, as on the phone.
SHAPES = [('page', 1080, 2355, 412), ('page-symbols-phone', 1080, 2355, 412), ('page-symbols-tablet', 1920, 2560, 800)]


def base(w, h):
    # The approved glow circles (glow-N.png from bake.py) placed with Backdrop's SPOTS maths, as bake-page.py did, but
    # at full phone resolution and kept in 16-bit-safe float until the end. Drawn in the phone shape and stretched for
    # the tablet shape, as the app always did.
    pw, ph = 1080, 2355
    page = Image.new('RGBA', (pw, ph), tuple(int(c) for c in SKY) + (255,))
    for i, (x, y, rx, ry, rot, _rgb, _a) in enumerate(SPOTS):
        g = Image.open(f'{OUT}/glow-{i + 1}.png').convert('RGBA')
        g = g.resize((round(2 * rx * pw), round(2 * ry * ph)), Image.LANCZOS)
        g = g.rotate(-rot, resample=Image.BICUBIC, expand=True)  # PIL turns anticlockwise, RN clockwise
        layer = Image.new('RGBA', (pw, ph))
        layer.paste(g, (round(x * pw - g.width / 2), round(y * ph - g.height / 2)))
        page = Image.alpha_composite(page, layer)
    im = page.convert('RGB')
    return im if (w, h) == (pw, ph) else im.resize((w, h), Image.LANCZOS)


def grain(im, dp):
    g = Image.open('assets/textures/grain.png')
    g = np.array(g, float) / (65535 if g.mode.startswith('I') else 255) * 255
    tile = round(im.width / dp * 160)
    g = np.array(Image.fromarray(g.astype(np.float32), 'F').resize((tile, tile), Image.BILINEAR))
    reps = (math.ceil(im.height / tile), math.ceil(im.width / tile))
    g = np.tile(g, reps)[: im.height, : im.width]
    a = np.array(im, float)
    out = a * 0.92 + g[..., None] * 0.08
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))


if sys.argv[1] == 'base':
    for name, w, h, _ in SHAPES:
        base(w, h).save(f'{TMP}/{name}.png')
        print('base', name, w, h)
else:
    for name, w, h, dp in SHAPES:
        im = Image.open(f'{TMP}/{name}.png').convert('RGB')
        grain(im, dp).save(f'{OUT}/{name}.webp', quality=92, method=6)
        print('done', name, os.path.getsize(f'{OUT}/{name}.webp') // 1024, 'KB')
