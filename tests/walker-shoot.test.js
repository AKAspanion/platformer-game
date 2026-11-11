import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import { registerEnemyType, enemyTypes } from "../app/game/enemies";
import {
  arena,
  makeWorld,
  enemy,
  freeze,
  tick,
  tickUntil,
  byId,
  placePlayer,
  TILE,
  GROUND,
} from "./helpers";

const shooter = (type = "pig", extra = {}) => ({ ...enemy("w1", 5, type), shoots: true, ...extra });

/** A world with one shooting walker at tile 5, facing right, player `dx` px in front of it. */
function setup({ type = "pig", dx = 80, dy = 0, shoots = true, id } = {}) {
  const data = arena({ enemies: [shooter(type, { shoots })] });
  if (id) data.id = id;
  const world = makeWorld(data);
  freeze(world);
  const walker = byId(world, "w1");
  walker.direction = 1;
  placePlayer(world, walker.getCenterX() + dx - world.player.width / 2);
  world.player.y -= dy;
  world.player.yOld = world.player.y;
  return { world, walker };
}

const shots = (world) => world.projectiles.items;

test("a pig that sees the player at 80 px aims for 15 ticks, then fires one mud, then waits 90", () => {
  const { world, walker } = setup();
  tick(world, 1);
  assert.equal(walker.state, "aim");
  tick(world, 14);
  assert.equal(walker.state, "aim");
  assert.equal(shots(world).length, 0);
  tick(world, 1);
  assert.equal(shots(world).length, 1);
  assert.equal(shots(world)[0].kind, "mud");
  assert.ok(shots(world)[0].vx > 0, "toward the player");
  assert.notEqual(walker.state, "aim");
});

test("the next shot comes no sooner than 90 ticks after the last", () => {
  const { world, walker } = setup();
  let firstShot = -1;
  let secondShot = -1;
  for (let i = 0; i < 300; i++) {
    world.player.hearts = 99;
    placePlayer(world, walker.getCenterX() + 80 - world.player.width / 2);
    world.projectiles.items.length = 0; // count shots only
    tick(world, 1);
    if (world.projectiles.items.length > 0) {
      if (firstShot < 0) firstShot = i;
      else if (secondShot < 0) secondShot = i;
    }
  }
  assert.ok(firstShot >= 0 && secondShot >= 0);
  assert.ok(secondShot - firstShot >= 90, `gap ${secondShot - firstShot}`);
});

test("closer than 52 px the pig lunges and fires nothing", () => {
  const { world, walker } = setup({ dx: 40 });
  tick(world, 1);
  assert.equal(walker.state, "windup");
  tick(world, 40);
  assert.equal(shots(world).length, 0);
});

test("out of range, off the height band or behind: nothing happens", () => {
  for (const options of [{ dx: 125 }, { dx: 80, dy: 30 }, { dx: -80 }]) {
    const { world, walker } = setup(options);
    for (let i = 0; i < 30; i++) {
      placePlayer(world, walker.getCenterX() + options.dx - world.player.width / 2);
      world.player.y -= options.dy || 0;
      world.player.yOld = world.player.y;
      tick(world, 1);
    }
    assert.equal(walker.state, "patrol", JSON.stringify(options));
    assert.equal(shots(world).length, 0, JSON.stringify(options));
  }
});

test("a pig without shoots never fires", () => {
  const { world, walker } = setup({ shoots: false });
  tick(world, 60);
  assert.equal(walker.state, "patrol");
  assert.equal(shots(world).length, 0);
});

test("slime, chameleon and beetle fire glob, spit and pebble", () => {
  for (const [type, kind] of [
    ["slime", "glob"],
    ["chameleon", "spit"],
    ["beetle", "pebble"],
  ]) {
    const { world } = setup({ type });
    const took = tickUntil(world, () => shots(world).length > 0, 40);
    assert.notEqual(took, -1, type);
    assert.equal(shots(world)[0].kind, kind);
  }
});

