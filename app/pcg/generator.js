/**
 * Procedural level generator (PCG) for Dino's Adventure, shared by the game
 * (endless, daily and custom worlds are generated in the browser) and by
 * scripts/generate-levels.js (story levels written to app/areas).
 *
 * Builds area data (areaMap / collisonMap / objectsMap / coins / enemies /
 * powerups / water / death / portals) in the same format as the hand-made
 * areas. Every level is checked for reachability (entry -> exit and back, and
 * every coin and power-up) using the player's jump limits; a seed that
 * produces an unbeatable level is rejected and the next seed is tried.
 */

export const ROWS = 12;
export const COLS = 21;
export const TILE = 16;

// Player physics (see app/game/player.js): max jump ~2.7 tiles up, ~3.3 tiles across.
const MAX_STEP_UP = 2;
const MAX_STEP_DOWN = 3;
const MAX_GAP = 3; // empty columns that can be jumped at equal height
// Flat, hazard-free columns at each edge so a player running through a portal
// does not land straight in a pit or an enemy.
const SAFE_EDGE = 4;

// Tile ids (same layout for the grasslands, iceland, desert and graveyard tilesets).
const TILES_A = {
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
  // graveyard
  4: {
    signRight: { id: 5, xOffset: 1, yOffset: 2, width: 14, height: 14 },
    signLeft: { id: 6, xOffset: 1, yOffset: 2, width: 14, height: 14 },
    big: [
      { id: 1, xOffset: -10, yOffset: -14, width: 36, height: 30 },
      { id: 7, xOffset: -4, yOffset: 5, width: 24, height: 11 },
    ],
    small: [
      { id: 3, xOffset: 4, yOffset: 4, width: 9, height: 12 },
      { id: 4, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 4, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 2, xOffset: 0, yOffset: 7, width: 16, height: 9 },
      { id: 8, xOffset: 2, yOffset: 8, width: 12, height: 8 },
      { id: 9, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 11, xOffset: 2, yOffset: 4, width: 12, height: 12 },
      { id: 14, xOffset: 0, yOffset: 9, width: 16, height: 8 },
    ],
  },
  // factory
  5: {
    signRight: { id: 8, xOffset: 6, yOffset: -2, width: 4, height: 18 },
    signLeft: { id: 9, xOffset: 6, yOffset: -2, width: 4, height: 18 },
    big: [
      { id: 4, xOffset: 2, yOffset: -4, width: 12, height: 20 },
      { id: 6, xOffset: 2, yOffset: -4, width: 12, height: 20 },
      { id: 11, xOffset: 0, yOffset: 0, width: 16, height: 16 },
    ],
    small: [
      { id: 1, xOffset: 3, yOffset: 3, width: 10, height: 13 },
      { id: 2, xOffset: 3, yOffset: 3, width: 10, height: 13 },
      { id: 3, xOffset: 1, yOffset: 2, width: 14, height: 14 },
      { id: 11, xOffset: 0, yOffset: 0, width: 16, height: 16 },
    ],
  },
};

// Generated worlds (app/gen paints these object ids for each world).
DECOR.gen = {
  signRight: { id: 5, xOffset: 1, yOffset: 2, width: 14, height: 14 },
  signLeft: { id: 6, xOffset: 1, yOffset: 2, width: 14, height: 14 },
  big: [
    { id: 1, xOffset: -8, yOffset: -16, width: 32, height: 32 },
    { id: 2, xOffset: -12, yOffset: -24, width: 40, height: 40 },
  ],
  small: [
    { id: 3, xOffset: 0, yOffset: 4, width: 16, height: 12 },
    { id: 4, xOffset: 2, yOffset: 4, width: 12, height: 12 },
    { id: 7, xOffset: 1, yOffset: 6, width: 14, height: 10 },
    { id: 8, xOffset: 3, yOffset: 8, width: 10, height: 8 },
    { id: 9, xOffset: 2, yOffset: 2, width: 12, height: 14 },
  ],
};

