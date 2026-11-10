/**
 * Procedural level generator for Dino's Adventure.
 *
 * Builds area JSON files (areaMap / collisonMap / objectsMap / coins / enemies /
 * water / death / portals) in the same format as the hand-made areas in app/areas.
 *
 * Usage:
 *   node scripts/generate-levels.js            # write all levels in LEVELS
 *   node scripts/generate-levels.js --print    # also print an ASCII preview
 *
 * Every generated level is checked for reachability (entry -> exit and back)
 * using the player's jump limits; a seed that produces an unbeatable level is
 * rejected and the next seed is tried.
 */
const fs = require("fs");
const path = require("path");

const ROWS = 12;
const COLS = 21;
const TILE = 16;

// Player physics (see app/game/player.js): max jump ~2.7 tiles up, ~3.3 tiles across.
const MAX_STEP_UP = 2;
const MAX_STEP_DOWN = 3;
const MAX_GAP = 3; // empty columns that can be jumped at equal height
// Flat, hazard-free columns at each edge so a player running through a portal
// does not land straight in a pit or an enemy.
const SAFE_EDGE = 4;

// Tile ids (identical layout for world-1 and world-2 tilesets).
const T = {
  topLeft: 1,
  top: 2,
  topRight: 3,
  left: 4,
  fill: 5,
  right: 6,
  innerLeft: 8,
  innerRight: 10,
  platLeft: 13,
  platMid: 14,
  platRight: 15,
};

// Decoration presets per world, taken from the existing hand-made areas.
// Each is placed in the air cell directly above a ground tile.
const DECOR = {
  1: {
    signRight: { id: 5, xOffset: 2, yOffset: 2, width: 14, height: 14 },
    signLeft: { id: 6, xOffset: 0, yOffset: 2, width: 14, height: 14 },
    big: [
      { id: 1, xOffset: -8, yOffset: -16, width: 32, height: 32 },
      { id: 2, xOffset: -12, yOffset: -24, width: 40, height: 40 },
    ],
    small: [
      { id: 3, xOffset: -4, yOffset: 6, width: 24, height: 10 },
      { id: 4, xOffset: 0, yOffset: 8, width: 16, height: 8 },
      { id: 7, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 8, xOffset: 1, yOffset: 8, width: 14, height: 8 },
      { id: 9, xOffset: 3, yOffset: 10, width: 11, height: 6 },
      { id: 10, xOffset: 3, yOffset: 8, width: 11, height: 8 },
      { id: 11, xOffset: 2, yOffset: 6, width: 12, height: 10 },
    ],
  },
  2: {
    signRight: { id: 5, xOffset: 0, yOffset: 0, width: 16, height: 16 },
    signLeft: { id: 6, xOffset: 0, yOffset: 0, width: 16, height: 16 },
    big: [
      { id: 1, xOffset: -8, yOffset: -32, width: 32, height: 48 },
      { id: 2, xOffset: -16, yOffset: -32, width: 48, height: 48 },
      { id: 3, xOffset: -4, yOffset: -16, width: 24, height: 32 },
    ],
    small: [
      { id: 4, xOffset: -2, yOffset: 4, width: 21, height: 12 },
      { id: 7, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 8, xOffset: -1, yOffset: 0, width: 18, height: 16 },
      { id: 9, xOffset: 2, yOffset: 4, width: 12, height: 12 },
    ],
  },
  3: {
    signRight: { id: 5, xOffset: 1, yOffset: 2, width: 14, height: 14 },
    signLeft: { id: 6, xOffset: 1, yOffset: 2, width: 14, height: 14 },
    big: [
      { id: 1, xOffset: -10, yOffset: -14, width: 36, height: 30 },
      { id: 2, xOffset: -7, yOffset: -2, width: 30, height: 18 },
      { id: 9, xOffset: -2, yOffset: -4, width: 20, height: 20 },
      { id: 11, xOffset: 0, yOffset: -2, width: 16, height: 18 },
    ],
    small: [
      { id: 3, xOffset: -1, yOffset: 6, width: 18, height: 10 },
      { id: 4, xOffset: 0, yOffset: 6, width: 17, height: 10 },
      { id: 7, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 8, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 10, xOffset: 1, yOffset: 7, width: 14, height: 9 },
      { id: 12, xOffset: 1, yOffset: 9, width: 14, height: 7 },
      { id: 13, xOffset: 1, yOffset: 9, width: 14, height: 7 },
      { id: 14, xOffset: -1, yOffset: 10, width: 18, height: 6 },
    ],
  },
};

