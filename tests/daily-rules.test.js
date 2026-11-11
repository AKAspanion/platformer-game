import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DAILY_LEVELS,
  MIN_SECONDS,
  MAX_SECONDS,
  COIN_SCORE,
  ENEMY_MAX_SCORE,
  dailyLevels,
  dailyScoreCeiling,
  seedToDate,
  seedIsOpen,
  daysBetween,
  generatedName,
} from "../app/daily/rules";
import { generateSequence, themeFor } from "../app/pcg/generator";
import { enemyTypes } from "../app/game/enemies";
import { cleanName } from "../app/auth/names";

const root = process.cwd();
const SYNC = path.join(root, "scripts", "sync-functions-shared.js");

test("constants", () => {
  assert.equal(DAILY_LEVELS, 5);
  assert.equal(MIN_SECONDS, 30);
  assert.equal(MAX_SECONDS, 7200);
  assert.equal(COIN_SCORE, 20);
});

test("dailyLevels matches the configs createDailySession used before", () => {
  const seed = 20261111;
  const expected = Array.from({ length: 5 }, (_, i) => ({
    theme: themeFor((seed + i * 3) % 9),
    difficulty: 1 + i,
    powerupCount: i === 0 ? 1 : 2,
  }));
  assert.deepEqual(dailyLevels(seed), expected);
});

test("ENEMY_MAX_SCORE is the highest score an enemy type awards", () => {
  const highest = Math.max(100, ...Object.values(enemyTypes).map((t) => t.score || 100));
  assert.equal(ENEMY_MAX_SCORE, highest);
});

test("dailyScoreCeiling is stable and covers every coin and enemy", () => {
  const seed = 20261111;
  const a = dailyScoreCeiling(seed);
  assert.equal(a, dailyScoreCeiling(seed));
  const areas = generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) });
  const everything = areas.reduce(
    (sum, area) =>
      sum +
      area.coins.length * 20 +
      area.enemies.reduce((s, e) => s + (enemyTypes[e.type].score || 100), 0),
    0,
  );
  assert.ok(a >= everything, `${a} >= ${everything}`);
});

test("seedIsOpen: yesterday, today and tomorrow by UTC date", () => {
  const now = Date.UTC(2026, 10, 11, 12);
  for (const seed of [20261110, 20261111, 20261112]) assert.equal(seedIsOpen(seed, now), true);
  for (const seed of [20261109, 20261113]) assert.equal(seedIsOpen(seed, now), false);
});

test("seedIsOpen: a UTC+13 player's local date is accepted", () => {
  assert.equal(seedIsOpen(20261112, Date.UTC(2026, 10, 11, 23, 30)), true);
});

test("seedIsOpen: month and year boundaries", () => {
  const now = Date.UTC(2026, 11, 31, 12);
  assert.equal(seedIsOpen(20270101, now), true);
  assert.equal(seedIsOpen(20270102, now), false);
});

test("daysBetween crosses month and year ends", () => {
  assert.equal(daysBetween(20261130, 20261201), 1);
  assert.equal(daysBetween(20261231, 20270101), 1);
  assert.equal(daysBetween(20261201, 20261130), -1);
  assert.equal(daysBetween(20261111, 20261111), 0);
});

test("seedToDate rejects impossible dates", () => {
  assert.equal(seedToDate(20261131), null);
  assert.equal(seedToDate(20261300), null);
  assert.equal(seedIsOpen(20261131, Date.UTC(2026, 10, 30)), false);
  assert.equal(seedIsOpen(20261300, Date.UTC(2026, 10, 30)), false);
  for (const bad of ["20261111", 20261111.5, NaN, null, undefined, -1, 0, 1e12, {}]) {
    assert.equal(seedToDate(bad), null);
    assert.equal(seedIsOpen(bad, Date.UTC(2026, 10, 11)), false);
  }
  assert.equal(seedToDate(20261111).toISOString(), "2026-11-11T00:00:00.000Z");
  assert.equal(seedToDate(20240229).toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(seedToDate(20250229), null);
});

test("generatedName is stable, short and already clean", () => {
  const name = generatedName("abc123");
  assert.equal(name, generatedName("abc123"));
  assert.ok(name.length > 0 && name.length <= 20, name);
  assert.equal(cleanName(name), name);
  assert.match(name, /^[A-Z][a-z]+ [A-Z][a-z]+ \d+$/);
  const names = new Set(Array.from({ length: 50 }, (_, i) => generatedName(`uid-${i}`)));
  assert.ok(names.size > 25);
  assert.ok(generatedName("").length <= 20);
});

test("sync script: check passes, then fails naming a stale file", () => {
  const run = (...args) => spawnSync(process.execPath, [SYNC, ...args], { encoding: "utf8" });
  assert.equal(run().status, 0);
  assert.equal(run("--check").status, 0);
  const source = path.join(root, "app", "daily", "rules.js");
  const original = fs.readFileSync(source, "utf8");
  try {
    fs.writeFileSync(source, original + "\n// stale\n");
    const result = run("--check");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /functions\/shared\/daily\/rules\.js is stale/);
  } finally {
    fs.writeFileSync(source, original);
  }
  assert.equal(run("--check").status, 0);
});

test("functions/shared/daily/rules.js loads in plain Node", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const m = await import('./functions/shared/daily/rules.js'); if (m.dailyLevels(20261111).length !== 5) process.exit(2)",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
