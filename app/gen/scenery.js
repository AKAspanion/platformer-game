import { Pix, rgb, shade, mix, luma } from "./pixels";

/**
 * A world's scenery from its spec: ground tiles (in the layout of the
 * generator's TILES_A ids), the sky backdrop, decorations, spikes, signs and
 * animated liquid frames. Every buffer is world-pixel sized (16px tiles).
 */

const T = 16;
const WHITE = [255, 255, 255];

// deterministic per-pixel noise, 0..1
const noise = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const paletteOf = (spec) => {
  const p = spec.palette;
  const ground = rgb(p.ground);
  const surface = rgb(p.surface);
  return {
    skyTop: rgb(p.skyTop),
    skyBottom: rgb(p.skyBottom),
    ground,
    groundDark: shade(ground, -0.3),
    groundLight: shade(ground, 0.18),
    surface,
    surfaceLight: shade(surface, 0.3),
    surfaceDark: shade(surface, -0.28),
    accent: rgb(p.accent),
    liquid: rgb(p.liquid),
    outline: mix(shade(ground, -0.6), [16, 10, 24], 0.4),
  };
};

// ---------------------------------------------------------------------- tiles

/** Base ground texture for one 16x16 tile. */
function groundFill(pix, c, style, seed, x0 = 0, y0 = 0, w = T, h = T) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const n = noise(x, y, seed);
      let color = c.ground;
      switch (style) {
        case "stone":
        case "moss": {
          const row = Math.floor(y / 5);
          const mortar = y % 5 === 4 || (x + (row % 2) * 5) % 10 === 0;
          color = mortar ? c.groundDark : n > 0.8 ? c.groundLight : c.ground;
          break;
        }
        case "metal": {
          const seam = x % 16 === 0 || y % 8 === 7;
          const rivet = (x % 16 === 2 || x % 16 === 13) && y % 8 === 2;
          color = seam ? c.groundDark : rivet ? c.groundLight : n > 0.92 ? c.groundDark : c.ground;
          break;
        }
        case "crystal": {
          const facet = (x + y * 2) % 9 === 0 || (x * 2 - y + 32) % 11 === 0;
          color = facet ? c.groundLight : n > 0.9 ? mix(c.ground, c.accent, 0.4) : c.ground;
          break;
        }
        case "candy": {
          const band = Math.floor(y / 4) % 3;
          color = band === 1 ? mix(c.ground, WHITE, 0.25) : band === 2 ? c.groundDark : c.ground;
          if (n > 0.95) color = c.accent;
          break;
        }
        case "ash":
          color =
            n > 0.97 ? c.accent : n > 0.85 ? c.groundLight : n < 0.1 ? c.groundDark : c.ground;
          break;
        default:
          color = n > 0.86 ? c.groundLight : n < 0.12 ? c.groundDark : c.ground;
      }
      pix.set(x, y, color);
    }
}

/** The surface layer on top of a ground tile; `edgeL` / `edgeR` round the corners. */
function surfaceTop(pix, c, style, seed, { edgeL = false, edgeR = false } = {}) {
  for (let x = 0; x < T; x++) {
    const n = noise(x, 99, seed);
    let depth = 4;
    if (style === "grass" || style === "moss") depth = 3 + Math.floor(n * 3);
    if (style === "snow" || style === "candy") depth = 4 + (n > 0.7 ? 2 : n > 0.4 ? 1 : 0);
    if (style === "sand") depth = 3;
    if (style === "metal") depth = 3;
    if (style === "crystal") depth = 2 + Math.floor(n * 4);
    for (let y = 0; y < depth; y++) {
      let color = y === 0 ? c.surfaceLight : y === depth - 1 ? c.surfaceDark : c.surface;
      if (style === "metal" && y === 1) color = (x >> 1) % 2 ? c.accent : c.outline;
      if (style === "candy" && y > 0 && noise(x, y, seed + 3) > 0.85)
        color = [c.accent, [255, 255, 255], [120, 220, 255]][Math.floor(noise(x, y, seed) * 3)];
      if (style === "ash" && y > 0 && noise(x, y, seed + 5) > 0.9) color = c.accent;
      pix.set(x, y, color);
    }
    // grass blades poke above the edge of the tile below the top row
    if ((style === "grass" || style === "moss") && n > 0.55) pix.set(x, depth, c.surfaceDark);
  }
  const cut = (x, y) => pix.clear(x, y);
  if (edgeL) {
    cut(0, 0);
    cut(1, 0);
    cut(0, 1);
  }
  if (edgeR) {
    cut(T - 1, 0);
    cut(T - 2, 0);
    cut(T - 1, 1);
  }
}