// Factory (world-5) girders: own layout, acid pits and a riveted back wall.
const TILES_FACTORY = {
  topLeft: 1,
  top: 2,
  topRight: 3,
  left: 4,
  fill: 5,
  right: 6,
  innerLeft: 7,
  innerRight: 8,
  platLeft: 12,
  platMid: 13,
  platRight: 14,
};
const TILESETS = { 5: TILES_FACTORY };
const ACID = { top: 16, body: 17 };
const backdropTile = (r, c) => (r === 0 ? (c % 2 ? 19 : 18) : (r + c) % 2 ? 21 : 20);

// Desert spikes (world-3 object 15): pit floors and 1-tile ground traps.
// Boss arenas (level 6 of every world): a flat floor and three ledges.
const BOSS_FLOOR = 9;
const BOSS_LEDGES = [
  [7, 2, 5],
  [5, 8, 12],
  [7, 15, 18],
];

// Factory saw blades (world-5 object 7) are its 1-tile ground traps.
const SAW = { id: 7, xOffset: 1, yOffset: 3, width: 14, height: 14 };

const SPIKES = {
  pit: { id: 15, xOffset: 0, yOffset: 0, width: 16, height: 16 },
  trap: { id: 15, xOffset: 1, yOffset: 2, width: 14, height: 14 },
};

// Enemy mixes per world. Walkers patrol ground and platforms; bats fly over
// pits; spitters stand mid-level and shoot.
export const ENEMY_TYPES = {
  1: ["pig", "chameleon", "pig", "beetle", "bat"],
  2: ["pig", "chameleon", "slime", "beetle", "bat"],
  3: ["pig", "slime", "chameleon", "beetle", "bat", "spitter"],
  4: ["slime", "bat", "beetle", "chameleon", "bat", "spitter"],
  5: ["beetle", "pig", "spitter", "beetle", "slime", "bat"],
};
/** Shooting walkers (phase 6a): how a walker's shot is placed and paced. */
export const SHOOT_MIN = 52; // px: closer than this, a walker lunges instead
export const SHOOT_MAX = 120; // px
export const SHOOT_HEIGHT = 24; // px: the player's centre within this of the walker's
export const SHOOT_EVERY = 90; // ticks between shots (3 s)
/** Area x (px) of the two portal arrival spots a level is entered at. */
export const ARRIVALS = [16, 330];
/** Half a walker's width in px: its patrol centre is `left` tiles plus this. */
const WALKER_HALF = 10;
/** Whether a walker standing at `left` (tiles) in a level of `difficulty` may shoot. */
export function walkerShoots(left, difficulty) {
  if (difficulty < 2) return false;
  const centre = left * TILE + WALKER_HALF;
  // like spitters: out of range of both portal arrival spots
  return ARRIVALS.every((x) => Math.abs(centre - x) > SHOOT_MAX);
}
/** A story level's difficulty from LEVELS, or 1 for a hand-made level LEVELS doesn't list. */
export function storyDifficulty(areaId) {
  return LEVELS.find((l) => l.id === areaId)?.difficulty ?? 1;
}

export const WALKERS = ["pig", "slime", "chameleon", "beetle"];
export const ALL_ENEMIES = [...WALKERS, "bat", "spitter"];
export const POWERUPS = ["heart", "shield", "triple", "wings"];
// Area theme = its music track. Graveyard plays "dungeon", factory plays "lab".
export const THEMES = { grasslands: 1, iceland: 2, desert: 3, dungeon: 4, lab: 5 };

/**
 * The levels to generate. Like Grassland 1-2, ground stays low
 * (rows 8-10, mostly 9-10) and the space above is filled with tiers of floating platforms
 * with coins and patrolling enemies. entryHeight / exitHeight are the ground-top rows at the
 * left / right edges, chosen to line up with the neighbouring areas.
 */
