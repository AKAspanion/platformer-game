import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import { LEVELS } from "../app/util";
import World from "../app/game/world";
import { enemyTypes } from "../app/game/enemies";
import { tick, mulberry32, TILE } from "./helpers";
import generator from "../scripts/generate-levels";

const playable = LEVELS.map(({ id }) => id);
const name = (id) => (LEVELS.find((l) => l.id === id) || { name: `area ${id}` }).name;

const freshWorld = () => {
  const world = new World();
  world.reset();
  return world;
};

/** Run `ticks` with no input; returns what happened. */
function idle(world, ticks) {
  let over = 0;
  tick(world, ticks, () => over++);
  return { dead: world.isPlayerDead || over > 0, standing: world.player.velocityY === 0 };
}

const solidTop = (area, r, c) => {
  const v = area.collisonMap[r] && area.collisonMap[r][c];
  return typeof v === "string" && v.includes("t");
};

test("every level links to existing, playable areas", () => {
  for (const id of playable) {
    const area = areas[id];
    assert.ok(area, `${name(id)} missing`);
    assert.equal(area.portals.length, 2, `${name(id)} should have two portals`);
    for (const portal of area.portals) {
      assert.ok(
        playable.includes(portal.destinationArea),
        `${name(id)} portal goes to unplayable area ${portal.destinationArea}`,
      );
    }
  }
});

test("level-select start positions land safely", () => {
  for (const level of LEVELS) {
    const world = freshWorld();
    world.setup(areas[level.id]);
    world.player.setLeft(level.left);
    world.player.setTop(level.top);
    world.enemies.items.forEach((e) => (e.velocity = 0));
    const { dead, standing } = idle(world, 60);
    assert.equal(dead, false, `${level.name}: died at start`);
    assert.equal(standing, true, `${level.name}: not standing after start`);
  }
});

test("walking through a portal lands safely and you can keep running", () => {
  for (const id of playable) {
    for (const portal of areas[id].portals) {
      const dest = portal.destinationArea;
      const label = `${name(id)} -> ${name(dest)}`;

      const world = freshWorld();
      world.setup(areas[id]);
      world.portal = portal;
      world.setup(areas[dest]);
      world.enemies.items.forEach((e) => (e.velocity = 0));

      const { dead, standing } = idle(world, 45);
      assert.equal(dead, false, `${label}: died on arrival`);
      assert.equal(standing, true, `${label}: not standing on arrival`);

      // keep running the same way for a moment: the safe zone by the edge
      for (let i = 0; i < 8; i++) {
        portal.direction < 0 ? world.player.moveLeft() : world.player.moveRight();
        tick(world);
      }
      assert.equal(world.isPlayerDead, false, `${label}: died running in from the portal`);
    }
  }
});

test("enemies patrol on solid footing and never walk into walls", () => {
  for (const id of playable) {
    const area = areas[id];
    for (const e of area.enemies) {
      const { width } = enemyTypes[e.type];
      const baseX = e.left * TILE;
      const feetRow = Math.round(e.top) + 1;
      for (const x of [baseX - e.sway, baseX + e.sway]) {
        const centreCol = Math.floor((x + width / 2) / TILE);
        assert.ok(
          solidTop(area, feetRow, centreCol),
          `${name(id)} enemy ${e.id}: no ground under it at x=${x.toFixed(1)} (col ${centreCol}, row ${feetRow})`,
        );
        // 3px of each side is transparent sprite padding
        for (const col of [Math.floor((x + 3) / TILE), Math.floor((x + width - 4) / TILE)]) {
          const cell = area.collisonMap[feetRow - 1] && area.collisonMap[feetRow - 1][col];
          assert.ok(
            !/[lr]/.test(cell || ""),
            `${name(id)} enemy ${e.id}: walks into a wall at col ${col}`,
          );
        }
      }
    }
  }
});

// Hand-made areas hide some coins inside hollow islands on purpose, so this
// only covers the generated ones.
test("generated coins are never inside solid ground", () => {
  for (const id of Object.keys(generator.buildAll())) {
    const area = areas[id];
    for (const coin of area.coins) {
      const col = Math.floor(coin.left + 0.4);
      const row = Math.floor(coin.top + 0.4);
      const cell = area.collisonMap[row] && area.collisonMap[row][col];
      const tile = area.areaMap[row] && area.areaMap[row][col];
      const inside = tile && cell === "" && area.areaMap[row - 1] && area.areaMap[row - 1][col];
      assert.ok(!inside, `${name(id)} coin ${coin.id} is buried at row ${row} col ${col}`);
    }
  }
});