const sideEdge = (pix, c, side) => {
  const x = side < 0 ? 0 : T - 1;
  for (let y = 0; y < T; y++) {
    if (!pix.alphaAt(x, y)) continue;
    pix.set(x, y, c.outline);
    pix.set(x - side, y, shade(pix.get(x - side, y), side < 0 ? 0.12 : -0.15));
  }
};

/**
 * Ground tiles by id (TILES_A layout): 1 topLeft, 2 top, 3 topRight, 4 left,
 * 5 fill, 6 right, 8 innerLeft, 10 innerRight, 13-15 platform. Unused ids get
 * the fill tile so nothing ever draws a blank.
 */
export function buildTiles(spec, seed) {
  const c = paletteOf(spec);
  const style = spec.terrain.surface;
  const tile = (fn) => {
    const pix = new Pix(T, T);
    groundFill(pix, c, style, seed);
    fn(pix);
    return pix;
  };
  const tiles = [];
  tiles[5] = tile(() => {});
  tiles[2] = tile((p) => surfaceTop(p, c, style, seed));
  tiles[1] = tile((p) => {
    surfaceTop(p, c, style, seed, { edgeL: true });
    sideEdge(p, c, -1);
  });
  tiles[3] = tile((p) => {
    surfaceTop(p, c, style, seed, { edgeR: true });
    sideEdge(p, c, 1);
  });
  tiles[4] = tile((p) => sideEdge(p, c, -1));
  tiles[6] = tile((p) => sideEdge(p, c, 1));
  tiles[8] = tile((p) => {
    p.rect(0, 0, 2, 2, c.outline);
    p.set(2, 0, c.groundDark);
  });
  tiles[10] = tile((p) => {
    p.rect(T - 2, 0, 2, 2, c.outline);
    p.set(T - 3, 0, c.groundDark);
  });
  // floating platforms: a slab with a rounded underside
  const plat = (left, right) => {
    const pix = new Pix(T, T);
    const depth = 10;
    groundFill(pix, c, style, seed + 1, 0, 0, T, depth);
    for (let x = 0; x < T; x++) {
      const end = (left && x < 3 ? 3 - x : 0) + (right && x > T - 4 ? x - (T - 4) : 0);
      for (let y = depth - end; y < depth; y++) pix.clear(x, y);
      pix.set(x, depth - 1 - end, c.outline);
    }
    surfaceTop(pix, c, style, seed, { edgeL: left, edgeR: right });
    if (left) sideEdge(pix, c, -1);
    if (right) sideEdge(pix, c, 1);
    return pix;
  };
  tiles[13] = plat(true, false);
  tiles[14] = plat(false, false);
  tiles[15] = plat(false, true);
  for (let id = 1; id <= 25; id++) if (!tiles[id]) tiles[id] = tiles[5];
  tiles[0] = null;
  return tiles;
}

// ------------------------------------------------------------------ backdrop