// Desert spikes (world-3 object 15): pit floors and 1-tile ground traps.
const SPIKES = {
  pit: { id: 15, xOffset: 0, yOffset: 0, width: 16, height: 16 },
  trap: { id: 15, xOffset: 1, yOffset: 2, width: 14, height: 14 },
};

const ENEMY_TYPES = {
  1: ["pig", "chameleon", "pig"],
  2: ["pig", "chameleon", "slime"],
  3: ["pig", "slime", "chameleon"],
};

/**
 * The levels to generate. entryHeight / exitHeight are the ground-top rows at the
 * left / right edges, chosen to line up with the neighbouring areas.
 */
const LEVELS = [
  {
    id: 9,
    world: 1,
    theme: "grasslands",
    seed: 9001,
    difficulty: 2,
    entryHeight: 7,
    exitHeight: 6,
    prev: { area: 7, x: 330, y: 96 },
    next: { area: 10, x: 16 },
  },
  {
    id: 10,
    world: 1,
    theme: "grasslands",
    seed: 10001,
    difficulty: 3,
    entryHeight: 6,
    exitHeight: 4,
    prev: { area: 9, x: 330 },
    next: { area: 3, x: 6, y: 24 },
  },
  {
    id: 11,
    world: 2,
    theme: "iceland",
    seed: 11001,
    difficulty: 3,
    entryHeight: 4,
    exitHeight: 6,
    prev: { area: 8, x: 330, y: 42 },
    next: { area: 12, x: 16 },
  },
  {
    id: 12,
    world: 2,
    theme: "iceland",
    seed: 12001,
    difficulty: 4,
    entryHeight: 6,
    exitHeight: 4,
    prev: { area: 11, x: 330 },
    next: { area: 13, x: 16 },
  },
  {
    id: 13,
    world: 3,
    theme: "desert",
    seed: 13169,
    difficulty: 3,
    entryHeight: 4,
    exitHeight: 6,
    prev: { area: 12, x: 330 },
    next: { area: 14, x: 16 },
  },
  {
    id: 14,
    world: 3,
    theme: "desert",
    seed: 14006,
    difficulty: 3,
    entryHeight: 6,
    exitHeight: 5,
    prev: { area: 13, x: 330 },
    next: { area: 15, x: 16 },
  },
  {
    id: 15,
    world: 3,
    theme: "desert",
    seed: 15052,
    difficulty: 4,
    entryHeight: 5,
    exitHeight: 7,
    prev: { area: 14, x: 330 },
    next: { area: 16, x: 16 },
  },
  {
    id: 16,
    world: 3,
    theme: "desert",
    seed: 16189,
    difficulty: 4,
    entryHeight: 7,
    exitHeight: 4,
    prev: { area: 15, x: 330 },
    next: { area: 1, x: 16, y: 24 },
  },
];

// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const round = (n) => Math.round(n * 100) / 100;

/**
 * Ground profile: heights[c] is the top row of solid ground in column c, or null for a pit.
 * Returns the profile plus the list of flat segments and pits.
 */
