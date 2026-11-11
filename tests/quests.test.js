import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  QUEST_COINS,
  CHEST_KEYS,
  localDay,
  weekStart,
  questRewardId,
  chestRewardId,
  metEnemies,
  unlockedModes,
  pickQuests,
  createQuests,
  claimChest,
  payFinished,
  CHEST_COINS,
} from "../app/rewards/quests";
import { createNest } from "../app/rewards/eggs";
import { createWallet } from "../app/progress/wallet";
import { mergeProgress } from "../app/progress/save";
import { LEVELS } from "../app/util/index";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const ALL = ["story", "daily", "endless", "community"];
const ctx = (extra = {}) => ({
  unlocked: ALL,
  metEnemies: ["pig", "slime", "chameleon", "beetle", "bat", "spitter"],
  ...extra,
});
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

/** Stored state with chosen picks for `day`, so a test controls what is asked. */
function stateWith(day, picks, progress, extra = {}) {
  return JSON.stringify({
    day,
    picks,
    progress,
    week: weekStart(day),
    weekDone: [],
    played: {},
    ...extra,
  });
}
const pick = (id, tier, target, stat, text, extra = {}) => ({
  id,
  tier,
  target,
  coins: QUEST_COINS[tier],
  text,
  stat,
  ...extra,
});

/** Every pick `pickQuests` can make, found by scanning days. */
function scan(context, days = 400) {
  const out = [];
  for (let day = 20000; day < 20000 + days; day++) {
    out.push(...pickQuests(day, {}, context));
    const forced = {};
    ["story", "daily", "endless", "community", "bossrush"].forEach((m) => {
      forced[m] = m === "bossrush" ? [] : [day, day - 1, day - 2];
    });
    out.push(...pickQuests(day, forced, { ...context, unlocked: [...ALL, "bossrush"] }));
  }
  return out;
}

test("localDay changes at local midnight; weeks start on Monday", () => {
  const a = localDay(at(2026, 11, 11, 23, 59));
  assert.equal(localDay(at(2026, 11, 12, 0, 0)), a + 1);
  const monday = localDay(at(2026, 11, 9));
  assert.equal(weekStart(localDay(at(2026, 11, 11))), monday);
  assert.equal(weekStart(localDay(at(2026, 11, 15))), monday);
  assert.equal(weekStart(monday), monday);
  assert.equal(weekStart(monday + 7), monday + 7);
  assert.equal(questRewardId(5, 2), "q5c");
  assert.equal(chestRewardId(9), "c9");
});

test("pickQuests makes one quest per tier, one a mode quest, two different general ids", () => {
  for (let day = 20000; day < 20100; day++) {
    const picks = pickQuests(day, {}, ctx());
    assert.deepEqual(
      picks.map((p) => p.tier),
      [0, 1, 2],
    );
    assert.deepEqual(
      picks.map((p) => p.coins),
      QUEST_COINS,
    );
    assert.equal(picks.filter((p) => p.mode).length, 1);
    const general = picks.filter((p) => !p.mode).map((p) => p.id);
    assert.equal(new Set(general).size, 2);
    assert.deepEqual(pickQuests(day, {}, ctx()), picks);
  }
});

test("the mode quest is the unlocked mode played least in the last 7 days", () => {
  const day = 20500;
  const run = (n) => Array.from({ length: n }, (_, i) => day - i);
  const played = { story: run(5), daily: run(3), endless: run(1), community: run(2) };
  for (let d = day; d < day + 30; d++) {
    const shifted = Object.fromEntries(
      Object.entries(played).map(([m, days]) => [m, days.map((x) => x + (d - day))]),
    );
    const mode = pickQuests(d, shifted, ctx()).find((p) => p.mode).mode;
    assert.equal(mode, "endless");
  }
  const withRush = pickQuests(day, played, ctx({ unlocked: [...ALL, "bossrush"] }));
  assert.equal(withRush.find((p) => p.mode).mode, "bossrush");
  // days older than 7 don't count
  const old = { story: [day - 8, day - 9], daily: [day], endless: [day], community: [day] };
  assert.equal(pickQuests(day, old, ctx()).find((p) => p.mode).mode, "story");
});

