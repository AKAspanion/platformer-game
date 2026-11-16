import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { arena, makeWorld, tick, TILE, GROUND, COLS } from "./helpers";
import Ground, { floorFor, FLOORS, SLIPPERY, EDGE_INSET } from "../app/game/floor";
import Boss from "../app/game/boss";
import { floorOf } from "../app/gen";
import { normalizeWorldSpec } from "../app/worlds/spec";

const iceArena = () => ({ ...arena(), world: 2, theme: "iceland" });

/** Run right for `ticks`, let go, and return { top, slide }: top speed and px slid after. */
function runAndStop(data, ticks = 30) {
  const world = makeWorld(data);
  const { player } = world;
  tick(world, 1);
  let top = 0;
  for (let t = 0; t < ticks; t++) {
    player.moveRight();
    world.update(() => {});
    top = Math.max(top, Math.abs(player.velocityX));
  }
  const from = player.x;
  tick(world, 60);
  return { top, slide: player.x - from };
}

// ----------------------------------------------------------------- slippery

test("Iceland is the slippery world; the others are not", () => {
  assert.equal(floorFor({ world: 2 }).slippery, true);
  [1, 3, 4, 5].forEach((world) => assert.equal(floorFor({ world }).slippery, false, `${world}`));
  assert.equal(makeWorld(iceArena()).player.slippery, true);
  assert.equal(makeWorld(arena()).player.slippery, false);
});

test("on slippery ground the dino slides a little further, at about the same top speed", () => {
  const normal = runAndStop(arena());
  const ice = runAndStop(iceArena());
  assert.ok(ice.slide > normal.slide * 1.2, `slid ${ice.slide} px on ice vs ${normal.slide} px`);
  assert.ok(ice.slide < normal.slide * 2, `only a little: ${ice.slide} vs ${normal.slide} px`);
  assert.ok(Math.abs(ice.top - normal.top) < 0.3, `top speed ${ice.top} vs ${normal.top}`);
});

test("slippery ground doesn't change a jump: in the air the dino moves as anywhere else", () => {
  const air = (data) => {
    const world = makeWorld(data);
    const { player } = world;
    tick(world, 1);
    player.queueJump();
    player.takeJump();
    const from = player.x;
    for (let t = 0; t < 8; t++) {
      player.moveRight();
      world.update(() => {});
    }
    return player.x - from;
  };
  assert.equal(air(iceArena()), air(arena()));
});

test("the slippery settings keep top speed close to normal ground's", () => {
  const top = (accel, friction) => (accel * friction) / (1 - friction);
  assert.ok(Math.abs(top(SLIPPERY.accel, SLIPPERY.friction) - top(0.5, 0.87)) < 0.2);
});

// ---------------------------------------------------------------- texture

const flatMap = () => arena().collisonMap;
const strandsNear = (ground, x) => ground.strandsAt(GROUND, x - 2, x + 2);

test("every world but the factory has a floor texture on its open tops", () => {
  [1, 2, 3, 4].forEach((world) => {
    const ground = new Ground(flatMap(), floorFor({ world }), TILE, 1);
    assert.ok(ground.strands.length > 0, `world ${world}`);
    assert.ok(
      ground.strands.every((s) => s.y === GROUND * TILE),
      "strands stand on the ground's top",
    );
  });
  const factory = new Ground(flatMap(), floorFor({ world: 5 }), TILE, 1);
  assert.equal(factory.strands.length, 0, "the factory floor is clean metal");
  assert.equal(factory.step({ left: 80, right: 90, bottom: GROUND * TILE }), 0);
});

test("a top with ground right on top of it gets no texture", () => {
  const map = flatMap();
  map[GROUND - 1][5] = "tlr";
  const ground = new Ground(map, floorFor({ world: 1 }), TILE, 1);
  assert.equal(ground.strandsAt(GROUND, 5 * TILE, 6 * TILE - 1).length, 0);
  assert.ok(ground.strandsAt(GROUND - 1, 5 * TILE, 6 * TILE - 1).length > 0);
});

test("the dino presses the floor under its feet, and it springs back after", () => {
  const world = makeWorld(arena(), { col: 5 });
  tick(world, 2);
  const under = strandsNear(world.ground, world.player.getCenterX());
  assert.ok(under.length > 0);
  assert.ok(
    under.every((s) => s.press > 0.9),
    "flattened under the feet",
  );

  world.player.x = world.player.xOld = 15 * TILE; // step away
  tick(world, 60);
  assert.ok(
    under.every((s) => s.press === 0 && s.lean === 0),
    "grass is back up once the dino has gone",
  );
});