export const LEVELS = [
  {
    id: 9,
    world: 1,
    theme: "grasslands",
    seed: 9001,
    difficulty: 2,
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: 7, x: 330, y: 96 },
    next: { area: 10, x: 16 },
  },
  {
    id: 10,
    world: 1,
    theme: "grasslands",
    seed: 10001,
    difficulty: 3,
    entryHeight: 9,
    exitHeight: 10,
    prev: { area: 9, x: 330 },
    next: { area: 3, x: 6, y: 24 },
  },
  {
    id: 11,
    world: 2,
    theme: "iceland",
    seed: 11001,
    difficulty: 3,
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: 8, x: 330, y: 42 },
    next: { area: 12, x: 16 },
  },
  {
    id: 12,
    world: 2,
    theme: "iceland",
    seed: 12001,
    difficulty: 4,
    entryHeight: 10,
    exitHeight: 9,
    prev: { area: 11, x: 330 },
    next: { area: 13, x: 16 },
  },
  {
    id: 13,
    world: 3,
    theme: "desert",
    seed: 13169,
    difficulty: 3,
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: 12, x: 330 },
    next: { area: 14, x: 16 },
  },
  {
    id: 14,
    world: 3,
    theme: "desert",
    seed: 14006,
    difficulty: 3,
    entryHeight: 9,
    exitHeight: 10,
    prev: { area: 13, x: 330 },
    next: { area: 15, x: 16 },
  },
  {
    id: 15,
    world: 3,
    theme: "desert",
    seed: 15052,
    difficulty: 4,
    entryHeight: 10,
    exitHeight: 9,
    prev: { area: 14, x: 330 },
    next: { area: 16, x: 16 },
  },
  {
    id: 16,
    world: 3,
    theme: "desert",
    seed: 16189,
    difficulty: 4,
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: 15, x: 330 },
    next: { area: 17, x: 16 },
  },
  ...[
    [17, 4, "dungeon", 3],
    [18, 4, "dungeon", 3],
    [19, 4, "dungeon", 4],
    [20, 4, "dungeon", 4],
    [21, 5, "lab", 4],
    [22, 5, "lab", 4],
    [23, 5, "lab", 5],
    [24, 5, "lab", 5],
  ].map(([id, world, theme, difficulty], i) => ({
    id,
    world,
    theme,
    seed: id * 1000 + 1,
    difficulty,
    entryHeight: 9,
    exitHeight: i % 2 ? 9 : 10,
    prev: { area: id - 1, x: 330 },
    next: id === 24 ? { area: 1, x: 16, y: 24 } : { area: id + 1, x: 16 },
  })),
];

// Every world has 6 levels; level 6 is a boss arena. The levels below extend
// the chain above: [id, world, theme, difficulty, boss, after, before].
export const FINISH = -1; // the last boss's exit ends the campaign
[
  [25, 1, "grasslands", 3, "kingPig", 10, 3],
  [26, 2, "iceland", 4, null, 12, 27],
  [27, 2, "iceland", 4, "frostSlime", 26, 13],
  [28, 3, "desert", 4, null, 16, 29],
  [29, 3, "desert", 4, "sandLizard", 28, 17],
  [30, 4, "dungeon", 5, null, 20, 31],
  [31, 4, "dungeon", 5, "batLord", 30, 21],
  [32, 5, "lab", 5, null, 24, 33],
  [33, 5, "lab", 5, "mechBeetle", 32, FINISH],
].forEach(([id, world, theme, difficulty, boss, after, before]) => {
  const prev = LEVELS.find((l) => l.id === after);
  if (prev) prev.next = { area: id, x: 16 };
  const next = LEVELS.find((l) => l.id === before);
  if (next) next.prev = { area: id, x: 330 };
  LEVELS.push({
    id,
    world,
    theme,
    seed: id * 1000 + 1,
    difficulty,
    ...(boss ? { boss } : {}),
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: after, x: 330 },
    next:
      before === FINISH
        ? { area: FINISH, x: 16, y: 0 }
        : before === 3
          ? { area: 3, x: 6, y: 24 } // hand-made Iceland 1: arrive on its upper ledge
          : { area: before, x: 16 },
  });
});

// ---------------------------------------------------------------------------

