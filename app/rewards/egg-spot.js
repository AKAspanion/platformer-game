import { COLS, ROWS, mulberry32, unreachableInArea } from "../pcg/generator.js";

/**
 * Where an egg can sit in an area: on a standable tile the dino can reach, off
 * the main path. Pure, so a story area gets the same spot every time and a
 * daily area gets the same one on every device.
 */

const EDGE = 3; // columns kept clear at each edge, where the portals are
// The dino enters at 40 px (story) or 24 px (daily): column 2.5 at the furthest. An egg is
// at least 5 tiles from there, so it is never picked up in the first step.
const SPAWN_COL = 2.5;
const MIN_FROM_SPAWN = 5;
const FIRST_COL = Math.ceil(SPAWN_COL + MIN_FROM_SPAWN - 0.25);
const COIN_OFFSET = 0.9; // a coin sits 0.9 of a tile above its surface, and so does an egg

const isSurface = (v) => typeof v === "string" && v.includes("t");

/** The standable tiles ("t") the dino can reach from the entry: [{ row, col }]. */
function reachableSurfaces(area) {
  const lost = new Set(unreachableInArea(area).map(({ row, col }) => `${row},${col}`));
  const found = [];
  area.collisonMap.forEach((row, r) =>
    row.forEach((v, c) => {
      if (isSurface(v) && !lost.has(`${r},${c}`)) found.push({ row: r, col: c });
    }),
  );
  return found;
}

const solid = (area, r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !!area.areaMap[r][c];

/** The coin reachability rule from validate(), on finished area data. */
export function eggReachable(area, spot) {
  if (!spot || !Number.isFinite(spot.left) || !Number.isFinite(spot.top)) return false;
  // the egg's own footprint (like a coin's) must be clear of solid tiles
  for (const r of [Math.floor(spot.top + 0.1), Math.floor(spot.top + 0.75)]) {
    for (const c of [Math.floor(spot.left + 0.15), Math.floor(spot.left + 0.7)]) {
      if (solid(area, r, c)) return false;
    }
  }
  return reachableSurfaces(area).some(
    (s) => Math.abs(s.col - spot.left) <= 1.5 && s.row - spot.top <= 3.2 && s.row - spot.top > 0,
  );
}

/**
 * Whether a coin, power-up or enemy is within `reach` cells of (row, col),
 * sideways and up or down.
 */
function crowded(area, row, col, reach, lists = [area.coins, area.powerups, area.enemies]) {
  const near = ({ left, top }) =>
    Math.abs(Math.floor(left) - col) <= reach && Math.abs(Math.floor(top) - row) <= reach;
  return lists.some((list) => (list || []).some(near));
}

// Tiers, best first. A floating platform top beats the ground, always. On either, an egg keeps
// clear of what is on or next to its tile, then of what is on its own tile. Generated levels put
// a coin trail on most platforms, so when no platform tile is free of coins the egg shares a
// tile with a coin (never with a power-up or an enemy) rather than drop to the ground.
const TIERS = [
  { floating: true, reach: 1, coins: true },
  { floating: true, reach: 0, coins: true },
  { floating: true, reach: 0, coins: false },
  { floating: false, reach: 1, coins: true },
  { floating: false, reach: 0, coins: true },
  { floating: false, reach: 0, coins: false },
];

/**
 * A reachable spot off the main path for an egg in an area, or null. Pure; same area + seed, same spot.
 * A floating platform top (with the clearest tile first) wins over the ground; the ground is the
 * fallback for a level with no usable platform. Either way the egg is 5+ tiles from the spawn.
 */
export function eggSpot(area, seed) {
  const roomy = reachableSurfaces(area)
    .filter(({ row, col }) => {
      if (col < FIRST_COL || col >= COLS - EDGE || row < 2) return false;
      // room for the egg and for the dino standing next to it
      if (solid(area, row - 1, col) || solid(area, row - 2, col)) return false;
      const object = area.objectsMap && area.objectsMap[row - 1] && area.objectsMap[row - 1][col];
      return !(area.world === 3 && object && object[0] && object[0].id === 15); // spikes
    })
    .map((s) => ({ ...s, floating: !solid(area, s.row + 1, s.col) }));

  let candidates = [];
  for (const { floating, reach, coins } of TIERS) {
    const lists = coins ? undefined : [area.powerups, area.enemies];
    candidates = roomy.filter(
      (s) => s.floating === floating && !crowded(area, s.row - 1, s.col, reach, lists),
    );
    if (candidates.length) break;
  }
  if (!candidates.length) return null;

  // the highest row, then the seed picks among the rest
  const top = Math.min(...candidates.map((s) => s.row));
  const best = candidates.filter((s) => s.row === top);
  const pick = best[Math.floor(mulberry32(seed)() * best.length)];
  const spot = {
    left: pick.col + 0.25,
    top: Math.round((pick.row - COIN_OFFSET) * 100) / 100,
  };
  return eggReachable(area, spot) ? spot : null;
}
