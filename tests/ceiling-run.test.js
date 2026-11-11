import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import World from "../app/game/world";
import { generateSequence, generateEndlessLevel } from "../app/pcg/generator";
import { dailyLevels, dailyScoreCeiling, ENEMY_MAX_SCORE } from "../app/daily/rules";
import { endlessScoreCeiling, checkEndlessRun } from "../app/modes/endless-rules";
import { handleSubmitDaily } from "../functions/src/daily.js";
import { fakeTickets, ticketed } from "./tickets-fake.js";

/**
 * A perfect run through the real World code: every coin and enemy scored with the
 * combo held at x4, and every power-up banked as a heart picked up at full health
 * (the ceiling's best case). Returns the world's score.
 */
function perfectRun(areas) {
  const world = new World();
  world.reset();
  for (const area of areas) {
    world.setup(area);
    // setup restarts the level's combo: hold it at the x4 tier
    const hold = () => {
      world.combo.count = 20;
      world.combo.multiplier = 4;
    };
    hold();
    for (let i = 0; i < area.coins.length; i++) {
      hold();
      world.scoreCoin();
    }
    assert.equal(world.enemies.items.length, area.enemies.length, "every enemy is in the world");
    for (const enemy of world.enemies.items) {
      enemy.score = ENEMY_MAX_SCORE;
      hold();
      // armoured enemies take two hits; only the kill scores
      for (let hits = 0; !enemy.dying && hits < 5; hits++) world.killEnemy(enemy, 1);
      assert.ok(enemy.dying, `${enemy.id} dies`);
    }
    assert.equal(world.powerups.items.length, (area.powerups || []).length);
    for (const item of world.powerups.items) {
      item.type = "heart";
      world.player.hearts = world.player.maxHearts ?? world.player.hearts;
      world.applyPowerup(item);
    }
  }
  return world.score;
}

const dailyAreas = (seed) => generateSequence({ idBase: 3000, seed, levels: dailyLevels(seed) });

test("a perfect x4 daily run through the World scores exactly dailyScoreCeiling", () => {
  for (const seed of [20261111, 20260305, 20271231, 20260101]) {
    const score = perfectRun(dailyAreas(seed));
    assert.ok(score > 0);
    assert.equal(score, dailyScoreCeiling(seed), `seed ${seed}`);
  }
});

test("the server takes the perfect daily score and refuses one point more", async () => {
  const seed = 20261111;
  const score = perfectRun(dailyAreas(seed));
  const now = () => Date.UTC(2026, 10, 11, 12);
  const auth = { uid: "u1", token: { name: "Ana", firebase: { sign_in_provider: "google.com" } } };
  // every run needs a fresh run ticket (tests/run-tickets.test.js tests them)
  const tickets = fakeTickets();
  const submit = (s) =>
    handleSubmitDaily(
      { auth, data: ticketed(tickets, auth, "daily", { seed, score: s, seconds: 60 }, now()) },
      {
        now,
        tickets,
        limiter: async () => false,
        scores: {
          get: async () => null,
          set: async () => {},
          rankOf: async () => 1,
          count: async () => 1,
        },
      },
    );
  await submit(score);
  await assert.rejects(submit(score + 1), (e) => e.message === "That run can't be ranked.");
});

test("a perfect x4 endless run through the World scores exactly endlessScoreCeiling", () => {
  for (const seed of [12345, 777, 98765]) {
    const level = 3;
    const areas = [];
    let prevExit = 9;
    for (let index = 0; index < level; index++) {
      const { data, exit } = generateEndlessLevel({
        id: 4000 + index,
        seed: seed + index * 7919,
        index,
        prevExit,
      });
      prevExit = exit;
      areas.push(data);
    }
    const score = perfectRun(areas);
    assert.ok(score > 0);
    assert.equal(score, endlessScoreCeiling(seed, level), `seed ${seed}`);
    assert.equal(checkEndlessRun({ seed, level, score, seconds: 60 }), null);
    assert.equal(typeof checkEndlessRun({ seed, level, score: score + 1, seconds: 60 }), "string");
  }
});
