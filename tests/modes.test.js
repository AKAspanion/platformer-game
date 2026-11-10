import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World from "../app/game/world";
import { generateSequence, generateEndlessLevel, validate, buildLevel } from "../app/pcg/generator";
import {
  FINISH,
  createDailySession,
  createEndlessSession,
  createCustomSession,
  dailySeed,
} from "../app/modes";
import { specFromPrompt, normalizeSpec, levelsFromSpec, requestSpec } from "../app/creator";
import { tick } from "./helpers";

/** Walk into each area like a portal would and idle: nobody should die on arrival. */
function playThrough(ids, label) {
  const world = new World();
  world.reset();
  world.player.setLeft(24);
  world.player.setTop(9 * 16 - 20);
  world.setup(areas[ids[0]]);
  ids.forEach((id, i) => {
    if (i > 0) {
      const prev = areas[ids[i - 1]];
      world.portal = prev.portals.find((p) => p.direction > 0);
      world.setup(areas[id]);
    }
    world.enemies.items.forEach((e) => (e.velocity = 0));
    let over = 0;
    tick(world, 40, () => over++);
    assert.equal(over, 0, `${label}: died arriving in area ${id}`);
    assert.equal(world.player.velocityY, 0, `${label}: not standing in area ${id}`);
  });
}

test("generateSequence chains levels: first has no way back, last finishes", () => {
  const list = generateSequence({
    idBase: 5000,
    seed: 42,
    levels: [
      { theme: "grasslands", difficulty: 1 },
      { theme: "dungeon", difficulty: 3 },
      { theme: "lab", difficulty: 5 },
    ],
  });
  assert.equal(list.length, 3);
  assert.equal(list[0].portals[0].destinationArea, null);
  assert.equal(list[0].portals[1].destinationArea, 5001);
  assert.equal(list[1].portals[0].destinationArea, 5000);
  assert.equal(list[2].portals[1].destinationArea, FINISH);
  assert.deepEqual(
    list.map((a) => a.world),
    [1, 4, 5],
  );
  list.forEach((a) => (areas[a.id] = a));
  playThrough([5000, 5001, 5002], "sequence");
  list.forEach((a) => delete areas[a.id]);
});

test("the generator is deterministic for a seed", () => {
  const a = generateSequence({
    idBase: 5100,
    seed: 7,
    levels: [{ theme: "desert", difficulty: 3 }],
  });
  const b = generateSequence({
    idBase: 5100,
    seed: 7,
    levels: [{ theme: "desert", difficulty: 3 }],
  });
  assert.deepEqual(a, b);
});

test("generated levels are valid across themes, difficulties and seeds", () => {
  const themes = ["grasslands", "iceland", "desert", "dungeon", "lab"];
  let n = 0;
  for (const theme of themes) {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      for (let seed = 1; seed <= 4; seed++) {
        const level = {
          id: 6000 + n++,
          theme,
          seed: seed * 977 + difficulty,
          difficulty,
          entryHeight: 9,
          exitHeight: 10,
          prev: { area: null, x: 330, y: 0 },
          next: { area: FINISH, x: 16, y: 0 },
        };
        // the runtime retries seeds; a valid one must turn up quickly
        let ok = false;
        for (let s = level.seed; s < level.seed + 60 && !ok; s++)
          ok = !validate(buildLevel(level, s));
        assert.ok(ok, `${theme} difficulty ${difficulty} seed ${seed}: no valid level`);
      }
    }
  }
});

test("daily challenge: 5 levels, the same for everyone on a day, different tomorrow", () => {
  const day = new Date(2026, 10, 11);
  const session = createDailySession(day);
  const first = JSON.stringify(areas[session.startId]);
  assert.equal(session.key, String(dailySeed(day)));
  assert.equal(dailySeed(day), 20261111);
  const ids = [0, 1, 2, 3, 4].map((i) => session.startId + i);
  ids.forEach((id) => assert.ok(areas[id], `daily level ${id}`));
  assert.equal(areas[ids[4]].portals[1].destinationArea, FINISH);
  assert.equal(session.label(ids[2]), "Daily 3/5");
  playThrough(ids, "daily");

  createDailySession(day);
  assert.equal(JSON.stringify(areas[session.startId]), first, "same day, same levels");
  createDailySession(new Date(2026, 10, 12));
  assert.notEqual(JSON.stringify(areas[session.startId]), first, "new day, new levels");
});

