/**
 * A tiny RGBA pixel buffer for generated art. Pure JS (runs in node tests);
 * `toImage` turns it into a canvas in the browser.
 */

export const rgb = (hex) => {
  const h = String(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** Lighter (amount > 0) or darker (< 0), -1..1. */
export const shade = ([r, g, b], amount) =>
  amount >= 0
    ? [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount].map(clamp255)
    : [r * (1 + amount), g * (1 + amount), b * (1 + amount)].map(clamp255);

export const mix = (a, b, t) => a.map((v, i) => clamp255(v + (b[i] - v) * t));

/** Perceived brightness 0..1. */
export const luma = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export class Pix {
  constructor(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Paint one pixel; `alpha` 0..1 blends over what is there. */
  set(x, y, color, alpha = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y) || alpha <= 0) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    if (alpha >= 1 || d[i + 3] === 0) {
      d[i] = color[0];
      d[i + 1] = color[1];
      d[i + 2] = color[2];
      d[i + 3] = d[i + 3] === 0 ? Math.round(255 * Math.min(1, alpha)) : 255;
      return;
    }
    d[i] = d[i] + (color[0] - d[i]) * alpha;
    d[i + 1] = d[i + 1] + (color[1] - d[i + 1]) * alpha;
    d[i + 2] = d[i + 2] + (color[2] - d[i + 2]) * alpha;
    d[i + 3] = Math.max(d[i + 3], Math.round(255 * alpha));
  }

  alphaAt(x, y) {
    if (!this.inside(x, y)) return 0;
    return this.data[(Math.floor(y) * this.width + Math.floor(x)) * 4 + 3];
  }

  get(x, y) {
    const i = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  clear(x, y) {
    if (!this.inside(x, y)) return;
    const i = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    this.data[i + 3] = 0;
  }

  rect(x, y, w, h, color, alpha = 1) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, color, alpha);
  }

  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    if (rx <= 0 || ry <= 0) return;
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i + 0.5 - cx) / rx;
        const dy = (j + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(i, j, color, alpha);
      }
  }

  circle(cx, cy, r, color, alpha = 1) {
    this.ellipse(cx, cy, r, r, color, alpha);
  }

  /** Filled triangle. */
  tri(ax, ay, bx, by, cx, cy, color, alpha = 1) {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const edge = (x0, y0, x1, y1, x, y) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
    const area = edge(ax, ay, bx, by, cx, cy);
    if (!area) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = edge(bx, by, cx, cy, px, py) / area;
        const w1 = edge(cx, cy, ax, ay, px, py) / area;
        const w2 = edge(ax, ay, bx, by, px, py) / area;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) this.set(x, y, color, alpha);
      }
  }

  line(x0, y0, x1, y1, color, width = 1, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (width <= 1) this.set(x, y, color, alpha);
      else this.circle(x, y, width / 2, color, alpha);
    }
  }

  /** A 1px outline around every opaque pixel (drawn into transparent neighbours). */
  outline(color) {
    const { width, height } = this;
    const solid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) solid[i] = this.data[i * 4 + 3] > 40 ? 1 : 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (solid[y * width + x]) continue;
        const near =
          (x > 0 && solid[y * width + x - 1]) ||
          (x < width - 1 && solid[y * width + x + 1]) ||
          (y > 0 && solid[(y - 1) * width + x]) ||
          (y < height - 1 && solid[(y + 1) * width + x]);
        if (near) this.set(x, y, color);
      }
    return this;
  }

  /** Every opaque pixel tinted toward `color` by t (hit flash). */
  tint(color, t) {
    for (let i = 0; i < this.data.length; i += 4) {
      if (!this.data[i + 3]) continue;
      for (let k = 0; k < 3; k++) this.data[i + k] += (color[k] - this.data[i + k]) * t;
    }
    return this;
  }

  /** Multiply alpha by t. */
  fade(t) {
    for (let i = 3; i < this.data.length; i += 4) this.data[i] *= t;
    return this;
  }

  /** Mirror left-right (sprites are drawn facing right). */
  flipped() {
    const out = new Pix(this.width, this.height);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const from = (y * this.width + x) * 4;
        const to = (y * this.width + (this.width - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) out.data[to + k] = this.data[from + k];
      }
    return out;
  }

  /** Draw `src` into this buffer at (x, y), optionally scaled (nearest neighbour). */
  blit(src, x = 0, y = 0, scale = 1, alpha = 1) {
    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const sx = Math.min(src.width - 1, Math.floor(i / scale));
        const sy = Math.min(src.height - 1, Math.floor(j / scale));
        const k = (sy * src.width + sx) * 4;
        const a = src.data[k + 3];
        if (!a) continue;
        this.set(x + i, y + j, [src.data[k], src.data[k + 1], src.data[k + 2]], (a / 255) * alpha);
      }
    return this;
  }

  /** Count of visible pixels (tests: "is anything drawn"). */
  coverage() {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) n++;
    return n;
  }
}

/** A canvas in the browser; the buffer itself in node (tests never draw). */
export const toImage = (pix) => {
  if (typeof document === "undefined" || !document.createElement) return pix;
  const canvas = document.createElement("canvas");
  canvas.width = pix.width;
  canvas.height = pix.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof ImageData === "undefined") return pix;
  ctx.putImageData(new ImageData(pix.data, pix.width, pix.height), 0, 0);
  return canvas;
};
