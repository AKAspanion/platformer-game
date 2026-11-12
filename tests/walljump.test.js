import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, placePlayer, tick, TILE, GROUND } from "./helpers";
import { JUMP_SPEED } from "../app/game/player";

const WALL_COL = 10;

/** The player in the air just left of a tall wall, after a jump. */
function besideWall() {
  const world = makeWorld(arena({ walls: [{ col: WALL_COL, top: 2 }] }));
  const { player } = world;
  player.x = player.xOld = WALL_COL * TILE - player.width - 0.01;
  player.y = player.yOld = 4 * TILE;
  player.velocityX = player.velocityY = 0;
  player.jumping = true;
  player.grounded = false;
  return world;
}

/** Ticks with right held (into the wall). */
const pushRight = (world, ticks) => {
  for (let i = 0; i < ticks; i++) {
    world.player.moveRight();
    world.update(() => {});
  }
};

/** Pixels the player falls in one more tick (pushing right or not). */
const fallOneTick = (world, push) => {
  const before = world.player.y;
  if (push) world.player.moveRight();
  world.update(() => {});
  return world.player.y - before;
};

test("pushing into a wall while falling slides down it slowly", () => {
  const world = besideWall();
  pushRight(world, 8);
  assert.equal(world.player.wallSliding, true);
  const fell = fallOneTick(world, true);
  assert.ok(fell > 0 && fell <= 3.1, `fell ${fell} px in a tick`);
});

test("falling beside a wall without pushing into it is a normal fall", () => {
  const world = besideWall();
  tick(world, 8);
  assert.equal(world.player.wallSliding, false);
  assert.ok(fallOneTick(world, false) > 4);
});

test("a jump while sliding on a wall jumps up and away from it", () => {
  const world = besideWall();
  const { player } = world;
  pushRight(world, 8);
  player.queueJump();
  assert.equal(player.takeJump(), true);
  assert.ok(player.velocityY < 0, "up");
  assert.ok(player.velocityX < 0, "away from the wall");
  assert.equal(player.direction, -1, "facing away from the wall");
});

test("right after a wall jump, pushing back toward the wall doesn't stop the push away", () => {
  const world = besideWall();
  const { player } = world;
  pushRight(world, 8);
  player.queueJump();
  player.takeJump();
  pushRight(world, 4);
  assert.ok(player.velocityX < 0, `vx ${player.velocityX}`);
  assert.ok(player.getRight() < WALL_COL * TILE - 4, "left the wall");
});

test("a wall jump still works a moment after letting go of the wall", () => {
  const world = besideWall();
  const { player } = world;
  pushRight(world, 8);
  tick(world, 2);
  assert.equal(player.jump(), true);
  assert.ok(player.velocityX < 0, "away from the wall");
});

test("a wall jump doesn't work long after letting go of the wall", () => {
  const world = besideWall();
  const { player } = world;
  pushRight(world, 8);
  tick(world, 5);
  assert.equal(player.grounded, false, "still in the air");
  assert.equal(player.jump(), false);
});

test("on the ground beside a wall, a jump is a normal jump", () => {
  const world = makeWorld(arena({ walls: [{ col: WALL_COL, top: 2 }] }));
  const { player } = world;
  placePlayer(world, WALL_COL * TILE - player.width - 0.01);
  pushRight(world, 2);
  assert.equal(player.grounded, true);
  assert.equal(player.jump(), true);
  assert.equal(player.velocityY, -JUMP_SPEED);
  assert.ok(player.velocityX >= 0, "not pushed off the wall");
  assert.ok(player.getBottom() <= GROUND * TILE);
});
