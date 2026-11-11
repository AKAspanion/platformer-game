import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createWallet } from "../app/progress/wallet";
import { createStats } from "../app/progress/stats";
import {
  CATALOG,
  FREE,
  itemOf,
  SLOTS,
  COMPANION_IDS,
  COMMON_COMPANIONS,
  RARE_COMPANIONS,
  isHatchOnly,
} from "../app/shop/catalog";

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

const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

const walletWith = (state) => memoryStorage({ wallet: JSON.stringify(state) });

test("a fresh wallet wears and owns the free items, with no coins", () => {
  const w = createWallet(memoryStorage(), "d");
  assert.deepEqual(w.worn(), {
    skin: "classic",
    hat: "none",
    fireball: "classic",
    companion: "none",
  });
  assert.ok(w.owns("skin", "classic") && w.owns("hat", "none") && w.owns("fireball", "classic"));
  assert.equal(w.owns("hat", "cap"), false);
  assert.equal(w.balance(), 0);
});

test("earned coins add up at once and persist", () => {
  const storage = memoryStorage();
  const w = createWallet(storage, "d");
  w.earn(3);
  w.earn(4);
  assert.equal(w.balance(), 7);
  assert.equal(w.earned(), 7);
  assert.equal(createWallet(storage, "d").balance(), 7);
  assert.deepEqual(JSON.parse(storage.data.wallet).earned, { d: 7 });
});

test("earn ignores bad amounts", () => {
  const w = createWallet(memoryStorage(), "d");
  [0, -5, 1.5, NaN, Infinity, "3", null].forEach((n) => w.earn(n));
  assert.equal(w.balance(), 0);
});

test("buying a 150-coin cap with 140 says need 10 and changes nothing; with 150 it works", () => {
  const w = createWallet(memoryStorage(), "d");
  w.earn(140);
  assert.deepEqual(w.buy("hat", "cap"), { ok: false, need: 10 });
  assert.equal(w.balance(), 140);
  assert.equal(w.owns("hat", "cap"), false);
  w.earn(10);
  assert.deepEqual(w.buy("hat", "cap"), { ok: true });
  assert.equal(w.balance(), 0);
  assert.ok(w.owns("hat", "cap"));
});

test("buying an unknown or an owned item does nothing", () => {
  const w = createWallet(memoryStorage(), "d");
  w.earn(5000);
  assert.deepEqual(w.buy("hat", "nope"), { ok: false, need: 0 });
  assert.deepEqual(w.buy("cape", "red"), { ok: false, need: 0 });
  assert.deepEqual(w.buy("skin", "classic"), { ok: false, need: 0 });
  w.buy("skin", "mint");
  assert.deepEqual(w.buy("skin", "mint"), { ok: false, need: 0 });
  assert.equal(w.balance(), 4800);
});

test("a debt from merged purchases shows 0, keeps items, and new coins pay it off first", () => {
  // 1,000 earned across two devices, 1,100 of items owned: a debt of 100.
  const storage = walletWith({
    earned: { a: 600, b: 400 },
    rewards: {},
    owned: ["skin:midnight", "hat:crown"],
    worn: { skin: "midnight", hat: "crown", fireball: "classic" },
    wornAt: 1,
  });
  const w = createWallet(storage, "a");
  assert.equal(w.balance(), 0);
  assert.ok(w.owns("skin", "midnight") && w.owns("hat", "crown"));
  w.earn(60);
  assert.equal(w.balance(), 0);
  w.earn(140);
  assert.equal(w.balance(), 100);
  assert.ok(w.owns("skin", "midnight") && w.owns("hat", "crown"));
});

test("an achievement reward pays once", () => {
  const w = createWallet(memoryStorage(), "d");
  assert.equal(w.reward("first-steps", 50), true);
  assert.equal(w.reward("first-steps", 50), false);
  assert.equal(w.balance(), 50);
  assert.equal(w.reward("bad", -5), false);
  assert.equal(w.balance(), 50);
});

test("wearing needs ownership", () => {
  const w = createWallet(memoryStorage(), "d");
  assert.equal(w.wear("skin", "gold"), false);
  assert.equal(w.worn().skin, "classic");
  w.earn(300);
  w.buy("skin", "sunset");
  assert.equal(w.wear("skin", "sunset"), true);
  assert.equal(w.worn().skin, "sunset");
  assert.equal(w.wear("skin", "classic"), true);
  assert.equal(w.wear("skin", "nope"), false);
  assert.equal(w.wear("hat", "classic"), false);
});

test("two devices' coins never overwrite each other", () => {
  const storage = memoryStorage();
  createWallet(storage, "a").earn(10);
  const b = createWallet(storage, "b");
  b.earn(5);
  assert.equal(b.earned(), 15);
});

test("blocked storage keeps the wallet working for the session", () => {
  const w = createWallet(blocked, "d");
  w.earn(20);
  assert.equal(w.balance(), 20);
  assert.deepEqual(w.buy("hat", "cap"), { ok: false, need: 130 });
});

test("a corrupt wallet reads as a fresh one", () => {
  const w = createWallet(memoryStorage({ wallet: "{{" }), "d");
  assert.equal(w.balance(), 0);
  assert.deepEqual(w.worn(), {
    skin: "classic",
    hat: "none",
    fireball: "classic",
    companion: "none",
  });
});

