"""
Generates enemy death animations from each enemy's first walk frame.

    python3 scripts/generate-enemy-death.py

Writes app/assets/sprites/enemies/<type>/dead/<left|right>/image_part_0<n>.png.

Every frame is a canvas twice the size of the source sprite. The sprite sits
horizontally centred with its top at 0.75 * height, so the game draws a death
frame at (enemy.x - 0.5 * w, enemy.y - 0.75 * h, 2 * w, 2 * h) where w, h are
the enemy's normal draw size (see Enemy.drawRect in app/game/enemies.js).

Sequence (8 frames): white hit flash -> red squash -> knocked back and tumbling
-> dissolving into a pixel smoke puff -> puff fades with sparkles.
Needs Pillow (pip install pillow). Output is deterministic.
"""

import math
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "app", "assets", "sprites", "enemies")
TYPES = ["pig", "slime", "chameleon"]
FRAMES = 8

SMOKE = (236, 236, 240, 255)
SMOKE_SHADE = (190, 190, 205, 255)
SMOKE_EDGE = (70, 66, 86, 255)
SPARK = (255, 236, 120, 255)
SPARK_HOT = (255, 255, 255, 255)


def white_flash(sprite):
    out = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    px, src = out.load(), sprite.load()
    for y in range(sprite.height):
        for x in range(sprite.width):
            if src[x, y][3] > 0:
                px[x, y] = (255, 255, 255, 255)
    return out


def tint(sprite, color, amount):
    out = sprite.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (
                    round(r + (color[0] - r) * amount),
                    round(g + (color[1] - g) * amount),
                    round(b + (color[2] - b) * amount),
                    a,
                )
    return out


def dissolve(sprite, amount, rng):
    out = sprite.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y][3] and rng.random() < amount:
                px[x, y] = (0, 0, 0, 0)
    return out


def fade(sprite, alpha):
    out = sprite.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, round(a * alpha))
    return out


def transform(sprite, sx=1.0, sy=1.0, angle=0.0):
    w = max(1, round(sprite.width * sx))
    h = max(1, round(sprite.height * sy))
    out = sprite.resize((w, h), Image.NEAREST)
    if angle:
        out = out.rotate(angle, resample=Image.NEAREST, expand=True)
    return out


def paste_centered(canvas, sprite, cx, bottom):
    """Paste with the sprite's bottom-centre at (cx, bottom)."""
    canvas.alpha_composite(sprite, (round(cx - sprite.width / 2), round(bottom - sprite.height)))


def paste_center(canvas, sprite, cx, cy):
    canvas.alpha_composite(sprite, (round(cx - sprite.width / 2), round(cy - sprite.height / 2)))


def puff(draw, cx, cy, size, blobs, progress, alpha=255):
    """Chunky pixel smoke cloud: overlapping circles with a dark rim."""
    edge = SMOKE_EDGE[:3] + (alpha,)
    body = SMOKE[:3] + (alpha,)
    shade = SMOKE_SHADE[:3] + (alpha,)
    for ox, oy, r in blobs:
        rr = max(1, round(r * size))
        x, y = cx + ox * size * progress, cy + oy * size * progress
        draw.ellipse([x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1], fill=edge)
    for ox, oy, r in blobs:
        rr = max(1, round(r * size))
        x, y = cx + ox * size * progress, cy + oy * size * progress
        draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=shade)
        draw.ellipse([x - rr, y - rr, x + rr - max(1, rr // 3), y + rr - max(1, rr // 3)], fill=body)


def sparks(draw, cx, cy, dist, rays, size):
    for i, angle in enumerate(rays):
        x = cx + math.cos(angle) * dist
        y = cy + math.sin(angle) * dist
        s = size if i % 2 == 0 else max(1, size - 1)
        draw.rectangle([x - s, y, x + s, y], fill=SPARK)
        draw.rectangle([x, y - s, x, y + s], fill=SPARK)
        draw.point((x, y), fill=SPARK_HOT)


def build(type_, side):
    src_path = os.path.join(ROOT, type_, side, "image_part_01.png")
    sprite = Image.open(src_path).convert("RGBA")
    w, h = sprite.size
    cw, ch = w * 2, h * 2
    cx = cw / 2
    bottom = h * 0.75 + h  # sprite's resting bottom inside the canvas
    centre_y = bottom - h / 2

    # Knocked back away from the way it faces: facing right tilts back to the left.
    back = 1 if side == "right" else -1
    rng = random.Random(f"{type_}-{side}")
    blobs = [(0, 0, 0.30)] + [
        (math.cos(a) * 0.38, math.sin(a) * 0.30, rng.uniform(0.16, 0.24))
        for a in [i * math.tau / 6 + rng.uniform(-0.3, 0.3) for i in range(6)]
    ]
    rays = [i * math.tau / 6 + 0.4 for i in range(6)]
    unit = min(w, h)

    red = tint(sprite, (255, 70, 70), 0.55)
    frames = []
    for f in range(FRAMES):
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        if f == 0:  # hit flash
            paste_centered(canvas, white_flash(sprite), cx, bottom)
        elif f == 1:  # squash on impact
            paste_centered(canvas, transform(red, 1.18, 0.82), cx, bottom)
        elif f == 2:  # popped up, tilting back
            body = transform(red, 1.0, 1.05, 18 * back)
            paste_center(canvas, body, cx - back * w * 0.05, centre_y - h * 0.14)
        elif f == 3:  # tumbling, smoke starts
            body = transform(tint(red, (40, 20, 30), 0.15), 0.95, 0.95, 50 * back)
            paste_center(canvas, body, cx - back * w * 0.08, centre_y - h * 0.18)
            puff(draw, cx, centre_y + h * 0.05, unit * 0.45, blobs, 0.6)
        elif f == 4:  # dissolving into the puff
            body = dissolve(transform(red, 0.85, 0.85, 85 * back), 0.45, rng)
            paste_center(canvas, body, cx - back * w * 0.1, centre_y - h * 0.12)
            puff(draw, cx, centre_y, unit * 0.62, blobs, 0.85)
        elif f == 5:  # full puff
            body = fade(dissolve(transform(red, 0.7, 0.7, 120 * back), 0.75, rng), 0.7)
            paste_center(canvas, body, cx - back * w * 0.1, centre_y - h * 0.1)
            puff(draw, cx, centre_y - h * 0.05, unit * 0.72, blobs, 1.0)
            sparks(draw, cx, centre_y - h * 0.05, unit * 0.8, rays, 2)
        elif f == 6:  # puff breaking up
            puff(draw, cx, centre_y - h * 0.12, unit * 0.6, blobs[1:], 1.35, 200)
            sparks(draw, cx, centre_y - h * 0.1, unit * 0.95, rays, 1)
        else:  # last wisps
            puff(draw, cx, centre_y - h * 0.2, unit * 0.4, blobs[1::2], 1.7, 120)
        frames.append(canvas)
    return frames


def main():
    for type_ in TYPES:
        for side in ("left", "right"):
            out_dir = os.path.join(ROOT, type_, "dead", side)
            os.makedirs(out_dir, exist_ok=True)
            for i, frame in enumerate(build(type_, side), start=1):
                frame.save(os.path.join(out_dir, f"image_part_0{i}.png"), optimize=True)
        print(f"{type_}: {FRAMES} frames x 2 sides")


if __name__ == "__main__":
    main()
