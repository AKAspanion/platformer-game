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

const SPAWN_COL = 2.5; // the dino enters at 40 px (story) or 24 px (daily): 2.5 tiles at most
const MIN_FROM_SPAWN = 5;

/** Whether the egg's own tile (the one above its surface) holds something from these lists. */
const onSomething = (area, spot, keys = ["coins", "powerups", "enemies"]) => {
  const row = Math.floor(spot.top);
  const col = Math.floor(spot.left);
  return keys.some((key) =>
    (area[key] || []).some(({ left, top }) => Math.floor(left) === col && Math.floor(top) === row),
  );
};

const isFloating = (area, spot) =>
  area.areaMap[Math.round(spot.top + 0.9) + 1][Math.floor(spot.left)] === 0;

/** Whether a reachable tile with room, 5+ tiles from the spawn, holds nothing (floating tops only when asked). */
function freeTile(area, { floatingOnly, coins = true }) {
  return area.collisonMap.some((line, r) =>
    line.some((v, c) => {
      if (typeof v !== "string" || !v.includes("t")) return false;
      if (r < 2 || c < SPAWN_COL + MIN_FROM_SPAWN || c >= COLS - 3) return false;
      if (floatingOnly && area.areaMap[r + 1][c]) return false;
      if (area.areaMap[r - 1][c] || area.areaMap[r - 2][c]) return false;
      const object = area.objectsMap?.[r - 1]?.[c];
      if (area.world === 3 && object?.[0]?.id === 15) return false; // spikes
      const spot = { left: c + 0.25, top: r - 0.9 };
      const keys = coins ? undefined : ["powerups", "enemies"];
      return !onSomething(area, spot, keys) && eggReachable(area, spot);
    }),
  );
}

function assertEggRules(area, spot, label) {
  assert.ok(spot, `${label}: no spot`);
  assert.ok(eggReachable(area, spot), `${label}: unreachable`);
  assert.ok(spot.left - SPAWN_COL >= MIN_FROM_SPAWN, `${label}: ${spot.left} is next to the spawn`);
  assert.equal(
    onSomething(area, spot, ["powerups", "enemies"]),
    false,
    `${label}: on a power-up or enemy`,
  );
  // a coin is shared only when no tile of the egg's kind (platform top, or ground) is free of coins
  if (onSomething(area, spot, ["coins"])) {
    assert.equal(
      freeTile(area, { floatingOnly: isFloating(area, spot) }),
      false,
      `${label}: egg on a coin with a free tile`,
    );
  }
  // a platform top with room (a coin may share it) beats the ground
  if (freeTile(area, { floatingOnly: true, coins: false })) {
    assert.ok(isFloating(area, spot), `${label}: on the ground`);
  }
}

test("200 generated daily areas get a spot that follows the egg rules", () => {
  let seen = 0;
  for (let seed = 20260101; seed < 20260141; seed++) {
    generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) }).forEach((area) => {
      seen++;
      const spot = eggSpot(area, seed);
      assert.deepEqual(eggSpot(area, seed), spot, "same area and seed, same spot");
      assertEggRules(area, spot, `seed ${seed} area ${area.id}`);
      assert.ok(spot.left >= 3 && spot.left < COLS - 3, `seed ${seed}: spot at the edge`);
    });
  }
  assert.equal(seen, 200);
});

test("every committed story egg follows the egg rules, with its coins in place", () => {
  let platforms = 0;
  STORY.forEach((id) => {
    const area = areas[id];
    assertEggRules(area, area.egg, `area ${id}`);
    if (isFloating(area, area.egg)) platforms++;
  });
  assert.ok(platforms >= 20, `${platforms} of 25 story eggs on a platform`);
});

test("a daily egg sits on a platform and 5+ tiles from the spawn, over 60 seeds with everything in place", () => {
  let floating = 0;
  let total = 0;
  for (let seed = 20261101; seed < 20261161; seed++) {
    generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) }).forEach((area) => {
      const spot = eggSpot(area, seed);
      assertEggRules(area, spot, `seed ${seed} area ${area.id}`);
      total++;
      if (isFloating(area, spot)) floating++;
    });
  }
  assert.equal(total, 300);
  assert.ok(floating >= 270, `${floating} of ${total} on a platform`);
});

test("a level without a usable floating platform puts the egg on the ground, 5+ tiles from the spawn", () => {
  const base = areas[9];
  // fill the space under every floating tile so nothing floats
  const areaMap = base.areaMap.map((line) => [...line]);
  base.collisonMap.forEach((line, r) =>
    line.forEach((v, c) => {
      if (typeof v === "string" && v.includes("t") && !areaMap[r + 1][c]) areaMap[r + 1][c] = 1;
    }),
  );
  const area = { ...base, areaMap, coins: [], powerups: [], enemies: [] };
  const spot = eggSpot(area, 7);
  assert.ok(spot, "a ground spot");
  assert.ok(spot.left - SPAWN_COL >= MIN_FROM_SPAWN);
  assert.ok(eggReachable(area, spot));
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
