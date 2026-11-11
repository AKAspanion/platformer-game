import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS } from "../app/achievements/catalog";
import { newlyEarned, progressToward } from "../app/achievements/check";
import { emptyProgress } from "../app/progress/save";
import { STAR } from "../app/campaign/index";
import { LEVELS } from "../app/util/index";
import { COMPANION_IDS } from "../app/shop/catalog";

const earned = (progress) => newlyEarned(progress);

test("the catalogue lists the first 12 achievements of the spec", () => {
  assert.deepEqual(
    ACHIEVEMENTS.slice(0, 12).map((a) => [a.id, a.name, a.coins]),
    [
      ["first-steps", "First Steps", 50],
      ["coin-collector", "Coin Collector", 100],
      ["big-spender", "Big Spender", 50],
      ["exterminator", "Exterminator", 250],
      ["untouchable", "Untouchable", 250],
      ["speedy", "Speedy", 250],
      ["daily-habit", "Daily Habit", 250],
      ["star-seeker", "Star Seeker", 250],
      ["completionist", "Completionist", 500],
      ["peak-performer", "Peak Performer", 500],
      ["rush-hour", "Rush Hour", 500],
      ["world-traveller", "World Traveller", 250],
    ],
  );
  assert.ok(ACHIEVEMENTS.every((a) => a.how));
});

test("a fresh progress earns nothing", () => {
  assert.deepEqual(earned(emptyProgress()), []);
});

test("first-steps needs Grassland 1 finished, and only pays once", () => {
  const p = emptyProgress();
  p.campaign.best[1] = 30;
  assert.ok(earned(p).includes("first-steps"));
  p.achievements["first-steps"] = 1;
  assert.ok(!earned(p).includes("first-steps"));
});

test("coin-collector at 1,000 coins across devices, with progress", () => {
  const p = emptyProgress();
  p.wallet.earned = { a: 600, b: 399 };
  assert.ok(!earned(p).includes("coin-collector"));
  assert.deepEqual(progressToward("coin-collector", p), { have: 999, need: 1000 });
  p.wallet.earned.b = 400;
  assert.ok(earned(p).includes("coin-collector"));
});

test("big-spender needs an item beyond the free ones", () => {
  const p = emptyProgress();
  p.wallet.owned = ["skin:classic", "hat:none", "fireball:classic"];
  assert.ok(!earned(p).includes("big-spender"));
  p.wallet.owned.push("hat:cap");
  assert.ok(earned(p).includes("big-spender"));
});

test("exterminator sums kills across devices", () => {
  const p = emptyProgress();
  p.stats.kills = { a: 499 };
  assert.ok(!earned(p).includes("exterminator"));
  p.stats.kills = { a: 300, b: 200 };
  assert.ok(earned(p).includes("exterminator"));
  assert.deepEqual(progressToward("exterminator", p), { have: 500, need: 500 });
});

test("boss, rush and world flags", () => {
  const p = emptyProgress();
  p.stats.flawlessBoss = true;
  assert.deepEqual(earned(p), ["untouchable"]);
  p.stats = { ...emptyProgress().stats, secretBoss: true };
  assert.deepEqual(earned(p), ["peak-performer"]);
  p.stats = { ...emptyProgress().stats, bossRushBest: 252 };
  assert.deepEqual(earned(p), ["rush-hour"]);
  p.stats = { ...emptyProgress().stats, worldsFinished: ["a", "b"] };
  assert.deepEqual(earned(p), []);
  p.stats.worldsFinished.push("c");
  assert.deepEqual(earned(p), ["world-traveller"]);
  assert.deepEqual(progressToward("world-traveller", p), { have: 3, need: 3 });
});

test("speedy needs the time star on every level of one world", () => {
  const p = emptyProgress();
  const iceland = LEVELS.filter((l) => l.world === "Iceland");
  iceland.forEach((l) => (p.campaign.stars[l.id] = STAR.TIME));
  assert.ok(earned(p).includes("speedy"));
  delete p.campaign.stars[iceland[0].id];
  assert.ok(!earned(p).includes("speedy"));
  p.campaign.stars[iceland[0].id] = STAR.COINS | STAR.ENEMIES;
  assert.ok(!earned(p).includes("speedy"));
});