test("endless mode keeps one level ahead and gets harder", () => {
  const session = createEndlessSession(12345);
  assert.ok(areas[session.startId] && areas[session.startId + 1]);
  assert.equal(areas[session.startId + 2], undefined);
  for (let i = 0; i < 8; i++) session.ensure(session.startId + i);
  assert.ok(areas[session.startId + 8]);
  const ids = Array.from({ length: 8 }, (_, i) => session.startId + i);
  playThrough(ids, "endless");
  const enemies = (id) => areas[id].enemies.length;
  assert.ok(enemies(ids[7]) >= enemies(ids[0]), "more enemies later on");
  assert.equal(session.label(ids[3]), "Endless 4");
  assert.equal(areas[ids[0]].portals[0].destinationArea, null, "no way back from the start");
});

test("endless levels are entered at the height the previous one left", () => {
  const a = generateEndlessLevel({ id: 7000, seed: 1, index: 0, prevExit: 9 });
  const b = generateEndlessLevel({ id: 7001, seed: 2, index: 1, prevExit: a.exit });
  assert.equal(b.data.portals[0].destinationY, a.exit * 16 - 8);
});

// ----------------------------------------------------------------- creator

test("offline world builder understands themes, enemies, difficulty and length", () => {
  const spec = specFromPrompt("A spooky graveyard full of bats and beetles, really hard, 4 levels");
  assert.equal(spec.theme, "graveyard");
  assert.deepEqual(spec.enemies.sort(), ["bat", "beetle"]);
  assert.equal(spec.difficulty, 4);
  assert.equal(spec.levels, 4);
  assert.equal(spec.enemyDensity, "high");

  const easy = specFromPrompt("an easy sunny meadow for kids called Happy Hills");
  assert.equal(easy.theme, "grasslands");
  assert.equal(easy.difficulty, 1);
  assert.equal(easy.name, "Happy Hills");

  assert.equal(specFromPrompt("a toxic robot factory").theme, "factory");
  assert.equal(specFromPrompt("frozen cave").theme, "iceland");
});

test("normalizeSpec clamps anything into a safe spec", () => {
  const spec = normalizeSpec({
    name: "<script>alert(1)</script> World of Doom and Gloom and More",
    theme: "moon",
    levels: 99,
    difficulty: -3,
    enemies: ["dragon", "bat", "bat"],
    enemyDensity: "max",
    powerups: [],
  });
  assert.ok(!/[<>()]/.test(spec.name));
  assert.ok(spec.name.length <= 24);
  assert.equal(spec.theme, "grasslands");
  assert.equal(spec.levels, 5);
  assert.equal(spec.difficulty, 1);
  assert.deepEqual(spec.enemies, ["bat"]);
  assert.equal(spec.enemyDensity, "medium");
  assert.deepEqual(spec.powerups, ["heart", "shield", "triple", "wings"]);
});

test("a created world builds playable levels from its spec", () => {
  for (const prompt of [
    "graveyard with spitters and lots of pits, 3 levels",
    "factory of beetles, very hard, 5 levels",
    "calm desert, 1 level",
  ]) {
    const spec = specFromPrompt(prompt);
    const world = { id: "w1", name: spec.name, spec, seed: 99 };
    const session = createCustomSession(world, levelsFromSpec);
    const ids = Array.from({ length: spec.levels }, (_, i) => session.startId + i);
    ids.forEach((id) => assert.ok(areas[id], `${prompt}: level ${id}`));
    const used = new Set(ids.flatMap((id) => areas[id].enemies.map((e) => e.type)));
    used.forEach((type) => assert.ok(spec.enemies.includes(type), `${prompt}: unexpected ${type}`));
    playThrough(ids, prompt);
  }
});

test("requestSpec uses the server's spec, or falls back offline when it fails", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        spec: {
          name: "Moon Base",
          theme: "factory",
          levels: 2,
          difficulty: 3,
          enemies: ["beetle"],
        },
      }),
    });
    const ai = await requestSpec("whatever", "http://server/api/world");
    assert.equal(ai.source, "ai");
    assert.equal(ai.spec.name, "Moon Base");
    assert.equal(ai.spec.theme, "factory");

    globalThis.fetch = async () => ({ ok: false, status: 503 });
    const down = await requestSpec("snowy hills", "http://server/api/world");
    assert.equal(down.source, "offline");
    assert.equal(down.spec.theme, "iceland");

    const none = await requestSpec("snowy hills", "");
    assert.equal(none.source, "offline");
  } finally {
    globalThis.fetch = original;
  }
});
