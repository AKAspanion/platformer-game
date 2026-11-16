import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, placePlayer, tick, tickUntil, TILE, GROUND } from "./helpers";
import Controller from "../app/controller";
import { CONTROL_IDS } from "../app/controller/layout";
import { helpItemsFor } from "../app/util";
import areas from "../app/areas";

const LEDGE = GROUND - 2; // a floating one-way ledge, two rows above the ground (one jump)

/** The arena with a floating ledge over columns 1-6, the dino standing on it. */
function onLedge() {
  const data = arena();
  for (let c = 1; c <= 6; c++) {
    data.areaMap[LEDGE][c] = 14;
    data.collisonMap[LEDGE][c] = "t";
  }
  const world = makeWorld(data);
  placePlayer(world, 3 * TILE, 1, LEDGE);
  tick(world, 2);
  return world;
}

const standingOn = (world, row) =>
  world.player.grounded && Math.abs(world.player.getBottom() - row * TILE) < 0.1;

test("down on a floating ledge drops the dino through to the ground below", () => {
  const world = onLedge();
  assert.ok(standingOn(world, LEDGE), "starts on the ledge");

  assert.equal(world.dropThrough(), true);
  const ticks = tickUntil(world, () => standingOn(world, GROUND));
  assert.ok(ticks > 0, "lands on the ground");
});

test("down on the ground does nothing: there is nowhere to land below it", () => {
  const world = makeWorld(arena());
  tick(world, 2);

  assert.equal(world.dropThrough(), false);
  tick(world, 20);
  assert.ok(standingOn(world, GROUND));
});

test("down in the air does nothing", () => {
  const world = onLedge();
  world.player.jump();
  tick(world, 2);

  assert.equal(world.dropThrough(), false);
});

test("a dropped dino lands on the same ledge again after jumping back up", () => {
  const world = onLedge();
  world.dropThrough();
  tickUntil(world, () => standingOn(world, GROUND));

  world.player.jump();
  // up through the one-way ledge from below, then down onto it
  const ticks = tickUntil(world, () => standingOn(world, LEDGE), 60);
  assert.ok(ticks > 0, "lands on the ledge, not through it");
});

test("down needs room: no drop onto a ledge right under the one you stand on", () => {
  const data = arena();
  for (let c = 1; c <= 6; c++) {
    data.collisonMap[GROUND - 1][c] = "t";
    data.areaMap[GROUND - 1][c] = 2;
  }
  const world = makeWorld(data);
  placePlayer(world, 3 * TILE, 1, GROUND - 1);
  tick(world, 2);

  assert.equal(world.dropThrough(), false);
});

test("the screen's bottom edge is never a floor: reaching it is falling in a pit", () => {
  const data = arena();
  // a hole in the ground with no pit hazard under it
  for (let c = 6; c <= 8; c++) {
    for (let r = GROUND; r < data.areaMap.length; r++) {
      data.areaMap[r][c] = 0;
      data.collisonMap[r][c] = "";
    }
  }
  const world = makeWorld(data);
  tick(world, 12); // long enough on the ground to be remembered as safe
  const { player } = world;
  const hearts = player.hearts;
  player.x = player.xOld = 7 * TILE;

  let lowest = 0;
  tickUntil(world, () => {
    lowest = Math.max(lowest, player.getBottom());
    return player.hearts < hearts;
  });
  assert.equal(player.hearts, hearts - 1, "a heart lost, as in a pit");
  assert.ok(player.x < 6 * TILE, `back on safe ground, at x ${player.x}`);
  tick(world, 30);
  assert.ok(player.getBottom() < world.height, "not standing on the bottom edge");
});

test("Iceland 2: knocked off the drop into a column with no floor, the dino never stands on the edge", () => {
  // dropping off the left ledge here lands on a chameleon that knocks the dino
  // under the cave floor's corner, a column with nothing below
  const world = makeWorld(areas[8]);
  placePlayer(world, 96, 1, 5);
  world.player.hearts = 99;
  tick(world, 3);
  assert.equal(world.dropThrough(), true);
  for (let i = 0; i < 150; i++) {
    tick(world);
    assert.ok(
      !(world.player.grounded && world.player.getBottom() >= world.height),
      `tick ${i}: standing on the bottom edge at x ${world.player.x}`,
    );
  }
});

test("↓ and S are the down key", () => {
  for (const keyCode of [40, 83]) {
    const controller = new Controller();
    controller.keyDownUp("keydown", keyCode);
    assert.equal(controller.down.active, true, `key ${keyCode}`);
    controller.keyDownUp("keyup", keyCode);
    assert.equal(controller.down.down, false, `key ${keyCode}`);
  }
});

test("releasing all controls lets go of down too", () => {
  const controller = new Controller();
  controller.keyDownUp("keydown", 40);
  controller.releaseAll();
  assert.equal(controller.down.down, false);
  assert.equal(controller.down.active, false);
});

test("the down button is a touch control that can be moved", () => {
  assert.ok(CONTROL_IDS.includes("downBtn"));
});

test("Help explains dropping down, on touch and on keyboard", () => {
  for (const touch of [true, false]) {
    const texts = helpItemsFor(touch).flatMap((s) =>
      s.content.flatMap(({ items }) => items.map((i) => i.text)),
    );
    assert.ok(
      texts.some((t) => /drop/.test(t)),
      `${touch ? "touch" : "keyboard"} help: ${texts.join(", ")}`,
    );
  }
});
