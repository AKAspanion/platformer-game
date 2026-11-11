import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COLS,
  LEVELS,
  MIN_PLATFORM_ROWS,
  MIN_PLATFORM_TILES,
  buildLevelOnce,
  generateArea,
  generateEndlessLevel,
  generateSequence,
  unreachablePlatforms,
  validate,
} from "../app/pcg/generator";
import { buildWorld } from "../app/gen";

const reef = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/sunny-coral-reef.json"), "utf8"),
);

/** Floating platform tiles of finished area data: standable, with nothing under them. */
function floating(data) {
  const out = [];
  data.collisonMap.forEach((row, r) =>
    row.forEach((v, c) => {
      const standable = typeof v === "string" && v.includes("t");
      const grounded = r + 1 >= data.areaMap.length || data.areaMap[r + 1][c] !== 0;
      if (standable && !grounded) out.push({ row: r, col: c });
    }),
  );
  return out;
}

function assertRule(data, where) {
  const tiles = floating(data);
  const rows = new Set(tiles.map((t) => t.row)).size;
  assert.ok(
    rows >= MIN_PLATFORM_ROWS && tiles.length >= MIN_PLATFORM_TILES,
    `${where}: ${rows} rows, ${tiles.length} tiles`,
  );
}

test("the platform rule's numbers", () => {
  assert.equal(MIN_PLATFORM_ROWS, 2);
  assert.equal(MIN_PLATFORM_TILES, 10);
});

test("Sunny Coral Reef: levels 1-5 each have floating platforms, the boss arena its three ledges", () => {
  const assets = buildWorld(reef, { audio: false });
  const areas = generateSequence({ idBase: 9000, seed: assets.seed, levels: assets.levels });
  assert.equal(areas.length, 6);
  areas.slice(0, 5).forEach((data, i) => assertRule(data, `reef level ${i + 1}`));
  assert.ok(assets.levels[5].boss);
  // three ledges: runs of tiles on rows 7, 5 and 7
  const ledges = floating(areas[5]);
  assert.deepEqual([...new Set(ledges.map((t) => t.row))].sort(), [5, 7]);
  assert.equal(ledges.length, 4 + 5 + 4);
});

const endlessInput = (seed, index) => ({
  id: 4000 + index,
  seed: seed + index * 7919,
  theme: ["grasslands", "iceland", "desert", "dungeon", "lab"][Math.floor(index / 3) % 5],
  difficulty: Math.min(5, 1 + Math.floor(index / 2)),
  entryHeight: 9,
  exitHeight: 9 + (index % 2),
  enemyScale: 0.8 + Math.min(0.6, index * 0.05),
  powerupCount: index % 3 === 2 ? 2 : 1,
  prev: { area: null, x: 330, y: 0 },
  next: { area: 4001 + index, x: 16, y: 9 * 16 - 8 },
});

test("1,000 endless levels meet the rule, and no platform is unreachable on a first pass", () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (let index = 0; index < 10; index++) {
      const { data } = generateEndlessLevel({ id: 4000 + index, seed, index, prevExit: 9 });
      assertRule(data, `endless ${seed}/${index}`);
      const input = endlessInput(seed, index);
      const area = generateArea(input);
      const first = buildLevelOnce(input, area.seed, new Set());
      assert.deepEqual(
        unreachablePlatforms(first),
        [],
        `endless ${seed}/${index} seed ${area.seed}`,
      );
    }
  }
});

test("300 community levels (60 worlds x levels 1-5) meet the rule, first pass reachable", () => {
  for (let w = 0; w < 60; w++) {
    const world = { ...reef, id: `wtest${w}`, seed: reef.seed + w * 101 };
    const assets = buildWorld(world, { audio: false });
    const areas = generateSequence({ idBase: 9000, seed: assets.seed, levels: assets.levels });
    areas.slice(0, 5).forEach((data, i) => assertRule(data, `world ${w} level ${i + 1}`));
    assets.levels.slice(0, 5).forEach((spec, i) => {
      const input = {
        ...spec,
        id: 9000 + i,
        seed: assets.seed + i,
        entryHeight: 9,
        exitHeight: 9,
        prev: { area: null, x: 330, y: 0 },
        next: { area: -1, x: 16, y: 0 },
      };
      const area = generateArea(input);
      const first = buildLevelOnce(input, area.seed, new Set());
      assert.deepEqual(unreachablePlatforms(first), [], `world ${w} level ${i + 1}`);
    });
  }
});

test("every theme at difficulties 1-5: each non-boss level meets the rule", () => {
  for (const theme of ["grasslands", "iceland", "desert", "dungeon", "lab", "gen"]) {
    for (let seed = 1; seed <= 6; seed++) {
      const levels = [1, 2, 3, 4, 5].map((difficulty) => ({ theme, difficulty }));
      const areas = generateSequence({ idBase: 5000, seed: seed * 977, levels });
      areas.forEach((data, i) => assertRule(data, `${theme} seed ${seed} difficulty ${i + 1}`));
    }
  }
});

test("a boss level keeps exactly its three fixed ledges, and validate skips the rule", () => {
  const level = {
    id: 5500,
    seed: 1,
    theme: "grasslands",
    difficulty: 3,
    boss: "chameleon",
    entryHeight: 9,
    exitHeight: 9,
    prev: { area: null, x: 330, y: 0 },
    next: { area: -1, x: 16, y: 0 },
  };
  const area = generateArea(level);
  assert.deepEqual(area.platforms, [
    [7, 2, 5],
    [5, 8, 12],
    [7, 15, 18],
  ]);
  assert.equal(validate(area), null);
});

test("validate rejects a non-boss level with one platform row; placement v1 and bosses skip it", () => {
  const heights = new Array(COLS).fill(9);
  const platforms = [[7, 8, 11]]; // one row, 4 tiles
  const data = { coins: [], powerups: [] };
  assert.equal(
    validate({ heights, platforms, traps: [], data }),
    "too few floating platforms (1 rows, 4 tiles)",
  );
  assert.equal(validate({ heights, platforms, traps: [], data, placement: "v1" }), null);
  assert.equal(validate({ heights, platforms, traps: [], data, boss: "pig" }), null);
});

test("generateArea gives a level that meets the rule, retrying seeds as needed", () => {
  const area = generateArea(endlessInput(1, 0));
  assert.equal(validate(area), null);
  assertRule(area.data, "retried");
});

test("every story LEVELS entry is placement v1", () => {
  LEVELS.forEach((level) => assert.equal(level.placement, "v1", `area ${level.id}`));
});
