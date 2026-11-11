"""
Menu icon buttons in the style of the existing red ones (help_btn.webp, ...):
a red squircle with white, bold, rounded glyphs.

    python3 scripts/generate-icons.py      (also run by `pnpm sprites`)

The blank button is the existing pause button with its glyph painted out, so
the shape and shading match exactly. Glyphs are drawn at 4x and scaled down
for smooth edges. Writes app/images/{settings,levels,daily,endless,create,leaderboards,quests}_btn.webp.
"""

import math
import os

from PIL import Image, ImageDraw

IMAGES = os.path.join(os.path.dirname(__file__), "..", "app", "images")
SIZE = 152
UP = 4  # supersampling
WHITE = (255, 255, 255, 255)
RED = (239, 83, 80, 255)


def blank_button():
    """The pause button with its white bars painted over in the button red."""
    img = Image.open(os.path.join(IMAGES, "pause_btn.webp")).convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            # glyph and its anti-aliased edge are lighter than any shade of the button
            if a > 200 and g > 92 and 30 < x < 122 and 30 < y < 122:
                px[x, y] = RED
    return img


def glyph(draw_fn):
    """Draw a white glyph at UPx onto a transparent canvas, return it at 1x."""
    big = Image.new("RGBA", (SIZE * UP, SIZE * UP), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(big), lambda v: v * UP)
    return big.resize((SIZE, SIZE), Image.LANCZOS)


def rounded_line(d, s, points, width):
    d.line([(s(x), s(y)) for x, y in points], fill=WHITE, width=s(width), joint="curve")
    for x, y in (points[0], points[-1]):
        r = s(width) / 2
        d.ellipse((s(x) - r, s(y) - r, s(x) + r, s(y) + r), fill=WHITE)


# ------------------------------------------------------------------- glyphs
# Coordinates are in the 152px button; the glyph area is about 44..108.


def settings(d, s):
    cx, cy = 76, 76
    teeth = 8
    outer, inner = 38, 29
    pts = []
    for i in range(teeth * 4):
        angle = (i / (teeth * 4)) * math.tau - math.pi / 2
        radius = outer if (i % 4) in (1, 2) else inner
        pts.append((s(cx + math.cos(angle) * radius), s(cy + math.sin(angle) * radius)))
    d.polygon(pts, fill=WHITE)
    d.ellipse((s(cx - 30), s(cy - 30), s(cx + 30), s(cy + 30)), fill=WHITE)
    d.ellipse((s(cx - 12), s(cy - 12), s(cx + 12), s(cy + 12)), fill=RED)


def levels(d, s):
    # 2x2 grid of rounded tiles, one with a play triangle feel: a "level select"
    for gx, gy in ((44, 44), (80, 44), (44, 80), (80, 80)):
        d.rounded_rectangle((s(gx), s(gy), s(gx + 28), s(gy + 28)), radius=s(8), fill=WHITE)
    # flag in the first tile, cut out in red
    d.rectangle((s(52), s(50), s(55), s(66)), fill=RED)
    d.polygon([(s(55), s(50)), (s(66), s(54)), (s(55), s(58))], fill=RED)


def daily(d, s):
    # calendar: body, header band, rings, and a check mark
    d.rounded_rectangle((s(42), s(50), s(110), s(110)), radius=s(12), fill=WHITE)
    d.rectangle((s(48), s(68), s(104), s(72)), fill=RED)
    for x in (58, 94):
        d.rounded_rectangle((s(x - 5), s(38), s(x + 5), s(58)), radius=s(5), fill=WHITE)
        d.rectangle((s(x - 5), s(56), s(x + 5), s(60)), fill=RED)
    d.line([(s(60), s(90)), (s(71), s(100)), (s(92), s(80))], fill=RED, width=s(8), joint="curve")
    for x, y in ((60, 90), (92, 80)):
        d.ellipse((s(x - 4), s(y - 4), s(x + 4), s(y + 4)), fill=RED)


def endless(d, s):
    # infinity: a lemniscate traced with a thick round pen
    pts = []
    for i in range(241):
        t = i / 240 * math.tau
        denom = 1 + math.sin(t) ** 2
        x = 76 + 36 * math.cos(t) / denom
        y = 76 + 36 * math.sin(t) * math.cos(t) / denom
        pts.append((x, y))
    width = 16
    r = width / 2
    for x, y in pts:
        d.ellipse((s(x - r), s(y - r), s(x + r), s(y + r)), fill=WHITE)


def star(d, s, cx, cy, size, pinch=0.28):
    pts = []
    for i in range(8):
        angle = i * math.pi / 4 - math.pi / 2
        radius = size if i % 2 == 0 else size * pinch
        pts.append((s(cx + math.cos(angle) * radius), s(cy + math.sin(angle) * radius)))
    d.polygon(pts, fill=WHITE)


def create(d, s):
    # sparkles: one big four-point star and two small ones
    star(d, s, 70, 82, 32)
    star(d, s, 104, 50, 14)
    star(d, s, 104, 100, 9)


def leaderboards(d, s):
    # trophy: a cup with two handles, a stem and a base
    d.pieslice((s(50), s(16), s(102), s(84)), 0, 180, fill=WHITE)
    d.rectangle((s(50), s(42), s(102), s(50)), fill=WHITE)
    for cx in (48, 104):
        d.ellipse((s(cx - 12), s(42), s(cx + 12), s(66)), outline=WHITE, width=s(7))
    d.rectangle((s(70), s(80), s(82), s(94)), fill=WHITE)
    d.rounded_rectangle((s(56), s(94), s(96), s(108)), radius=s(4), fill=WHITE)


def quests(d, s):
    # checklist: a clipboard page with three rows, each a check box and a line
    d.rounded_rectangle((s(44), s(38), s(108), s(114)), radius=s(10), fill=WHITE)
    d.rounded_rectangle((s(60), s(30), s(92), s(46)), radius=s(6), fill=WHITE)
    d.rounded_rectangle((s(66), s(35), s(86), s(41)), radius=s(3), fill=RED)
    for i, y in enumerate((58, 76, 94)):
        d.rounded_rectangle((s(52), s(y), s(64), s(y + 12)), radius=s(3), outline=RED, width=s(3))
        d.rounded_rectangle((s(70), s(y + 3), s(100), s(y + 9)), radius=s(3), fill=RED)
        if i == 0:
            d.line([(s(54), s(y + 6)), (s(58), s(y + 10)), (s(67), s(y - 2))], fill=RED, width=s(4), joint="curve")


ICONS = {
    "settings": settings,
    "levels": levels,
    "daily": daily,
    "endless": endless,
    "create": create,
    "leaderboards": leaderboards,
    "quests": quests,
}


def main():
    base = blank_button()
    for name, fn in ICONS.items():
        img = base.copy()
        img.alpha_composite(glyph(fn))
        img.save(os.path.join(IMAGES, f"{name}_btn.webp"), quality=92, method=6)
    print(f"icons: {', '.join(ICONS)}")


if __name__ == "__main__":
    main()