test("a quest only names an enemy from a world the player has reached", () => {
  const grass = { reached: [1, 2, 7], last: 7, stars: {}, best: {} };
  const met = metEnemies(grass);
  assert.deepEqual([...met].sort(), ["bat", "beetle", "chameleon", "pig"]);
  const types = scan(ctx({ metEnemies: met })).filter((p) => p.id === "defeat-type");
  assert.ok(types.length > 0);
  types.forEach((p) => assert.ok(["pig", "chameleon", "beetle", "bat"].includes(p.enemy)));
  const seen = new Set(types.map((p) => p.enemy));
  assert.ok(seen.size > 1);
  assert.ok(metEnemies({ reached: [1, 13] }).includes("spitter"));
  assert.ok(metEnemies(null).includes("pig"));
});

test("unlockedModes adds boss rush once every boss is beaten", () => {
  assert.deepEqual(unlockedModes({ reached: [1], best: {} }), ALL);
  const best = {};
  LEVELS.filter((l) => l.boss).forEach((l) => {
    best[l.id] = 50;
  });
  assert.deepEqual(unlockedModes({ reached: [1], best }), [...ALL, "bossrush"]);
});

test("quest texts and counts match the spec", () => {
  const picks = scan(ctx());
  const find = (id, tier, enemy) =>
    picks.find((p) => p.id === id && p.tier === tier && (!enemy || p.enemy === enemy));
  const slimes = find("defeat-type", 1, "slime");
  assert.equal(slimes.text, "Defeat 8 slimes with fireballs");
  assert.equal(slimes.enemy, "slime");
  assert.equal(find("defeat", 1).text, "Defeat 15 enemies");
  assert.equal(find("coins", 1).text, "Collect 150 coins");
  assert.equal(find("combo", 1).text, "Reach a x3 combo");
  assert.equal(find("combo", 1).target, 10);
  assert.equal(find("burn", 1).text, "Burn 5 enemy projectiles");
  assert.equal(find("powerups", 1).text, "Pick up 3 power-ups");
  assert.equal(find("endless", 1).text, "Reach endless level 5");
  assert.equal(find("flawless", 0).text, "Finish a level without losing a heart");
  assert.equal(find("flawless", 1).text, "Finish 2 levels without losing a heart");
  assert.equal(find("daily", 2).text, "Finish today's daily challenge");
  assert.equal(find("daily", 2).target, 5);
  assert.equal(find("bossrush", 2).text, "Finish boss rush");
  assert.equal(find("bossrush", 0).text, "Beat 2 bosses in boss rush");
  assert.equal(find("story", 0).text, "Finish a story level");
  assert.equal(find("community", 0).text, "Finish a community world level");
  assert.equal(find("community", 2).text, "Finish 4 community world levels");
  assert.equal(find("defeat-type", 0, "bat").text, "Defeat 4 bats with fireballs");
  assert.equal(find("defeat-type", 2, "spitter").text, "Defeat 12 spitter plants with fireballs");
});

test("a day's picks are made once and kept", () => {
  const storage = memoryStorage();
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  const first = quests.today();
  const again = createQuests(
    storage,
    () => at(2026, 11, 11, 20),
    () => ctx({ unlocked: ["story"], metEnemies: ["bat"] }),
  );
  assert.deepEqual(again.today(), first);
  assert.deepEqual(
    quests.today().map((q) => q.have),
    [0, 0, 0],
  );
});

test("coins count up to the target, finish once and pay a reward id", () => {
  const day = localDay(at(2026, 11, 11));
  const picks = [
    pick("coins", 1, 150, "coin", "Collect 150 coins"),
    pick("defeat", 0, 8, "kill", "Defeat 8 enemies"),
    pick("story", 2, 3, "level", "Finish 3 story levels", { mode: "story" }),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [140, 0, 0]) });
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  const r = quests.record({ type: "coin", n: 15 }, "endless");
  assert.deepEqual(
    r.finished.map((f) => f.rewardId),
    [`q${day}a`],
  );
  assert.equal(r.finished[0].pick.id, "coins");
  assert.equal(r.chest, null);
  const view = quests.today()[0];
  assert.equal(view.have, 150);
  assert.equal(view.done, true);
  assert.deepEqual(quests.record({ type: "coin", n: 10 }, "endless").finished, []);
  assert.equal(quests.today()[0].have, 150);
  assert.equal(quests.keys(), 1);
  // a general quest counts every mode, a kill counts too
  quests.record({ type: "kill", enemy: "pig" }, "story");
  assert.equal(quests.today()[1].have, 1);
});