test("daily-habit counts the best streak", () => {
  const p = emptyProgress();
  p.streak = { days: 1, best: 6, freezes: 0, last: 20261111 };
  assert.ok(!earned(p).includes("daily-habit"));
  p.streak.best = 7;
  assert.ok(earned(p).includes("daily-habit"));
  assert.deepEqual(progressToward("daily-habit", p), { have: 7, need: 7 });
});

/** A campaign holding exactly n stars. */
function withStars(n) {
  const p = emptyProgress();
  LEVELS.forEach((level, i) => {
    p.campaign.stars[level.id] = [0, 1, 3, 7][Math.max(0, Math.min(3, n - i * 3))];
  });
  return p;
}

test("star-seeker at 75 stars and completionist at 90", () => {
  assert.ok(!earned(withStars(74)).includes("star-seeker"));
  assert.ok(earned(withStars(75)).includes("star-seeker"));
  assert.ok(!earned(withStars(75)).includes("completionist"));
  assert.ok(!earned(withStars(89)).includes("completionist"));
  assert.ok(earned(withStars(90)).includes("completionist"));
  assert.deepEqual(progressToward("star-seeker", withStars(40)), { have: 40, need: 75 });
  assert.deepEqual(progressToward("completionist", withStars(40)), { have: 40, need: 90 });
});

test("achievements without a number have no progress", () => {
  assert.equal(progressToward("first-steps", emptyProgress()), null);
  assert.equal(progressToward("constructor", emptyProgress()), null);
});

test("hostile ids and owned values do not throw or count", () => {
  const p = emptyProgress();
  p.wallet.owned = ["constructor:x", "__proto__:y", "hat:nonsense", "nocolon"];
  p.achievements = { toString: 1 };
  assert.ok(!earned(p).includes("big-spender"));
  assert.equal(progressToward("__proto__", p), null);
});

test("the catalogue has 24 entries, the new 12 with the spec's coins", () => {
  assert.equal(ACHIEVEMENTS.length, 24);
  assert.deepEqual(
    ACHIEVEMENTS.slice(12).map((a) => [a.id, a.name, a.coins]),
    [
      ["world-conqueror", "World Conqueror", 500],
      ["grand-tour", "Grand Tour", 1000],
      ["combo-king", "Combo King", 250],
      ["unbroken", "Unbroken", 500],
      ["shield-breaker", "Shield Breaker", 250],
      ["sharpshooter", "Sharpshooter", 250],
      ["egg-hunter", "Egg Hunter", 250],
      ["full-nest", "Full Nest", 500],
      ["questing", "Questing", 250],
      ["treasure-hunter", "Treasure Hunter", 500],
      ["deep-diver", "Deep Diver", 250],
      ["devoted", "Devoted", 500],
    ],
  );
  assert.ok(ACHIEVEMENTS.every((a) => a.how));
});

const bossIds = LEVELS.filter((l) => l.boss).map((l) => l.id);

test("world-conqueror needs all five bosses finished", () => {
  const p = emptyProgress();
  bossIds.slice(0, 4).forEach((id) => (p.campaign.best[id] = 60));
  assert.ok(!earned(p).includes("world-conqueror"));
  assert.deepEqual(progressToward("world-conqueror", p), { have: 4, need: 5, unit: "bosses" });
  p.campaign.best[bossIds[4]] = 60;
  assert.ok(earned(p).includes("world-conqueror"));
});

test("grand-tour needs every level and the secret boss", () => {
  const p = emptyProgress();
  LEVELS.forEach((l) => (p.campaign.best[l.id] = 60));
  assert.ok(!earned(p).includes("grand-tour"));
  assert.deepEqual(progressToward("grand-tour", p), { have: 30, need: 31, unit: "levels" });
  p.stats.secretBoss = true;
  assert.ok(earned(p).includes("grand-tour"));
  delete p.campaign.best[LEVELS[0].id];
  assert.ok(!earned(p).includes("grand-tour"));
});