export function mulberry32(seed) {
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

  // boss arenas: one flat floor, no pits
  if (level.boss) {
    heights.fill(BOSS_FLOOR);
    segments.push({ start: 0, end: COLS - 1, height: BOSS_FLOOR });
    return { heights, segments, pits };
  }

  let col = 0;
  let h = level.entryHeight;
  // Low ground, no higher than Grassland 1-2 (mostly rows 9-10): tall dirt
  // walls waste the screen.
  const minH = 8;
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
      if (next < 9 && rng() < 0.5) next = 9; // row 8 only now and then
    }
    next = Math.max(minH, Math.min(maxH, next));
    if (next === h && left > 5) next = h < 9 ? h + 1 : h - 1;

    const pitChance = (0.35 + level.difficulty * 0.1) * (level.pitScale ?? 1);
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
  // boss arenas: three ledges to dodge onto, two rows apart (one jump each)
  if (level.boss) return BOSS_LEDGES.map((p) => [...p]);

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

/**
 * Upper tier: floating platforms climbing toward the top of the screen. Each
 * one must be reachable (by the jump model below) from a surface placed before
 * it, so the tier is always climbable.
 */
function placeSkyPlatforms(rng, level, heights, platforms) {
  const target = 7 + Math.floor(level.difficulty / 2);
  const added = [];
  const clear = (r, s, e) =>
    r >= 2 &&
    s >= 1 &&
    e <= COLS - 2 &&
    // stacked platforms need 3 rows between them: room for a 20px enemy
    platforms.every(([pr, ps, pe]) => Math.abs(pr - r) > 2 || e < ps - 1 || s > pe + 1) &&
    [...Array(e - s + 3).keys()].every((i) => {
      const c = s - 1 + i;
      // one empty row under it: the player (12px) still fits below and, as the
      // platform is one-way, can jump up through it
      return !solidAt(heights, r, c) && !solidAt(heights, r + 1, c);
    });

  for (let attempt = 0; attempt < 800 && added.length < target; attempt++) {
    // favour the highest rows: that's where the tier is missing
    const r = pick(rng, [2, 2, 3, 3, 4, 4, 5, 5, 6]);
    const w = pick(rng, [2, 3, 3, 4, 4, 5]);
    const s = randInt(rng, 1, COLS - 1 - w);
    const e = s + w - 1;
    if (!clear(r, s, e)) continue;
    // the HUD (area / coin count) covers the top corners
    if (r <= 2 && (s <= 3 || e >= COLS - 4)) continue;

    const surf = surfaces(heights, platforms);
    const cells = [];
    for (let c = s; c <= e; c++) cells.push({ row: r, col: c });
    const linked = cells.some((cell) => surf.some((from) => canJump(from, cell)));
    if (!linked) continue;

    platforms.push([r, s, e]);
    added.push([r, s, e]);
  }
  return added;
}

/**
 * Builds a level. A platform the dino can't stand on from the entry (see
 * unreachablePlatforms) is repaired before the level is used: the build is
 * redone without that platform, which also drops anything that sat on it.
 */
export function buildLevel(input, seed) {
  const dropped = new Set();
  let result = buildLevelOnce(input, seed, dropped);
  for (let pass = 0; pass < 8; pass++) {
    const bad = unreachablePlatformIndexes(result);
    if (!bad.length) break;
    bad.forEach((i) => dropped.add(result.platforms[i].join(",")));
    result = buildLevelOnce(input, seed, dropped);
  }
  return result;
}

