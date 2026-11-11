/**
 * Cosmetics: skins and fireball colours are palette shifts of the existing
 * sprites, made when the game loads; hats are small sprites drawn on the
 * dino's head. They change looks only, never speed, jumps, hearts, damage or
 * score.
 */

/** A palette maps source colours to target colours: [[from rgb, to rgb], ...]. */
// The sprites are lossy webp, so a pixel counts as a source colour when it is
// within this distance of it; it then keeps its offset (its shading).
const TOLERANCE = 30;

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

/**
 * The dino's greens, read from the sprite: body, highlight, belly, mid, shade,
 * darker shade, deepest shade. The dark outline and white eyes are left alone.
 */
const DINO_GREENS = [
  [183, 210, 83],
  [213, 226, 119],
  [223, 230, 160],
  [166, 193, 70],
  [149, 182, 52],
  [130, 160, 59],
  [100, 121, 45],
];

const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** A skin: the dino's greens re-made around `base`, keeping the light and shade ladder. */
function skin(base) {
  const body = luminance(DINO_GREENS[0]);
  return DINO_GREENS.map((from) => {
    const l = luminance(from);
    const to =
      l <= body
        ? base.map((c) => clamp((c * l) / body))
        : base.map((c) => clamp(c + ((255 - c) * (l - body)) / (255 - body)));
    return [from, to];
  });
}

export const SKIN_PALETTES = {
  classic: [],
  mint: skin([105, 215, 185]),
  sunset: skin([240, 120, 80]),
  midnight: skin([70, 80, 160]),
  ghost: skin([215, 225, 240]),
  gold: skin([240, 190, 50]),
};

const FLAME = [
  [247, 118, 34],
  [254, 174, 52],
  [254, 231, 97],
];

const flame = (a, b, c) => FLAME.map((from, i) => [from, [a, b, c][i]]);

export const FIREBALL_PALETTES = {
  classic: [],
  blue: flame([40, 110, 250], [80, 170, 255], [190, 235, 255]),
  green: flame([40, 190, 70], [110, 230, 100], [220, 255, 150]),
  purple: flame([150, 50, 220], [200, 100, 255], [240, 190, 255]),
};

/**
 * Where a hat's top-left sits, from the dino's box (x, y), by facing. The dino
 * is drawn much larger than its 12x12 box, so the head is above the box.
 */
export const HAT_ANCHOR = { left: { x: -6, y: -29 }, right: { x: 6, y: -29 } };

/** Recolours RGBA pixels in place: each source colour in the palette maps to its target. */
export function shiftPixels(data, palette) {
  if (!palette || palette.length === 0) return;
  const limit = TOLERANCE * TOLERANCE;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let best = null;
    let bestDistance = limit + 1;
    for (let p = 0; p < palette.length; p++) {
      const [from] = palette[p];
      const distance = (r - from[0]) ** 2 + (g - from[1]) ** 2 + (b - from[2]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = palette[p];
      }
    }
    if (!best || bestDistance > limit) continue;
    const [from, to] = best;
    data[i] = clamp(to[0] + (r - from[0]));
    data[i + 1] = clamp(to[1] + (g - from[1]));
    data[i + 2] = clamp(to[2] + (b - from[2]));
  }
}

/** Canvas copies of the frames, recoloured; "classic" (no palette) returns the frames themselves. */
export function tintFrames(frames, palette) {
  if (!palette || palette.length === 0 || typeof document === "undefined") return frames;
  return frames.map((frame) => {
    const width = frame.naturalWidth || frame.width;
    const height = frame.naturalHeight || frame.height;
    if (!width || !height) return frame; // failed to load: nothing to tint
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(frame, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height);
    shiftPixels(pixels.data, palette);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  });
}

const HATS = ["cap", "party", "viking", "wizard", "crown"];
const hatImages = {};

export function hatImage(id) {
  if (!HATS.includes(id)) return null;
  if (!hatImages[id]) {
    const image = new Image();
    image.src = `./assets/sprites/hats/${id}.webp`;
    hatImages[id] = image;
  }
  return hatImages[id];
}
