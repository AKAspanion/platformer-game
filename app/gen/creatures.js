import { Pix, rgb, shade, mix, luma } from "./pixels";

/**
 * Pixel-art creatures from a spec entry (body, colors, features, behaviour):
 * walk / attack / death frames for enemies, and bosses with a crown.
 * Sprites are drawn facing right at 2x the world size (finer pixels), then
 * mirrored for the left-facing frames.
 */

export const SCALE = 2;
const WHITE = [255, 255, 255];
const EYE = [250, 250, 246];
const PUPIL = [26, 20, 34];
const CROWN = [255, 210, 64];

/** World-pixel size (hit box) for an enemy of this design. */
export const enemySize = ({ behavior, body }) => {
  if (behavior === "flyer") return { width: 18, height: 13 };
  if (behavior === "turret") return { width: 16, height: 18 };
  return (
    {
      blob: { width: 23, height: 17 },
      round: { width: 20, height: 19 },
      box: { width: 22, height: 19 },
      tall: { width: 18, height: 21 },
      spiky: { width: 20, height: 19 },
      bug: { width: 20, height: 14 },
    }[body] || { width: 20, height: 19 }
  );
};

const colorsOf = (design) => {
  let main = rgb(design.color);
  // very dark or very light bodies lose their shading: pull them in a bit
  if (luma(main) < 0.12) main = shade(main, 0.25);
  if (luma(main) > 0.92) main = shade(main, -0.12);
  let accent = rgb(design.accent);
  if (Math.abs(luma(accent) - luma(main)) < 0.08)
    accent = shade(accent, luma(main) > 0.5 ? -0.4 : 0.4);
  return {
    main,
    light: shade(main, 0.32),
    dark: shade(main, -0.3),
    belly: mix(main, WHITE, 0.45),
    accent,
    accentDark: shade(accent, -0.3),
    accentLight: shade(accent, 0.35),
    outline: mix(shade(main, -0.72), [20, 12, 30], 0.5),
    bone: mix(accent, [255, 244, 220], 0.6),
  };
};

const inBody = (body, u, v) => {
  switch (body) {
    case "blob":
      return u * u + ((v - 1) / 2) ** 2 <= 1 && v <= 1;
    case "box":
      return u ** 4 + v ** 4 <= 1;
    case "tall":
      return (u / 0.78) ** 2 + v * v <= 1;
    case "bug":
      return u * u + v * v <= 1;
    case "spiky":
      return u * u + v * v <= 0.82;
    default:
      return u * u + v * v <= 1;
  }
};

/**
 * Paint one pose into a new buffer. `box` is the body area in grid pixels
 * { x, y, w, h } inside a canvas of `size` { w, h }.
 * Pose: { leg 0..3, squashX, squashY, mouth 0..1, wing -1..1, lean, angry, crown }
 */
