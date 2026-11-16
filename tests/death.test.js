import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, enemy, freeze, tick, byId, placePlayer, TILE, GROUND } from "./helpers";
import {
  DEATHS,
  DEATH_KINDS,
  DEATH_TICKS,
  SHATTER_TICK,
  deathPose,
  pitDeath,
  projectileDeath,
  hazardDeath,
} from "../app/game/death";

const PIT = { x: 8 * TILE, y: 170, width: 32, height: 32 };

/** A world on its last heart. */
function lastHeart(data = arena()) {
  const world = makeWorld(data);
  freeze(world);
  world.player.hearts = 1;
  return world;
}

/** Drop the dino into the pit at column 8 on its last heart, and tick once. */
function intoPit(data) {
  const world = lastHeart(data);
  world.player.x = PIT.x + 4;
  world.player.y = 172;
  tick(world, 1);
  return world;
}

/** Hit by a projectile of `kind`, on the last heart. */
function shotBy(kind) {
  const world = lastHeart();
  const { player } = world;
  world.projectiles.add(player.getCenterX(), player.getCenterY(), -1, { kind, vx: 0, vy: 0 });
  tick(world, 1);
  return world;
}

test("every death plays out before the Game Over panel comes up", () => {
  DEATH_KINDS.forEach((kind) => {
    assert.equal(deathPose(kind, DEATH_TICKS + 2).hidden, true, `${kind} is gone`);
    assert.equal(deathPose(kind, 1).hidden, false, `${kind} is seen first`);
  });
});

test("there are eight deaths, each with a motion and frames", () => {
  assert.deepEqual(DEATH_KINDS, [
    "knockout",
    "shot",
    "spiked",
    "burnt",
    "frozen",
    "drown",
    "melt",
    "void",
  ]);
  DEATH_KINDS.forEach((kind) => {
    assert.ok(["fall", "fly", "sink", "still"].includes(DEATHS[kind].motion), kind);
    assert.ok(["dead", "hurt", "hold"].includes(DEATHS[kind].frames), kind);
  });
});

test("projectiles and boss attacks pick their death", () => {
  assert.equal(projectileDeath("icicle"), "frozen");
  assert.equal(projectileDeath("shard"), "frozen");
  assert.equal(projectileDeath("missile"), "burnt");
  ["seed", "sand", "orb", "mud", "glob", "spit", "pebble"].forEach((kind) =>
    assert.equal(projectileDeath(kind), "shot", kind),
  );
  assert.equal(hazardDeath("laser"), "burnt");
  assert.equal(hazardDeath("blast"), "burnt");
  assert.equal(hazardDeath("tongue"), "knockout");
});

test("a pit is water, spikes, acid or bottomless, by what is drawn in it", () => {
  const rows = 12;
  const empty = () => Array.from({ length: rows }, () => new Array(21).fill(0));
  const area = { rows, map: empty(), objects: empty(), theme: "grasslands" };
  assert.equal(pitDeath(3, { ...area, water: [{ x: 48, width: 16 }] }), "drown");
  assert.equal(pitDeath(3, area), "void");

  const spikes = empty();
  spikes[rows - 1][3] = [{ id: 15 }];
  assert.equal(pitDeath(3, { ...area, objects: spikes }), "spiked");

  const acid = empty();
  acid[rows - 2][3] = 16;
  assert.equal(pitDeath(3, { ...area, map: acid, theme: "lab" }), "melt");
  assert.equal(pitDeath(3, { ...area, map: acid }), "void", "tile 16 is acid only in the factory");
});

test("an enemy knocks the dino out: flung away, spinning, through the ground", () => {
  const world = lastHeart(arena({ enemies: [enemy("pig", 6)] }));
  placePlayer(world, byId(world, "pig").x - 8); // left of the pig
  tick(world, 1);
  const { player } = world;
  assert.equal(world.isPlayerDead, true);
  assert.equal(player.deathKind, "knockout");
  assert.equal(player.deathDir, -1, "flung away from the pig");
  assert.ok(player.velocityY < 0, "flung up");
  assert.ok(player.velocityX < 0, "flung left");
  assert.notEqual(deathPose("knockout", 10, -1).rotation, 0, "spinning");

  tick(world, 40);
  assert.ok(player.getTop() > world.height, "fell through the ground and off the screen");
});

test("a seed shot knocks the dino over where it stands", () => {
  const world = shotBy("seed");
  const { player } = world;
  assert.equal(player.deathKind, "shot");
  tick(world, 30);
  assert.ok(Math.abs(player.getBottom() - GROUND * TILE) < 1, "lies on the ground");
});

test("an icicle freezes the dino still, then it shatters", () => {
  const world = shotBy("icicle");
  const { player } = world;
  assert.equal(player.deathKind, "frozen");
  const at = { x: player.x, y: player.y };
  tick(world, SHATTER_TICK - 2);
  assert.deepEqual({ x: player.x, y: player.y }, at, "frozen in place");
  assert.equal(deathPose("frozen", SHATTER_TICK - 1).hidden, false);
  const before = world.effects.particles.length;
  tick(world, 2);
  assert.ok(world.effects.particles.length > before + 10, "shattered into ice");
  assert.equal(deathPose("frozen", SHATTER_TICK).hidden, true);
});

test("a missile burns the dino, and it smokes", () => {
  const world = shotBy("missile");
  assert.equal(world.player.deathKind, "burnt");
  assert.ok(deathPose("burnt", 10).tintAmount > 0.5, "charred");
});

test("a spike trap spikes the dino", () => {
  // on a raised block: a trap this low on the screen would count as a pit
  const top = GROUND - 2;
  const trap = { x: 5 * TILE + 3, y: top * TILE - 7, width: 10, height: 7 };
  const world = lastHeart(arena({ death: [trap], walls: [{ col: 5, top }] }));
  placePlayer(world, 5 * TILE + 2, 1, top);
  tick(world, 1);
  assert.equal(world.player.deathKind, "spiked");
  assert.ok(world.player.velocityY < 0, "popped up");
});

test("a water pit drowns the dino: it sinks, bubbling", () => {
  const data = arena({ death: [PIT] });
  data.water = [8, 9].map((left) => ({ left, top: 10 }));
  const world = intoPit(data);
  const { player } = world;
  assert.equal(player.deathKind, "drown");
  const y = player.y;
  tick(world, 10);
  assert.ok(player.y > y, "sinking");
  assert.ok(player.y - y < 10, "slowly");
});

test("a bottomless pit is the void: it shrinks away", () => {
  const world = intoPit(arena({ death: [PIT] }));
  assert.equal(world.player.deathKind, "void");
  assert.ok(deathPose("void", 20).scaleX < 0.5, "shrinking");
});

test("an acid pit melts the dino flat", () => {
  const data = arena({ death: [PIT] });
  data.theme = "lab";
  data.areaMap[10][8] = 16;
  data.areaMap[10][9] = 16;
  const world = intoPit(data);
  assert.equal(world.player.deathKind, "melt");
  const pose = deathPose("melt", 20);
  assert.ok(pose.scaleY < 0.5 && pose.scaleX > 1, "melted flat");
});

test("a fresh run forgets how the dino died", () => {
  const world = shotBy("icicle");
  world.reset();
  world.player.reset();
  assert.equal(world.player.deathKind, null);
  assert.equal(world.player.deadTimer, 0);
});