function buildLevelOnce(input, seed, dropped) {
  const level = { ...input, world: input.world || THEMES[input.theme] || 1 };
  const T = TILESETS[level.world] || TILES_A;
  const rng = mulberry32(seed);
  const { heights, segments, pits } = buildProfile(rng, level);
  const platforms = placePlatforms(rng, level, heights, segments, pits);
  if (!level.boss) placeSkyPlatforms(mulberry32(seed * 31 + 7), level, heights, platforms);
  if (dropped.size) {
    const kept = platforms.filter((pl) => !dropped.has(pl.join(",")));
    platforms.length = 0;
    platforms.push(...kept);
  }

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

  // Pits: spikes (desert), acid (factory), bottomless (graveyard) or water.
  // Generated worlds choose with `style.pits` ("liquid" fills every pit).
  const pitStyle =
    (level.style && level.style.pits) ||
    { 3: "spikes", 4: "void", 5: "acid" }[level.world] ||
    "water";
  const trapsOn = level.style ? !!level.style.traps : level.world === 3 || level.world === 5;

  // Water and death zones.
  const water = [];
  const death = [];
  pits.forEach((pit) => {
    const lower = Math.max(heights[pit.start - 1], heights[pit.end + 1]);
    if (pitStyle === "spikes") {
      for (let c = pit.start; c <= pit.end; c++) objectsMap[ROWS - 1][c] = [{ ...SPIKES.pit }];
    } else if (pitStyle === "acid") {
      // acid, a little below the lower rim
      const top = Math.max(lower + 1, 10);
      for (let c = pit.start; c <= pit.end; c++) {
        for (let r = top; r < ROWS; r++) areaMap[r][c] = r === top ? ACID.top : ACID.body;
      }
    } else if (pitStyle === "void") {
      // graveyard pits are bottomless
    } else if (pit.water || pitStyle === "liquid") {
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
  if (trapsOn && !level.boss) {
    const trap = level.world === 5 ? SAW : SPIKES.trap;
    segments.forEach((seg, i) => {
      if (i === 0 || i === segments.length - 1 || traps.length >= level.difficulty - 1) return;
      const r = seg.height - 1;
      const lo = seg.start + (i === 1 ? 2 : 1);
      const hi = seg.end - (i === segments.length - 2 ? 2 : 1);
      if (hi < lo || rng() < 0.2) return;
      if ([...Array(seg.end - seg.start + 1).keys()].some((k) => occupied[r][seg.start + k]))
        return;
      const c = randInt(rng, lo, hi);
      objectsMap[r][c] = [{ ...trap }];
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
  // a boss arena has only its boss (and the minions it calls)
  const types = level.boss ? [] : level.enemyTypes || ENEMY_TYPES[level.world];
  // generated worlds name their own enemy types: `enemyKinds` says how each moves
  const kindOf = (t) =>
    (level.enemyKinds && level.enemyKinds[t]) ||
    (t === "bat" ? "flyer" : t === "spitter" ? "turret" : "walker");
  // a world can ask for no walkers at all (e.g. only spitters and bats)
  const walkers = types.filter((t) => kindOf(t) === "walker");
  // (unique, and no rng call for a single kind: story levels stay the same)
  const flyers = [...new Set(types.filter((t) => kindOf(t) === "flyer"))];
  const turrets = [...new Set(types.filter((t) => kindOf(t) === "turret"))];
  const one = (list) => (list.length === 1 ? list[0] : pick(rng, list));
  const scale = level.enemyScale ?? 1;
  const maxEnemies = Math.max(1, Math.round((1 + level.difficulty) * scale));
  const enemyId = () =>
    `A${String(level.id).padStart(2, "0")}E${String(enemies.length + 1).padStart(2, "0")}`;
  segments.forEach((seg, i) => {
    if (!walkers.length) return;
    if (i === 0 || i === segments.length - 1 || enemies.length >= maxEnemies) return;
    if (traps.some((t) => t.row === seg.height && t.col >= seg.start && t.col <= seg.end)) return;
    const lo = seg.start + (i === 1 ? 2 : 0);
    const hi = seg.end - (i === segments.length - 2 ? 2 : 0);
    const len = hi - lo + 1;
    if (len < 2) return;
    const r = seg.height - 1;
    const center = (lo + hi + 1) / 2 - 0.65;
    enemies.push({
      id: enemyId(),
      type: pick(rng, walkers),
      left: round(center),
      top: r,
      sway: Math.max(4, Math.floor((len * TILE - 24) / 2)),
      dir: rng() < 0.5 ? -1 : 1,
    });
    for (let c = lo; c <= hi; c++) occupied[r][c] = true;
  });
  // Platform patrollers on wide platforms.
  // 5-6 in all, like the hand-made areas
  const maxTotal = Math.max(1, Math.round((4 + Math.floor(level.difficulty / 2)) * scale));
  platforms.forEach((platform) => {
    const [r, s, e] = platform;
    if (!walkers.length) return;
    if (level.difficulty < 2 || e - s < 2 || r < 2 || enemies.length >= maxTotal) return;
    // no room for a 20px enemy under a platform two rows up
    if (platforms.some(([pr, ps, pe]) => pr === r - 2 && pe >= s && ps <= e)) return;
    enemies.push({
      id: enemyId(),
      type: pick(rng, walkers),
      left: round((s + e + 1) / 2 - 0.65),
      top: r - 1,
      sway: Math.floor(((e - s + 1) * TILE - 24) / 2),
      dir: 1,
    });
  });

  // Bats patrol the air over wide pits, above the coin arc.
  if (flyers.length && (level.difficulty >= 2 || !walkers.length)) {
    pits.forEach((pit) => {
      const width = pit.end - pit.start + 1;
      if (width < 2 || enemies.length >= maxTotal + 1 || rng() < 0.35) return;
      const ground = Math.min(heights[pit.start - 1], heights[pit.end + 1]);
      const r = ground - 4;
      const s = pit.start - 1;
      const e = pit.end + 1;
      for (let c = s; c <= e; c++) if (areaMap[r][c] || areaMap[r + 1][c]) return;
      enemies.push({
        id: enemyId(),
        type: one(flyers),
        left: round((pit.start + pit.end + 1) / 2 - 0.55),
        top: r,
        sway: Math.max(8, Math.floor((width * TILE) / 2)),
        dir: rng() < 0.5 ? -1 : 1,
      });
    });
  }

  // One spitter on a mid-level ground segment, out of range of both edges.
  if (turrets.length && level.difficulty >= 2 && rng() < 0.75) {
    const spots = segments.filter((seg, i) => {
      if (i === 0 || i === segments.length - 1) return false;
      const c = Math.floor((seg.start + seg.end) / 2);
      const r = seg.height - 1;
      // spit range is 88px: stay out of reach of both portal arrival spots
      return (
        c >= 8 &&
        c <= COLS - 9 &&
        !occupied[r][c] &&
        !isTrap(r, c) &&
        !enemies.some((en) => en.top === r && Math.abs(en.left - c) < 3)
      );
    });
    if (spots.length) {
      const seg = pick(rng, spots);
      const c = Math.floor((seg.start + seg.end) / 2);
      enemies.push({
        id: enemyId(),
        type: one(turrets),
        left: c,
        top: seg.height - 1,
        sway: 0,
        dir: -1,
      });
      occupied[seg.height - 1][c] = true;
    }
  }

  // No walkers asked for: spitters guard the higher platforms instead (too
  // high to reach a player arriving through a portal).
  if (turrets.length && !walkers.length) {
    platforms
      .filter(([r, s, e]) => r <= 6 && e - s >= 1)
      .forEach(([r, s, e]) => {
        if (enemies.length >= maxTotal) return;
        const c = Math.floor((s + e) / 2);
        if (enemies.some((en) => en.top === r - 1 && Math.abs(en.left - c) < 2)) return;
        enemies.push({
          id: enemyId(),
          type: one(turrets),
          left: c,
          top: r - 1,
          sway: 0,
          dir: -1,
        });
      });
  }

  // Mix it up: never a level of only one kind of walker when the world has more.
  const distinct = [...new Set(walkers)];
  const walking = enemies.filter((en) => kindOf(en.type) === "walker");
  if (
    distinct.length > 1 &&
    walking.length > 1 &&
    new Set(walking.map((en) => en.type)).size === 1
  ) {
    const others = distinct.filter((t) => t !== walking[0].type);
    walking[Math.floor(rng() * walking.length)].type = pick(rng, others);
    if (walking.length > 3) walking[0].type = pick(rng, others);
  }

  // Walkers far enough from the portals may shoot (a flag: no random numbers drawn).
  enemies.forEach((en) => {
    if (kindOf(en.type) === "walker" && walkerShoots(en.left, level.difficulty)) en.shoots = true;
  });

  // Power-ups on top of floating platforms with no enemy on them.
  const powerups = [];
  const allowed = level.boss ? ["heart"] : level.powerups || POWERUPS;
  const count = level.boss ? 1 : (level.powerupCount ?? 1);
  const spots = platforms
    .filter(
      ([r, s, e]) =>
        r >= 2 && !enemies.some((en) => en.top === r - 1 && en.left >= s - 1 && en.left <= e),
    )
    .sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < count && allowed.length && spots.length; i++) {
    const [r, s, e] = spots.splice(Math.floor(rng() * Math.min(3, spots.length)), 1)[0];
    const c = Math.floor((s + e) / 2);
    powerups.push({
      id: `A${String(level.id).padStart(2, "0")}P${String(i + 1).padStart(2, "0")}`,
      type: pick(rng, allowed),
      left: c,
      top: r - 1,
    });
  }
  const isPowerup = (r, c) => powerups.some((p) => p.top === r && p.left === c);

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
        if (r < ROWS && c < COLS && (areaMap[r][c] || isTrap(r, c) || isPowerup(r, c))) return;
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
  const decor = DECOR[level.decorSet || level.world];
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

  const backdrop =
    level.world === 5
      ? Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (__, c) => backdropTile(r, c)),
        )
      : undefined;

  const boss = level.boss
    ? {
        id: `A${String(level.id).padStart(2, "0")}B01`,
        kind: level.boss,
        left: 14,
        top: BOSS_FLOOR - 1,
      }
    : undefined;

  return {
    data: {
      id: level.id,
      world: level.world,
      ...(boss ? { boss } : {}),
      ...(backdrop ? { backdrop } : {}),
      rows: ROWS,
      columns: COLS,
      theme: level.theme,
      water,
      coins,
      death,
      portals,
      enemies,
      powerups,
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

/** Platforms (as surface indexes) the dino can't stand on from the entry, using the normal jump model. */
export function unreachablePlatforms({ heights, platforms, traps = [] }) {
  const surf = surfaces(heights, platforms, traps);
  const entry = surf.findIndex((s) => s.col === 0 && s.row === heights[0]);
  if (entry < 0) return [];
  const seen = reachable(surf, entry);
  const first = surf.length - platforms.reduce((n, [, s, e]) => n + e - s + 1, 0);
  const bad = [];
  for (let i = first; i < surf.length; i++) if (!seen.has(i)) bad.push(i);
  return bad;
}

/**
 * The same check on finished area data (hand-made or generated): the standable
 * tiles ("t" collision) that the dino can't reach from the ground at the left
 * edge. Returns [{row, col}]. Traps are not in the data, so they are ignored.
 */
export function unreachableInArea(data) {
  const grid = data.collisonMap;
  const surf = [];
  grid.forEach((row, r) =>
    row.forEach(
      (v, c) => typeof v === "string" && v.includes("t") && surf.push({ row: r, col: c }),
    ),
  );
  const grounded = (s) => s.row + 1 >= ROWS || data.areaMap[s.row + 1][s.col] !== 0;
  let entry = -1;
  for (let c = 0; c < COLS && entry < 0; c++) {
    entry = surf.findIndex((s) => s.col === c && grounded(s));
  }
  if (entry < 0) return surf;
  const seen = reachable(surf, entry);
  return surf.filter((s, i) => !seen.has(i));
}

/** Indexes (into `platforms`) of platforms with no standable tile from the entry. */
function unreachablePlatformIndexes(level) {
  const bad = new Set(unreachablePlatforms(level));
  const surf = surfaces(level.heights, level.platforms, level.traps);
  let at = surf.length - level.platforms.reduce((n, [, s, e]) => n + e - s + 1, 0);
  const out = [];
  level.platforms.forEach(([, s, e], i) => {
    if (bad.has(at)) out.push(i);
    at += e - s + 1;
  });
  return out;
}

export function validate({ heights, platforms, traps, data }) {
  const surf = surfaces(heights, platforms, traps);
  const entry = surf.findIndex((s) => s.col === 0 && s.row === heights[0]);
  const exit = surf.findIndex((s) => s.col === COLS - 1 && s.row === heights[COLS - 1]);
  if (entry < 0 || exit < 0) return "edge has no ground";
  if (!reachable(surf, entry).has(exit)) return "exit unreachable from entry";
  if (!reachable(surf, exit).has(entry)) return "entry unreachable from exit";

  const stranded = unreachablePlatforms({ heights, platforms, traps });
  if (stranded.length) {
    const s = surf[stranded[0]];
    return `platform ${s.col},${s.row} unreachable`;
  }

  const fromEntry = reachable(surf, entry);
  for (const coin of [...data.coins, ...(data.powerups || [])]) {
    const ok = [...fromEntry].some((i) => {
      const s = surf[i];
      return Math.abs(s.col - coin.left) <= 1.5 && s.row - coin.top <= 3.2 && s.row - coin.top > 0;
    });
    if (!ok) return `coin ${coin.id} unreachable`;
  }
  return null;
}

export function ascii({ data }) {
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

/** Builds every level in LEVELS (first valid seed) and links their portals. */
export function buildAll() {
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

  return results;
}

/** First valid seed from `level.seed`: { data, heights, seed }. */
export function generateArea(level, attempts = 400) {
  let seed = level.seed;
  let error = null;
  for (let attempt = 0; attempt < attempts; attempt++, seed++) {
    const result = buildLevel(level, seed);
    error = validate(result);
    if (!error) return { ...result, seed };
  }
  throw new Error(`area ${level.id}: could not generate a valid level (${error})`);
}

const THEME_ORDER = ["grasslands", "iceland", "desert", "dungeon", "lab"];
export const themeFor = (index) => THEME_ORDER[Math.floor(index / 3) % THEME_ORDER.length];

/**
 * A chain of generated levels for runtime modes (daily, custom worlds).
 * `levels` is [{ theme, difficulty, enemyTypes?, enemyScale?, pitScale?,
 * powerups?, powerupCount? }]. The first level's left edge is the end of the
 * world (no portal); the last level's right portal goes to area -1 ("finish").
 */
export function generateSequence({ idBase, seed, levels }) {
  const rng = mulberry32(seed);
  const exits = [];
  const areas = [];
  levels.forEach((spec, i) => {
    const id = idBase + i;
    const entryHeight = 9;
    const exitHeight = 9 + (rng() < 0.4 ? 1 : 0);
    const last = i === levels.length - 1;
    const result = generateArea({
      ...spec,
      id,
      seed: Math.floor(rng() * 1e9),
      difficulty: Math.max(1, Math.min(5, spec.difficulty || 2)),
      entryHeight,
      exitHeight,
      prev:
        i === 0
          ? { area: null, x: 330, y: 0 }
          : { area: id - 1, x: 330, y: exits[i - 1] * TILE - 8 },
      next: last ? { area: -1, x: 16, y: 0 } : { area: id + 1, x: 16, y: entryHeight * TILE - 8 },
    });
    exits.push(result.heights[COLS - 1]);
    areas.push(result.data);
  });
  return areas;
}

/** One endless-mode level: always entered at row 9 from the left. */
export function generateEndlessLevel({ id, seed, index, prevExit }) {
  const difficulty = Math.min(5, 1 + Math.floor(index / 2));
  const result = generateArea({
    id,
    seed,
    theme: themeFor(index),
    difficulty,
    entryHeight: 9,
    exitHeight: 9 + (index % 2),
    enemyScale: 0.8 + Math.min(0.6, index * 0.05),
    powerupCount: index % 3 === 2 ? 2 : 1,
    prev:
      index === 0 ? { area: null, x: 330, y: 0 } : { area: id - 1, x: 330, y: prevExit * TILE - 8 },
    next: { area: id + 1, x: 16, y: 9 * TILE - 8 },
  });
  return { data: result.data, exit: result.heights[COLS - 1] };
}