/** The sky picture behind a level: 336x192 (21 x 12 tiles). */
export function buildBackground(spec, seed, width = 21 * T, height = 12 * T) {
  const c = paletteOf(spec);
  const pix = new Pix(width, height);
  const { skyline, celestial } = spec.backdrop;
  const dark = luma(c.skyTop) < 0.3;

  // banded gradient (pixel-art dithering at the band edges)
  const bands = 10;
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const dither = (x + y) % 2 ? 0.5 / bands : 0;
      const step = Math.floor((t + dither) * bands) / bands;
      pix.set(x, y, mix(c.skyTop, c.skyBottom, step));
    }
  }

  // stars on dark skies
  if (dark || celestial === "stars") {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(noise(i, 1, seed) * width);
      const y = Math.floor(noise(i, 2, seed) * height * 0.7);
      pix.set(x, y, WHITE, 0.35 + noise(i, 3, seed) * 0.6);
      if (i % 15 === 0) {
        pix.set(x - 1, y, WHITE, 0.4);
        pix.set(x + 1, y, WHITE, 0.4);
        pix.set(x, y - 1, WHITE, 0.4);
        pix.set(x, y + 1, WHITE, 0.4);
      }
    }
  }

  const sunX = width * (0.62 + noise(1, 9, seed) * 0.25);
  if (celestial === "sun") {
    const glow = mix(c.skyBottom, [255, 240, 180], 0.5);
    pix.circle(sunX, 42, 26, glow, 0.25);
    pix.circle(sunX, 42, 19, glow, 0.35);
    pix.circle(sunX, 42, 13, [255, 236, 150]);
    pix.circle(sunX - 3, 39, 8, [255, 250, 210]);
  } else if (celestial === "moon" || celestial === "twin-moons") {
    const moon = (x, y, r) => {
      pix.circle(x, y, r + 6, WHITE, 0.08);
      pix.circle(x, y, r, [236, 236, 220]);
      pix.circle(x + r * 0.35, y - r * 0.2, r * 0.25, [200, 200, 190]);
      pix.circle(x - r * 0.3, y + r * 0.35, r * 0.18, [205, 205, 195]);
    };
    moon(sunX, 40, 12);
    if (celestial === "twin-moons") moon(sunX - 60, 62, 7);
  }

  // clouds on bright skies
  if (!dark && skyline !== "cavern") {
    for (let i = 0; i < 5; i++) {
      const x = noise(i, 4, seed) * width;
      const y = 20 + noise(i, 5, seed) * 50;
      const s = 6 + noise(i, 6, seed) * 6;
      [
        [0, 0, 1.6],
        [s * 1.2, -s * 0.4, 1.2],
        [s * 2.4, 0, 1.4],
        [s * 1.2, s * 0.2, 1.4],
      ].forEach(([dx, dy, k]) =>
        pix.ellipse(x + dx, y + dy, s * k, s * 0.75 * k * 0.7, WHITE, 0.75),
      );
    }
  }

  const far = mix(mix(c.skyBottom, c.ground, 0.3), c.skyTop, 0.15);
  const near = mix(c.skyBottom, c.ground, 0.62);
  const ridge = (base, amp, color, fn) => {
    for (let x = 0; x < width; x++) {
      const top = Math.round(base - fn(x) * amp);
      for (let y = Math.max(0, top); y < height; y++) pix.set(x, y, color);
      pix.set(x, top, shade(color, 0.12));
    }
  };
  const waves = (x, k, phase) =>
    (Math.sin(x * 0.021 * k + phase) + Math.sin(x * 0.047 * k + phase * 2) * 0.5 + 1.5) / 3;
  const ph = noise(3, 3, seed) * 10;

  switch (skyline) {
    case "mountains": {
      // snow caps only where it's cold or bright, not on a volcano
      const snowy = spec.terrain.surface === "snow" || luma(c.skyTop) > 0.55;
      const peaks = (x, w, h, off) => {
        const m = ((x + off) % w) / w;
        return (1 - Math.abs(m - 0.5) * 2) * h;
      };
      for (let x = 0; x < width; x++) {
        const h = Math.max(peaks(x, 90, 1, ph * 9), peaks(x, 60, 0.75, ph * 20));
        const top = Math.round(150 - h * 85);
        for (let y = top; y < height; y++) {
          pix.set(x, y, snowy && y < top + 10 && h > 0.7 ? mix(far, WHITE, 0.7) : far);
        }
      }
      ridge(160, 26, near, (x) => waves(x, 1.2, ph));
      break;
    }
    case "dunes":
      ridge(140, 26, far, (x) => (Math.sin(x * 0.015 + ph) + 1) / 2);
      ridge(162, 22, near, (x) => (Math.sin(x * 0.024 + ph * 2) + 1) / 2);
      break;
    case "forest":
      ridge(140, 26, far, (x) => waves(x, 1, ph));
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * width + noise(i, 7, seed) * 10;
        const h = 22 + noise(i, 8, seed) * 22;
        pix.tri(x - 9, 170, x + 9, 170, x, 170 - h, near);
        pix.tri(x - 7, 170 - h * 0.4, x + 7, 170 - h * 0.4, x, 170 - h * 1.1, near);
      }
      pix.rect(0, 168, width, height - 168, near);
      break;
    case "city": {
      ridge(150, 10, far, (x) => waves(x, 2, ph));
      let x = 0;
      for (let i = 0; x < width; i++) {
        const w = 14 + Math.floor(noise(i, 10, seed) * 22);
        const h = 30 + Math.floor(noise(i, 11, seed) * 70);
        pix.rect(x, 175 - h, w - 2, h + 20, near);
        for (let wy = 175 - h + 4; wy < 170; wy += 6)
          for (let wx = x + 3; wx < x + w - 5; wx += 5)
            if (noise(wx, wy, seed) > 0.55) pix.rect(wx, wy, 2, 2, c.accent, 0.8);
        x += w;
      }
      break;
    }
    case "spires":
      ridge(150, 20, far, (x) => waves(x, 1, ph));
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * width + noise(i, 12, seed) * 20;
        const h = 40 + noise(i, 13, seed) * 60;
        const w = 6 + noise(i, 14, seed) * 8;
        pix.rect(x - w / 2, 175 - h, w, h + 20, near);
        pix.tri(x - w / 2 - 2, 176 - h, x + w / 2 + 2, 176 - h, x, 160 - h, near);
        if (noise(i, 15, seed) > 0.4) pix.rect(x - 1, 185 - h * 0.6, 2, 3, c.accent);
      }
      pix.rect(0, 172, width, height - 172, near);
      break;
    case "clouds":
      ridge(165, 18, far, (x) => waves(x, 1.4, ph));
      for (let i = 0; i < 18; i++) {
        const x = (i / 18) * width;
        pix.circle(
          x,
          176 + noise(i, 16, seed) * 6,
          16 + noise(i, 17, seed) * 10,
          mix(WHITE, c.skyBottom, 0.25),
        );
      }
      break;
    case "cavern":
      ridge(160, 24, far, (x) => waves(x, 1.3, ph));
      for (let i = 0; i < 24; i++) {
        const x = (i / 24) * width + noise(i, 18, seed) * 8;
        const h = 14 + noise(i, 19, seed) * 40;
        pix.tri(x - 7, 0, x + 7, 0, x, h, near);
      }
      pix.rect(0, 0, width, 6, near);
      break;
    default:
      ridge(145, 30, far, (x) => waves(x, 1, ph));
      ridge(168, 22, near, (x) => waves(x, 1.6, ph + 2));
  }
  return pix;
}