function buildProfile(rng, level) {
  const heights = new Array(COLS).fill(null);
  const segments = [];
  const pits = [];

  let col = 0;
  let h = level.entryHeight;
  const minH = 3;
  const maxH = 10;

  while (col < COLS) {
    const remaining = COLS - col;
    const first = segments.length === 0;
    let len = first ? randInt(rng, SAFE_EDGE, SAFE_EDGE + 1) : randInt(rng, 2, 4);
    if (remaining - len < SAFE_EDGE) len = remaining; // last segment absorbs the rest

    for (let c = col; c < col + len; c++) heights[c] = h;
    segments.push({ start: col, end: col + len - 1, height: h });
    col += len;

    if (col >= COLS) break;

    // Steer toward the exit height as we approach the end.
    const left = COLS - col;
    const want = level.exitHeight - h;
    let next;
    if (left <= 5) {
      next = h + Math.max(-MAX_STEP_UP, Math.min(MAX_STEP_DOWN, want));
    } else {
      next = h + pick(rng, [-2, -1, -1, 1, 1, 2, 2, 3]);
    }
    next = Math.max(minH, Math.min(maxH, next));
    if (next === h && left > 5) next = h < 7 ? h + 1 : h - 1;

    const pitChance = 0.35 + level.difficulty * 0.1;
    if (left > SAFE_EDGE + 1 && Math.abs(next - h) <= 1 && rng() < pitChance) {
      const maxWidth = Math.min(3, 1 + Math.ceil(level.difficulty / 2), left - SAFE_EDGE - 1);
      const width = randInt(rng, 1, maxWidth);
      pits.push({ start: col, end: col + width - 1, water: rng() < 0.6 });
      col += width;
    }
    h = next;
  }

  return { heights, segments, pits };
}

function solidAt(heights, r, c) {
  const cc = Math.max(0, Math.min(COLS - 1, c));
  if (r < 0) return false;
  if (r >= ROWS) return heights[cc] !== null;
  return heights[cc] !== null && r >= heights[cc];
}

function emptyGrid(fill) {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(fill));
}

function placePlatforms(rng, level, heights, segments, pits) {
  // Floating one-way platforms: [row, startCol, endCol]
  const platforms = [];
  const free = (r, s, e) =>
    r >= 1 &&
    platforms.every(([pr, ps, pe]) => Math.abs(pr - r) > 1 || e < ps - 1 || s > pe + 1) &&
    [...Array(e - s + 3).keys()].every(
      (i) => !solidAt(heights, r + 1, s - 1 + i) && !solidAt(heights, r, s - 1 + i),
    );

  // Over wide pits, a stepping platform.
  pits.forEach((pit) => {
    const ground = Math.min(heights[pit.start - 1], heights[pit.end + 1]);
    const width = pit.end - pit.start + 1;
    if (width >= 3 || rng() < 0.4) {
      const r = ground - 2;
      const s = pit.start;
      const e = Math.min(COLS - 1, pit.start + Math.max(1, width - 1));
      if (free(r, s, e)) platforms.push([r, s, e]);
    }
  });

  // Above flat segments: a 2-tier climb for bonus coins.
  segments.forEach((seg, i) => {
    if (i === 0 || i === segments.length - 1) return;
    if (rng() > 0.55 + level.difficulty * 0.05) return;
    const w = randInt(rng, 2, 4);
    const s = Math.max(1, Math.min(COLS - w - 1, seg.start + randInt(rng, -1, 1)));
    const e = s + w - 1;
    const r = seg.height - 2 - (rng() < 0.4 ? 1 : 0);
    if (r >= 1 && free(r, s, e)) platforms.push([r, s, e]);
    const r2 = r - 2;
    const s2 = Math.min(COLS - 3, e + 1 + randInt(rng, 0, 1));
    if (r2 >= 1 && rng() < 0.5 && free(r2, s2, s2 + 1)) platforms.push([r2, s2, s2 + 1]);
  });

  return platforms;
}

