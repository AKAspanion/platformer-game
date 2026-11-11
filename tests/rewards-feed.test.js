import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { featsFrom } from "../app/rewards/feed";

test("featsFrom turns events, world feats and coins into quest feats", () => {
  const out = featsFrom(
    ["kill", "burn", "burn", "powerup", "shield-bounce"],
    [
      { type: "kill", enemy: "pig" },
      { type: "egg", id: "s9" },
    ],
    3,
  );
  assert.deepEqual(out.feats, [
    { type: "kill", enemy: "pig" },
    { type: "burn" },
    { type: "burn" },
    { type: "powerup" },
    { type: "coin", n: 3 },
  ]);
  assert.deepEqual(out.eggs, ["s9"]);
  assert.equal(out.burned, 2);
  assert.equal(out.shieldBounced, true);
});

test("featsFrom with nothing happening gives nothing", () => {
  assert.deepEqual(featsFrom([], [], 0), {
    feats: [],
    eggs: [],
    burned: 0,
    shieldBounced: false,
  });
});

test("featsFrom ignores malformed input", () => {
  const out = featsFrom(undefined, [null, { type: "kill" }, { type: "egg", id: 4 }], NaN);
  assert.deepEqual(out, { feats: [], eggs: [], burned: 0, shieldBounced: false });
});

import areas from "../app/areas";
import { assetsOf } from "../app/game/world";
import { createDailySession, createEndlessSession, dailySeed } from "../app/modes";
import { dailyEggLevel, dailyEggId, createNest } from "../app/rewards/eggs";
import { createQuests } from "../app/rewards/quests";
import { createWallet } from "../app/progress/wallet";

test("today's daily puts exactly one egg, d<seed>, in the level dailyEggLevel picks", () => {
  const date = new Date(2026, 10, 11);
  const seed = dailySeed(date);
  const session = createDailySession(date);
  const holders = [];
  for (let i = 0; i < 5; i++) {
    const area = areas[session.startId + i];
    if (area.egg) holders.push([i, area.egg.id]);
  }
  assert.deepEqual(holders, [[dailyEggLevel(seed), dailyEggId(seed)]]);
});

test("endless levels hold no egg", () => {
  const session = createEndlessSession(123);
  assert.equal(areas[session.startId].egg, undefined);
  assert.equal(areas[session.startId + 1].egg, undefined);
});

test("a level with an egg preloads the egg icon; one without doesn't", () => {
  const withEgg = Object.values(areas).find((a) => a.egg);
  const without = Object.values(areas).find((a) => !a.egg);
  assert.ok(assetsOf(withEgg).images.includes("./assets/sprites/items/egg.png"));
  assert.ok(!assetsOf(without).images.includes("./assets/sprites/items/egg.png"));
});

test("eggs and quests keep working when storage throws on every write", () => {
  const broken = {
    getItem: () => null,
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => {},
  };
  const nest = createNest(broken);
  assert.doesNotThrow(() => nest.find("s14", "story"));
  const quests = createQuests(broken, () => new Date(2026, 10, 11, 12));
  const wallet = createWallet(broken, "device");
  let finished = [];
  assert.doesNotThrow(() => {
    for (let i = 0; i < 400; i++) {
      finished = finished.concat(quests.record({ type: "coin", n: 5 }, "story").finished);
    }
  });
  finished.forEach(({ pick, rewardId }) =>
    assert.doesNotThrow(() => wallet.reward(rewardId, pick.coins)),
  );
});
