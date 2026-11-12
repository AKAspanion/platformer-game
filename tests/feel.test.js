import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, placePlayer, tick, tickUntil, TILE, GROUND } from "./helpers";
import Smoother from "../app/engine/smooth";
import GameEngine from "../app/engine";

// What the shell does with the jump button on every tick, before the world updates.
const step = (world, { held = true } = {}) => {
  const { player } = world;
  const jumped = player.takeJump();
  if (!held) player.releaseJump();
  world.update(() => {});
  return jumped;
};

const groundY = GROUND * TILE;

/** Pixels the player rises from a standing jump, holding jump for `holdTicks` ticks. */
function jumpRise(holdTicks) {
  const world = makeWorld(arena());
  const { player } = world;
  tick(world, 1); // settle on the ground
  const startY = player.y;
  let top = startY;
  player.queueJump();
  for (let t = 0; t < 30; t++) {
    step(world, { held: t < holdTicks });
    top = Math.min(top, player.y);
    if (player.grounded && t > 0) break;
  }
  return startY - top;
}

// --------------------------------------------------------------- jump height

test("holding jump gives the full jump the level generator plans for (2.7 tiles)", () => {
  assert.ok(jumpRise(30) >= 2.7 * TILE, `rose ${jumpRise(30)} px`);
});

test("a quick tap jumps lower than a held jump, but still clears a tile", () => {
  const full = jumpRise(30);
  const tap = jumpRise(0);
  assert.ok(tap < full - TILE * 0.5, `tap ${tap} px vs held ${full} px`);
  assert.ok(tap > TILE, `tap ${tap} px`);
});

test("letting go later jumps higher than letting go sooner", () => {
  const rises = [0, 1, 2, 3].map(jumpRise);
  for (let i = 1; i < rises.length; i++) {
    assert.ok(rises[i] > rises[i - 1], `rises ${rises.join(", ")}`);
  }
});

test("a knockback is not cut short by letting go of jump", () => {
  const world = makeWorld(arena());
  const { player } = world;
  tick(world, 1);
  player.damage(player.getCenterX() + 10);
  const vy = player.velocityY;
  player.releaseJump();
  world.update(() => {});
  assert.ok(Math.abs(player.velocityY - (vy + world.gravity) * world.friction) < 1e-9);
});

// --------------------------------------------------------------- jump buffer

/** A player falling from `height` px above the ground, after a jump. */
function falling(height) {
  const world = makeWorld(arena());
  const { player } = world;
  player.y = player.yOld = groundY - player.height - height;
  player.jumping = true;
  player.grounded = false;
  return world;
}

test("a jump pressed just before landing happens on landing", () => {
  const world = falling(40);
  const { player } = world;
  tickUntil(world, () => groundY - player.getBottom() < 8, 30);
  assert.equal(player.grounded, false, "still in the air when pressed");
  player.queueJump();
  let jumped = false;
  for (let t = 0; t < 5 && !jumped; t++) jumped = step(world);
  assert.equal(jumped, true);
  assert.ok(player.velocityY < 0, "going up");
});

test("a jump pressed long before landing is forgotten", () => {
  const world = falling(60);
  const { player } = world;
  player.queueJump();
  let jumped = false;
  for (let t = 0; t < 20; t++) jumped = step(world) || jumped;
  assert.equal(jumped, false);
  assert.equal(player.grounded, true);
});

// --------------------------------------------------------------- coyote time

/** The player walks right off a pillar; returns the world on the first tick in the air. */
function walkOffLedge() {
  const top = GROUND - 3;
  const world = makeWorld(arena({ walls: [{ col: 6, top }] }));
  const { player } = world;
  placePlayer(world, 6 * TILE + 2, 1, top);
  tick(world, 1);
  assert.equal(player.grounded, true, "standing on the pillar");
  const ticks = tickUntil(
    world,
    () => {
      player.moveRight();
      return !player.grounded;
    },
    60,
  );
  assert.ok(ticks > 0, "walked off");
  return world;
}

test("a jump just after walking off a ledge still works", () => {
  const world = walkOffLedge();
  tick(world, 2);
  world.player.queueJump();
  assert.equal(world.player.takeJump(), true);
  assert.ok(world.player.velocityY < 0);
});

test("a jump long after walking off a ledge does nothing (without wings)", () => {
  const world = walkOffLedge();
  tick(world, 5);
  assert.equal(world.player.grounded, false, "still falling");
  assert.equal(world.player.jump(), false);
});

// --------------------------------------------------------------- smooth drawing

test("a frame between ticks draws a moving object part of the way along", () => {
  const smoother = new Smoother();
  const enemy = { x: 10, y: 20 };
  smoother.snapshot([enemy]);
  enemy.x = 14;
  enemy.y = 24;
  smoother.apply([enemy], 0.5);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, { x: 12, y: 22 });
  smoother.restore();
  assert.deepEqual({ x: enemy.x, y: enemy.y }, { x: 14, y: 24 }, "back where the game has it");
});

test("an object that jumped across the screen (a portal) is drawn where it is", () => {
  const smoother = new Smoother();
  const player = { x: 10, y: 20 };
  smoother.snapshot([player]);
  player.x = 200;
  smoother.apply([player], 0.5);
  assert.equal(player.x, 200);
  smoother.restore();
});

test("an object with no earlier position is drawn where it is", () => {
  const smoother = new Smoother();
  smoother.snapshot([]);
  const fireball = { x: 50, y: 60 };
  smoother.apply([fireball], 0.25);
  assert.deepEqual({ x: fireball.x, y: fireball.y }, { x: 50, y: 60 });
  smoother.restore();
});

test("the engine draws every frame, with how far it is into the next tick", () => {
  let frame = null;
  let now = 0;
  globalThis.window = {
    requestAnimationFrame: (fn) => {
      frame = fn;
      return 1;
    },
    cancelAnimationFrame: () => {},
    performance: { now: () => now },
  };
  const step = 1000 / 30;
  let updates = 0;
  const alphas = [];
  const engine = new GameEngine(
    step,
    () => updates++,
    (alpha) => alphas.push(alpha),
  );
  engine.start();
  // frames closer together than a tick, as on a 60-120 Hz screen
  [step * 0.5, step * 1.25, step * 1.75].forEach((t) => frame(t));
  assert.equal(updates, 2);
  assert.equal(alphas.length, 3, "drawn on the frame without a tick too");
  [0.5, 0.25, 0.75].forEach((want, i) => assert.ok(Math.abs(alphas[i] - want) < 1e-6, `${alphas}`));
});
