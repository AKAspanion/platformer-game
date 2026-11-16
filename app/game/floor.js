/**
 * The floor of a world: how its ground feels (slippery or not) and the light
 * texture on top of it (grass, powder snow, sand, moss, dust) that the dino
 * and a boss press down as they walk. Enemies don't touch it.
 *
 * Every open run of standable tops in the collision map ("t") gets a dense
 * fringe of 1px strands, in two layers: the back one is drawn behind
 * everything that stands on the floor, the short front one over their feet,
 * so they stand in the grass. A run's rounded ends are left bare and the
 * strands get shorter towards them.
 *
 * A foot flattens the strands under it and parts the ones at its edges (grass
 * bends aside, snow and sand squash up into a little ridge); they spring back
 * at the texture's own pace: grass at once, snow footprints linger. Nobody
 * on it, it lies still.
 *
 * The factory's floor is bare metal: no texture, nothing to press.
 */

// How each texture behaves. Each layer: `step` px between strands, `chance`
// a slot has one, `heights` [min, max] px, `mound` px over which heights rise
// and fall (clumps, drifts), `jitter` how much each strand differs from its
// neighbours (spiky grass vs smooth snow, default 0.35), `spike` odds of an
// extra-tall strand. Then:
// `lean` strands bend aside, `squish` the floor
// beside a foot rises, `recover` press lost per tick, `flat` how much of a
// pressed strand still shows.
export const TEXTURES = {
  blades: {
    back: { step: 1, chance: 0.92, heights: [1, 5], mound: 6, jitter: 0.6, spike: 0.15 },
    front: { step: 1, chance: 0.55, heights: [1, 2], mound: 3, jitter: 0.5, spike: 0 },
    lean: true,
    squish: false,
    recover: 0.07,
    flat: 0.2,
  },
  powder: {
    back: { step: 1, chance: 1, heights: [1, 4], mound: 7, jitter: 0.12, spike: 0 },
    lean: false,
    squish: true,
    recover: 0.006,
    flat: 0,
  },
  grit: {
    back: { step: 1, chance: 0.9, heights: [1, 3], mound: 5, spike: 0 },
    lean: false,
    squish: true,
    recover: 0.02,
    flat: 0,
  },
  tufts: {
    back: { step: 1, chance: 0.6, heights: [1, 4], mound: 3, spike: 0.08 },
    front: { step: 2, chance: 0.4, heights: [1, 2], mound: 3, spike: 0 },
    lean: true,
    squish: false,
    recover: 0.05,
    flat: 0.3,
  },
  dust: {
    back: { step: 2, chance: 0.35, heights: [1, 1], mound: 1, spike: 0 },
    lean: true,
    squish: false,
    recover: 0.015,
    flat: 0,
  },
};

/**
 * Story worlds by number. `back` / `front` are the colours of each layer,
 * `packed` the mark a foot leaves on the surface. Iceland is the slippery one.
 */
export const FLOORS = {
  1: {
    texture: "blades",
    back: ["#7ea51e", "#8fb021", "#9cc02a"],
    front: ["#c6de5c", "#b3d02a"],
    packed: "#7a9a1c",
  },
  2: {
    texture: "powder",
    back: ["#ffffff", "#f4fbff", "#e6f6ff"],
    packed: "#b4d8ef",
    slippery: true,
  },
  3: { texture: "grit", back: ["#f5e9ce", "#f3d594", "#f0c37a"], packed: "#d6a85e" },
  4: {
    texture: "tufts",
    back: ["#2f5a5a", "#3f7a72", "#4b8a70"],
    front: ["#5c9a7a"],
    packed: "#244249",
  },
  5: { texture: null }, // the factory: clean metal
};

// Slippery ground: the dino keeps more of its speed (friction) and picks up
// speed a little slower, so its top speed stays about the same: it only takes
// a bit longer to start and stop. Only on the ground; jumps are unchanged.
export const SLIPPERY = { friction: 0.91, accel: 0.33 };

/** Px left bare at a run's open end (the tiles' rounded corners). */
export const EDGE_INSET = 3;
const TAPER = 6; // px over which strands shorten towards a run's end

