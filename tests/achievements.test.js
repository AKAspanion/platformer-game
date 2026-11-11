import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS } from "../app/achievements/catalog";
import { newlyEarned, progressToward } from "../app/achievements/check";
import { emptyProgress } from "../app/progress/save";
import { STAR } from "../app/campaign/index";
import { LEVELS } from "../app/util/index";

const earned = (progress) => newlyEarned(progress);

test("the catalogue lists the 12 achievements of the spec", () => {
  assert.deepEqual(
    ACHIEVEMENTS.map((a) => [a.id, a.name, a.coins]),
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
