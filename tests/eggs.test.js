import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  HATCH_MS,
  DUPLICATE_COINS,
  createNest,
  companionFor,
  dailyEggLevel,
  hatchLabel,
  duplicateRewardId,
  storyEggId,
  dailyEggId,
  chestEggId,
} from "../app/rewards/eggs";
import { createWallet } from "../app/progress/wallet";
import { createFollower, companionFrames, FOLLOW_TICKS } from "../app/game/companion";
import { COMPANION_IDS, COMMON_COMPANIONS, RARE_COMPANIONS } from "../app/shop/catalog";
import {
  arena,
  makeWorld,
  enemy,
  freeze,
  tick,
  tickUntil,
  placePlayer,
  TILE,
  GROUND,
} from "./helpers";

const root = process.cwd();
const HOUR = 3600000;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

/** A nest on a clock the test sets. */
function nestAt(time, storage = memoryStorage()) {
  const clock = { now: time };
  const nest = createNest(storage, () => clock.now);
  return { nest, clock, storage };
}

test("ids", () => {
  assert.equal(storyEggId(9), "s9");
  assert.equal(dailyEggId(20261111), "d20261111");
  assert.equal(chestEggId(3), "c3");
  assert.equal(duplicateRewardId("s9"), "es9");
});

test("an egg is found once", () => {
  const { nest } = nestAt(1000);
  assert.equal(nest.has("s9"), false);
  assert.equal(nest.find("s9", "story"), true);
  assert.equal(nest.has("s9"), true);
  assert.deepEqual(nest.list(), [{ id: "s9", source: "story", foundAt: 1000, ready: false }]);

  const before = JSON.stringify(nest.list());
  assert.equal(nest.find("s9", "story"), false);
  assert.equal(JSON.stringify(nest.list()), before);
});

test("an unknown source or an empty id is not an egg", () => {
  const { nest } = nestAt(1000);
  assert.equal(nest.find("s1", "shop"), false);
  assert.equal(nest.find("", "story"), false);
  assert.equal(nest.has("s1"), false);
  assert.deepEqual(nest.list(), []);
});

test("the hatch label counts the hours left, rounded up", () => {
  const egg = { foundAt: 0 };
  assert.equal(hatchLabel(egg, 0), "Hatches in 24h");
  assert.equal(hatchLabel(egg, 19 * HOUR), "Hatches in 5h");
  assert.equal(hatchLabel(egg, 86340000), "Hatches in 1h");
  assert.equal(hatchLabel(egg, 86400000), "Ready!");
  assert.equal(hatchLabel(egg, 90 * HOUR), "Ready!");
});

test("a clock set back never speeds an egg up", () => {
  const { nest, clock } = nestAt(10000);
  nest.find("s9", "story");
  clock.now = 5000;
  assert.equal(hatchLabel({ foundAt: 10000 }, 5000), "Hatches in 24h");
  assert.deepEqual(nest.due(), []);
  assert.equal(nest.list()[0].ready, false);
});

test("an egg hatches 24 hours after it was found, once", () => {
  const { nest, clock } = nestAt(0);
  const wallet = createWallet(memoryStorage(), "dev");
  nest.find("s9", "story");

  clock.now = HATCH_MS - 1;
  assert.deepEqual(nest.due(), []);
  assert.equal(nest.hatch("s9", wallet), null);
  assert.equal(nest.list().length, 1);

  clock.now = HATCH_MS;
  assert.deepEqual(nest.due(), [{ id: "s9", source: "story", foundAt: 0 }]);
  const expected = companionFor({ id: "s9", foundAt: 0 });
  assert.deepEqual(nest.hatch("s9", wallet), { companion: expected, duplicate: false });
  assert.equal(wallet.owns("companion", expected), true);
  assert.deepEqual(nest.list(), []);
  assert.equal(nest.has("s9"), true, "a hatched egg still counts as found");

  assert.equal(nest.hatch("s9", wallet), null);
  assert.equal(nest.find("s9", "story"), false, "and can't be found again");
});

test("a hatch that isn't in the nest does nothing", () => {
  const { nest } = nestAt(HATCH_MS * 2);
  const wallet = createWallet(memoryStorage(), "dev");
  assert.equal(nest.hatch("nope", wallet), null);
});

test("a companion already owned pays 100 coins once instead", () => {
  const { nest, clock } = nestAt(0);
  const wallet = createWallet(memoryStorage(), "dev");
  nest.find("s9", "story");
  const owned = companionFor({ id: "s9", foundAt: 0 });
  wallet.grant("companion", owned);
  const before = wallet.balance();

  clock.now = HATCH_MS;
  assert.deepEqual(nest.hatch("s9", wallet), { companion: owned, duplicate: true });
  assert.equal(wallet.balance(), before + DUPLICATE_COINS);
  assert.equal(wallet.reward(duplicateRewardId("s9"), DUPLICATE_COINS), false, "paid once");
  assert.equal(wallet.balance(), before + DUPLICATE_COINS);
});

