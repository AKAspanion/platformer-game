import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  MIN_LEVEL,
  MAX_LEVEL,
  SECONDS_PER_LEVEL,
  MAX_ENDLESS_SECONDS,
  ENDLESS_LIMIT,
  endlessScoreCeiling,
  checkEndlessRun,
  compareRuns,
} from "../app/modes/endless-rules";
import { createEndlessBoard } from "../app/modes/endless-board";
import { generateEndlessLevel } from "../app/pcg/generator";
import { COIN_SCORE, ENEMY_MAX_SCORE, FULL_HEART_BONUS } from "../app/daily/rules";

const root = process.cwd();
const SYNC = path.join(root, "scripts", "sync-functions-shared.js");

test("constants", () => {
  assert.equal(MIN_LEVEL, 2);
  assert.equal(MAX_LEVEL, 500);
  assert.equal(SECONDS_PER_LEVEL, 8);
  assert.equal(MAX_ENDLESS_SECONDS, 36000);
  assert.equal(ENDLESS_LIMIT, 30);
});

test("endlessScoreCeiling is stable and covers what endless mode builds", () => {
  const seed = 12345;
  const ceiling = endlessScoreCeiling(seed, 5);
  assert.equal(endlessScoreCeiling(seed, 5), ceiling);

  // build the levels the way createEndlessSession does, under other ids
  let prevExit = 9;
  let possible = 0;
  for (let index = 0; index < 5; index++) {
    const { data, exit } = generateEndlessLevel({
      id: 900 + index,
      seed: seed + index * 7919,
      index,
      prevExit,
    });
    prevExit = exit;
    possible += data.coins.length * COIN_SCORE + data.enemies.length * ENEMY_MAX_SCORE;
    possible += (data.powerups || []).length * 100;
  }
  assert.ok(possible > 0);
  assert.ok(ceiling >= possible, `${ceiling} >= ${possible}`);
  assert.ok(endlessScoreCeiling(seed, 6) > ceiling, "more levels, more to score");
});

test("endlessScoreCeiling is 4 x (coins and enemies) plus 100 per power-up over levels 1..level", () => {
  const seed = 12345;
  let prevExit = 9;
  let coins = 0;
  let enemies = 0;
  let powerups = 0;
  for (let index = 0; index < 3; index++) {
    const { data, exit } = generateEndlessLevel({
      id: 4000 + index,
      seed: seed + index * 7919,
      index,
      prevExit,
    });
    prevExit = exit;
    coins += data.coins.length;
    enemies += data.enemies.length;
    powerups += (data.powerups || []).length;
  }
  const expected =
    4 * (COIN_SCORE * coins + ENEMY_MAX_SCORE * enemies) + FULL_HEART_BONUS * powerups;
  assert.equal(endlessScoreCeiling(seed, 3), expected);
  assert.equal(checkEndlessRun({ seed, level: 3, score: expected, seconds: 60 }), null);
  assert.equal(
    checkEndlessRun({ seed, level: 3, score: expected + 1, seconds: 60 }),
    "That score is more than the levels give.",
  );
});

test("checkEndlessRun rejects what can't have happened", () => {
  const seed = 12345;
  const ceiling = endlessScoreCeiling(seed, 4);
  const bad = (run) => assert.equal(typeof checkEndlessRun({ seed, ...run }), "string");
  bad({ level: 1, score: 0, seconds: 100 });
  bad({ level: 501, score: 0, seconds: 10000 });
  bad({ level: 3.5, score: 0, seconds: 100 });
  bad({ level: 4, score: -1, seconds: 30 });
  bad({ level: 4, score: ceiling + 1, seconds: 30 });
  bad({ level: 4, score: 1.5, seconds: 30 });
  bad({ level: 2, score: 0, seconds: 7 });
  bad({ level: 4, score: 0, seconds: 23 });
  bad({ level: 4, score: 0, seconds: 36001 });
  bad({ level: 4, score: 0, seconds: NaN });
  bad({ level: 4, score: 0, seconds: "30" });
  assert.equal(typeof checkEndlessRun({ seed: 1.5, level: 4, score: 0, seconds: 30 }), "string");
  assert.equal(typeof checkEndlessRun(null), "string");
});

test("checkEndlessRun accepts a fair run", () => {
  const seed = 12345;
  assert.equal(checkEndlessRun({ seed, level: 4, score: 100, seconds: 30 }), null);
  assert.equal(checkEndlessRun({ seed, level: 2, score: 0, seconds: 8 }), null);
  const ceiling = endlessScoreCeiling(seed, 4);
  assert.equal(checkEndlessRun({ seed, level: 4, score: ceiling, seconds: 30 }), null);
});