test("a mode quest counts only feats recorded with its mode", () => {
  const day = localDay(at(2026, 11, 11));
  const picks = [
    pick("defeat", 0, 8, "kill", "Defeat 8 enemies"),
    pick("endless", 1, 5, "endless-level", "Reach endless level 5", { mode: "endless" }),
    pick("coins", 2, 300, "coin", "Collect 300 coins"),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [0, 0, 0]) });
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.deepEqual(quests.record({ type: "endless-level", level: 5 }, "daily").finished, []);
  assert.equal(quests.today()[1].have, 0);
  const r = quests.record({ type: "endless-level", level: 5 }, "endless");
  assert.equal(r.finished.length, 1);
  assert.equal(quests.today()[1].done, true);
});

test("a combo quest takes the highest value reached", () => {
  const day = localDay(at(2026, 11, 11));
  const picks = [
    pick("combo", 1, 10, "combo", "Reach a x3 combo"),
    pick("burn", 0, 3, "burn", "Burn 3 enemy projectiles"),
    pick("powerups", 2, 5, "powerup", "Pick up 5 power-ups"),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [0, 0, 0]) });
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.deepEqual(quests.record({ type: "combo", value: 9 }, "story").finished, []);
  assert.equal(quests.today()[0].have, 9);
  assert.equal(quests.record({ type: "combo", value: 10 }, "story").finished.length, 1);
  quests.record({ type: "burn" }, "story");
  quests.record({ type: "powerup" }, "story");
  assert.deepEqual(
    quests.today().map((q) => q.have),
    [10, 1, 1],
  );
});

test("level, boss and boss rush feats", () => {
  const day = localDay(at(2026, 11, 11));
  const picks = [
    pick("flawless", 0, 1, "flawless", "Finish a level without losing a heart"),
    pick("bossrush", 1, 3, "boss", "Beat 3 bosses in boss rush", { mode: "bossrush" }),
    pick("bossrush", 2, 1, "bossrush-finished", "Finish boss rush", { mode: "bossrush" }),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [0, 0, 0]) });
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.deepEqual(quests.record({ type: "level", flawless: false }, "story").finished, []);
  assert.equal(quests.record({ type: "level", flawless: true }, "story").finished.length, 1);
  quests.record({ type: "boss" }, "story");
  assert.equal(quests.today()[1].have, 0);
  quests.record({ type: "boss" }, "bossrush");
  assert.equal(quests.today()[1].have, 1);
  assert.equal(quests.record({ type: "bossrush-finished" }, "bossrush").finished.length, 1);
});

test("past local midnight, a feat counts toward the new day's picks", () => {
  const storage = memoryStorage();
  let clock = at(2026, 11, 11, 23, 59);
  const quests = createQuests(
    storage,
    () => clock,
    () => ctx(),
  );
  const before = quests.today();
  const day = localDay(clock);
  const old = [
    pick("defeat", 0, 8, "kill", "Defeat 8 enemies"),
    pick("coins", 1, 150, "coin", "Collect 150 coins"),
    pick("burn", 2, 8, "burn", "Burn 8 enemy projectiles"),
  ];
  storage.setItem("quests", stateWith(day, old, [3, 0, 0]));
  assert.equal(quests.today()[0].have, 3);
  clock = at(2026, 11, 12, 0, 0);
  quests.record({ type: "kill", enemy: "pig" }, "story");
  const after = quests.today();
  assert.deepEqual(JSON.parse(storage.data.quests).day, day + 1);
  assert.notDeepEqual(
    after.map((q) => q.id),
    old.map((q) => q.id),
  );
  assert.ok(before.length === 3 && after.length === 3);
  assert.ok(after.every((q) => q.have <= 1));
});