test("combo-king at 20 and unbroken at 50", () => {
  const p = emptyProgress();
  p.stats.bestCombo = 19;
  assert.ok(!earned(p).includes("combo-king"));
  p.stats.bestCombo = 20;
  assert.ok(earned(p).includes("combo-king"));
  assert.ok(!earned(p).includes("unbroken"));
  p.stats.bestCombo = 50;
  assert.ok(earned(p).includes("unbroken"));
  assert.deepEqual(progressToward("unbroken", p), { have: 50, need: 50 });
});

test("shield-breaker and sharpshooter", () => {
  const p = emptyProgress();
  p.stats.shieldlessBoss = true;
  p.stats.burned = { a: 60, b: 39 };
  assert.deepEqual(earned(p), ["shield-breaker"]);
  assert.deepEqual(progressToward("sharpshooter", p), { have: 99, need: 100, unit: "projectiles" });
  p.stats.burned.b = 40;
  assert.ok(earned(p).includes("sharpshooter"));
});

test("egg-hunter at 10 found eggs and full-nest at all 8 companions", () => {
  const p = emptyProgress();
  p.nest.found = Array.from({ length: 9 }, (_, i) => `s${i}`);
  assert.ok(!earned(p).includes("egg-hunter"));
  p.nest.found.push("s9");
  assert.ok(earned(p).includes("egg-hunter"));
  assert.deepEqual(progressToward("egg-hunter", p), { have: 10, need: 10, unit: "eggs" });
  p.wallet.owned = COMPANION_IDS.slice(0, 7).map((id) => `companion:${id}`);
  assert.ok(!earned(p).includes("full-nest"));
  assert.deepEqual(progressToward("full-nest", p), { have: 7, need: 8, unit: "companions" });
  p.wallet.owned.push(`companion:${COMPANION_IDS[7]}`);
  assert.ok(earned(p).includes("full-nest"));
});

test("hatched companions are not purchases", () => {
  const p = emptyProgress();
  p.wallet.owned = ["companion:trike"];
  assert.ok(!earned(p).includes("big-spender"));
});

test("questing counts quest reward ids, treasure-hunter counts chests", () => {
  const p = emptyProgress();
  for (let i = 0; i < 24; i++) p.wallet.rewards[`q${20400 + i}${"abc"[i % 3]}`] = 50;
  p.wallet.rewards["questing-x"] = 250;
  p.wallet.rewards["c20400x"] = 1;
  assert.ok(!earned(p).includes("questing"));
  assert.deepEqual(progressToward("questing", p), { have: 24, need: 25, unit: "quests" });
  p.wallet.rewards.q20500a = 50;
  assert.ok(earned(p).includes("questing"));
  [20400, 20407, 20414].forEach((d) => (p.wallet.rewards[`c${d}`] = 100));
  assert.ok(!earned(p).includes("treasure-hunter"));
  p.wallet.rewards.c20421 = 100;
  assert.ok(earned(p).includes("treasure-hunter"));
  assert.deepEqual(progressToward("treasure-hunter", p), { have: 4, need: 4, unit: "chests" });
});

test("deep-diver at endless level 25 and devoted at a 30-day streak", () => {
  const p = emptyProgress();
  p.stats.endlessDeepest = 24;
  p.streak = { days: 1, best: 29, freezes: 0, last: 20261111 };
  assert.deepEqual(earned(p), ["daily-habit"]);
  p.stats.endlessDeepest = 25;
  p.streak.best = 30;
  assert.deepEqual(earned(p), ["daily-habit", "deep-diver", "devoted"]);
  assert.deepEqual(progressToward("devoted", p), { have: 30, need: 30, unit: "days" });
  assert.deepEqual(progressToward("deep-diver", p), { have: 25, need: 25, unit: "levels" });
});
