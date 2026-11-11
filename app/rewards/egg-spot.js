import { COLS, ROWS, mulberry32, unreachableInArea } from "../pcg/generator.js";

/**
 * Where an egg can sit in an area: on a standable tile the dino can reach, off
 * the main path. Pure, so a story area gets the same spot every time and a
 * daily area gets the same one on every device.
 */

const EDGE = 3; // columns kept clear at each edge, where the portals are
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
function crowded(area, row, col, reach) {
  const near = ({ left, top }) =>
    Math.abs(Math.floor(left) - col) <= reach && Math.abs(Math.floor(top) - row) <= reach;
  return [area.coins, area.powerups, area.enemies].some((list) => (list || []).some(near));
}

// An egg keeps clear of what is on or next to its tile. A level whose platforms
// all carry a coin trail has no such tile, so the rule loosens to its own tile.
const CLEARANCE = [1, 0];

/** A reachable spot off the main path for an egg in an area, or null. Pure; same area + seed, same spot. */
export function eggSpot(area, seed) {
  const roomy = reachableSurfaces(area).filter(({ row, col }) => {
    if (col < EDGE || col >= COLS - EDGE || row < 2) return false;
    // room for the egg and for the dino standing next to it
    if (solid(area, row - 1, col) || solid(area, row - 2, col)) return false;
    const object = area.objectsMap && area.objectsMap[row - 1] && area.objectsMap[row - 1][col];
    return !(area.world === 3 && object && object[0] && object[0].id === 15); // spikes
  });
  let candidates = [];
  for (const reach of CLEARANCE) {
    candidates = roomy
      .filter(({ row, col }) => !crowded(area, row - 1, col, reach))
      .map((s) => ({ ...s, floating: !solid(area, s.row + 1, s.col) }));
    if (candidates.length) break;
  }
  if (!candidates.length) return null;

  // floating platform tops first, then the highest row
  candidates.sort((a, b) => Number(b.floating) - Number(a.floating) || a.row - b.row);
  const best = candidates.filter(
    (s) => s.floating === candidates[0].floating && s.row === candidates[0].row,
  );
  const pick = best[Math.floor(mulberry32(seed)() * best.length)];
  const spot = {
    left: pick.col + 0.25,
    top: Math.round((pick.row - COIN_OFFSET) * 100) / 100,
  };
  return eggReachable(area, spot) ? spot : null;
}
