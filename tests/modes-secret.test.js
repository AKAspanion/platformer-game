import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import { FINISH } from "../app/modes";
import { STARFALL_ID, starfallWorld, createSecretSession } from "../app/modes/secret";
import {
  BOSS_RUSH_BASE,
  MAX_HEARTS,
  bossLevels,
  createBossRushSession,
} from "../app/modes/bossrush";
import { sanitizeWorld, LEVELS_PER_WORLD } from "../app/worlds/spec";
import { LEVELS } from "../app/util/index";

test("starfallWorld is the same record every call and survives sanitizeWorld", () => {
  const a = starfallWorld();
  assert.deepEqual(a, starfallWorld());
  assert.deepEqual(a, sanitizeWorld(a));
  assert.equal(a.id, STARFALL_ID);
  assert.equal(a.name, "Starfall Peaks");
  assert.equal(LEVELS_PER_WORLD, 6);
});

test("createSecretSession works without a network and builds 6 areas", () => {
  const saved = globalThis.fetch;
  delete globalThis.fetch;
  try {
    const session = createSecretSession();
    assert.equal(session.kind, "secret");
    assert.equal(session.world.id, "starfall-peaks");
    assert.equal(session.key, "starfall-peaks");
    const ids = Array.from({ length: 6 }, (_, i) => session.startId + i);
    ids.forEach((id) => assert.ok(areas[id], `area ${id}`));
    assert.ok(areas[ids[5]].boss, "last is a boss arena");
  } finally {
    if (saved) globalThis.fetch = saved;
  }
});

test("bossLevels returns the five boss levels in campaign order", () => {
  const bosses = bossLevels(LEVELS);
  assert.equal(bosses.length, 5);
  assert.ok(bosses.every((level) => level.boss));
  assert.equal(bosses[0].name, "Grassland 6");
  assert.equal(bosses[4].world, LEVELS[LEVELS.length - 1].world);
  assert.equal(bosses[4], LEVELS[LEVELS.length - 1]);
});

test("boss rush chains copies of the arenas and ends in FINISH", () => {
  const session = createBossRushSession();
  assert.equal(session.kind, "bossrush");
  assert.equal(session.key, "best");
  assert.equal(session.startId, BOSS_RUSH_BASE);
  bossLevels().forEach((level, i) => {
    const copy = areas[BOSS_RUSH_BASE + i];
    assert.equal(copy.id, BOSS_RUSH_BASE + i);
    assert.deepEqual(copy.boss, areas[level.id].boss);
    const forward = copy.portals.find((p) => p.direction > 0);
    const back = copy.portals.find((p) => p.direction < 0);
    assert.equal(forward.destinationArea, i === 4 ? FINISH : BOSS_RUSH_BASE + i + 1);
    assert.ok(back.destinationArea == null, "no back exit leads anywhere");
  });
  assert.equal(areas[BOSS_RUSH_BASE + 5], undefined);
});

test("boss rush leaves the campaign arenas untouched", () => {
  const before = JSON.stringify(areas[25].portals);
  createBossRushSession();
  assert.equal(JSON.stringify(areas[25].portals), before);
});

test("heartsAfterBoss gives one heart back, up to the maximum", () => {
  const { heartsAfterBoss } = createBossRushSession();
  assert.equal(MAX_HEARTS, 3);
  assert.deepEqual([1, 2, 3].map(heartsAfterBoss), [2, 3, 3]);
});