// --------------------------------------------------------------------- decor

const BIG = [
  "tree",
  "pine",
  "palm",
  "cactus",
  "crystal",
  "tombstone",
  "lamp",
  "pipe",
  "coral",
  "mushroom",
];
const SMALL = ["rock", "bush", "flower", "bones", "mushroom", "crystal", "tombstone"];

function drawDecor(type, w, h, c, seed) {
  const pix = new Pix(w, h);
  const trunk = mix(c.ground, [90, 56, 32], 0.55);
  let leaf = c.surface;
  if (luma(leaf) > 0.8) leaf = mix(c.surface, [40, 110, 80], 0.55);
  if (luma(leaf) < 0.15) leaf = shade(leaf, 0.3);
  const leafLight = shade(leaf, 0.25);
  const leafDark = shade(leaf, -0.25);
  const cx = w / 2;
  switch (type) {
    case "tree":
      pix.rect(cx - w * 0.07, h * 0.5, w * 0.14, h * 0.5, trunk);
      pix.circle(cx, h * 0.38, w * 0.36, leafDark);
      pix.circle(cx - w * 0.06, h * 0.33, w * 0.3, leaf);
      pix.circle(cx - w * 0.12, h * 0.26, w * 0.14, leafLight);
      break;
    case "pine":
      pix.rect(cx - w * 0.06, h * 0.78, w * 0.12, h * 0.22, trunk);
      [0.8, 0.58, 0.36].forEach((y, i) => {
        const s = w * (0.45 - i * 0.1);
        pix.tri(cx - s, h * y, cx + s, h * y, cx, h * (y - 0.36), i % 2 ? leaf : leafDark);
        if (luma(c.surface) > 0.8)
          pix.tri(
            cx - s * 0.4,
            h * (y - 0.22),
            cx + s * 0.4,
            h * (y - 0.22),
            cx,
            h * (y - 0.36),
            WHITE,
          );
      });
      break;
    case "palm":
      pix.line(cx, h, cx + w * 0.1, h * 0.25, trunk, Math.max(2, w * 0.1));
      [-1, 1].forEach((s) => {
        pix.tri(
          cx + w * 0.1,
          h * 0.22,
          cx + s * w * 0.48,
          h * 0.34,
          cx + s * w * 0.2,
          h * 0.16,
          leaf,
        );
        pix.tri(
          cx + w * 0.1,
          h * 0.24,
          cx + s * w * 0.38,
          h * 0.12,
          cx + s * w * 0.08,
          h * 0.08,
          leafLight,
        );
      });
      pix.circle(cx + w * 0.1, h * 0.26, 2, trunk);
      break;
    case "cactus": {
      const g = mix(leaf, [60, 150, 70], 0.5);
      pix.rect(cx - w * 0.1, h * 0.15, w * 0.2, h * 0.85, g);
      pix.rect(cx - w * 0.32, h * 0.4, w * 0.12, h * 0.25, g);
      pix.rect(cx - w * 0.32, h * 0.6, w * 0.24, w * 0.1, g);
      pix.rect(cx + w * 0.2, h * 0.3, w * 0.12, h * 0.25, g);
      pix.rect(cx + w * 0.08, h * 0.5, w * 0.24, w * 0.1, g);
      pix.rect(cx - w * 0.04, h * 0.18, 1, h * 0.7, shade(g, 0.3));
      break;
    }
    case "crystal":
      [
        [-0.22, 0.65, 0.12],
        [0.18, 0.55, 0.14],
        [0, 0.95, 0.18],
      ].forEach(([dx, hh, ww], i) => {
        const x = cx + dx * w;
        const col = i === 2 ? c.accent : shade(c.accent, -0.2);
        pix.tri(x - w * ww, h, x + w * ww, h, x, h * (1 - hh), col);
        pix.line(x - 1, h - 2, x, h * (1 - hh) + 2, shade(c.accent, 0.5), 1);
      });
      break;
    case "tombstone": {
      const stone = mix(c.ground, [150, 150, 165], 0.6);
      pix.rect(cx - w * 0.3, h * 0.35, w * 0.6, h * 0.65, stone);
      pix.circle(cx, h * 0.38, w * 0.3, stone);
      pix.rect(cx - w * 0.03, h * 0.35, w * 0.06, h * 0.32, shade(stone, -0.35));
      pix.rect(cx - w * 0.15, h * 0.45, w * 0.3, w * 0.06, shade(stone, -0.35));
      break;
    }
    case "lamp":
      pix.rect(cx - 1, h * 0.25, 2, h * 0.75, c.outline);
      pix.circle(cx, h * 0.2, w * 0.3, c.accent, 0.25);
      pix.rect(cx - w * 0.15, h * 0.12, w * 0.3, h * 0.16, mix(c.accent, WHITE, 0.4));
      pix.rect(cx - w * 0.18, h * 0.1, w * 0.36, 2, c.outline);
      break;
    case "pipe": {
      const metal = mix(c.ground, [140, 150, 160], 0.6);
      pix.rect(cx - w * 0.22, h * 0.3, w * 0.44, h * 0.7, metal);
      pix.rect(cx - w * 0.3, h * 0.25, w * 0.6, h * 0.12, shade(metal, 0.2));
      pix.rect(cx - w * 0.12, h * 0.35, 2, h * 0.6, shade(metal, 0.35));
      pix.circle(cx, h * 0.15, w * 0.15, WHITE, 0.3);
      break;
    }
    case "coral":
      [-0.25, 0, 0.25].forEach((dx, i) => {
        const x = cx + dx * w;
        const col = i === 1 ? c.accent : shade(c.accent, 0.2);
        pix.line(x, h, x + dx * w * 0.4, h * 0.3 + i * 4, col, Math.max(2, w * 0.1));
        pix.circle(x + dx * w * 0.4, h * 0.3 + i * 4, w * 0.08, col);
      });
      break;
    case "mushroom":
      // a dome cap: the top half of an ellipse, then the stem under it
      pix.ellipse(cx, h * 0.45, w * 0.45, h * 0.3, c.accent);
      for (let y = Math.ceil(h * 0.45); y < h; y++) for (let x = 0; x < w; x++) pix.clear(x, y);
      pix.rect(cx - w * 0.12, h * 0.45, w * 0.24, h * 0.55, mix(WHITE, c.ground, 0.15));
      for (let i = 0; i < 3; i++)
        pix.circle(cx + (i - 1) * w * 0.22, h * 0.32, Math.max(1, w * 0.06), WHITE);
      break;
    case "rock": {
      const stone = mix(c.ground, [130, 130, 140], 0.45);
      pix.ellipse(cx, h * 0.72, w * 0.46, h * 0.3, stone);
      pix.ellipse(cx - w * 0.12, h * 0.62, w * 0.2, h * 0.14, shade(stone, 0.25));
      break;
    }
    case "bush":
      pix.circle(cx - w * 0.22, h * 0.65, w * 0.26, leafDark);
      pix.circle(cx + w * 0.2, h * 0.65, w * 0.26, leafDark);
      pix.circle(cx, h * 0.52, w * 0.3, leaf);
      pix.circle(cx - w * 0.08, h * 0.45, w * 0.12, leafLight);
      break;
    case "flower":
      pix.line(cx, h, cx, h * 0.4, leafDark, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        pix.circle(
          cx + Math.cos(a) * w * 0.18,
          h * 0.32 + Math.sin(a) * h * 0.18,
          w * 0.13,
          c.accent,
        );
      }
      pix.circle(cx, h * 0.32, w * 0.1, [255, 230, 120]);
      break;
    case "bones": {
      const bone = [236, 228, 208];
      pix.line(w * 0.15, h * 0.8, w * 0.85, h * 0.6, bone, 2);
      [
        [0.15, 0.8],
        [0.85, 0.6],
      ].forEach(([u, v]) => pix.circle(w * u, h * v, 2, bone));
      pix.circle(cx, h * 0.55, w * 0.16, bone);
      pix.rect(cx - 2, h * 0.52, 1.5, 1.5, [40, 30, 30]);
      pix.rect(cx + 1, h * 0.52, 1.5, 1.5, [40, 30, 30]);
      break;
    }
    default:
      pix.ellipse(cx, h * 0.7, w * 0.4, h * 0.3, c.groundLight);
  }
  pix.outline(c.outline);
  void seed;
  return pix;
}

