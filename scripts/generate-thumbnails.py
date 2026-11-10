"""
Renders level-select thumbnails (app/images/levels/area-<id>.webp) from the area JSON,
drawing the same layers as the game's render(): background, back wall,
water, tiles, decor, coins, power-ups, enemies and the player at the start.

    python3 scripts/generate-thumbnails.py          # every level in the level select
    python3 scripts/generate-thumbnails.py 1 7      # specific area ids

`yarn levels` runs it after regenerating. Needs Pillow.
"""

import json
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "app")
SPRITES = os.path.join(ROOT, "assets", "sprites")
SCALE = 4  # render at 4x world pixels, then fit to the thumbnail size
OUT_SIZE = (512, 292)  # level-select tiles are ~150-250px wide
TILE = 16

# draw sizes from app/game/enemies.js
ENEMY_SIZE = {
    "pig": (21, 20),
    "slime": (23, 20),
    "chameleon": (22, 20),
    "beetle": (20, 14),
    "bat": (18, 12),
    "spitter": (16, 18),
}
POWERUP_SIZE = {"heart": (11, 10), "shield": (12, 13), "triple": (13, 12), "wings": (13, 11)}

_cache = {}


def sprite(path):
    if path not in _cache:
        _cache[path] = Image.open(os.path.join(SPRITES, path)).convert("RGBA")
    return _cache[path]


def levels():
    """LEVELS from app/util/index.js: id -> (name, campaign number, left, top)."""
    text = open(os.path.join(ROOT, "util", "index.js")).read()
    pattern = r'\{ name: "([^"]+)", id: (\d+), world: "[^"]+", left: (\d+), top: (\d+)'
    out = {}
    for index, (name, id_, left, top) in enumerate(re.findall(pattern, text), start=1):
        out[int(id_)] = (name, index, int(left), int(top))
    return out


# boss draw size (from app/game/boss.js) and crown headroom ratio
BOSS = {
    "kingPig": (44, 40, 60),
    "frostSlime": (50, 34, 60),
    "sandLizard": (44, 40, 76),
    "batLord": (44, 30, 48),
    "mechBeetle": (46, 32, 56),
}


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

    for r, row in enumerate(area.get("backdrop") or []):
        for c, v in enumerate(row):
            if v:
                draw(sprite(f"world-{world}/tiles/{v}.png"), c * TILE, r * TILE, TILE, TILE)

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
        y = e["top"] * TILE + 2 if e["type"] == "bat" else (e["top"] + 1) * TILE - h
        draw(sprite(f"enemies/{e['type']}/{side}/image_part_01.png"), e["left"] * TILE, y + 1, w, h)

    for p in area.get("powerups", []):
        w, h = POWERUP_SIZE[p["type"]]
        x, y = p["left"] * TILE + (16 - w) / 2, p["top"] * TILE + (16 - h) / 2
        glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        cx, cy, rad = (x + w / 2) * SCALE, (y + h / 2) * SCALE, 9 * SCALE
        ImageDraw.Draw(glow).ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=(255, 240, 160, 70))
        canvas.alpha_composite(glow)
        draw(sprite(f"items/{p['type']}.png"), x, y, w, h)

    boss = area.get("boss")
    if boss:
        w, h, base_h = BOSS[boss["kind"]]
        crown = h * 24 / base_h
        y = 34 if boss["kind"] == "batLord" else (boss["top"] + 1) * TILE - h
        draw(sprite(f"enemies/boss/{boss['kind']}/left/image_part_01.png"), boss["left"] * TILE, y - crown + 1, w, h + crown)

    # player: drop from the start position onto the first surface below it
    col = int((left + 6) // TILE)
    ground = next(
        (r for r in range(max(0, int((top + 12) // TILE)), rows) if "t" in (area["collisonMap"][r][col] or "")),
        rows,
    )
    py = ground * TILE - 12
    draw(sprite("player/right/Idle (1).webp"), left - 12, py - 23, 60, 40)

    # no HUD: the level select prints the level name over the picture
    return canvas.convert("RGB").resize(OUT_SIZE, Image.LANCZOS)


def main():
    ids = [int(a) for a in sys.argv[1:]] or sorted(levels())
    meta = levels()
    for id_ in ids:
        name, area_num, left, top = meta[id_]
        area = json.load(open(os.path.join(ROOT, "areas", f"area-{id_}.json")))
        out = os.path.join(ROOT, "images", "levels", f"area-{id_}.webp")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        render(area, area_num, left, top).save(out, quality=82, method=6)
        print(f"{name}: images/levels/area-{id_}.webp")


if __name__ == "__main__":
    main()