function paint(design, pose, size, box) {
  const pix = new Pix(size.w, size.h);
  const c = colorsOf(design);
  const f = new Set(design.features || []);
  const { body, behavior } = design;
  pose = { leg: 0, ...pose };
  const sx = pose.squashX || 1;
  const sy = pose.squashY || 1;
  const lean = pose.lean || 0;

  // body box after squash, anchored at the feet
  const bw = box.w * sx;
  const bh = box.h * sy;
  const cx = box.x + box.w / 2 + lean;
  const bottom = box.y + box.h;
  const top = bottom - bh;
  const cy = top + bh / 2;
  const toUV = (x, y) => [((x + 0.5 - cx) / bw) * 2, ((y + 0.5 - cy) / bh) * 2];
  const at = (u, v) => [cx + (u * bw) / 2, cy + (v * bh) / 2];

  const legs = behavior === "walker" && body !== "blob";
  const legLen = Math.max(2, Math.round(box.legs || 0));

  // ---- wings (behind)
  if (behavior === "flyer" || design.wings) {
    const flap = pose.wing || 0;
    [-1, 1].forEach((side) => {
      const [rx, ry] = at(side * 0.55, -0.2);
      const tipX = rx + side * bw * 0.7;
      const tipY = ry - bh * 0.6 * flap - bh * 0.1;
      const lowX = rx + side * bw * 0.45;
      const lowY = ry + bh * 0.35 - bh * 0.3 * flap;
      pix.tri(rx, ry - bh * 0.15, tipX, tipY, lowX, lowY, side < 0 ? c.accentDark : c.accent);
      pix.line(rx, ry - bh * 0.15, tipX, tipY, c.accentLight, 1);
    });
  }

  // ---- turret base (pot / rock) and stem
  if (behavior === "turret") {
    const potH = Math.round(size.h * 0.22);
    const potW = box.w * 0.8;
    pix.rect(cx - potW / 2, size.h - potH, potW, potH, c.accentDark);
    pix.rect(cx - potW / 2 - 1, size.h - potH, potW + 2, 2, c.accent);
    pix.rect(cx - 1.5, bottom - 2, 3, size.h - potH - bottom + 3, shade(c.accent, -0.1));
    pix.tri(cx, bottom + 3, cx - 6, bottom + 1, cx - 1, bottom + 6, c.accent);
  }

  // ---- tail (behind)
  if (f.has("tail")) {
    const [tx, ty] = at(-0.85, 0.35);
    pix.line(tx, ty, tx - bw * 0.35, ty - bh * 0.25, c.dark, 3);
    pix.line(tx - bw * 0.35, ty - bh * 0.25, tx - bw * 0.42, ty - bh * 0.55, c.dark, 2.5);
    pix.circle(tx - bw * 0.42, ty - bh * 0.6, 2, c.accent);
  }

  // ---- legs
  const drawLeg = (u, phase, back) => {
    const [lx] = at(u, 1);
    const lift = [0, -2, 0, 1][(pose.leg + phase) % 4] || 0;
    const swing = [0, 1, 0, -1][(pose.leg + phase) % 4] || 0;
    const color = back ? c.dark : shade(c.main, -0.12);
    const w = body === "bug" ? 2 : body === "box" ? 4 : 3;
    pix.rect(lx - w / 2 + swing, bottom - 2 + Math.min(0, lift), w, legLen + 2, color);
    pix.rect(
      lx - w / 2 + swing - 0.5,
      bottom + legLen - 1 + Math.min(0, lift),
      w + 2,
      2,
      c.outline,
    );
  };
  if (legs) {
    if (body === "box") {
      drawLeg(-0.75, 2, true);
      drawLeg(0.45, 0, true);
    } else if (body === "bug") {
      [-0.6, 0, 0.6].forEach((u, i) => drawLeg(u, i % 2 ? 2 : 0, true));
    }
  }

  // ---- body with shading and belly
  for (let y = Math.floor(top - 2); y <= Math.ceil(bottom); y++)
    for (let x = Math.floor(cx - bw / 2 - 2); x <= Math.ceil(cx + bw / 2 + 2); x++) {
      const [u, v] = toUV(x, y);
      if (!inBody(body, u, v)) continue;
      const light = -u * 0.45 - v * 0.75;
      let color = light > 0.55 ? c.light : light < -0.55 ? c.dark : c.main;
      if (body !== "bug" && u > -0.1 && v > 0.1 && (u - 0.25) ** 2 + (v - 0.55) ** 2 < 0.28) {
        color = c.belly;
      }
      pix.set(x, y, color);
    }

  // ---- spikes around the top / back
  if (f.has("spikes") || body === "spiky") {
    const n = body === "spiky" ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.05 + (i / (n - 1)) * (body === "spiky" ? 0.95 : 0.6));
      const [bx, by] = at(Math.cos(a) * 0.85, Math.sin(a) * 0.85);
      const [tx, ty] = at(Math.cos(a) * 1.35, Math.sin(a) * 1.35);
      const nx = -Math.sin(a) * 2.2;
      const ny = Math.cos(a) * 2.2;
      pix.tri(bx - nx, by - ny, bx + nx, by + ny, tx, ty, i % 2 ? c.accentLight : c.accent);
    }
  }

  // ---- shell (armour)
  if (f.has("shell") || design.armored) {
    for (let y = Math.floor(top - 1); y <= Math.ceil(cy + bh * 0.1); y++)
      for (let x = Math.floor(cx - bw / 2); x <= Math.ceil(cx + bw / 2); x++) {
        const [u, v] = toUV(x, y);
        if (!inBody(body, u * 1.05, v * 1.05) || v > 0.1 || u > 0.45) continue;
        const ring = Math.abs(u + 0.15) < 0.06 || Math.abs(v + 0.35) < 0.06;
        pix.set(x, y, ring ? c.accentDark : -u - v > 0.9 ? c.accentLight : c.accent);
      }
  }

  // ---- ears, horns, antenna
  if (f.has("ears")) {
    [-0.35, 0.3].forEach((u) => {
      const [ex, ey] = at(u, -0.85);
      pix.tri(ex - 4, ey + 3, ex + 4, ey + 3, ex + u * 3, ey - 6, c.main);
      pix.tri(ex - 2, ey + 3, ex + 2, ey + 3, ex + u * 3, ey - 3, c.accent);
    });
  }
  if (f.has("horns")) {
    [-0.3, 0.38].forEach((u) => {
      const [hx, hy] = at(u, -0.82);
      pix.tri(hx - 2.5, hy + 2, hx + 2.5, hy + 2, hx + (u > 0 ? 3 : -3), hy - 8, c.bone);
      pix.set(hx + (u > 0 ? 3 : -3), hy - 8, shade(c.bone, -0.3));
    });
  }
  if (f.has("antenna")) {
    [-0.15, 0.3].forEach((u, i) => {
      const [ax, ay] = at(u, -0.9);
      const wob = Math.sin((pose.leg + i) * 1.6) * 1.5;
      pix.line(ax, ay, ax + 2 + wob, ay - 7, c.outline, 1);
      pix.circle(ax + 2 + wob, ay - 8, 1.8, c.accentLight);
    });
  }

  // ---- crown (bosses)
  if (pose.crown) {
    const [kx, ky] = at(-0.05, -0.92);
    const w = Math.max(12, bw * 0.42);
    const h = Math.max(8, pose.crown * 0.75);
    pix.rect(kx - w / 2, ky - h * 0.45, w, h * 0.45, CROWN);
    for (let i = 0; i < 3; i++) {
      const px = kx - w / 2 + (w / 2) * i;
      pix.tri(px - 3, ky - h * 0.4, px + 3, ky - h * 0.4, px, ky - h, CROWN);
    }
    pix.rect(kx - w / 2, ky - h * 0.45, w, 2, shade(CROWN, 0.4));
    pix.circle(kx, ky - h * 0.25, 1.6, [232, 52, 74]);
  }

  // ---- eyes
  const eyes = f.has("one-eye")
    ? [[0.38, -0.3, 0.2]]
    : f.has("three-eyes")
      ? [
          [0.1, -0.4, 0.12],
          [0.45, -0.45, 0.12],
          [0.62, -0.1, 0.1],
        ]
      : [
          [0.12, -0.3, 0.15],
          [0.55, -0.32, 0.14],
        ];
  eyes.forEach(([u, v, r]) => {
    const [ex, ey] = at(u, v);
    const rad = Math.max(2, r * Math.min(bw, bh));
    pix.circle(ex, ey, rad, EYE);
    pix.circle(ex + rad * 0.4, ey + (pose.angry ? 0.5 : 0), Math.max(1, rad * 0.55), PUPIL);
    pix.set(ex - rad * 0.3, ey - rad * 0.4, WHITE);
    if (pose.angry) pix.line(ex - rad, ey - rad - 1, ex + rad, ey - rad * 0.4, c.outline, 1.5);
  });

  // ---- mouth
  const [mx, my] = at(0.62, behavior === "turret" ? 0.2 : 0.32);
  const open = pose.mouth || 0;
  if (open > 0.15) {
    const mw = Math.max(4, bw * 0.24);
    const mh = Math.max(2, bh * 0.22 * open);
    pix.ellipse(mx, my, mw / 2, mh / 2 + 0.5, [70, 18, 30]);
    pix.ellipse(mx, my + mh * 0.2, mw / 3, mh / 4, [220, 80, 100]);
    if (f.has("teeth") || open > 0.6) {
      for (let i = 0; i < 3; i++)
        pix.tri(
          mx - mw / 2 + 1 + i * (mw / 3),
          my - mh / 2,
          mx - mw / 2 + 2.5 + i * (mw / 3),
          my - mh / 2,
          mx - mw / 2 + 1.7 + i * (mw / 3),
          my - mh / 2 + 2.5,
          WHITE,
        );
    }
  } else {
    pix.line(mx - bw * 0.1, my, mx + bw * 0.12, my - 0.5, c.outline, 1);
    if (f.has("teeth")) {
      pix.tri(mx - 1, my, mx + 1, my, mx, my + 3, WHITE);
      pix.tri(mx + 3, my - 0.5, mx + 5, my - 0.5, mx + 4, my + 2.5, WHITE);
    }
  }

  // ---- front legs (over the body)
  if (legs) {
    if (body === "box") {
      drawLeg(-0.45, 0, false);
      drawLeg(0.75, 2, false);
    } else if (body === "bug") {
      [-0.3, 0.3].forEach((u, i) => drawLeg(u, i ? 0 : 2, false));
    } else {
      drawLeg(-0.35, 0, false);
      drawLeg(0.35, 2, false);
    }
  }
  if (body === "tall") {
    // little arms
    const [ax, ay] = at(0.7, 0.1);
    const reach = (pose.mouth || 0) * 3;
    pix.line(ax, ay, ax + 4 + reach, ay + 3 - reach, c.dark, 2.5);
  }

  pix.outline(c.outline);
  if (pose.flash) pix.tint(WHITE, pose.flash);
  return pix;
}