const DEFAULT = { texture: null, back: [], front: [], packed: null, slippery: false };

/** The floor an area stands on: its own `floor` (generated worlds), else its world's. */
export function floorFor(data = {}) {
  const floor = data.floor || FLOORS[data.world] || FLOORS[1];
  return { ...DEFAULT, ...floor, slippery: !!floor.slippery };
}

/** Every colour of a floor's texture (for the bits a foot kicks up). */
export const floorColors = (floor) => [...(floor.back || []), ...(floor.front || [])];

// deterministic noise, 0..1
const noise = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// noise that rises and falls smoothly over `period` px (clumps and drifts)
const smooth = (x, period, y, seed) => {
  if (period <= 1) return noise(x, y, seed);
  const i = Math.floor(x / period);
  const f = x / period - i;
  const t = f * f * (3 - 2 * f);
  return noise(i, y, seed) * (1 - t) + noise(i + 1, y, seed) * t;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** A cell is open floor: a standable top with nothing solid right on it. */
const openTop = (map, r, c) => {
  const value = map[r] && map[r][c];
  if (typeof value !== "string" || !value.includes("t")) return false;
  const above = r > 0 && map[r - 1][c];
  return !(typeof above === "string" && above !== "");
};

export default class Ground {
  /**
   * `collisonMap` as in area data, `floor` from floorFor(), `seed` keeps the
   * strands the same each time the level is played.
   */
  constructor(collisonMap = [], floor = DEFAULT, tileSize = 16, seed = 1) {
    this.floor = floor;
    this.tileSize = tileSize;
    this.strands = [];
    this.cells = new Map(); // "row,col" -> strands on that tile's top
    this.rects = new Map(); // colour -> [x, y, w, h, ...], reused each draw
    const kind = TEXTURES[floor.texture];
    if (!kind || !floor.back || !floor.back.length) return;
    this.kind = kind;

    const layers = [
      { layer: 0, spec: kind.back, colors: floor.back },
      ...(kind.front && floor.front && floor.front.length
        ? [{ layer: 1, spec: kind.front, colors: floor.front }]
        : []),
    ];

    collisonMap.forEach((row, r) => {
      const columns = row.length;
      let c = 0;
      while (c < columns) {
        if (!openTop(collisonMap, r, c)) {
          c += 1;
          continue;
        }
        let end = c;
        while (end + 1 < columns && openTop(collisonMap, r, end + 1)) end += 1;
        // the map's own edges carry on off screen: only a real end is rounded
        const from = c * tileSize + (c > 0 ? EDGE_INSET : 0);
        const to = (end + 1) * tileSize - (end < columns - 1 ? EDGE_INSET : 0);
        const fade = (x) =>
          Math.min(c > 0 ? x - from : Infinity, end < columns - 1 ? to - 1 - x : Infinity);
        layers.forEach((l) => this.grow(r, from, to, fade, l, seed));
        c = end + 1;
      }
    });
  }

  /** Strands of one layer along row `r` from px `from` to `to`. */
  grow(r, from, to, fade, { layer, spec, colors }, seed) {
    const { tileSize } = this;
    const [min, max] = spec.heights;
    const s = seed + layer * 7919;
    for (let x = from; x < to; x++) {
      if ((x - from) % spec.step !== 0) continue;
      if (noise(x, r, s) > spec.chance) continue;
      const lump = smooth(x, spec.mound, r * 13, s + 1);
      const jitter = spec.jitter ?? 0.35;
      const mix = (1 - jitter) * lump + jitter * noise(x, r, s + 2);
      let h = min + Math.round((max - min) * mix);
      if (spec.spike && noise(x, r, s + 3) < spec.spike) h += 1 + Math.round(noise(x, r, s + 4));
      // shorter towards a run's end
      const edge = fade(x);
      if (edge < TAPER) h = Math.min(h, 1 + Math.floor(edge / 2));
      if (h < 1) continue;
      const strand = {
        x,
        y: r * tileSize,
        h,
        layer,
        color: colors[Math.floor(noise(x, r, s + 5) * colors.length)],
        press: 0,
        lean: 0,
      };
      this.strands.push(strand);
      const key = `${r},${Math.floor(x / tileSize)}`;
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(strand);
    }
  }

  /** Strands on the tops of `row` between x `from` and `to` (world px). */
  strandsAt(row, from, to) {
    const out = [];
    const first = Math.floor(from / this.tileSize);
    const last = Math.floor(to / this.tileSize);
    for (let c = first; c <= last; c++) {
      const list = this.cells.get(`${row},${c}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s.x >= from && s.x <= to) out.push(s);
      }
    }
    return out;
  }

  /**
   * A foot on the floor: `left`..`right` (px) standing at `bottom`, moving at
   * `vx`. Strands under it flatten; those just past its edges bend aside (or
   * squash up into a ridge). `spread` widens the edge (a hard landing).
   * Returns how many strands it touched (0: bare floor).
   */
  step({ left, right, bottom, vx = 0, spread = 3 }) {
    if (!this.kind) return 0;
    const { lean, squish } = this.kind;
    const row = Math.round(bottom / this.tileSize);
    const centre = (left + right) / 2;
    const strands = this.strandsAt(row, left - spread, right + spread);
    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      const side = s.x + 0.5 < centre ? -1 : 1;
      if (s.x + 1 > left && s.x < right) {
        s.press = 1;
        if (lean) s.lean = clamp(side + vx * 0.5, -2, 2);
      } else if (squish) {
        // pushed up beside the foot, unless already a footprint
        if (s.press <= 0.05) s.press = Math.min(s.press, -0.5);
      } else {
        s.press = Math.max(s.press, 0.35);
        if (lean) s.lean = clamp(side * 1.5 + vx * 0.3, -2, 2);
      }
    }
    return strands.length;
  }

  /** A heavy blow on the floor at (x, y): everything within `radius` px is flattened. */
  impact(x, y, radius = 20) {
    return this.step({ left: x - radius, right: x + radius, bottom: y, spread: 4 });
  }

  /** Pressed strands spring back, bent ones straighten. */
  update() {
    if (!this.kind) return;
    const { recover } = this.kind;
    for (let i = 0; i < this.strands.length; i++) {
      const s = this.strands[i];
      if (s.press > 0) s.press = Math.max(0, s.press - recover);
      else if (s.press < 0) s.press = Math.min(0, s.press + recover);
      if (s.lean !== 0) {
        s.lean *= 0.85;
        if (Math.abs(s.lean) < 0.05) s.lean = 0;
      }
    }
  }

  /**
   * Draw one layer: 0 (back, with the footprints) after the tiles and before
   * anything standing on the floor, 1 (front) over their feet. Strands are
   * batched into one path per colour.
   */
  draw(ctx, layer = 0) {
    if (!this.kind || !this.strands.length) return;
    const { flat } = this.kind;
    const packed = this.floor.packed;
    const { rects } = this;
    rects.forEach((list) => (list.length = 0));
    const add = (color, x, y, w, h) => {
      let list = rects.get(color);
      if (!list) rects.set(color, (list = []));
      list.push(x, y, w, h);
    };

    for (let i = 0; i < this.strands.length; i++) {
      const s = this.strands[i];
      if (s.layer !== layer) continue;
      // a foot's mark on the surface itself
      if (layer === 0 && packed && s.press > 0.3) add(packed, s.x, s.y, 1, 1);
      const height = s.press > 0 ? s.h * (1 - s.press * (1 - flat)) : s.h * (1 - s.press);
      if (height < 0.5) continue;
      const h = Math.max(1, Math.round(height));
      const lean = Math.round(s.lean);
      if (lean && h >= 2) {
        const low = Math.ceil(h / 2);
        add(s.color, s.x, s.y - low, 1, low);
        add(s.color, s.x + lean, s.y - h, 1, h - low);
      } else {
        add(s.color, s.x + (h === 1 ? lean : 0), s.y - h, 1, h);
      }
    }

    rects.forEach((list, color) => {
      if (!list.length) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 4)
        ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 3]);
      ctx.fill();
    });
  }
}
