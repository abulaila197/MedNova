"""Bakes the 3 page-background glows of src/components/Backdrop.tsx into soft round PNGs (Yazan 2026-10-19).
Each PNG is the spot's radial gradient on a circle; the app stretches it to rx x ry and rotates it, which is
exactly what the SVG ellipse with objectBoundingBox gradient draws. Re-run after changing SPOTS or STRENGTH:
  python3 scripts/bake-backdrop/bake.py
"""
from PIL import Image

SIZE = 512
STRENGTH = 0.55
SPOTS = [((120, 110, 255), 0.55), ((110, 200, 255), 0.5), ((90, 140, 255), 0.42)]

for i, (rgb, a) in enumerate(SPOTS):
    img = Image.new('RGBA', (SIZE, SIZE))
    px = img.load()
    c = (SIZE - 1) / 2
    for y in range(SIZE):
        for x in range(SIZE):
            r = (((x - c) ** 2 + (y - c) ** 2) ** 0.5) / (SIZE / 2)
            if r <= 0.5:
                o = STRENGTH + (STRENGTH * 0.45 - STRENGTH) * (r / 0.5)
            elif r < 1:
                o = STRENGTH * 0.45 * (1 - (r - 0.5) / 0.5)
            else:
                o = 0
            px[x, y] = (*rgb, round(255 * a * o))
    img.save(f'assets/images/backdrop/glow-{i + 1}.png', optimize=True)
    print(i + 1, 'done')