function buildLevel(level, seed) {
  const rng = mulberry32(seed);
  const { heights, segments, pits } = buildProfile(rng, level);
  const platforms = placePlatforms(rng, level, heights, segments, pits);

  const areaMap = emptyGrid(0);
  const collisonMap = emptyGrid("");
  const objectsMap = emptyGrid(0);
  const occupied = emptyGrid(false); // cells used by enemies/decor

  // Ground autotiling + collisions.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!solidAt(heights, r, c)) continue;
      const up = !solidAt(heights, r - 1, c);
      const left = !solidAt(heights, r, c - 1);
      const right = !solidAt(heights, r, c + 1);

      let tile = T.fill;
      if (up) tile = left && !right ? T.topLeft : right && !left ? T.topRight : T.top;
      else if (left) tile = T.left;
      else if (right) tile = T.right;
      else if (!solidAt(heights, r - 1, c - 1)) tile = T.innerLeft;
      else if (!solidAt(heights, r - 1, c + 1)) tile = T.innerRight;
      areaMap[r][c] = tile;

      let col = "";
      if (up) col += "t";
      if (left && c > 0) col += "l";
      if (right && c < COLS - 1) col += "r";
      collisonMap[r][c] = col;
    }
  }

  platforms.forEach(([r, s, e]) => {
    for (let c = s; c <= e; c++) {
      areaMap[r][c] = c === s ? T.platLeft : c === e ? T.platRight : T.platMid;
      collisonMap[r][c] = "t";
    }
  });

  // Water and death zones.
  const water = [];
  const death = [];
  pits.forEach((pit) => {
    const lower = Math.max(heights[pit.start - 1], heights[pit.end + 1]);
    if (level.world === 3) {
      for (let c = pit.start; c <= pit.end; c++) objectsMap[ROWS - 1][c] = [{ ...SPIKES.pit }];
    } else if (pit.water) {
      const top = Math.max(lower, 9);
      for (let c = pit.start - 1; c <= pit.end + 1; c++) {
        for (let t = top; t <= ROWS - 1; t += 0.5) water.push({ left: c, top: t });
      }
    }
    death.push({
      x: pit.start * TILE,
      y: 170,
      height: 32,
      width: (pit.end - pit.start + 1) * TILE,
    });
  });

  // Desert ground spike traps: one tile to hop over, on enemy-free segments.
  const traps = [];
  if (level.world === 3) {
    segments.forEach((seg, i) => {
      if (i === 0 || i === segments.length - 1 || traps.length >= level.difficulty - 1) return;
      const r = seg.height - 1;
      const lo = seg.start + (i === 1 ? 2 : 1);
      const hi = seg.end - (i === segments.length - 2 ? 2 : 1);
      if (hi < lo || rng() < 0.2) return;
      if ([...Array(seg.end - seg.start + 1).keys()].some((k) => occupied[r][seg.start + k]))
        return;
      const c = randInt(rng, lo, hi);
      objectsMap[r][c] = [{ ...SPIKES.trap }];
      occupied[r][c] = true;
      traps.push({ row: seg.height, col: c });
      death.push({ x: c * TILE + 3, y: seg.height * TILE - 7, width: 10, height: 7 });
    });
  }
  const isTrap = (r, c) => traps.some((t) => t.col === c && t.row - 1 === r);

  // Enemies patrol interior segments. On the segments next to the edges they
  // keep 2 columns clear on the edge side: a player running in through a
  // portal and dropping off the edge ledge lands there.
  const enemies = [];
  const types = ENEMY_TYPES[level.world];
  const maxEnemies = 1 + level.difficulty;
  segments.forEach((seg, i) => {
    if (i === 0 || i === segments.length - 1 || enemies.length >= maxEnemies) return;
    if (traps.some((t) => t.row === seg.height && t.col >= seg.start && t.col <= seg.end)) return;
    const lo = seg.start + (i === 1 ? 2 : 0);
    const hi = seg.end - (i === segments.length - 2 ? 2 : 0);
    const len = hi - lo + 1;
    if (len < 2) return;
    const r = seg.height - 1;
    const center = (lo + hi + 1) / 2 - 0.65;
    enemies.push({
      id: `A${String(level.id).padStart(2, "0")}E${String(enemies.length + 1).padStart(2, "0")}`,
      type: pick(rng, types),
      left: round(center),
      top: r,
      sway: Math.max(4, Math.floor((len * TILE - 24) / 2)),
      dir: rng() < 0.5 ? -1 : 1,
    });
    for (let c = lo; c <= hi; c++) occupied[r][c] = true;
  });
  // Platform patrollers on wide platforms.
  platforms.forEach(([r, s, e]) => {
    if (level.difficulty < 2 || e - s < 2 || r < 2 || enemies.length >= maxEnemies + 1) return;
    enemies.push({
      id: `A${String(level.id).padStart(2, "0")}E${String(enemies.length + 1).padStart(2, "0")}`,
      type: "pig",
      left: round((s + e + 1) / 2 - 0.65),
      top: r - 1,
      sway: Math.floor(((e - s + 1) * TILE - 24) / 2),
      dir: 1,
    });
  });

  // Coins: rows above platforms, arcs over pits, a few on the ground.
  const coins = [];
  const addCoin = (left, top) => {
    if (top < 0.3) return;
    // coin sprite is ~0.6 x 0.7 tiles; skip if it would overlap a tile or platform
    const r0 = Math.floor(top + 0.1);
    const r1 = Math.floor(top + 0.75);
    const c0 = Math.floor(left + 0.15);
    const c1 = Math.floor(left + 0.7);
    for (const r of [r0, r1]) {
      for (const c of [c0, c1]) {
        if (r < ROWS && c < COLS && (areaMap[r][c] || isTrap(r, c))) return;
      }
    }
    if (coins.some((c) => Math.abs(c.left - left) < 0.8 && Math.abs(c.top - top) < 0.9)) return;
    const id = `A${String(level.id).padStart(2, "0")}C${String(coins.length + 1).padStart(2, "0")}`;
    coins.push({ id, left: round(left), top: round(top) });
  };
  platforms.forEach(([r, s, e]) => {
    for (let c = s; c <= e; c++) addCoin(c + 0.25, r - 0.9);
  });
  pits.forEach((pit) => {
    const ground = Math.min(heights[pit.start - 1], heights[pit.end + 1]);
    const width = pit.end - pit.start + 1;
    const n = width + 1;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      addCoin(pit.start - 0.5 + t * (width + 1), ground - 1.4 - Math.sin(t * Math.PI) * 1.3);
    }
  });
  segments.forEach((seg, i) => {
    if (i === 0) return;
    if (
      enemies.some((en) => en.top === seg.height - 1 && en.left >= seg.start && en.left <= seg.end)
    ) {
      return;
    }
    for (let c = seg.start; c <= Math.min(seg.end, seg.start + 2); c++)
      addCoin(c + 0.25, seg.height - 0.95);
  });
  traps.forEach(({ row, col }) => addCoin(col + 0.25, row - 2.3));

  // Decorations.
  const decor = DECOR[level.world];
  const isFreeTop = (r, c) =>
    r >= 0 && !occupied[r][c] && areaMap[r][c] === 0 && heights[c] === r + 1;
  const addDecor = (r, c, obj) => {
    if (!isFreeTop(r, c)) return false;
    objectsMap[r][c] = objectsMap[r][c] || [];
    objectsMap[r][c].push({ ...obj });
    occupied[r][c] = true;
    return true;
  };
  addDecor(level.entryHeight - 1, 1, decor.signRight);
  addDecor(heights[COLS - 1] - 1, COLS - 2, decor.signLeft);
  for (let c = 0; c < COLS; c++) {
    if (heights[c] === null) continue;
    const r = heights[c] - 1;
    // keep the tall decor away from platforms right above
    const roomAbove = r >= 2 && areaMap[r - 1][c] === 0 && areaMap[r - 2][c] === 0;
    const roll = rng();
    if (roll < 0.18 && roomAbove) addDecor(r, c, pick(rng, decor.big));
    else if (roll < 0.5) addDecor(r, c, pick(rng, decor.small));
  }

  // Portals at the screen edges, tall enough to cover the edge ground.
  const leftTop = heights[0];
  const rightTop = heights[COLS - 1];
  const portals = [
    {
      x: -8,
      y: -40,
      height: leftTop * TILE + 40,
      width: 8,
      direction: -1,
      destinationArea: level.prev.area,
      destinationX: level.prev.x,
      destinationY: level.prev.y,
    },
    {
      x: COLS * TILE,
      y: -40,
      height: rightTop * TILE + 40,
      width: 8,
      direction: 1,
      destinationArea: level.next.area,
      destinationX: level.next.x,
      destinationY: level.next.y,
    },
  ];

  return {
    data: {
      id: level.id,
      world: level.world,
      rows: ROWS,
      columns: COLS,
      theme: level.theme,
      water,
      coins,
      death,
      portals,
      enemies,
      areaMap,
      collisonMap,
      objectsMap,
    },
    heights,
    platforms,
    traps,
  };
}