test("ids are unique within each level", () => {
  for (const id of playable) {
    const ids = [...areas[id].coins, ...areas[id].enemies].map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, `${name(id)} has duplicate ids`);
  }
});

test("generated levels are up to date and pass the reachability check", () => {
  const results = generator.buildAll();
  for (const [id, { data }] of Object.entries(results)) {
    assert.deepEqual(areas[id], data, `area-${id}.json is stale: run yarn levels`);
  }
});

test("generated levels keep ground low and fill the space above with platforms", () => {
  const generated = generator.LEVELS.map((l) => l.id);
  assert.deepEqual(generated, [9, 10, 11, 12, 13, 14, 15, 16]);
  for (const id of generated) {
    const area = areas[id];

    // no taller than Grassland 1-2: ground tops (solid tile under a "t") at row 8+
    let solid = 0;
    area.collisonMap.forEach((row, r) =>
      row.forEach((cell, c) => {
        const ground = cell.includes("t") && area.areaMap[r + 1] && area.areaMap[r + 1][c];
        assert.ok(!ground || r >= 8, `${name(id)}: ground top at row ${r} col ${c}`);
        if (area.areaMap[r][c] && !(cell === "t" && !ground)) solid++;
      }),
    );
    const fill = solid / (area.rows * area.columns);
    assert.ok(
      fill <= 0.29,
      `${name(id)}: ${Math.round(fill * 100)}% solid (Grassland 1-2: 21-29%)`,
    );

    let upper = 0;
    area.collisonMap.forEach((row, r) =>
      row.forEach((cell, c) => {
        const floating = cell === "t" && !area.areaMap[r + 1][c];
        if (floating && r <= 5) upper++;
      }),
    );
    assert.ok(upper >= 10, `${name(id)}: only ${upper} upper platform tiles`);
    assert.ok(
      area.coins.some((coin) => coin.top < 3),
      `${name(id)}: no coins up top`,
    );
  }
});

test("fuzz: random play on every level never breaks the simulation", () => {
  const rng = mulberry32(2108);
  for (const id of playable) {
    for (let run = 0; run < 4; run++) {
      const world = freshWorld();
      const level = LEVELS.find((l) => l.id === id);
      world.setup(areas[id]);
      world.player.setLeft(level.left);
      world.player.setTop(level.top);

      let input = { left: false, right: false, jump: false, fire: false };
      let inWall = 0;
      for (let t = 0; t < 3000; t++) {
        if (t % 6 === 0) {
          input = {
            left: rng() < 0.3,
            right: rng() < 0.5,
            jump: rng() < 0.25,
            fire: rng() < 0.3,
          };
        }
        if (!world.isPlayerDead) {
          if (input.left) world.player.moveLeft();
          if (input.right) world.player.moveRight();
          if (input.jump) world.player.jump();
          if (input.fire) world.shootFireball(`f${t}`);
        }
        world.update(() => {});

        const { player } = world;
        const label = `${name(id)} run ${run} tick ${t}`;
        assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y), `${label}: NaN position`);
        assert.ok(world.fireballs.items.length <= 8, `${label}: fireballs pile up`);
        assert.ok(world.effects.particles.length <= 300, `${label}: particles pile up`);
        world.enemies.items.forEach((e) =>
          assert.ok(Number.isFinite(e.x), `${label}: enemy ${e.id} NaN`),
        );

        // Islands can be jumped through from below, so passing through a wall
        // tile is fine; getting stuck in one is not.
        const col = Math.floor(player.getCenterX() / TILE);
        const row = Math.floor(player.getCenterY() / TILE);
        const cell = world.collisonMap[row] && world.collisonMap[row][col];
        inWall = row >= 0 && cell && /[lr]/.test(cell) && world.map[row][col] ? inWall + 1 : 0;
        assert.ok(inWall < 20, `${label}: player stuck in a wall at row ${row} col ${col}`);

        if (world.portal || world.isPlayerDead) {
          // respawn at the level start and keep going
          world.reset();
          world.portal = null;
          world.setup(areas[id]);
          world.player.setLeft(level.left);
          world.player.setTop(level.top);
          inWall = 0;
        }
      }
    }
  }
});