test("the nest lists unhatched eggs oldest first and survives a reload", () => {
  const storage = memoryStorage();
  const { nest, clock } = nestAt(5000, storage);
  nest.find("d2", "daily");
  clock.now = 1000;
  nest.find("s1", "story");
  clock.now = HATCH_MS + 1000;

  const again = createNest(storage, () => clock.now);
  assert.deepEqual(
    again.list().map((e) => [e.id, e.ready]),
    [
      ["s1", true],
      ["d2", false],
    ],
  );
});

test("the nest works with blocked storage", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const { nest } = nestAt(0, blocked);
  assert.equal(nest.find("s1", "story"), true);
  assert.equal(nest.has("s1"), true);
  assert.equal(nest.find("s1", "story"), false);
});

test("hatches are 10% rare, every companion appears, and the pick is stable", () => {
  const counts = {};
  let rare = 0;
  for (let i = 0; i < 10000; i++) {
    const egg = { id: `s${i}`, foundAt: 0 };
    const id = companionFor(egg);
    assert.equal(companionFor(egg), id);
    counts[id] = (counts[id] || 0) + 1;
    if (RARE_COMPANIONS.includes(id)) rare++;
    else assert.ok(COMMON_COMPANIONS.includes(id));
  }
  assert.ok(rare >= 800 && rare <= 1200, `${rare} rares in 10000`);
  COMPANION_IDS.forEach((id) => assert.ok(counts[id] > 0, `${id} never hatched`));
});

test("the daily egg level is 0 to 4, stable, and takes every value", () => {
  const seen = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const level = dailyEggLevel(seed);
    assert.ok(Number.isInteger(level) && level >= 0 && level <= 4);
    assert.equal(dailyEggLevel(seed), level);
    seen.add(level);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
});

// ------------------------------------------------------------------- the world

const withEgg = (extra = {}) => ({
  ...arena(extra),
  egg: { id: "s900", left: 6.25, top: GROUND - 0.9 },
});

test("touching the egg reports it and changes no score or coins", () => {
  const world = makeWorld(withEgg(), { col: 2 });
  assert.ok(world.egg, "the egg is placed");
  placePlayer(world, 6 * TILE);
  tick(world, 3);

  assert.deepEqual(world.feats, [{ type: "egg", id: "s900" }]);
  assert.equal(world.egg, null);
  assert.equal(world.totalCoins, 0);
  assert.equal(world.score, 0);
  tick(world, 3);
  assert.equal(world.feats.length, 1, "found once");
});

test("an egg that was found before isn't placed", () => {
  const world = makeWorld(arena());
  world.eggFound = (id) => id === "s900";
  world.setup(withEgg());
  assert.equal(world.egg, null);

  world.eggFound = () => false;
  world.setup(withEgg());
  assert.equal(world.egg.id, "s900");
});

test("a level without an egg has none", () => {
  const world = makeWorld(arena());
  assert.equal(world.egg, null);
});

test("a kill reports the enemy's type", () => {
  const world = makeWorld(arena({ enemies: [enemy("s1", 5, "slime")] }));
  freeze(world);
  world.shootFireball("f1");
  tickUntil(world, () => world.fireballs.items.length === 0);
  assert.deepEqual(world.feats, [{ type: "kill", enemy: "slime" }]);
});

test("only the latest 50 feats are kept", () => {
  const world = makeWorld(arena());
  for (let i = 0; i < 60; i++) world.addFeat({ type: "egg", id: `e${i}` });
  assert.equal(world.feats.length, 50);
  assert.equal(world.feats[0].id, "e10");
  assert.equal(world.feats[49].id, "e59");
});

// ------------------------------------------------------------- the companion

test("a follower walks 10 ticks behind the dino", () => {
  assert.equal(FOLLOW_TICKS, 10);
  const follower = createFollower();
  for (let x = 0; x < 15; x++) follower.push({ x, y: 5, direction: 1 });
  assert.deepEqual(follower.at(), { x: 4, y: 5, direction: 1, moving: true });
});

test("a follower with one position stands there; reset forgets the trail", () => {
  const follower = createFollower();
  assert.equal(follower.at(), null);
  follower.push({ x: 7, y: 3, direction: -1 });
  assert.deepEqual(follower.at(), { x: 7, y: 3, direction: -1, moving: false });
  follower.reset();
  assert.equal(follower.at(), null);
});

test("a follower stands still once the dino has", () => {
  const follower = createFollower(2);
  [0, 1, 2, 3, 3, 3, 3, 3].forEach((x) => follower.push({ x, y: 0, direction: 1 }));
  assert.equal(follower.at().moving, false);
});

test("companion frames: two per companion, none for none or junk", () => {
  assert.deepEqual(companionFrames("none"), []);
  assert.deepEqual(companionFrames("../x"), []);
  assert.deepEqual(companionFrames(undefined), []);
  const frames = companionFrames("raptor");
  assert.equal(frames.length, 2);
  assert.equal(companionFrames("raptor"), frames, "loaded once");
});

test("the egg icon and every companion's two frames exist", () => {
  const sprites = path.join(root, "app", "assets", "sprites");
  assert.ok(fs.existsSync(path.join(sprites, "items", "egg.png")));
  COMPANION_IDS.forEach((id) => {
    [1, 2].forEach((n) => {
      assert.ok(fs.existsSync(path.join(sprites, "companions", `${id}-${n}.png`)), `${id}-${n}`);
    });
  });
});
