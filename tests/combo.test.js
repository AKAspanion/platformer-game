import "./env";
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createEarnings } from "../app/progress/earn";
import Combo, { COMBO_WINDOW, multiplierFor } from "../app/game/combo";
import Effects from "../app/game/effects";
import { settings } from "../app/util/settings";
import { arena, makeWorld, enemy, freeze, tick } from "./helpers";

const plain = () => makeWorld(arena());
/** `n` coins, each `gap` ticks after the last. */
const coins = (world, n, gap = 30) => {
  for (let i = 0; i < n; i++) {
    if (i) tick(world, gap);
    world.scoreCoin();
  }
};

test("multiplierFor: x1 to 4, x2 from 5, x3 from 10, x4 from 20", () => {
  const got = [1, 4, 5, 9, 10, 19, 20, 99].map(multiplierFor);
  assert.deepEqual(got, [1, 1, 2, 2, 3, 3, 4, 4]);
});

test("5 coins 30 ticks apart: combo 5, x2, score 20 x 4 + 40", () => {
  const world = plain();
  coins(world, 5);
  assert.equal(world.combo.count, 5);
  assert.equal(world.combo.multiplier, 2);
  assert.equal(world.score, 120);
});

test("a gap over 2 seconds ends the combo: 4 coins, 61 ticks, a coin is combo 1", () => {
  const world = plain();
  coins(world, 4);
  tick(world, COMBO_WINDOW + 1);
  assert.equal(world.combo.count, 0);
  world.scoreCoin();
  assert.equal(world.combo.count, 1);
  assert.equal(world.score, 100);
});

test("combo 19 and a beetle kill: combo 20, 200 x 4, tier up, chime and combo-up", () => {
  const world = makeWorld(arena({ enemies: [enemy("b", 8, "beetle")] }));
  freeze(world);
  world.combo.count = 19;
  world.combo.multiplier = 3;
  world.combo.left = 30;
  world.events = [];
  world.fireballs.reset();
  const target = world.enemies.items[0];
  target.armor = 0;
  const before = world.score;
  globalThis.__played.length = 0;
  const realNow = Date.now();
  mock.method(Date, "now", () => realNow + 1e6); // clear of the sound repeat gap
  world.killEnemy(target, 1);
  if (!target.dying) world.killEnemy(target, 1); // a second hit if it has armour
  assert.equal(world.combo.count, 20);
  assert.equal(world.combo.multiplier, 4);
  assert.equal(world.score - before, 800);
  assert.ok(world.events.includes("combo-up"));
  assert.ok(globalThis.__played.some((p) => p.endsWith("combo-chime.wav")));
  mock.restoreAll();
});

test("a lost heart ends the combo; a shield block keeps it", () => {
  const world = plain();
  world.combo.count = 12;
  world.combo.best = 12;
  world.combo.multiplier = 3;
  world.combo.left = 40;
  world.player.shield = true;
  world.player.invulnerable = 0;
  world.hurtPlayer(0, () => {});
  assert.equal(world.combo.count, 12);
  world.player.invulnerable = 0;
  world.hurtPlayer(0, () => {});
  assert.equal(world.combo.count, 0);
  assert.equal(world.combo.multiplier, 1);
  assert.equal(world.combo.best, 12);
});

test("falling in a pit ends the combo", () => {
  const world = plain();
  world.combo.count = 7;
  world.fallInPit(() => {});
  assert.equal(world.combo.count, 0);
});

test("a new level starts at combo 0, x1, best 0", () => {
  const world = plain();
  coins(world, 8);
  assert.equal(world.combo.best, 8);
  world.setup(arena());
  assert.equal(world.combo.count, 0);
  assert.equal(world.combo.multiplier, 1);
  assert.equal(world.combo.best, 0);
});

test("the wallet still gets exactly 1 coin per coin collected", () => {
  const world = plain();
  const earnings = createEarnings();
  earnings.tick(world);
  coins(world, 25, 2);
  assert.equal(world.combo.multiplier, 4);
  assert.equal(earnings.tick(world).coins, 25);
});

test("a boss hit that does not kill leaves the combo alone; the kill steps it", () => {
  const combo = new Combo();
  combo.step();
  combo.step();
  const world = plain();
  world.combo.step();
  world.combo.step();
  const boss = {
    hit: () => "hit",
    getCenterX: () => 50,
    getCenterY: () => 50,
    config: {},
  };
  world.boss = boss;
  world.hitBoss(1);
  assert.equal(world.combo.count, 2);
  boss.hit = () => "dead";
  Object.assign(boss, {
    id: "bx",
    name: "X",
    getTop: () => 40,
    config: {},
  });
  world.enemies.items = [];
  world.hitBoss(1);
  assert.equal(world.combo.count, 3);
});

test("Effects.shake(2, 6) offsets by at most 2 px", () => {
  const e = new Effects();
  assert.deepEqual(e.shakeOffset(), { x: 0, y: 0 });
  e.shake(2, 6);
  const { x, y } = e.shakeOffset();
  assert.ok(Math.abs(x) <= 2 && Math.abs(y) <= 2 && (x || y));
});

test("a multiplier going up does not shake the screen", () => {
  const world = plain();
  coins(world, 4, 1);
  world.scoreCoin(); // the 5th: x2
  assert.deepEqual(world.effects.shakeOffset(), { x: 0, y: 0 });
});

test("a kill at x3 or more does not shake the screen", () => {
  const world3 = makeWorld(arena({ enemies: [enemy("p", 8)] }));
  freeze(world3);
  world3.combo.count = 9;
  world3.combo.multiplier = 2;
  world3.combo.step(); // 10: x3
  world3.combo.left = 30;
  world3.killEnemy(world3.enemies.items[0], 1);
  assert.deepEqual(world3.effects.shakeOffset(), { x: 0, y: 0 });
});

test("hit-stop freezes the combo timer", () => {
  const world = plain();
  world.combo.count = 3;
  world.combo.left = 10;
  world.effects.hitStop(8);
  tick(world, 8);
  assert.equal(world.combo.left, 10);
  tick(world, 1);
  assert.equal(world.combo.left, 9);
});

test("a fresh install has Screen shake on", () => {
  assert.equal(settings.get("shake"), true);
});

test("the shell draws the shake offset only with the setting on, and tracks combo_best", () => {
  const src = fs.readFileSync("app/index.js", "utf8");
  assert.match(src, /settings\.get\("shake"\)/);
  assert.match(src, /combo_best/);
  const html = fs.readFileSync("app/index.html", "utf8");
  assert.match(html, /Screen shake/);
});

test("Combo: best is kept when the combo ends; tick counts down to the end", () => {
  const combo = new Combo();
  for (let i = 0; i < 6; i++) combo.step();
  assert.equal(combo.left, COMBO_WINDOW);
  for (let i = 0; i < COMBO_WINDOW; i++) combo.tick();
  assert.equal(combo.count, 0);
  assert.equal(combo.best, 6);
  assert.deepEqual(combo.step(), { count: 1, multiplier: 1, tierUp: false });
});

test("a ghost never touches the combo: only the live world has one", () => {
  const src = fs.readFileSync("app/ghosts/ghost.js", "utf8");
  assert.doesNotMatch(src, /combo/i);
});
