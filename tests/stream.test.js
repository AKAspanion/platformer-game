import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World, { SEAM_MARGIN } from "../app/game/world";
import { joinsSeamlessly, runInto } from "../app/engine/scroll";
import { LEVELS } from "../app/util";
import { arena, makeWorld, placePlayer, enemy, tick, TILE, COLS, GROUND } from "./helpers";

const WIDTH = COLS * TILE;

/** A test arena with id `id`, a way back and a way on, like a level of a world. */
const level = (id, extra = {}, next = id + 1) => ({
  ...arena(extra),
  id,
  portals: [
    { x: -8, y: 0, width: 8, height: 32, direction: -1, destinationArea: id - 1 },
    { x: WIDTH, y: 0, width: 8, height: 48, direction: 1, destinationArea: next },
  ],
});

test("a run starts as the one area it was set up with", () => {
  const world = makeWorld(level(901));
  assert.equal(world.segments.length, 1);
  assert.equal(world.viewWidth, WIDTH);
  assert.equal(world.width, WIDTH);
  assert.equal(world.cameraX(), 0);
});

test("the next area joins on only once the dino is past the middle of the last one", () => {
  const world = makeWorld(level(901));
  placePlayer(world, WIDTH / 2 - 40);
  assert.equal(world.nextArea(), null);
  placePlayer(world, WIDTH / 2);
  const next = world.nextArea();
  assert.equal(next.id, 902);
  assert.equal(next.portal.direction, 1);
});

test("extend lays the next area on to the right of the run", () => {
  const first = level(901, { coins: [{ id: "c1", left: 3, top: 9 }] });
  const second = level(902, {
    coins: [{ id: "c2", left: 3, top: 9 }],
    enemies: [enemy("e2", 5)],
    powerups: [{ id: "p2", type: "heart", left: 7, top: 9 }],
    death: [{ x: 32, y: 170, width: 16, height: 22 }],
  });
  second.water = [{ left: 9, top: 11 }];
  second.egg = { id: "s902", left: 4.25, top: GROUND - 0.9 };
  const before = JSON.stringify(second);
  const world = makeWorld(first);
  world.extend(second);

  assert.equal(JSON.stringify(second), before, "the area's own data is left as it was");
  assert.equal(world.columns, COLS * 2);
  assert.equal(world.width, WIDTH * 2);
  assert.equal(world.viewWidth, WIDTH, "the screen stays one area wide");
  assert.deepEqual(
    world.segments.map(({ id, x, width }) => ({ id, x, width })),
    [
      { id: 901, x: 0, width: WIDTH },
      { id: 902, x: WIDTH, width: WIDTH },
    ],
  );
  world.collisonMap.forEach((row) => assert.equal(row.length, COLS * 2));
  world.map.forEach((row) => assert.equal(row.length, COLS * 2));
  world.objects.forEach((row) => assert.equal(row.length, COLS * 2));

  const coin = world.coins.items.find((c) => c.id === "c2");
  assert.equal(coin.baseX, WIDTH + 3 * TILE);
  assert.equal(world.enemies.items.find((e) => e.id === "e2").x, WIDTH + 5 * TILE);
  assert.ok(world.powerups.items.find((p) => p.id === "p2").x > WIDTH + 7 * TILE - 1);
  assert.equal(world.water.items.at(-1).x, WIDTH + 9 * TILE);
  assert.equal(world.deathAreas.at(-1).x, WIDTH + 32);
  assert.deepEqual(
    world.eggs.map((e) => e.id),
    ["s902"],
  );
  assert.ok(world.eggs[0].x > WIDTH);

  // the seam's portals are gone: back at the run's start, on at its new end
  assert.deepEqual(
    world.portals.map((p) => [p.direction, p.x, p.destinationArea]),
    [
      [-1, -8, 900],
      [1, WIDTH * 2, 903],
    ],
  );
});

test("coins taken and enemies beaten before stay gone when their area joins on", () => {
  const world = makeWorld(level(901));
  world.collectedCoins = "c2,";
  world.killedEnemies = "e2,";
  world.extend(level(902, { coins: [{ id: "c2", left: 3, top: 9 }], enemies: [enemy("e2", 5)] }));
  assert.equal(world.coins.items.length, 0);
  assert.equal(world.enemies.items.length, 0);
});

test("the camera follows the dino through the run and stops at its ends", () => {
  const world = makeWorld(level(901));
  world.extend(level(902));
  placePlayer(world, 20);
  assert.equal(world.cameraX(), 0);
  placePlayer(world, WIDTH);
  assert.equal(world.cameraX(), world.player.getCenterX() - WIDTH / 2);
  placePlayer(world, WIDTH * 2 - 10);
  assert.equal(world.cameraX(), WIDTH);
});