test("12 keys open the chest once; extra keys do nothing", () => {
  const day = localDay(at(2026, 11, 11)); // a Wednesday
  const monday = weekStart(day);
  const done = Array.from({ length: 11 }, (_, i) => `q${monday + (i % 3)}x${i}`);
  const picks = [
    pick("defeat", 0, 1, "kill", "Defeat 1 enemies"),
    pick("coins", 1, 1, "coin", "Collect 1 coins"),
    pick("burn", 2, 1, "burn", "Burn 1 enemy projectiles"),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [0, 0, 0], { weekDone: done }) });
  const quests = createQuests(
    storage,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.equal(quests.keys(), 11);
  const r = quests.record({ type: "kill", enemy: "pig" }, "story");
  assert.deepEqual(r.chest, { rewardId: `c${monday}`, eggWeek: monday });
  assert.equal(quests.keys(), CHEST_KEYS);
  const r13 = quests.record({ type: "coin", n: 1 }, "story");
  assert.equal(r13.finished.length, 1);
  assert.deepEqual(r13.chest, r.chest, "the chest stays due; the wallet pays it once");
  assert.equal(quests.keys(), 12);
});

test("keys reset on Monday", () => {
  const sunday = localDay(at(2026, 11, 15));
  const picks = [
    pick("defeat", 0, 8, "kill", "Defeat 8 enemies"),
    pick("coins", 1, 150, "coin", "Collect 150 coins"),
    pick("burn", 2, 8, "burn", "Burn 8 enemy projectiles"),
  ];
  const weekDone = Array.from({ length: 12 }, (_, i) => `k${i}`);
  const storage = memoryStorage({ quests: stateWith(sunday, picks, [0, 0, 0], { weekDone }) });
  let clock = at(2026, 11, 15, 22);
  const quests = createQuests(
    storage,
    () => clock,
    () => ctx(),
  );
  assert.equal(quests.keys(), 12);
  clock = at(2026, 11, 16, 8);
  assert.equal(quests.keys(), 0);
});

test("played() notes the mode for today and feeds the next picks", () => {
  const storage = memoryStorage();
  const clock = at(2026, 11, 11);
  const quests = createQuests(
    storage,
    () => clock,
    () => ctx(),
  );
  quests.played("story");
  quests.played("story");
  const saved = JSON.parse(storage.data.quests);
  assert.deepEqual(saved.played, { story: [localDay(clock)] });
  // a week later the day is out of the window
  const later = createQuests(
    storage,
    () => at(2026, 11, 18),
    () => ctx(),
  );
  later.today();
  assert.deepEqual(JSON.parse(storage.data.quests).played, {});
});

test("corrupt stored state gives fresh picks without throwing", () => {
  [
    "{not json",
    "null",
    JSON.stringify({ day: 5, picks: [{ id: 1 }], progress: [1] }),
    JSON.stringify({ day: localDay(at(2026, 11, 11)), picks: [], progress: [] }),
  ].forEach((raw) => {
    const quests = createQuests(
      memoryStorage({ quests: raw }),
      () => at(2026, 11, 11),
      () => ctx(),
    );
    const today = quests.today();
    assert.equal(today.length, 3);
    assert.equal(quests.keys(), 0);
  });
});