test("compareRuns ranks level, then score, then the shorter time", () => {
  const a = { level: 9, score: 4000, seconds: 300 };
  const b = { level: 9, score: 4000, seconds: 250 };
  const c = { level: 10, score: 100, seconds: 900 };
  assert.deepEqual([a, b, c].sort(compareRuns), [c, b, a]);
  assert.ok(compareRuns({ level: 9, score: 5000, seconds: 900 }, a) < 0);
});

test("the board passes a backend rejection on unchanged", async () => {
  const failure = Object.assign(new Error("Can't reach the server right now."), {
    code: "unavailable",
  });
  const backend = {
    call: async () => Promise.reject(failure),
    list: async () => Promise.reject(failure),
    get: async () => Promise.reject(failure),
  };
  const board = createEndlessBoard(backend);
  await assert.rejects(board.top(), (error) => error === failure);
  await assert.rejects(board.mine("u1"), (error) => error === failure);
  await assert.rejects(
    board.submit({ seed: 1, level: 2, score: 0, seconds: 8 }),
    (error) => error === failure,
  );
});

test("the board ranks entries, clamps the limit and sends no name", async () => {
  const calls = [];
  const backend = {
    call: async (name, data) => (calls.push([name, data]), { rank: 1 }),
    list: async (count) => (
      calls.push(["list", count]),
      [
        { uid: "a", name: "A", level: 9, score: 1, seconds: 2, seed: 5, updatedAt: 1 },
        { uid: "b", name: "B", level: 8, score: 1, seconds: 2 },
      ]
    ),
    get: async (uid) => (uid === "a" ? { uid, name: "A", level: 9, score: 1, seconds: 2 } : null),
  };
  const board = createEndlessBoard(backend);
  const top = await board.top(1000);
  assert.deepEqual(
    top.map((r) => [r.uid, r.rank]),
    [
      ["a", 1],
      ["b", 2],
    ],
  );
  assert.equal("seed" in top[0], false);
  assert.deepEqual(calls[0], ["list", 100]);
  await board.top();
  assert.deepEqual(calls[1], ["list", 50]);
  assert.equal(await board.mine("zz"), null);
  assert.equal((await board.mine("a")).level, 9);
  await board.submit({ seed: 1, level: 2, score: 3, seconds: 9, ticket: "t1", name: "Hacker" });
  assert.deepEqual(calls[2], [
    "submitEndlessScore",
    { seed: 1, level: 2, score: 3, seconds: 9, ticket: "t1" },
  ]);
});

test("firestore.rules: endless/{uid} is closed to client reads and writes (getEndlessBoard reads it)", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const block = rules.match(/match \/endless\/\{uid\} \{([^}]*)\}/);
  assert.ok(block, "an endless/{uid} match exists");
  assert.match(block[1], /allow read: if false;/);
  assert.doesNotMatch(block[1], /allow (get|list)/);
  assert.match(block[1], /allow write: if false;/);
  assert.ok(rules.indexOf("match /endless/") < rules.indexOf("match /{document=**}"));
  assert.match(rules, /match \/worlds\/\{worldId\}/);
  assert.match(rules, /match \/saves\/\{uid\}/);
});

test("firestore.indexes.json ranks endless by level, score, seconds", () => {
  const { indexes } = JSON.parse(
    fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8"),
  );
  const index = indexes.find((i) => i.collectionGroup === "endless");
  assert.ok(index);
  assert.deepEqual(
    index.fields.map((f) => [f.fieldPath, f.order]),
    [
      ["level", "DESCENDING"],
      ["score", "DESCENDING"],
      ["seconds", "ASCENDING"],
    ],
  );
});

test("sync script: functions/shared/modes/endless-rules.js is current and loads in plain Node", () => {
  // compared directly (not through the script): other test files rewrite app/daily/rules.js meanwhile
  const source = fs.readFileSync(path.join(root, "app", "modes", "endless-rules.js"), "utf8");
  const copy = fs.readFileSync(
    path.join(root, "functions", "shared", "modes", "endless-rules.js"),
    "utf8",
  );
  assert.equal(
    copy,
    `// GENERATED from app/modes/endless-rules.js by scripts/sync-functions-shared.js. Do not edit.\n${source}`,
  );
  const sync = fs.readFileSync(SYNC, "utf8");
  assert.match(sync, /\["modes\/endless-rules\.js", "modes\/endless-rules\.js"\]/);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const m = await import('./functions/shared/modes/endless-rules.js'); if (m.checkEndlessRun({ seed: 12345, level: 4, score: 100, seconds: 30 }) !== null) process.exit(2)",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
