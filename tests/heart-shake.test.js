import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { arena, makeWorld, tick } from "./helpers";

const still = { x: 0, y: 0 };
const plain = () => makeWorld(arena());

/** True for each of the next 6 ticks, then the shake is gone. */
const shakesSixTicks = (world) => {
  // the world is frozen first (hit-stop): nothing moves, then the shake plays in full
  while (world.effects.freeze > 0) {
    assert.deepEqual(world.effects.shakeOffset(), still);
    tick(world, 1);
  }
  for (let i = 0; i < 6; i++) {
    const { x, y } = world.effects.shakeOffset();
    assert.ok(x !== 0 || y !== 0, `tick ${i}`);
    tick(world, 1);
  }
  assert.deepEqual(world.effects.shakeOffset(), still);
};

test("an enemy hit at 3 hearts: 2 hearts left, shakes for 6 ticks", () => {
  const world = plain();
  world.player.hearts = 3;
  world.player.shield = false;
  world.player.invulnerable = 0;
  world.hurtPlayer(0, () => {});
  assert.equal(world.player.hearts, 2);
  shakesSixTicks(world);
});

test("a pit fall at 2 hearts: 1 heart left, shakes for 6 ticks", () => {
  const world = plain();
  world.player.hearts = 2;
  world.player.invulnerable = 0;
  world.fallInPit(() => {});
  assert.equal(world.player.hearts, 1);
  shakesSixTicks(world);
});

test("losing the last heart shakes as the dino dies", () => {
  const world = plain();
  world.player.hearts = 1;
  world.player.invulnerable = 0;
  world.hurtPlayer(0, () => {});
  assert.equal(world.player.hearts, 0);
  assert.notDeepEqual(world.effects.shakeOffset(), still);

  const pit = plain();
  pit.player.hearts = 1;
  pit.player.invulnerable = 0;
  pit.fallInPit(() => {});
  assert.notDeepEqual(pit.effects.shakeOffset(), still);
});

test("a shield-blocked hit loses no heart and does not shake", () => {
  const world = plain();
  world.player.hearts = 3;
  world.player.shield = true;
  world.player.invulnerable = 0;
  world.hurtPlayer(0, () => {});
  assert.equal(world.player.hearts, 3);
  assert.deepEqual(world.effects.shakeOffset(), still);
});

test("a hit during the invulnerable blink does not shake", () => {
  const world = plain();
  world.player.hearts = 3;
  world.player.invulnerable = 10;
  world.hurtPlayer(0, () => {});
  world.fallInPit(() => {});
  assert.equal(world.player.hearts, 3);
  assert.deepEqual(world.effects.shakeOffset(), still);
});

test("combo tiers and kills never shake, but still chime", () => {
  const world = plain();
  const events = [];
  world.emit = (name) => events.push(name);
  for (let i = 0; i < 4; i++) world.scoreCoin();
  world.scoreCoin(); // 5th: x2
  assert.deepEqual(world.effects.shakeOffset(), still);
  assert.ok(events.includes("combo-up"));
  world.combo.count = 9;
  world.scoreCoin(); // 10th: x3
  world.scoreCoin(); // a score at x3
  assert.deepEqual(world.effects.shakeOffset(), still);
});

test("the shell draws no offset with Screen shake off", () => {
  const src = fs.readFileSync("app/index.js", "utf8");
  assert.match(src, /settings\.get\("shake"\)/);
});

test("the screen holds still during hit-stop; the full 6-tick shake plays after it", () => {
  const world = plain();
  world.effects.hitStop(3);
  world.effects.shake(2, 6);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(world.effects.shakeOffset(), still, `frozen tick ${i}`);
    tick(world, 1);
  }
  shakesSixTicks(world);
});

test("a shake with no hit-stop moves the screen for 6 ticks", () => {
  const world = plain();
  world.effects.shake(2, 6);
  shakesSixTicks(world);
});