test("walking over a seam reports the crossing, a few px past it, both ways", () => {
  const world = makeWorld(level(901), { col: 18 });
  world.extend(level(902));
  const centreAt = (x) => placePlayer(world, x - world.player.width / 2);

  centreAt(WIDTH + SEAM_MARGIN - 1);
  tick(world);
  assert.equal(world.crossing, null, "standing on the seam is still the first area");

  centreAt(WIDTH + SEAM_MARGIN + 1);
  tick(world);
  assert.deepEqual(world.crossing, { from: 901, to: 902, direction: 1 });

  world.enterSegment(902);
  assert.equal(world.id, 902);
  assert.equal(world.areaTicks, 0, "the new level's clock starts");
  assert.equal(world.segment.x, WIDTH);

  centreAt(WIDTH - SEAM_MARGIN - 1);
  tick(world);
  assert.deepEqual(world.crossing, { from: 902, to: 901, direction: -1 });
});

test("a dino walking right crosses the seam on the ground with no portal", () => {
  const world = makeWorld(level(901), { col: 15 });
  world.extend(level(902));
  let crossed = null;
  for (let i = 0; i < 90 && !crossed; i++) {
    world.player.moveRight();
    tick(world);
    crossed = world.crossing;
  }
  assert.deepEqual(crossed, { from: 901, to: 902, direction: 1 });
  assert.equal(world.portal, undefined, "no portal was taken");
  assert.ok(world.player.grounded || world.player.velocityY >= 0);
});

test("fireballs burn out off screen, not off the end of the run", () => {
  const world = makeWorld(level(901), { col: 2 });
  world.extend(level(902));
  world.extend(level(903));
  world.fireballs.add("f", WIDTH + 80, GROUND * TILE - 20, 1);
  tick(world);
  assert.equal(world.fireballs.items.length, 0);
});

test("a boss arena never joins on", () => {
  const world = makeWorld({ ...level(901), boss: { id: "b", kind: "kingPig", top: GROUND - 1 } });
  placePlayer(world, WIDTH - 40);
  assert.equal(world.nextArea(), null);
});

test("a run set up from a later area lays the earlier ones behind the dino", () => {
  const world = new World();
  world.reset();
  world.player.x = world.player.xOld = 40;
  world.setupRun([level(901), level(902), level(903)]);
  assert.equal(world.id, 903, "the last area of the run is played");
  assert.equal(world.segments.length, 3);
  assert.equal(world.player.x, WIDTH * 2 + 40, "standing where it was put in that area");
  assert.equal(world.spawn.x, WIDTH * 2 + 40);
  assert.deepEqual(
    world.portals.map((p) => [p.direction, p.x, p.destinationArea]),
    [
      [-1, -8, 900],
      [1, WIDTH * 3, 904],
    ],
  );
});

test("a dino started in a later area walks back over the seam into the one before", () => {
  const world = new World();
  world.reset();
  world.setupRun([level(901), level(902)]);
  placePlayer(world, WIDTH + 30, -1);
  let crossed = null;
  for (let i = 0; i < 60 && !crossed; i++) {
    world.player.moveLeft();
    tick(world);
    crossed = world.crossing;
  }
  assert.deepEqual(crossed, { from: 902, to: 901, direction: -1 });
});

// ------------------------------------------------------------- the story

test("a story level started mid-world has its world's earlier levels behind it", () => {
  LEVELS.forEach((lvl, i) => {
    const run = runInto(areas, lvl.id).map((a) => a.id);
    const first = LEVELS.slice(0, i + 1).findLastIndex((l, j) => j === 0 || LEVELS[j - 1].boss);
    const expected = lvl.boss ? [lvl.id] : LEVELS.slice(first, i + 1).map((l) => l.id);
    assert.deepEqual(run, expected, `${lvl.name}`);
  });
});

/** The areas of a world's run from its first level, as streaming lays them down. */
const runFrom = (id) => {
  const run = [areas[id]];
  for (;;) {
    const last = run.at(-1);
    const portal = last.portals.find((p) => p.direction === 1 && p.destinationArea != null);
    const next = portal && areas[portal.destinationArea];
    if (!joinsSeamlessly(last, next, portal)) return run;
    run.push(next);
  }
};

test("each story world scrolls from its first level to the boss arena's door", () => {
  const firsts = LEVELS.filter((l, i) => i === 0 || LEVELS[i - 1].boss);
  assert.ok(firsts.length >= 5);
  firsts.forEach((first) => {
    const run = runFrom(first.id);
    const boss = LEVELS.find((l) => l.boss && l.id > first.id);
    assert.deepEqual(
      run.map((a) => a.id),
      LEVELS.filter((l) => l.id >= first.id && l.id < boss.id).map((l) => l.id),
      `${first.world}: one run up to the boss`,
    );

    const world = new World();
    world.reset();
    world.setup(run[0]);
    run.slice(1).forEach((area) => world.extend(area));
    assert.equal(world.segments.length, run.length);
    world.collisonMap.forEach((row) => assert.equal(row.length, world.columns));
    const out = world.portals.find((p) => p.direction > 0);
    assert.equal(out.destinationArea, boss.id, `${first.world}: the run ends at the boss`);
    assert.equal(out.x, world.width);
  });
});