test("a walker shot costs the player a heart; a fireball burns it", () => {
  const { world, walker } = setup();
  tickUntil(world, () => shots(world).length > 0, 40);
  const hearts = world.player.hearts;
  const shot = shots(world)[0];
  shot.x = world.player.x;
  shot.y = world.player.y + 4;
  tick(world, 1);
  assert.equal(world.player.hearts, hearts - 1);
  assert.equal(shots(world).length, 0);

  // burn
  const second = setup();
  tickUntil(second.world, () => shots(second.world).length > 0, 40);
  const mud = shots(second.world)[0];
  mud.x = 250; // well away from the walker and the player
  mud.vx = 0;
  mud.y = (GROUND - 3) * TILE;
  mud.vy = 0;
  mud.gravity = 0;
  second.world.fireballs.add("f", mud.x - 20, mud.y - 4, 1);
  second.world.events = [];
  tick(second.world, 1);
  assert.ok(second.world.events.includes("burn"));
  assert.equal(shots(second.world).length, 0);
  assert.equal(second.world.fireballs.items.length, 0);
});

test("story areas: shooting follows position and difficulty", () => {
  // area 10 is difficulty 3: a walker at left 3 is within 120 px of the arrival
  const near = makeWorld(arena({ enemies: [enemy("n", 3), enemy("f", 10)] }), { col: 2 });
  assert.equal(near.enemies.items.length, 2);
  const make = (id) => {
    const data = arena({ enemies: [enemy("n", 3), enemy("f", 10)] });
    data.id = id;
    return makeWorld(data);
  };
  const hard = make(10);
  assert.equal(byId(hard, "n").shoots, false);
  assert.equal(byId(hard, "f").shoots, true);
  // an unlisted (hand-made, difficulty 1) area never shoots
  const easy = make(1);
  assert.equal(byId(easy, "f").shoots, false);
});

test("every walker in Grassland 1 stays a lunger", () => {
  const world = makeWorld(areas[1]);
  const walkers = world.enemies.items.filter((e) => e.kind === "walker");
  assert.ok(walkers.length > 0);
  assert.ok(walkers.every((e) => !e.shoots));
});

test("a community walker's glob carries its creature's colours", () => {
  registerEnemyType(
    "commwalker",
    {
      kind: "walker",
      maxV: 0.5,
      minV: 0.3,
      delay: 3,
      width: 20,
      height: 19,
      walk: 1,
      colors: ["#ff00aa", "#00ffaa"],
    },
    { left: [], right: [], deadLeft: [], deadRight: [] },
  );
  const { world } = setup({ type: "commwalker" });
  tickUntil(world, () => shots(world).length > 0, 40);
  assert.equal(shots(world)[0].kind, "glob");
  assert.deepEqual(shots(world)[0].colors, enemyTypes.commwalker.colors);
});

test("a ghost replay changes nothing in a level with shooters", async () => {
  const { ghostAt } = await import("../app/ghosts/ghost");
  const { world } = setup();
  tick(world, 3);
  const before = JSON.stringify({
    p: world.player.hearts,
    e: world.enemies.items.map((e) => [e.x, e.state]),
    s: shots(world).length,
  });
  const ghost = { id: 10, seconds: 3, frames: [] };
  try {
    ghostAt(ghost, world.areaTicks);
  } catch {
    /* an empty ghost may not replay; the point is that the world is untouched */
  }
  const after = JSON.stringify({
    p: world.player.hearts,
    e: world.enemies.items.map((e) => [e.x, e.state]),
    s: shots(world).length,
  });
  assert.equal(after, before);
});

test("every walker shot reaches a player standing 52-120 px away on flat ground", () => {
  for (const type of ["pig", "chameleon", "beetle", "slime"]) {
    for (const dx of [53, 70, 90, 105, 120]) {
      const { world } = setup({ type, dx });
      const took = tickUntil(world, () => shots(world).length > 0, 40);
      assert.notEqual(took, -1, `${type} at ${dx} px fires`);
      const shot = shots(world)[0];
      const hearts = world.player.hearts;
      // the shot is in the air above the floor when it gets to the player's x
      for (let i = 0; i < 80 && world.player.hearts === hearts; i++) {
        tick(world, 1);
        assert.ok(shot.getBottom() <= GROUND * TILE, `${type} at ${dx} px sank into the floor`);
      }
      assert.equal(world.player.hearts, hearts - 1, `${type} at ${dx} px hits the player`);
    }
  }
});