test("storage that refuses writes or reads still works for the session", () => {
  const broken = {
    getItem: () => null,
    setItem: () => {
      throw new Error("full");
    },
  };
  const day = localDay(at(2026, 11, 11));
  const quests = createQuests(
    broken,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  const picks = quests.today();
  assert.equal(picks.length, 3);
  const target = picks.find(
    (q) =>
      q.stat === "coin" ||
      q.stat === "kill" ||
      q.stat === "burn" ||
      q.stat === "powerup" ||
      q.stat === "kill-type",
  );
  if (target) {
    const feat = {
      coin: { type: "coin", n: 1 },
      kill: { type: "kill", enemy: target.enemy },
      "kill-type": { type: "kill", enemy: target.enemy },
      burn: { type: "burn" },
      powerup: { type: "powerup" },
    }[target.stat];
    quests.record(feat, "story");
    assert.equal(quests.today().find((q) => q.id === target.id && q.tier === target.tier).have, 1);
  }
  quests.played("daily");
  assert.deepEqual(
    quests.today().map((q) => q.id),
    picks.map((q) => q.id),
  );
  assert.equal(quests.keys(), 0);
  const noStorage = createQuests(
    null,
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.equal(noStorage.today().length, 3);
  assert.equal(noStorage.record({ type: "burn" }, "story").chest, null);
  assert.ok(day > 0);
});

/** Two devices of one week: A has 11 keys, B finished other quests. */
function twoDevices(extraKeys) {
  const day = localDay(at(2026, 11, 11));
  const monday = weekStart(day);
  const picks = [
    pick("defeat", 0, 1, "kill", "Defeat 1 enemies"),
    pick("coins", 1, 1, "coin", "Collect 1 coins"),
    pick("burn", 2, 1, "burn", "Burn 1 enemy projectiles"),
  ];
  const keys = (from, n) => Array.from({ length: n }, (_, i) => `q${monday - 7 + from + i}z`);
  const a = JSON.parse(stateWith(day, picks, [0, 0, 0], { weekDone: keys(0, 11) }));
  const b = JSON.parse(stateWith(day, picks, [0, 0, 0], { weekDone: keys(11, extraKeys) }));
  return { day, monday, a, b };
}

for (const extra of [1, 2]) {
  test(`keys 11 + ${extra} from another device pay the chest once, 500 coins and one egg`, () => {
    const { monday, a, b } = twoDevices(extra);
    const merged = mergeProgress({ quests: a }, { quests: b }).quests;
    assert.equal(merged.weekDone.length, 11 + extra);
    const storage = memoryStorage({ quests: JSON.stringify(merged) });
    const quests = createQuests(
      storage,
      () => at(2026, 11, 11),
      () => ctx(),
    );
    const wallet = createWallet(memoryStorage(), "dev");
    const nest = createNest(memoryStorage(), () => 1000);
    const before = wallet.balance();
    assert.deepEqual(quests.chest(), { rewardId: `c${monday}`, eggWeek: monday });
    assert.equal(claimChest(quests.chest(), wallet, nest), true);
    assert.equal(wallet.balance(), before + CHEST_COINS);
    assert.equal(nest.has(`c${monday}`), true);
    // a second check, a record() and a second device's merge don't pay again
    assert.equal(claimChest(quests.chest(), wallet, nest), false);
    assert.equal(
      claimChest(quests.record({ type: "kill", enemy: "pig" }, "story").chest, wallet, nest),
      false,
    );
    const other = createWallet(memoryStorage(), "dev2");
    assert.equal(
      other.reward(`c${monday}`, CHEST_COINS),
      true,
      "the other device paid it too, before syncing",
    );
    assert.equal(
      claimChest(
        quests.chest(),
        other,
        createNest(memoryStorage(), () => 1000),
      ),
      false,
    );
    assert.equal(wallet.balance(), before + CHEST_COINS);
  });
}

test("fewer than 12 keys: no chest", () => {
  const { a } = twoDevices(0);
  const quests = createQuests(
    memoryStorage({ quests: JSON.stringify(a) }),
    () => at(2026, 11, 11),
    () => ctx(),
  );
  assert.equal(quests.chest(), null);
  assert.equal(
    claimChest(null, createWallet(memoryStorage(), "dev"), createNest(memoryStorage())),
    false,
  );
});

/** A day D with three picks, some progress and some keys, and a clock that moves. */
function backFixture(date, weekDone = ["qa", "qb"]) {
  const day = localDay(date);
  const picks = [
    pick("defeat", 0, 8, "kill", "Defeat 8 enemies"),
    pick("coins", 1, 150, "coin", "Collect 150 coins"),
    pick("burn", 2, 8, "burn", "Burn 8 enemy projectiles"),
  ];
  const storage = memoryStorage({ quests: stateWith(day, picks, [3, 20, 1], { weekDone }) });
  let clock = date;
  const quests = createQuests(
    storage,
    () => clock,
    () => ctx(),
  );
  return { day, picks, storage, quests, setClock: (d) => (clock = d) };
}

test("a clock set back keeps today's picks and progress, and they are still there when it returns", () => {
  const { day, picks, storage, quests, setClock } = backFixture(at(2026, 11, 11));
  const before = storage.data.quests;
  setClock(at(2026, 11, 10));
  const shown = quests.today();
  assert.deepEqual(
    shown.map((q) => [q.id, q.have]),
    picks.map((q, i) => [q.id, [3, 20, 1][i]]),
  );
  assert.equal(storage.data.quests, before, "nothing is rewritten");
  quests.played("story"); // state keeps its own day
  assert.equal(JSON.parse(storage.data.quests).day, day);
  setClock(at(2026, 11, 11));
  assert.deepEqual(
    quests.today().map((q) => [q.id, q.have]),
    picks.map((q, i) => [q.id, [3, 20, 1][i]]),
  );
  assert.equal(JSON.parse(storage.data.quests).day, day);
});

test("going back across a Monday keeps the week's keys", () => {
  const monday = at(2026, 11, 9); // a Monday
  const { quests, storage, setClock } = backFixture(monday, ["qa", "qb", "qc"]);
  setClock(at(2026, 11, 8)); // the Sunday before
  assert.equal(quests.keys(), 3);
  assert.deepEqual(JSON.parse(storage.data.quests).weekDone, ["qa", "qb", "qc"]);
  assert.equal(JSON.parse(storage.data.quests).week, weekStart(localDay(monday)));
  setClock(at(2026, 11, 9));
  assert.equal(quests.keys(), 3);
});

test("progress made while the clock is back counts toward the stored day", () => {
  const { quests, setClock } = backFixture(at(2026, 11, 11));
  setClock(at(2026, 11, 10));
  quests.record({ type: "kill", enemy: "pig" }, "story");
  assert.equal(quests.today()[0].have, 4);
});

test("a later date still starts a fresh day, and a later Monday resets the keys", () => {
  const { day, quests, storage, setClock } = backFixture(at(2026, 11, 11), ["qa", "qb"]);
  setClock(at(2026, 11, 12));
  assert.ok(quests.today().every((q) => q.have === 0));
  assert.equal(JSON.parse(storage.data.quests).day, day + 1);
  assert.equal(quests.keys(), 2, "same week");
  setClock(at(2026, 11, 16)); // the next Monday
  assert.equal(quests.keys(), 0);
});

test("a merge never moves the day backwards", () => {
  const day = localDay(at(2026, 11, 11));
  const picks = [pick("defeat", 0, 8, "kill", "Defeat 8 enemies")];
  const newer = JSON.parse(stateWith(day, picks, [3]));
  const older = JSON.parse(stateWith(day - 1, picks, [8]));
  [
    mergeProgress({ quests: newer }, { quests: older }),
    mergeProgress({ quests: older }, { quests: newer }),
  ]
    .map((m) => m.quests)
    .forEach((merged) => {
      assert.equal(merged.day, day);
      assert.deepEqual(merged.progress, [3]);
    });
});

test("only a quest whose reward id was not paid before is paid and reported", () => {
  const wallet = createWallet(memoryStorage(), "dev");
  const finished = [
    { pick: pick("defeat", 0, 1, "kill", "Defeat 1 enemies"), rewardId: "q1a" },
    { pick: pick("coins", 1, 1, "coin", "Collect 1 coins"), rewardId: "q1b" },
  ];
  assert.equal(wallet.reward("q1a", 50), true, "paid on another device, before a merge");
  const before = wallet.balance();
  const paid = payFinished(finished, wallet);
  assert.deepEqual(
    paid.map((f) => f.rewardId),
    ["q1b"],
  );
  assert.equal(wallet.balance(), before + QUEST_COINS[1]);
  assert.deepEqual(payFinished(finished, wallet), [], "a second pass pays and reports nothing");
});
