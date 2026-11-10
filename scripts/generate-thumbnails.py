"""
Renders level-select thumbnails (app/images/area_N.png) from the area JSON,
drawing the same layers as the game's render(): background, water, tiles,
decor, coins, enemies, the player at the level start, and the HUD.

    python3 scripts/generate-thumbnails.py          # generated levels (ids 9-16)
    python3 scripts/generate-thumbnails.py 1 7      # specific area ids

`yarn levels` runs it after regenerating. Needs Pillow.
"""

import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "app")
SPRITES = os.path.join(ROOT, "assets", "sprites")
SCALE = 4  # render at 4x world pixels, then fit to the thumbnail size
OUT_SIZE = (1304, 740)  # size of the existing thumbnails
TILE = 16

ENEMY_SIZE = {"pig": (21, 20), "slime": (23, 20), "chameleon": (22, 20)}

_cache = {}


def sprite(path):
    if path not in _cache:
        _cache[path] = Image.open(os.path.join(SPRITES, path)).convert("RGBA")
    return _cache[path]


def levels():
    """LEVELS from app/util/index.js: id -> (name, areaNum, left, top, thumbnail)."""
    text = open(os.path.join(ROOT, "util", "index.js")).read()
    pattern = r'\{ name: "([^"]+)", id: (\d+), left: (\d+), top: (\d+), ss: "images/(area_\d+)\.png" \}'
    out = {}
    for index, (name, id_, left, top, ss) in enumerate(re.findall(pattern, text), start=1):
        out[int(id_)] = (name, index, int(left), int(top), ss)
    return out


def font(size):
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def render(area, area_num, left, top):
    rows, cols = len(area["areaMap"]), len(area["areaMap"][0])
    world = area.get("world", 1)
    canvas = Image.new("RGBA", (cols * TILE * SCALE, rows * TILE * SCALE))

    def draw(img, x, y, w, h):
        w, h = round(w * SCALE), round(h * SCALE)
        if w <= 0 or h <= 0:
            return
        canvas.alpha_composite(img.resize((w, h), Image.NEAREST), (round(x * SCALE), round(y * SCALE)))

    bg = sprite(f"world-{world}/bg.png").resize(canvas.size, Image.BILINEAR)
    canvas.alpha_composite(bg)

    for w in area.get("water", []):
        draw(sprite("water/image 1.webp"), w["left"] * TILE, w["top"] * TILE, TILE, TILE)

    for r, row in enumerate(area["areaMap"]):
        for c, value in enumerate(row):
            for v in value if isinstance(value, list) else [value]:
                if v:
                    draw(sprite(f"world-{world}/tiles/{v}.png"), c * TILE, r * TILE, TILE, TILE)

    for r, row in enumerate(area["objectsMap"]):
        for c, value in enumerate(row):
            for o in value or []:
                draw(
                    sprite(f"world-{world}/objects/{o['id']}.png"),
                    c * TILE + o.get("xOffset", 0),
                    r * TILE + o.get("yOffset", 0),
                    o.get("width", 16),
                    o.get("height", 16),
                )

    for coin in area["coins"]:
        draw(
            sprite("coin/image 1.webp"),
            coin["left"] * TILE + coin.get("offsetX", 3),
            coin["top"] * TILE + coin.get("offsetY", 3),
            8,
            10,
        )

    for e in area["enemies"]:
        w, h = ENEMY_SIZE.get(e["type"], (20, 20))
        side = "left" if e.get("dir", 1) < 0 else "right"
        draw(sprite(f"enemies/{e['type']}/{side}/image_part_01.png"), e["left"] * TILE, e["top"] * TILE - 3, w, h)

    # player: drop from the start position onto the first surface below it
    col = int((left + 6) // TILE)
    ground = next(
        (r for r in range(max(0, int((top + 12) // TILE)), rows) if "t" in (area["collisonMap"][r][col] or "")),
        rows,
    )
    py = ground * TILE - 12
    draw(sprite("player/right/Idle (1).webp"), left - 12, py - 23, 60, 40)

    # HUD (same positions as app/index.js)
    hud = ImageDraw.Draw(canvas)
    f = font(10 * SCALE)

    def text(value, x, y):
        hud.text((x * SCALE, y * SCALE), str(value), font=f, fill="black", anchor="ls")

    draw(sprite("coin/image 1.webp"), (cols - 1.3) * 16, 8, 10, 10)
    text("x", (cols - 2) * 16, 15)
    text(0, (cols - 2.7) * 16, 16.1)
    text("Area", 12, 15.3)
    text("x", 38, 15)
    text(area_num, 48, 15.3)
    text(0, (cols - 2.7) * 9, 15.3)

    return canvas.convert("RGB").resize(OUT_SIZE, Image.LANCZOS)


def main():
    ids = [int(a) for a in sys.argv[1:]] or list(range(9, 17))
    meta = levels()
    for id_ in ids:
        name, area_num, left, top, ss = meta[id_]
        area = json.load(open(os.path.join(ROOT, "areas", f"area-{id_}.json")))
        render(area, area_num, left, top).save(os.path.join(ROOT, "images", f"{ss}.png"), optimize=True)
        print(f"{name}: images/{ss}.png")


if __name__ == "__main__":
    main()
