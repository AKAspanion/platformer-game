import "./env";
import World from "../app/game/world";

export const ROWS = 12;
export const COLS = 21;
export const TILE = 16;
export const GROUND = 10; // ground top row of the test arena

/**
 * A flat test arena: ground from row GROUND down, optional wall columns
 * (`walls: [{ col, top }]` = solid from row `top` to the ground) and enemies.
 */
export function arena({ enemies = [], walls = [], coins = [], death = [] } = {}) {
  const areaMap = [];
  const collisonMap = [];
  for (let r = 0; r < ROWS; r++) {
    areaMap.push(new Array(COLS).fill(0));
    collisonMap.push(new Array(COLS).fill(""));
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = GROUND; r < ROWS; r++) {
      areaMap[r][c] = r === GROUND ? 2 : 5;
      collisonMap[r][c] = r === GROUND ? "t" : "";
    }
  }
  walls.forEach(({ col, top }) => {
    for (let r = top; r < GROUND; r++) {
      areaMap[r][col] = 5;
      collisonMap[r][col] = r === top ? "tlr" : "lr";
    }
  });
  return {
    id: 900,
    world: 1,
    rows: ROWS,
    columns: COLS,
    theme: "grasslands",
    water: [],
    coins,
    death,
    portals: [],
    enemies,
    areaMap,
    collisonMap,
    objectsMap: areaMap.map((row) => row.map(() => 0)),
  };
}

/** A world set up with `data`, the player standing at column `col` on the ground. */
export function makeWorld(data, { col = 2, direction = 1 } = {}) {
  const world = new World();
  world.reset();
  world.setup(data);
  placePlayer(world, col * TILE, direction);
  return world;
}

export function placePlayer(world, x, direction = 1, groundRow = GROUND) {
  const { player } = world;
  player.x = player.xOld = x;
  player.y = player.yOld = groundRow * TILE - player.height - 0.01;
  player.velocityX = player.velocityY = 0;
  player.direction = direction;
  player.jumping = false;
}

/** Enemy entry for arena(); `left` in tiles. Patrol speed is zeroed by freeze(). */
export const enemy = (id, left, type = "pig", top = GROUND - 1) => ({
  id,
  type,
  left,
  top,
  sway: 0,
  dir: 1,
});

/** Stop every enemy from patrolling, so tests control positions exactly. */
export function freeze(world) {
  world.enemies.items.forEach((e) => {
    e.velocity = 0;
  });
}

export function tick(world, count = 1, onGameOver = () => {}) {
  for (let i = 0; i < count; i++) world.update(onGameOver);
}

/** Tick until `done()` or `max` ticks; returns the ticks taken. */
export function tickUntil(world, done, max = 120, onGameOver = () => {}) {
  for (let i = 1; i <= max; i++) {
    world.update(onGameOver);
    if (done()) return i;
  }
  return -1;
}

export const byId = (world, id) => world.enemies.items.find((e) => e.id === id);

/** Seeded RNG for repeatable fuzzing. */
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
