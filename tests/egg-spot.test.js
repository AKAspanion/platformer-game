import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import areas from "../app/areas";
import { eggSpot, eggReachable } from "../app/rewards/egg-spot";
import { dailyLevels } from "../app/daily/rules";
import { generateSequence, COLS } from "../app/pcg/generator";

const root = process.cwd();
const SCRIPT = path.join(root, "scripts", "place-eggs.js");
const AREAS = path.join(root, "app", "areas");

/** The non-boss story areas: Grassland 1-3, Iceland 1-2, then the generated ones. */
const STORY = [1, 2, 3, 7, 8, ...Array.from({ length: 16 }, (_, i) => i + 9), 26, 28, 30, 32];

const EGG_FIELD = /,\n {2}"egg": \{[^{}]*\}/;

/** A copy of the story areas, as they were before any egg. */
function bareCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eggs-"));
  const bare = {};
  STORY.forEach((id) => {
    const text = fs
      .readFileSync(path.join(AREAS, `area-${id}.json`), "utf8")
      .replace(EGG_FIELD, "");
    bare[id] = text;
    fs.writeFileSync(path.join(dir, `area-${id}.json`), text);
  });
  return { dir, bare };
}

const place = (dir, ...args) =>
  spawnSync(process.execPath, [SCRIPT, "--dir", dir, ...args], { encoding: "utf8" });

test("every non-boss story area has its egg, reachable", () => {
  assert.equal(STORY.length, 25);
  STORY.forEach((id) => {
    const area = areas[id];
    assert.equal(area.egg.id, `s${id}`);
    assert.ok(eggReachable(area, area.egg), `area ${id}: egg unreachable`);
  });
});

test("boss areas have no egg", () => {
  Object.values(areas)
    .filter((area) => !STORY.includes(area.id))
    .forEach((area) => assert.equal(area.egg, undefined, `area ${area.id}`));
});

test("placing eggs changes nothing but the egg field", () => {
  const { dir, bare } = bareCopy();
  const run = place(dir);
  assert.equal(run.status, 0, run.stderr);
  STORY.forEach((id) => {
    const text = fs.readFileSync(path.join(dir, `area-${id}.json`), "utf8");
    assert.equal(text.replace(EGG_FIELD, ""), bare[id], `area ${id}`);
    assert.equal(text, fs.readFileSync(path.join(AREAS, `area-${id}.json`), "utf8"), `area ${id}`);
    const before = JSON.parse(bare[id]);
    const after = JSON.parse(text);
    ["areaMap", "collisonMap", "objectsMap", "coins", "powerups", "enemies", "portals"].forEach(
      (key) => assert.deepEqual(after[key], before[key], `area ${id} ${key}`),
    );
  });
});

test("placing eggs twice changes no file", () => {
  const { dir } = bareCopy();
  place(dir);
  const first = STORY.map((id) => fs.readFileSync(path.join(dir, `area-${id}.json`), "utf8"));
  const second = place(dir);
  assert.equal(second.status, 0, second.stderr);
  STORY.forEach((id, i) => {
    assert.equal(fs.readFileSync(path.join(dir, `area-${id}.json`), "utf8"), first[i]);
  });
});

test("a hand spot inside a solid tile stops the script and names the area", () => {
  const { dir } = bareCopy();
  const area = areas[1];
  let solid = null;
  area.areaMap.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v && !solid && r > 4) solid = { left: c + 0.25, top: r };
    }),
  );
  const file = path.join(dir, "hand-spots.json");
  fs.writeFileSync(file, JSON.stringify({ 1: solid, 2: { left: 7.25, top: 3.1 } }));
  const run = place(dir, "--hand-spots", file);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /area 1\b/);
});

test("200 generated daily areas get a reachable spot clear of everything", () => {
  let seen = 0;
  let placed = 0;
  for (let seed = 20260101; seed < 20260141; seed++) {
    generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) }).forEach((area) => {
      seen++;
      const spot = eggSpot(area, seed);
      assert.deepEqual(eggSpot(area, seed), spot, "same area and seed, same spot");
      if (!spot) return;
      placed++;
      assert.ok(eggReachable(area, spot), `seed ${seed} area ${area.id}`);
      assert.ok(spot.left >= 3 && spot.left < COLS - 3, `seed ${seed}: spot at the edge`);
      const row = Math.round(spot.top + 0.9);
      const col = Math.floor(spot.left);
      const own = (list) =>
        list.some(({ left, top }) => Math.floor(left) === col && Math.floor(top) === row - 1);
      assert.equal(own(area.coins), false, `seed ${seed}: egg on a coin`);
      assert.equal(own(area.powerups), false, `seed ${seed}: egg on a power-up`);
      assert.equal(own(area.enemies), false, `seed ${seed}: egg on an enemy`);
    });
  }
  assert.equal(seen, 200);
  assert.ok(placed >= 190, `${placed} of 200 got a spot`);
});

test("with a floating platform to stand on, the egg sits on a platform", () => {
  let withPlatforms = 0;
  for (let seed = 20260101; seed < 20260121; seed++) {
    generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) }).forEach((full) => {
      // no coins, power-ups or enemies: every tile is clear
      const area = { ...full, coins: [], powerups: [], enemies: [] };
      const platform = (r, c) =>
        typeof area.collisonMap[r][c] === "string" &&
        area.collisonMap[r][c].includes("t") &&
        !area.areaMap[r + 1][c] &&
        c >= 3 &&
        c < COLS - 3 &&
        r >= 2;
      const has = area.collisonMap.some((row, r) => row.some((_, c) => platform(r, c)));
      const spot = eggSpot(area, seed);
      assert.ok(spot, `seed ${seed} area ${area.id}`);
      if (!has) return;
      withPlatforms++;
      const row = Math.round(spot.top + 0.9);
      assert.equal(
        area.areaMap[row + 1][Math.floor(spot.left)],
        0,
        `seed ${seed}: not on a platform`,
      );
    });
  }
  assert.ok(withPlatforms > 20, `${withPlatforms} areas with platforms`);
});

test("eggReachable refuses a spot in a wall or far from any reachable tile", () => {
  const area = areas[9];
  assert.equal(eggReachable(area, { left: 0.25, top: 0.1 }), false, "nothing to stand on near");
  assert.equal(eggReachable(area, null), false);
  assert.equal(eggReachable(area, { left: NaN, top: 1 }), false);
  const wall = { row: 11, col: 0 };
  assert.ok(area.areaMap[wall.row][wall.col], "test data: a solid tile");
  assert.equal(eggReachable(area, { left: wall.col + 0.25, top: wall.row - 0.1 }), false);
});