/** Standable surfaces: ground tops and platform tops, as {row, col}. */
function surfaces(heights, platforms, traps = []) {
  const list = [];
  const trapped = new Set(traps.map(({ col }) => col));
  heights.forEach((h, c) => h !== null && !trapped.has(c) && list.push({ row: h, col: c }));
  platforms.forEach(([r, s, e]) => {
    for (let c = s; c <= e; c++) list.push({ row: r, col: c });
  });
  return list;
}

/**
 * Horizontal distance (px) the player covers in a running jump before falling
 * below `rise` px above the take-off point. Mirrors Player.update().
 */
function jumpReach(rise) {
  let vy = -18;
  let vx = 3.3; // ~terminal run speed (0.5 accel, 0.87 friction)
  let y = 0;
  let x = 0;
  let best = -1;
  for (let f = 0; f < 120; f++) {
    vy += 2;
    y += vy;
    vx += 0.5;
    x += vx;
    vy *= 0.87;
    vx *= 0.87;
    if (vy > 0 && -y < rise) break; // falling and already below target height
    if (vy > 0 && -y >= rise) best = x;
  }
  return best;
}

const PLAYER_W = 12;

function canJump(a, b) {
  const riseRows = a.row - b.row; // positive = going up
  const gapCols = Math.abs(a.col - b.col) - 1; // empty columns between the two tiles
  if (gapCols < 0) return riseRows <= MAX_STEP_UP;
  const reach = jumpReach(riseRows * TILE) * 0.85; // safety margin
  if (reach < 0) return false;
  // Player can overhang its take-off and landing tiles by most of its width.
  return gapCols * TILE - (PLAYER_W - 2) * 2 <= reach;
}