/** Each pair of story areas that join on: [from, to]. */
const storyJoins = () =>
  LEVELS.map(({ id }) => areas[id]).flatMap((from) => {
    const portal = from.portals.find((p) => p.direction === 1 && p.destinationArea != null);
    const to = portal && areas[portal.destinationArea];
    return joinsSeamlessly(from, to, portal) ? [[from, to]] : [];
  });

test("every floor at a story seam walks on into the next level: no wall, no hidden pit", () => {
  const joins = storyJoins();
  assert.ok(joins.length >= 20);
  const problems = [];
  joins.forEach(([from, to]) => {
    const seam = from.columns * TILE;
    for (let row = 1; row < from.rows; row++) {
      for (const dir of [1, -1]) {
        // a floor on the edge column the dino walks off, with room to stand on it
        const area = dir > 0 ? from : to;
        const column = dir > 0 ? from.columns - 1 : 0;
        const cell = (r) => String(area.collisonMap[r][column] || "");
        if (!cell(row).includes("t") || cell(row - 1).includes("t")) continue;

        const world = new World();
        world.reset();
        world.setup(from);
        world.extend(to);
        world.enemies.items = [];
        const { player } = world;
        const x = dir > 0 ? seam - 12 - player.width / 2 : seam + 12 - player.width / 2;
        placePlayer(world, x, dir, row);
        for (let i = 0; i < 20; i++) {
          if (dir > 0) player.moveRight();
          else player.moveLeft();
          tick(world);
        }
        const crossed = dir > 0 ? player.getLeft() > seam + 8 : player.getRight() < seam - 8;
        if (!crossed || world.respawns || world.isPlayerDead) {
          const way = dir > 0 ? "right" : "left";
          const fate = world.respawns ? "fell into a pit" : "was stopped";
          problems.push(`${from.id}|${to.id} row ${row} walking ${way}: ${fate}`);
        }
      }
    }
  });
  assert.deepEqual(problems, []);
});

test("Iceland 2's cave ledge runs on through Iceland 3's cliff and out onto its ground", () => {
  const world = new World();
  world.reset();
  world.setup(areas[8]);
  world.extend(areas[9]);
  world.enemies.items = [];
  const seam = areas[8].columns * TILE;
  placePlayer(world, seam - 3 * TILE, 1, 8); // on the cave ledge, three tiles before the seam
  const { player } = world;
  // walk until out past the cliff's far face (column 4), then stand: level 9's own pit
  // lies a few tiles further on
  for (let i = 0; i < 60 && player.getLeft() < seam + 4 * TILE; i++) {
    player.moveRight();
    tick(world);
  }
  tick(world, 15);
  assert.equal(world.respawns, 0, "no pit hidden in the cliff");
  assert.ok(player.getLeft() >= seam + 4 * TILE, "past the cliff's far face, no wall in the way");
  assert.equal(Math.round(player.getBottom() / TILE), 9, "down on the ground beyond it");
});

test("every story floor is the top of a drawn ledge: no standing in the dirt", () => {
  const TOPS = new Set([1, 2, 3, 12, 13, 14, 15]);
  const problems = [];
  LEVELS.filter((l) => !l.boss).forEach(({ id }) => {
    const area = areas[id];
    area.collisonMap.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (c >= area.columns || !String(cell).includes("t")) return;
        const ids = [area.areaMap[r][c]].flat();
        // the bottom row is under the screen's edge: it is never stood on
        if (r < area.rows - 1 && !ids.some((t) => TOPS.has(t))) problems.push(`${id} r${r}c${c}`);
      }),
    );
  });
  assert.deepEqual(problems, []);
});

test("Iceland 3's cliff is background like Iceland 2's: the dino jumps in front of it onto its ledge", () => {
  const world = makeWorld(areas[9]);
  world.enemies.items = [];
  const { player } = world;
  placePlayer(world, 5 * TILE, -1, 9); // on the ground beyond the cliff, facing it
  player.jump();
  for (let i = 0; i < 40; i++) {
    if (player.getLeft() > 2 * TILE) player.moveLeft();
    tick(world);
  }
  assert.equal(world.respawns, 0);
  assert.equal(
    Math.round(player.getBottom() / TILE),
    8,
    "standing on the ledge, no wall in the way",
  );
  assert.ok(player.getRight() < 4 * TILE, "on the ledge inside the cliff");

  // walking along the ground into it, the ledge's corner is a step: no walking into the dirt
  placePlayer(world, 5 * TILE, -1, 9);
  for (let i = 0; i < 30; i++) {
    player.moveLeft();
    tick(world);
  }
  assert.equal(world.respawns, 0, "never into dirt with nothing under it");
  assert.ok(player.getLeft() >= 4 * TILE - 0.5, "stopped at the step");
});