test("the catalogue matches the spec table and each slot has one free item", () => {
  const table = {
    skin: "classic:Classic:0 mint:Mint:200 sunset:Sunset:300 ocean:Ocean:350 lava:Lava:400 midnight:Midnight:500 candy:Candy:600 ghost:Ghost:750 gold:Gold:1000",
    hat: "none:No hat:0 cap:Cap:150 party:Party hat:200 cowboy:Cowboy:300 viking:Viking:400 tophat:Top hat:450 wizard:Wizard:500 pirate:Pirate:550 crown:Crown:600",
    fireball:
      "classic:Classic:0 blue:Blue flame:250 green:Green flame:250 crimson:Crimson flame:300 pink:Pink flame:300 ice:Ice flame:350 purple:Purple flame:400 gold:Gold flame:450 shadow:Shadow flame:600",
    companion:
      "none:None:0 hatchling:Hatchling:0 ptero:Ptero Chick:0 trike:Mini Trike:0 stego:Tiny Stego:0 raptor:Baby Raptor:0 ankylo:Little Anky:0 golden:Golden Hatchling:0 crystal:Crystal Drake:0",
  };
  assert.deepEqual(Object.keys(CATALOG), ["skin", "hat", "fireball", "companion"]);
  Object.keys(table).forEach((slot) => {
    assert.equal(CATALOG[slot].map((i) => `${i.id}:${i.name}:${i.price}`).join(" "), table[slot]);
    if (slot === "companion") return;
    assert.equal(CATALOG[slot].filter((i) => i.price === 0).length, 1);
    assert.equal(CATALOG[slot].find((i) => i.price === 0).id, FREE[slot]);
  });
  assert.deepEqual(FREE, { skin: "classic", hat: "none", fireball: "classic", companion: "none" });
  assert.deepEqual(itemOf("hat", "crown"), { id: "crown", name: "Crown", price: 600 });
  assert.equal(itemOf("hat", "nope"), null);
  assert.equal(itemOf("toString", "x"), null);
});

test("stats count kills per device, keep flags and the fastest boss rush", () => {
  const storage = memoryStorage();
  const s = createStats(storage, "d");
  s.addKills(3);
  s.addKills(2);
  s.addKills(-1);
  s.addKills(1.5);
  assert.equal(s.kills(), 5);
  s.markFlawlessBoss();
  s.markSecretBoss();
  s.finishWorld("w1");
  s.finishWorld("w1");
  s.finishWorld("");
  assert.equal(s.bossRushTime(300), 300);
  assert.equal(s.bossRushTime(350), 300);
  assert.equal(s.bossRushTime(250), 250);
  assert.equal(s.bossRushTime(NaN), 250);
  assert.deepEqual(createStats(storage, "d").read(), {
    kills: { d: 5 },
    flawlessBoss: true,
    secretBoss: true,
    worldsFinished: ["w1"],
    bossRushBest: 250,
    burned: {},
    bestCombo: 0,
    shieldlessBoss: false,
    endlessDeepest: 0,
  });
  assert.equal(createStats(storage, "other").kills(), 5);
  assert.equal(createStats(memoryStorage(), "d").bossRushTime(NaN), null);
});

test("the companion slot: free None, 8 hatchable ids, 6 common and 2 rare", () => {
  assert.deepEqual(SLOTS, ["skin", "hat", "fireball", "companion"]);
  assert.equal(FREE.companion, "none");
  assert.equal(COMPANION_IDS.length, 8);
  assert.equal(COMMON_COMPANIONS.length, 6);
  assert.deepEqual(RARE_COMPANIONS, ["golden", "crystal"]);
  assert.ok(isHatchOnly("companion", "trike"));
  assert.ok(!isHatchOnly("companion", "none"));
  assert.ok(!isHatchOnly("hat", "cap"));
  assert.ok(!isHatchOnly("companion", "dragon"));
});

test("a companion can't be bought, only granted once", () => {
  const wallet = createWallet(memoryStorage(), "A");
  wallet.earn(5000);
  assert.deepEqual(wallet.buy("companion", "trike"), { ok: false, need: 0, hatchOnly: true });
  assert.equal(wallet.balance(), 5000);
  assert.equal(wallet.wear("companion", "trike"), false);
  assert.equal(wallet.grant("companion", "trike"), true);
  assert.equal(wallet.owns("companion", "trike"), true);
  assert.equal(wallet.balance(), 5000);
  assert.equal(wallet.grant("companion", "trike"), false);
  assert.equal(wallet.grant("companion", "dragon"), false);
  assert.equal(wallet.grant("hat", "cap"), false);
  assert.equal(wallet.wear("companion", "trike"), true);
  assert.equal(wallet.worn().companion, "trike");
});

test("a fresh device wears no companion", () => {
  assert.equal(createWallet(memoryStorage(), "A").worn().companion, "none");
});

test("stats count burned projectiles per device and keep the higher bests", () => {
  const storage = memoryStorage();
  const s = createStats(storage, "d");
  s.addBurned(4);
  s.addBurned(0);
  s.addBurned(1.5);
  assert.equal(s.burned(), 4);
  createStats(storage, "e").addBurned(6);
  assert.equal(s.burned(), 10);
  s.bestCombo(12);
  s.bestCombo(7);
  s.bestCombo(NaN);
  s.endlessDeepest(9);
  s.endlessDeepest(4);
  s.markShieldlessBoss();
  const read = createStats(storage, "d").read();
  assert.equal(read.bestCombo, 12);
  assert.equal(read.endlessDeepest, 9);
  assert.equal(read.shieldlessBoss, true);
});