function reachable(surf, from) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = surf[queue.shift()];
    surf.forEach((s, i) => {
      if (!seen.has(i) && canJump(cur, s)) {
        seen.add(i);
        queue.push(i);
      }
    });
  }
  return seen;
}

function validate({ heights, platforms, traps, data }) {
  const surf = surfaces(heights, platforms, traps);
  const entry = surf.findIndex((s) => s.col === 0 && s.row === heights[0]);
  const exit = surf.findIndex((s) => s.col === COLS - 1 && s.row === heights[COLS - 1]);
  if (entry < 0 || exit < 0) return "edge has no ground";
  if (!reachable(surf, entry).has(exit)) return "exit unreachable from entry";
  if (!reachable(surf, exit).has(entry)) return "entry unreachable from exit";

  // No column of solid wall taller than a jump next to the start/end spawn.
  const fromEntry = reachable(surf, entry);
  for (const coin of data.coins) {
    const ok = [...fromEntry].some((i) => {
      const s = surf[i];
      return Math.abs(s.col - coin.left) <= 1.5 && s.row - coin.top <= 3.2 && s.row - coin.top > 0;
    });
    if (!ok) return `coin ${coin.id} unreachable`;
  }
  return null;
}

function ascii({ data }) {
  const coinCells = new Set(data.coins.map((c) => `${Math.floor(c.top)},${Math.floor(c.left)}`));
  const enemyCells = new Set(data.enemies.map((e) => `${e.top},${Math.floor(e.left)}`));
  return data.areaMap
    .map((row, r) =>
      row
        .map((v, c) => {
          if (enemyCells.has(`${r},${c}`)) return "E";
          if (coinCells.has(`${r},${c}`)) return "o";
          if ([13, 14, 15].includes(v)) return "=";
          if (v) return "#";
          if (data.water.some((w) => w.left === c && Math.floor(w.top) === r)) return "~";
          const obj = data.objectsMap[r][c];
          if (obj && obj[0].id === 15 && data.world === 3) return "^";
          return obj ? "*" : ".";
        })
        .join(""),
    )
    .join("\n");
}