const spikeTile = (c) => {
  const pix = new Pix(T, T);
  const metal = mix(c.groundDark, [190, 195, 205], 0.65);
  for (let i = 0; i < 4; i++) {
    const x = i * 4;
    pix.tri(x, T, x + 4, T, x + 2, 5, metal);
    pix.line(x + 2, 6, x + 1, T - 1, shade(metal, 0.4), 1);
  }
  pix.rect(0, T - 2, T, 2, c.outline);
  return pix;
};

const signTile = (c, dir) => {
  const pix = new Pix(14, 14);
  const wood = mix(c.ground, [150, 100, 60], 0.55);
  pix.rect(6, 6, 2, 8, shade(wood, -0.3));
  pix.rect(1, 2, 12, 6, wood);
  pix.rect(1, 2, 12, 1, shade(wood, 0.25));
  const y = 5;
  if (dir > 0) pix.tri(4, y - 2, 4, y + 2, 10, y, c.accent);
  else pix.tri(10, y - 2, 10, y + 2, 4, y, c.accent);
  pix.outline(c.outline);
  return pix;
};

/** Object images by id, matching DECOR.gen in app/pcg/generator.js (+ 15 spikes). */
export function buildObjects(spec, seed) {
  const c = paletteOf(spec);
  const list = spec.decor;
  const bigs = list.filter((t) => BIG.includes(t));
  const smalls = list.filter((t) => SMALL.includes(t));
  const big = (i) => bigs[i % Math.max(1, bigs.length)] || "tree";
  const small = (i) => smalls[i % Math.max(1, smalls.length)] || "rock";
  const objects = [];
  objects[1] = drawDecor(big(0), 32, 32, c, seed);
  objects[2] = drawDecor(big(1), 40, 40, c, seed + 1);
  objects[3] = drawDecor(small(0), 16, 12, c, seed + 2);
  objects[4] = drawDecor(small(1), 12, 12, c, seed + 3);
  objects[7] = drawDecor(small(2), 14, 10, c, seed + 4);
  objects[8] = drawDecor(small(3), 10, 8, c, seed + 5);
  objects[9] = drawDecor(big(2), 12, 14, c, seed + 6);
  objects[5] = signTile(c, 1);
  objects[6] = signTile(c, -1);
  objects[15] = spikeTile(c);
  for (let id = 1; id <= 16; id++) if (!objects[id]) objects[id] = objects[3];
  objects[0] = null;
  return objects;
}