test("snow footprints linger longer than grass", () => {
  const leftAfter = (world) => {
    const ground = new Ground(flatMap(), floorFor({ world }), TILE, 1);
    ground.step({ left: 80, right: 90, bottom: GROUND * TILE });
    for (let t = 0; t < 30; t++) ground.update();
    return Math.max(...ground.strandsAt(GROUND, 80, 90).map((s) => s.press));
  };
  assert.ok(leftAfter(2) > 0.5, "a snow print is still there after a second");
  assert.equal(leftAfter(1), 0, "grass is already back");
});

test("blades just past the feet are pushed aside, not flattened", () => {
  const ground = new Ground(flatMap(), floorFor({ world: 1 }), TILE, 1);
  ground.step({ left: 80, right: 90, bottom: GROUND * TILE, spread: 6 });
  const beside = ground.strands.filter((s) => s.press > 0 && s.press < 1);
  const rightSide = (s) => s.x > 85;
  assert.ok(beside.some(rightSide) && !beside.every(rightSide), "both sides");
  beside.forEach((s) => assert.ok(rightSide(s) ? s.lean > 0 : s.lean < 0, `${s.x} leans away`));
  ground.strandsAt(GROUND, 81, 89).forEach((s) => assert.equal(s.press, 1));
});

test("enemies walking the floor leave it alone", () => {
  const world = makeWorld(
    arena({ enemies: [{ id: "e1", type: "pig", left: 12, top: GROUND - 1, sway: 32, dir: 1 }] }),
    { col: 2 },
  );
  world.player.x = world.player.xOld = 1; // far from the pig
  tick(world, 40);
  const pig = world.enemies.items[0];
  const under = world.ground.strandsAt(GROUND, pig.getLeft(), pig.getRight());
  assert.ok(under.length > 0);
  assert.ok(under.every((s) => s.press === 0));
});

test("a boss on the ground presses a wide print, and its slam flattens more", () => {
  const world = makeWorld(arena(), { col: 1 });
  world.boss = new Boss(
    { id: "B", kind: "kingPig", left: 10, top: GROUND - 1 },
    { minX: 4, maxX: world.width - 4, groundY: GROUND * TILE },
  );
  world.pressGroundUnderBoss();
  const pressed = world.ground.strands.filter((s) => s.press === 1);
  assert.ok(pressed.length >= 8, `${pressed.length} strands under the boss`);

  world.bossActions().slam(4 * TILE, GROUND * TILE);
  const slammed = world.ground.strandsAt(GROUND, 4 * TILE - 18, 4 * TILE + 18);
  assert.ok(slammed.every((s) => s.press === 1));
});

/** A 2D context that records each fill as { color, rects }. */
const recorder = () => {
  const fills = [];
  let path = [];
  return {
    fills,
    fillStyle: null,
    beginPath() {
      path = [];
    },
    rect(x, y, w, h) {
      path.push({ x, y, w, h });
    },
    fill() {
      fills.push({ color: this.fillStyle, rects: path });
    },
    get rects() {
      return fills.flatMap((f) => f.rects);
    },
  };
};

test("the floor draws in one batch per colour, pressed strands lower than standing ones", () => {
  const ground = new Ground(flatMap(), floorFor({ world: 1 }), TILE, 1);
  ground.step({ left: 80, right: 90, bottom: GROUND * TILE });
  const ctx = recorder();
  ground.draw(ctx, 0);
  assert.ok(ctx.rects.length > 0);
  const colors = ctx.fills.map((f) => f.color);
  assert.equal(new Set(colors).size, colors.length, "each colour filled once");
  const tallest = (from, to) =>
    Math.max(
      0,
      ...ctx.rects.filter((r) => r.x >= from && r.x <= to).map((r) => GROUND * TILE - r.y),
    );
  assert.ok(tallest(82, 88) < tallest(150, 200), "flattened grass is lower");
});

test("grass is dense: a blade in nearly every pixel, and a front layer drawn on its own", () => {
  const ground = new Ground(flatMap(), floorFor({ world: 1 }), TILE, 1);
  const back = ground.strands.filter((s) => s.layer === 0);
  const front = ground.strands.filter((s) => s.layer === 1);
  assert.ok(back.length >= COLS * TILE * 0.85, `${back.length} back blades`);
  assert.ok(front.length > COLS * TILE * 0.4, `${front.length} front blades`);
  const ctx = recorder();
  ground.draw(ctx, 1);
  const frontColors = new Set(FLOORS[1].front);
  assert.ok(
    ctx.fills.every((f) => frontColors.has(f.color)),
    "front layer only",
  );
});