/**
 * Update one portal of an existing (hand-made) area in place, editing only the
 * changed numbers so the file's formatting is preserved.
 */
function linkNeighbour(outDir, areaId, direction, values) {
  const file = path.join(outDir, `area-${areaId}.json`);
  let text = fs.readFileSync(file, "utf8");
  const blockRe = /\{[^{}]*"direction":\s*(-?\d+)[^{}]*\}/g;
  let match;
  while ((match = blockRe.exec(text))) {
    if (Number(match[1]) !== direction) continue;
    let block = match[0];
    Object.entries(values).forEach(([key, value]) => {
      block = block.replace(new RegExp(`"${key}":\\s*-?[\\d.]+`), `"${key}": ${value}`);
    });
    text = text.slice(0, match.index) + block + text.slice(match.index + match[0].length);
    fs.writeFileSync(file, text);
    return;
  }
  throw new Error(`area ${areaId}: no portal with direction ${direction}`);
}

function main() {
  const print = process.argv.includes("--print");
  const outDir = path.resolve(__dirname, "../app/areas");

  const results = {};
  LEVELS.forEach((level) => {
    let result;
    let error;
    let seed = level.seed;
    for (let attempt = 0; attempt < 500; attempt++, seed++) {
      result = buildLevel(level, seed);
      error = validate(result);
      if (!error) break;
    }
    if (error) throw new Error(`area ${level.id}: could not generate a valid level (${error})`);
    results[level.id] = { ...result, seed };
  });

  // Portals between two generated levels land the player just above the
  // neighbour's edge ground.
  Object.values(results).forEach(({ data }) => {
    data.portals.forEach((portal) => {
      if (portal.destinationY !== undefined) return;
      const target = results[portal.destinationArea];
      if (!target) throw new Error(`area ${data.id}: portal needs destinationY`);
      const edge = portal.direction < 0 ? COLS - 1 : 0;
      portal.destinationY = target.heights[edge] * TILE - 8;
    });
  });

  // Hand-made neighbours: point their portal into this level at the right height.
  Object.values(results).forEach(({ data, heights }) => {
    data.portals.forEach((portal) => {
      if (results[portal.destinationArea]) return;
      const fromLeft = portal.direction < 0; // we exit left, so they enter us from their right
      linkNeighbour(outDir, portal.destinationArea, fromLeft ? 1 : -1, {
        destinationArea: data.id,
        destinationX: fromLeft ? 16 : 330,
        destinationY: heights[fromLeft ? 0 : COLS - 1] * TILE - 8,
      });
    });
  });

  Object.values(results).forEach((result) => {
    const { data, seed } = result;
    const file = path.join(outDir, `area-${data.id}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    console.log(
      `area-${data.id}.json  seed=${seed}  coins=${data.coins.length}  enemies=${data.enemies.length}  pits=${data.death.length}  left=${result.heights[0]} right=${result.heights[COLS - 1]}`,
    );
    if (print) console.log(ascii(result) + "\n");
  });
}

module.exports = { buildLevel, validate, LEVELS };

if (require.main === module) main();
