"""Bakes the whole page background of src/components/Backdrop.tsx (navy + the 3 glows) into ONE opaque picture
(2026-10-19, lag): the phone then draws one plain image per backdrop instead of three big rotated see-through ones.
Uses the glow-N.png circles from bake.py with Backdrop's SPOTS maths, on a design-shaped (282 x 615) canvas; the
app stretches it to the screen. Re-run after changing SPOTS, the glows or the navy:
  python3 scripts/bake-backdrop/bake-page.py
"""
from PIL import Image

W, H = 720, 1570  # 282 x 615 design shape
SKY = (0x0D, 0x17, 0x38, 255)
# x, y, rx, ry, rot (deg, clockwise), as in Backdrop.tsx SPOTS
SPOTS = [(1.02, -0.02, 0.95, 0.32, -32), (0.92, 0.04, 0.5, 0.14, -32), (-0.05, 1.02, 0.85, 0.28, -28)]

page = Image.new('RGBA', (W, H), SKY)
for i, (x, y, rx, ry, rot) in enumerate(SPOTS):
    g = Image.open(f'assets/images/backdrop/glow-{i + 1}.png').convert('RGBA')
    g = g.resize((round(2 * rx * W), round(2 * ry * H)), Image.LANCZOS)
    g = g.rotate(-rot, resample=Image.BICUBIC, expand=True)  # PIL turns anticlockwise, RN clockwise
    layer = Image.new('RGBA', (W, H))
    layer.paste(g, (round(x * W - g.width / 2), round(y * H - g.height / 2)))
    page = Image.alpha_composite(page, layer)
page.convert('RGB').save('assets/images/backdrop/page.png', optimize=True)
print('done', page.size)