/** Body area and canvas for a design at world size w x h (+ headroom). */
const layout = (design, w, h, headroom = 0) => {
  const W = w * SCALE;
  const H = (h + headroom) * SCALE;
  const featTop = (design.features || []).some((x) => ["horns", "ears", "antenna"].includes(x));
  const head = headroom * SCALE;
  if (design.behavior === "flyer") {
    return {
      size: { w: W, h: H },
      box: { x: W * 0.28, y: head + H * 0.2, w: W * 0.44, h: (H - head) * 0.62 },
    };
  }
  if (design.behavior === "turret") {
    return {
      size: { w: W, h: H },
      box: { x: W * 0.12, y: head + 3, w: W * 0.76, h: (H - head) * 0.5 },
    };
  }
  const legRoom = design.body === "blob" ? 0 : design.body === "bug" ? H * 0.14 : H * 0.17;
  const topRoom = head + (featTop && !head ? H * 0.14 : 2);
  const side = design.features && design.features.includes("tail") ? W * 0.14 : 2;
  return {
    size: { w: W, h: H },
    box: {
      x: side,
      y: topRoom,
      w: W - side - 2,
      h: H - topRoom - legRoom - 1,
      legs: legRoom - 1,
    },
  };
};

/** Particles and a puff: death frames, 2x the sprite (see Enemy#drawRect). */
function deathFrames(design, base, w, h, seed, offsetY = 0.75) {
  const c = colorsOf(design);
  const W = w * 2 * SCALE;
  const H = h * 2 * SCALE;
  const ox = w * 0.5 * SCALE;
  const oy = h * offsetY * SCALE;
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bits = Array.from({ length: 16 }, () => ({
    a: rnd() * Math.PI * 2,
    v: 0.5 + rnd(),
    color: [c.main, c.accent, c.light, WHITE][Math.floor(rnd() * 4)],
    size: 1 + Math.floor(rnd() * 2.5),
  }));
  const cx = ox + base.width / 2;
  const cy = oy + base.height / 2;
  return Array.from({ length: 8 }, (_, k) => {
    const pix = new Pix(W, H);
    if (k < 2) {
      const squash = new Pix(base.width, base.height).blit(base);
      squash.tint(WHITE, k === 0 ? 0.6 : 0.85);
      pix.blit(squash, ox, oy);
      return pix;
    }
    const t = (k - 1) / 7;
    const radius = t * Math.min(W, H) * 0.42;
    // puff
    pix.circle(cx, cy, Math.max(1, (1 - t) * base.height * 0.5), mix(c.light, WHITE, 0.6), 1 - t);
    bits.forEach((b) => {
      const x = cx + Math.cos(b.a) * radius * b.v;
      const y = cy + Math.sin(b.a) * radius * b.v + t * t * 10;
      pix.rect(x, y, b.size, b.size, b.color, 1 - t * 0.85);
    });
    return pix;
  });
}

