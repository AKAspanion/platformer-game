import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, placePlayer, tick, TILE, GROUND } from "./helpers";

/**
 * Dirt is background, as in the hand-made levels: a jump that clears a block's top goes
 * in front of its wall and lands on it; anything else meets the wall, so the dino never
 * sinks into dirt with nothing under it.
 */
const FACE = 8 * TILE; // the block's left face
const blockWorld = (height) => {
  // a wide block, columns 8 to 14, so the dino stays on it once up
  const walls = [8, 9, 10, 11, 12, 13, 14].map((col) => ({ col, top: GROUND - height }));
  const world = makeWorld(arena({ walls }));
  placePlayer(world, FACE - world.player.width - 1); // running at the wall, a px short
  world.player.velocityX = 3;
  return world;
};

/** Jump at the wall and run on until on top or 40 ticks; returns if it went in front. */
const jumpAt = (world, { release = Infinity } = {}) => {
  const { player } = world;
  const top = (GROUND - 2) * TILE;
  player.jump();
  let inFront = false;
  for (let i = 0; i < 40; i++) {
    if (i === release) player.releaseJump();
    if (!(player.grounded && player.getBottom() <= top + 1)) player.moveRight();
    tick(world);
    if (player.getRight() > FACE + 1 && player.getBottom() > top + 1) inFront = true;
  }
  return inFront;
};

test("a jump that clears a block's top goes in front of its wall and lands on it", () => {
  const world = blockWorld(2);
  const { player } = world;
  const went = jumpAt(world);
  assert.ok(went, "passed in front of the dirt below its top");
  assert.equal(Math.round(player.getBottom() / TILE), GROUND - 2, "standing on the block");
  assert.equal(world.respawns, 0);
});

test("a wall too tall to clear holds: the dino never goes into its dirt", () => {
  const world = blockWorld(4);
  const { player } = world;
  player.jump();
  for (let i = 0; i < 40; i++) {
    player.moveRight();
    tick(world);
    assert.ok(player.getRight() <= FACE, `tick ${i}: outside the wall`);
  }
  assert.equal(Math.round(player.getBottom() / TILE), GROUND, "back on the ground");
});

test("walking into a block meets its wall", () => {
  const world = blockWorld(2);
  const { player } = world;
  for (let i = 0; i < 30; i++) {
    player.moveRight();
    tick(world);
  }
  assert.ok(player.getRight() <= FACE);
  assert.equal(Math.round(player.getBottom() / TILE), GROUND);
});

test("a jump cut short in front of the dirt puts the dino back outside its wall", () => {
  const world = blockWorld(2);
  const { player } = world;
  const went = jumpAt(world, { release: 1 });
  assert.ok(went, "it did go in front before the jump was cut");
  assert.equal(world.respawns, 0, "never sank into the dirt");
  const onTop = Math.round(player.getBottom() / TILE) === GROUND - 2;
  assert.ok(onTop || player.getRight() <= FACE, "on the block, or outside its wall");
  if (!onTop) assert.equal(Math.round(player.getBottom() / TILE), GROUND, "on the ground");
});