// -------------------------------------------------------------------- liquid

/** Animated liquid: 8 surface frames (waves on top) and 8 body frames. */
export function buildLiquid(spec, seed) {
  const c = paletteOf(spec);
  const base = c.liquid;
  const light = shade(base, 0.35);
  const dark = shade(base, -0.25);
  const glow = luma(base) > 0.45 && base[0] > base[2]; // lava-ish: bubbles
  const frame = (k, surface) => {
    const pix = new Pix(T, T);
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const n = noise(x, (y + k) % T, seed);
        const color = n > 0.93 ? light : n < 0.08 ? dark : base;
        pix.set(x, y, color, 0.82);
      }
    if (surface) {
      for (let x = 0; x < T; x++) {
        const crest = Math.round(1.5 + Math.sin(((x + k * 2) / T) * Math.PI * 2) * 1.5);
        for (let y = 0; y < crest; y++) pix.clear(x, y);
        pix.set(x, crest, WHITE, 0.7);
        pix.set(x, crest + 1, light, 0.9);
      }
      if (glow) pix.circle((k * 5 + seed) % T, 8 - (k % 4), 1.2, light);
    }
    return pix;
  };
  return {
    surface: Array.from({ length: 8 }, (_, k) => frame(k, true)),
    body: Array.from({ length: 8 }, (_, k) => frame(k, false)),
  };
}