const both = (frames) => ({ right: frames, left: frames.map((p) => p.flipped()) });

/**
 * All frames for an enemy design. Returns { config, frames } where frames are
 * Pix buffers (right-facing and mirrored), config is an enemyTypes entry.
 */
export function buildEnemy(design, seed = 1) {
  const { width, height } = enemySize(design);
  const { size, box } = layout(design, width, height);
  const speed = { slow: [0.2, 0.35], medium: [0.35, 0.6], fast: [0.6, 0.9] }[design.speed] || [
    0.35, 0.6,
  ];
  const hp = design.armored ? 2 : 1;

  let walk;
  let attack = [];
  if (design.behavior === "flyer") {
    walk = [1, 0, -1, 0].map((wing, i) => paint(design, { leg: i, wing }, size, box));
  } else if (design.behavior === "turret") {
    walk = [0, 1, 0, -1].map((sway, i) => paint(design, { leg: i, lean: sway }, size, box));
    attack = [0.4, 0.8, 1].map((m, i) =>
      paint(design, { mouth: m, lean: i * 1.5, squashY: 1 - m * 0.08, angry: true }, size, box),
    );
  } else {
    const blob = design.body === "blob";
    walk = [0, 1, 2, 3].map((leg) =>
      paint(
        design,
        {
          leg,
          squashX: blob ? 1 + [0, 0.05, 0, -0.04][leg] : 1,
          squashY: blob ? 1 - [0, 0.07, 0, -0.05][leg] : 1 - [0, 0.02, 0, 0.02][leg],
        },
        size,
        box,
      ),
    );
    attack = [
      paint(design, { squashX: 1.08, squashY: 0.86, angry: true }, size, box),
      paint(design, { squashX: 1.1, squashY: 0.84, angry: true, flash: 0.55 }, size, box),
      paint(design, { squashX: 1.05, squashY: 0.95, lean: 3, mouth: 0.8, angry: true }, size, box),
      paint(design, { lean: 4, mouth: 1, angry: true }, size, box),
    ];
  }
  const dead = deathFrames(design, walk[0], width, height, seed);
  const w = both(walk);
  const a = both(attack);
  const d = both(dead);

  return {
    config: {
      kind: design.behavior,
      maxV: design.behavior === "turret" ? 0 : speed[1],
      minV: design.behavior === "turret" ? 0 : speed[0],
      delay: design.behavior === "turret" ? 5 : design.speed === "fast" ? 2 : 3,
      width,
      height,
      walk: walk.length,
      ...(design.behavior === "turret" ? { shoot: 3 } : {}),
      ...(hp > 1 ? { hp, score: 200 } : {}),
    },
    frames: {
      right: w.right,
      left: w.left,
      attackRight: a.right,
      attackLeft: a.left,
      deadRight: d.right,
      deadLeft: d.left,
    },
  };
}