test("a platform's rounded ends are bare, and the grass shortens towards them", () => {
  const map = flatMap();
  for (let c = 5; c <= 7; c++) map[4][c] = "t"; // a floating ledge
  const ground = new Ground(map, floorFor({ world: 1 }), TILE, 1);
  const ledge = ground.strands.filter((s) => s.y === 4 * TILE);
  const start = 5 * TILE + EDGE_INSET;
  const end = 8 * TILE - EDGE_INSET;
  assert.ok(ledge.length > 0);
  assert.ok(
    ledge.every((s) => s.x >= start && s.x < end),
    "nothing over the corners",
  );
  ledge.forEach((s) => {
    const edge = Math.min(s.x - start, end - 1 - s.x);
    assert.ok(s.h <= 1 + Math.floor(edge / 2) || edge >= 6, `${s.x}: ${s.h} px`);
  });
  // the map's own edges aren't rounded: the ground carries on off screen
  assert.ok(ground.strands.some((s) => s.y === GROUND * TILE && s.x < EDGE_INSET));
});

test("grass lies still with nobody on it, and only moves when stepped on", () => {
  const ground = new Ground(flatMap(), floorFor({ world: 1 }), TILE, 1);
  const frame = () => {
    const ctx = recorder();
    ground.draw(ctx, 0);
    ground.draw(ctx, 1);
    return JSON.stringify(ctx.rects);
  };
  const still = frame();
  for (let t = 0; t < 40; t++) ground.update();
  assert.equal(frame(), still, "no wind");
  ground.step({ left: 80, right: 90, bottom: GROUND * TILE });
  assert.notEqual(frame(), still, "a foot parts it");
  for (let t = 0; t < 60; t++) ground.update();
  assert.equal(frame(), still, "and it settles back exactly");
});

test("snow squashes up into a ridge beside a footprint", () => {
  const ground = new Ground(flatMap(), floorFor({ world: 2 }), TILE, 1);
  ground.step({ left: 80, right: 90, bottom: GROUND * TILE });
  const ridge = ground.strands.filter((s) => s.press < 0);
  assert.ok(ridge.length > 0 && ridge.every((s) => s.x <= 79 || s.x >= 90));
  const ctx = recorder();
  ground.draw(ctx, 0);
  const at = (x) => ctx.rects.filter((r) => r.x === x).map((r) => GROUND * TILE - r.y);
  const raised = ridge[0];
  assert.ok(Math.max(...at(raised.x)) > raised.h, "drawn taller than it lies");
});

test("running through grass kicks bits of it up; a bare floor kicks up nothing", () => {
  const world = makeWorld(arena(), { col: 3 });
  tick(world, 1);
  world.effects.particles = [];
  for (let t = 0; t < 30; t++) {
    world.player.moveRight();
    world.update(() => {});
  }
  const colors = new Set([...FLOORS[1].back, ...FLOORS[1].front]);
  const bits = world.effects.particles.filter((p) => colors.has(p.color));
  assert.ok(bits.length > 0, "bits kicked up");

  const bare = makeWorld({ ...arena(), floor: { texture: null } }, { col: 3 });
  tick(bare, 1);
  bare.effects.particles = [];
  for (let t = 0; t < 30; t++) {
    bare.player.moveRight();
    bare.update(() => {});
  }
  assert.equal(bare.effects.particles.length, 0, "nothing to kick up on a bare floor");
});

// ---------------------------------------------------------- created worlds

test("a created world's floor comes from its surface style; its spec says if it's slippery", () => {
  const spec = (terrain) => normalizeWorldSpec({ terrain, palette: { surface: "#40a040" } });
  const grass = floorOf(spec({ surface: "grass" }));
  assert.equal(grass.texture, "blades");
  assert.equal(grass.slippery, false);
  assert.ok(new Ground(flatMap(), floorFor({ floor: grass }), TILE, 3).strands.length > 0);

  assert.equal(floorOf(spec({ surface: "snow" })).slippery, true, "snow is, by default");
  assert.equal(floorOf(spec({ surface: "snow", slippery: false })).slippery, false);
  assert.equal(floorOf(spec({ surface: "crystal", slippery: true })).slippery, true);
  assert.equal(floorOf(spec({ surface: "stone" })).texture, "dust");

  ["metal", "crystal"].forEach((surface) => {
    const bare = floorFor({ floor: floorOf(spec({ surface })) });
    assert.equal(new Ground(flatMap(), bare, TILE, 3).strands.length, 0, `${surface} is bare`);
  });
});

test("a world spec keeps its slippery choice; snow is slippery unless it says not", () => {
  assert.equal(normalizeWorldSpec({ terrain: { surface: "sand" } }).terrain.slippery, false);
  assert.equal(
    normalizeWorldSpec({ terrain: { surface: "sand", slippery: true } }).terrain.slippery,
    true,
  );
  assert.equal(normalizeWorldSpec({ terrain: { surface: "snow" } }).terrain.slippery, true);
  assert.equal(normalizeWorldSpec({ terrain: { slippery: "yes" } }).terrain.slippery, false);
});
