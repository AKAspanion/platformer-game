"""
Generates the game's procedural pixel art (needs Pillow):

  - new enemies: bat (4 flap frames), beetle (4 walk frames), spitter plant
    (4 idle + 3 spit frames), and the spitter's seed
  - attack frames (crouch, flash, lunge, bite) for every walking enemy
  - power-up icons (heart, shield, triple fire, wings) and HUD hearts

    python3 scripts/generate-sprites.py && python3 scripts/generate-enemy-death.py

(`pnpm sprites` runs both.) Art is drawn at 1 art pixel = 1 world pixel and
saved at 2x, like the existing enemy sprites. Output is deterministic.
"""

import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "sprites")
ENEMIES = os.path.join(ROOT, "enemies")
ITEMS = os.path.join(ROOT, "items")
SCALE = 2
OUTLINE = (34, 24, 44, 255)


def canvas(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outline(img, color=OUTLINE):
    """1px outline around everything opaque (4-neighbourhood)."""
    out = img.copy()
    src, px = img.load(), out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 128:
                    px[x, y] = color
                    break
    return out


def save(img, path, flip=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST).save(path, optimize=True)


def save_sides(frames, type_, sub=""):
    """Frames are drawn facing right; left is the mirror image."""
    for side, flip in (("right", False), ("left", True)):
        folder = os.path.join(ENEMIES, type_, sub, side) if sub else os.path.join(ENEMIES, type_, side)
        for i, frame in enumerate(frames, start=1):
            save(frame, os.path.join(folder, f"image_part_0{i}.png"), flip)


# --------------------------------------------------------------------------- bat


def bat(wing):  # wing: -1 up, 0 mid, 1 down
    img, d = canvas(18, 12)
    body, belly = (108, 75, 160, 255), (150, 118, 200, 255)
    membrane, bone = (82, 56, 128, 255), (60, 40, 96, 255)
    tip_y = {-1: 1, 0: 5, 1: 10}[wing]
    for sign in (-1, 1):
        cx = 9
        root = (cx + sign * 2, 6)
        tip = (cx + sign * 8, tip_y)
        mid = (cx + sign * 5, tip_y + (2 if wing < 0 else -1 if wing > 0 else 1))
        low = (cx + sign * 3, 8)
        d.polygon([root, tip, (cx + sign * 7, tip_y + 3), mid, (cx + sign * 4, 9), low], fill=membrane)
        d.line([root, tip], fill=bone)
    d.ellipse((6, 4, 12, 10), fill=body)
    d.ellipse((7, 6, 11, 10), fill=belly)
    d.polygon([(7, 5), (7, 2), (9, 4)], fill=body)  # ears
    d.polygon([(10, 4), (12, 2), (12, 5)], fill=body)
    d.point((9, 6), fill=(255, 255, 255, 255))  # eyes (looking right)
    d.point((11, 6), fill=(255, 255, 255, 255))
    d.point((10, 6), fill=(232, 52, 74, 255))
    d.point((9, 8), fill=(255, 255, 255, 255))  # fangs
    d.point((11, 8), fill=(255, 255, 255, 255))
    return outline(img)


# ------------------------------------------------------------------------ beetle


def beetle(step):
    img, d = canvas(20, 14)
    shell, shine, dark = (47, 111, 176, 255), (125, 186, 240, 255), (29, 72, 120, 255)
    head, leg = (45, 45, 61, 255), (30, 30, 42, 255)
    # legs (alternate pairs while walking)
    for i, x in enumerate((4, 8, 12)):
        lift = 1 if (i + step) % 2 == 0 else 0
        d.line([(x, 10), (x - 1 + lift, 13 - lift)], fill=leg)
    d.pieslice((1, 1, 16, 20), 180, 360, fill=shell)  # dome
    d.rectangle((2, 9, 15, 10), fill=dark)
    d.arc((4, 3, 12, 12), 200, 290, fill=shine)
    d.point((6, 4), fill=(220, 240, 255, 255))
    d.line([(9, 2), (9, 9)], fill=dark)  # wing seam
    d.ellipse((14, 5, 19, 11), fill=head)
    d.point((17, 7), fill=(255, 255, 255, 255))
    d.line([(19, 9), (19, 10)], fill=(200, 200, 210, 255))  # mandible
    return outline(img)


# ----------------------------------------------------------------------- spitter


def spitter(bob=0, mouth=1, lean=0):
    img, d = canvas(16, 18)
    pot, rim, stem, leaf = (192, 99, 58, 255), (220, 132, 80, 255), (63, 143, 58, 255), (92, 181, 79, 255)
    headc, spot = (98, 196, 82, 255), (63, 143, 58, 255)
    d.polygon([(4, 13), (12, 13), (11, 17), (5, 17)], fill=pot)
    d.rectangle((3, 12, 13, 13), fill=rim)
    d.rectangle((7, 8 + bob, 8, 12), fill=stem)
    d.ellipse((2, 9, 7, 12), fill=leaf)
    d.ellipse((9, 9, 14, 12), fill=leaf)
    hx = lean
    d.ellipse((2 + hx, 1 + bob, 12 + hx, 10 + bob), fill=headc)
    d.point((5 + hx, 7 + bob), fill=spot)
    d.point((4 + hx, 4 + bob), fill=spot)
    d.point((7 + hx, 3 + bob), fill=(255, 255, 255, 255))  # eye
    d.point((8 + hx, 3 + bob), fill=(30, 20, 30, 255))
    if mouth:  # mouth faces right
        top, bottom = 5 - mouth + bob, 6 + mouth + bob
        d.ellipse((9 + hx, top, 13 + hx, bottom), fill=(70, 16, 34, 255))
        d.point((12 + hx, top + 1), fill=(255, 255, 255, 255))
    return outline(img)


def seed(turn):
    img, d = canvas(7, 7)
    d.ellipse((1, 1, 5, 5), fill=(122, 74, 34, 255))
    hx, hy = [(2, 2), (4, 2), (4, 4), (2, 4)][turn]
    d.point((hx, hy), fill=(240, 196, 120, 255))
    return outline(img, (50, 26, 14, 255))


# ---------------------------------------------------------------- attack frames


def tint(img, color, amount):
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = tuple(round(c + (t - c) * amount) for c, t in zip((r, g, b), color)) + (a,)
    return out


def place(size, sprite, dx=0, angle=0):
    """Paste `sprite` bottom-centred in a canvas of `size`, shifted by dx."""
    if angle:
        sprite = sprite.rotate(angle, resample=Image.NEAREST, expand=True)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    x = round((size[0] - sprite.width) / 2 + dx)
    y = size[1] - sprite.height
    out.paste(sprite, (x, y), sprite)  # paste clips at the edges
    return out


def attack_frames(src):
    """crouch, red flash, lunge (with speed lines), bite. Facing right."""
    w, h = src.size
    unit = max(1, w // 18)
    crouch = src.resize((round(w * 1.06), round(h * 0.86)), Image.NEAREST)
    small = src.resize((round(w * 0.92), round(h * 0.92)), Image.NEAREST)
    lunge = small.resize((round(small.width * 1.12), round(small.height * 0.92)), Image.NEAREST)

    f1 = place((w, h), crouch, -2 * unit)
    f2 = place((w, h), tint(crouch, (255, 60, 60), 0.5), -2 * unit)
    f3 = place((w, h), lunge, 2 * unit)
    d = ImageDraw.Draw(f3)
    for i, y in enumerate((h * 0.35, h * 0.55, h * 0.75)):
        x0 = 0
        d.line([(x0, round(y)), (x0 + 3 * unit + i * unit, round(y))], fill=(255, 255, 255, 200), width=unit)
    f4 = place((w, h), small, 2 * unit, angle=-8)
    return [f1, f2, f3, f4]


# ----------------------------------------------------------------------- items


HEART = [
    ".XX...XX.",
    "XXXX.XXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "...XXX...",
    "....X....",
]


def heart_icon(fill=(232, 52, 74, 255), shine=(255, 150, 160, 255)):
    img, d = canvas(11, 10)
    for y, row in enumerate(HEART):
        for x, c in enumerate(row):
            if c == "X":
                d.point((x + 1, y + 1), fill=fill)
    d.point((2, 3), fill=shine)
    d.point((3, 2), fill=shine)
    return outline(img)


def shield_icon():
    img, d = canvas(12, 13)
    d.polygon([(2, 2), (6, 1), (10, 2), (10, 6), (6, 11), (2, 6)], fill=(74, 144, 226, 255))
    d.polygon([(6, 2), (9, 3), (9, 6), (6, 9)], fill=(150, 200, 255, 255))
    d.line([(4, 4), (4, 6)], fill=(230, 245, 255, 255))
    return outline(img)


def flame(d, x, y, s=1.0):
    d.ellipse((x, y + 2 * s, x + 4 * s, y + 6 * s), fill=(255, 140, 26, 255))
    d.polygon([(x, y + 4 * s), (x + 2 * s, y), (x + 4 * s, y + 4 * s)], fill=(255, 140, 26, 255))
    d.ellipse((x + 1 * s, y + 3 * s, x + 3 * s, y + 5.5 * s), fill=(255, 224, 102, 255))


def triple_icon():
    img, d = canvas(13, 12)
    flame(d, 0, 4)
    flame(d, 8, 4)
    flame(d, 3.5, 1, 1.25)
    return outline(img)


def wings_icon():
    img, d = canvas(13, 11)
    white, shade = (255, 255, 255, 255), (190, 215, 245, 255)
    for sign, cx in ((-1, 6), (1, 6)):
        pts = [(cx, 7), (cx + sign * 6, 1), (cx + sign * 6, 4), (cx + sign * 5, 6), (cx + sign * 4, 8)]
        d.polygon(pts, fill=white)
        d.line([(cx + sign * 2, 6), (cx + sign * 5, 3)], fill=shade)
    d.ellipse((5, 5, 7, 8), fill=(255, 210, 90, 255))
    return outline(img)


# ----------------------------------------------------------------------- bosses

CROWN = 24  # px of headroom above the body for the crown (2x art)

# kind: (base enemy, walk frames to use, tint colour, tint amount, crown anchor x)
BOSSES = {
    "kingPig": ("pig", [1, 5, 9, 13], None, 0, 0.5),
    "frostSlime": ("slime", [1, 4, 7, 10], (120, 200, 255), 0.45, 0.5),
    "sandLizard": ("chameleon", [1, 3, 5, 7], (235, 170, 80), 0.4, 0.62),
    "batLord": ("bat", [1, 2, 3, 4], (150, 20, 40), 0.35, 0.5),
    "mechBeetle": ("beetle", [1, 2, 3, 4], (150, 160, 175), 0.55, 0.8),
}


def crown(d, cx, top, width):
    """Gold crown sitting on y=top, centred on cx."""
    gold, shade, gem = (255, 205, 60, 255), (210, 150, 30, 255), (230, 40, 70, 255)
    h = width * 0.62
    base = top
    pts = [
        (cx - width / 2, base),
        (cx - width / 2, base - h),
        (cx - width / 4, base - h * 0.55),
        (cx, base - h * 1.05),
        (cx + width / 4, base - h * 0.55),
        (cx + width / 2, base - h),
        (cx + width / 2, base),
    ]
    d.polygon(pts, fill=gold, outline=OUTLINE)
    d.rectangle((cx - width / 2, base - h * 0.28, cx + width / 2, base), fill=shade, outline=OUTLINE)
    r = max(2, width * 0.08)
    d.ellipse((cx - r, base - h * 0.62 - r, cx + r, base - h * 0.62 + r), fill=gem, outline=OUTLINE)


def boss_frame(src, tint_color, amount, anchor):
    """Body at 2x with a crown on its head; canvas has CROWN px of headroom."""
    body = src.resize((src.width * 2, src.height * 2), Image.NEAREST)
    if tint_color:
        body = tint(body, tint_color, amount)
    out = Image.new("RGBA", (body.width, body.height + CROWN), (0, 0, 0, 0))
    out.alpha_composite(body, (0, CROWN))
    # crown on the highest point of the head near the anchor
    px = body.load()
    ax = int(body.width * anchor)
    top = min(
        (y for y in range(body.height) for x in range(max(0, ax - 6), min(body.width, ax + 6)) if px[x, y][3] > 128),
        default=0,
    )
    d = ImageDraw.Draw(out)
    crown(d, ax, top + CROWN + 4, max(16, body.width * 0.3))
    return out


def bosses():
    for kind, (base, walk, color, amount, anchor) in BOSSES.items():
        attack_dir = os.path.join(ENEMIES, base, "attack", "right")
        attack = (
            [os.path.join(attack_dir, f"image_part_0{i}.png") for i in range(1, 5)]
            if os.path.isdir(attack_dir)
            else [os.path.join(ENEMIES, base, "right", f"image_part_0{i}.png") for i in walk]
        )
        sets = {
            "": [os.path.join(ENEMIES, base, "right", f"image_part_0{i}.png") for i in walk],
            "attack": attack,
        }
        for sub, paths in sets.items():
            for side, flip in (("right", False), ("left", True)):
                folder = os.path.join(ENEMIES, "boss", kind, sub, side) if sub else os.path.join(ENEMIES, "boss", kind, side)
                os.makedirs(folder, exist_ok=True)
                for i, path in enumerate(paths, start=1):
                    frame = boss_frame(Image.open(path).convert("RGBA"), color, amount, anchor)
                    if flip:
                        frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
                    frame.save(os.path.join(folder, f"image_part_0{i}.png"), optimize=True)


def main():
    save_sides([bat(-1), bat(0), bat(1), bat(0)], "bat")
    save_sides([beetle(0), beetle(1), beetle(0), beetle(1)], "beetle")
    save_sides([spitter(0, 1), spitter(0, 1), spitter(1, 1), spitter(1, 0)], "spitter")
    save_sides([spitter(0, 0, -1), spitter(0, 3, 1), spitter(0, 2, 0)], "spitter", "attack")
    for i in range(4):
        save(seed(i), os.path.join(ENEMIES, "spitter", "seed", f"image_part_0{i + 1}.png"))

    for type_ in ("pig", "slime", "chameleon", "beetle"):
        for side, flip in (("right", False), ("left", True)):
            src = Image.open(os.path.join(ENEMIES, type_, "right", "image_part_01.png")).convert("RGBA")
            for i, frame in enumerate(attack_frames(src), start=1):
                folder = os.path.join(ENEMIES, type_, "attack", side)
                os.makedirs(folder, exist_ok=True)
                img = frame.transpose(Image.FLIP_LEFT_RIGHT) if flip else frame
                img.save(os.path.join(folder, f"image_part_0{i}.png"), optimize=True)

    save(heart_icon(), os.path.join(ITEMS, "heart.png"))
    save(shield_icon(), os.path.join(ITEMS, "shield.png"))
    save(triple_icon(), os.path.join(ITEMS, "triple.png"))
    save(wings_icon(), os.path.join(ITEMS, "wings.png"))
    save(heart_icon(), os.path.join(ITEMS, "hud-heart.png"))
    save(heart_icon((70, 60, 80, 255), (100, 90, 110, 255)), os.path.join(ITEMS, "hud-heart-empty.png"))
    bosses()
    print("sprites written")


if __name__ == "__main__":
    main()