/** World-pixel size of a boss (hit box) and its crown headroom. */
export const bossSize = ({ body, flyer }) => {
  if (flyer) return { width: 44, height: 30, crown: 12 };
  return (
    {
      blob: { width: 50, height: 34, crown: 12 },
      tall: { width: 40, height: 42, crown: 12 },
      bug: { width: 48, height: 32, crown: 12 },
    }[body] || { width: 44, height: 38, crown: 12 }
  );
};

/** Boss frames (Pix): { "walk-left": [], "walk-right": [], "attack-*", "dead-*" }. */
export function buildBossFrames(design, seed = 7) {
  const d = { ...design, behavior: design.flyer ? "flyer" : "walker" };
  const { width, height, crown } = bossSize(design);
  const { size, box } = layout(d, width, height, crown);
  const crownPx = crown * SCALE;
  const walk = design.flyer
    ? [1, 0, -1, 0].map((wing, i) => paint(d, { leg: i, wing, crown: crownPx }, size, box))
    : [0, 1, 2, 3].map((leg) =>
        paint(d, { leg, crown: crownPx, squashY: 1 - [0, 0.03, 0, 0.03][leg] }, size, box),
      );
  const attack = [
    paint(d, { crown: crownPx, squashX: 1.08, squashY: 0.88, angry: true, wing: 1 }, size, box),
    paint(d, { crown: crownPx, mouth: 0.6, angry: true, flash: 0.35, wing: 0 }, size, box),
    paint(d, { crown: crownPx, mouth: 1, lean: 3, angry: true, wing: -1 }, size, box),
    paint(d, { crown: crownPx, mouth: 0.8, lean: 2, angry: true, wing: 0 }, size, box),
  ];
  // the dying boss draws at 2x its hit box, from (x - w/2, y - 3h/4)
  const body = new Pix(size.w, size.h).blit(walk[0]);
  const deadBase = new Pix(width * SCALE, height * SCALE).blit(body, 0, -crownPx);
  const dead = deathFrames(d, deadBase, width, height, seed);
  const w = both(walk);
  const a = both(attack);
  const x = both(dead);
  return {
    size: { width, height, crown },
    frames: {
      "walk-right": w.right,
      "walk-left": w.left,
      "attack-right": a.right,
      "attack-left": a.left,
      "dead-right": x.right,
      "dead-left": x.left,
    },
  };
}
