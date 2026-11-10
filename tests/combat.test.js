import "./env";
import test from "node:test";
import assert from "node:assert/strict";
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

const fire = (world, id = "f1") => world.shootFireball(id);
const noFireballs = (world) => () => world.fireballs.items.length === 0;

test("a fireball kills only the first enemy in its path", () => {
  const world = makeWorld(arena({ enemies: [enemy("near", 5), enemy("far", 6.5)] }));
  freeze(world);

  assert.equal(fire(world), true);
  assert.notEqual(tickUntil(world, noFireballs(world)), -1, "fireball should burn out");

  assert.equal(byId(world, "near").dying, true);
  assert.equal(byId(world, "far").dying, false);
  assert.equal(world.totalEnemies, 1);
  assert.equal(world.killedEnemies, "near,");
});

test("firing left hits the nearest enemy on the left", () => {
  const world = makeWorld(arena({ enemies: [enemy("far", 3), enemy("near", 6)] }), {
    col: 11,
    direction: -1,
  });
  freeze(world);

  fire(world);
  tickUntil(world, noFireballs(world));

  assert.equal(byId(world, "near").dying, true);
  assert.equal(byId(world, "far").dying, false);
  assert.equal(world.totalEnemies, 1);
});

test("two enemies on the same spot: still one kill per fireball", () => {
  const world = makeWorld(arena({ enemies: [enemy("a", 6), enemy("b", 6)] }));
  freeze(world);

  fire(world);
  tickUntil(world, noFireballs(world));
  assert.equal(world.totalEnemies, 1);
  assert.equal(world.enemies.items.filter((e) => e.dying).length, 1);
});

test("a second fireball passes the dying enemy and kills the next one", () => {
  const world = makeWorld(arena({ enemies: [enemy("first", 5), enemy("second", 8)] }));
  freeze(world);

  fire(world, "f1");
  tickUntil(world, () => byId(world, "first").dying);
  // wait out the cooldown, then fire again while the first is still dying
  tickUntil(world, () => !world.player.firing);
  assert.equal(byId(world, "first").dead, false, "first should still be animating");
  assert.equal(fire(world, "f2"), true);
  tickUntil(world, noFireballs(world));

  assert.equal(byId(world, "second").dying, true);
  assert.equal(world.totalEnemies, 2);
});

test("fireballs stop at walls and don't kill enemies behind them", () => {
  const world = makeWorld(
    arena({ enemies: [enemy("hidden", 10)], walls: [{ col: 7, top: GROUND - 3 }] }),
  );
  freeze(world);

  fire(world);
  const ticks = tickUntil(world, noFireballs(world));
  assert.ok(ticks > 0 && ticks < 30, `fireball should hit the wall quickly (took ${ticks})`);
  assert.equal(byId(world, "hidden").dying, false);
  assert.equal(world.totalEnemies, 0);
});

test("fireballs fly over a one-tile step and hit the enemy on it", () => {
  const world = makeWorld(
    arena({
      enemies: [enemy("onStep", 8, "pig", GROUND - 2)],
      walls: [
        { col: 7, top: GROUND - 1 },
        { col: 8, top: GROUND - 1 },
        { col: 9, top: GROUND - 1 },
      ],
    }),
  );
  freeze(world);

  fire(world);
  tickUntil(world, noFireballs(world));
  assert.equal(byId(world, "onStep").dying, true);
});

test("fireballs that miss leave the screen and are removed", () => {
  const world = makeWorld(arena());
  fire(world);
  const ticks = tickUntil(world, noFireballs(world), 200);
  assert.ok(ticks > 0, "fireball never removed");
});

test("fire cooldown: one fireball per 9 ticks", () => {
  const world = makeWorld(arena());
  let shots = 0;
  for (let i = 0; i < 30; i++) {
    if (fire(world, `f${i}`)) shots++;
    tick(world);
  }
  // 30 ticks at one shot every 9 ticks (plus hit-free, so no hit-stop)
  assert.ok(shots >= 3 && shots <= 4, `shots=${shots}`);
});

test("dead players can't shoot", () => {
  const world = makeWorld(arena());
  world.isPlayerDead = true;
  assert.equal(fire(world), false);
  assert.equal(world.fireballs.items.length, 0);
});

test("death animation plays, then the enemy is removed", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 5)] }));
  freeze(world);
  const pig = byId(world, "pig");

  fire(world);
  tickUntil(world, () => pig.dying);
  const frames = new Set();
  const ticks = tickUntil(world, () => {
    frames.add(pig.animator.frameIndex);
    return !world.enemies.items.includes(pig);
  });

  assert.ok(ticks > 10 && ticks < 40, `death took ${ticks} ticks`);
  assert.equal(frames.size, 8, "should show all 8 death frames");
  assert.equal(pig.animator.frameSet, pig.deathFrameSets[pig.direction < 0 ? 0 : 1]);
});

test("death frames are drawn 2x the sprite, centred on the enemy", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 5)] }));
  const pig = byId(world, "pig");
  const alive = pig.drawRect();
  pig.kill(1);
  const dying = pig.drawRect();
  assert.equal(dying.width, alive.width * 2);
  assert.equal(dying.height, alive.height * 2);
  assert.equal(dying.x + dying.width / 2, alive.x + alive.width / 2);
});

test("dying enemies are harmless", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 5)] }));
  freeze(world);
  const pig = byId(world, "pig");
  pig.kill(1);
  placePlayer(world, pig.x + 2);

  let over = 0;
  tick(world, 5, () => over++);
  assert.equal(world.isPlayerDead, false);
  assert.equal(over, 0);
});

test("touching a live enemy kills the player once", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 5)] }));
  freeze(world);
  placePlayer(world, byId(world, "pig").x + 4);

  let over = 0;
  tick(world, 10, () => over++);
  assert.equal(world.isPlayerDead, true);
  assert.equal(over, 1);
});

test("brushing the transparent edge of an enemy sprite is not a hit", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 5)] }));
  freeze(world);
  const pig = byId(world, "pig");
  // 2px of overlap with the sprite box, all of it transparent padding
  placePlayer(world, pig.x - world.player.width + 2);
  tick(world, 1);
  assert.equal(world.isPlayerDead, false);
});

test("killed enemies stay dead when the area is entered again", () => {
  const data = arena({ enemies: [enemy("a", 5), enemy("b", 12)] });
  const world = makeWorld(data);
  freeze(world);
  fire(world);
  tickUntil(world, noFireballs(world));

  world.setup(data);
  assert.deepEqual(
    world.enemies.items.map((e) => e.id),
    ["b"],
  );
});

test("a hit freezes the world briefly (hit-stop) and shakes the screen", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 4)] }));
  freeze(world);
  fire(world);
  tickUntil(world, () => byId(world, "pig").dying);

  assert.ok(world.effects.freeze > 0, "hit-stop expected");
  assert.ok(world.effects.shakeTime > 0, "shake expected");
  assert.equal(world.effects.texts[0].text, "+100");

  world.player.velocityX = 3;
  const x = world.player.x;
  tick(world, world.effects.freeze);
  assert.equal(world.player.x, x, "player frozen during hit-stop");
  tick(world, 1);
  assert.notEqual(world.player.x, x, "player moves again after hit-stop");
});

test("effects expire", () => {
  const world = makeWorld(arena());
  world.effects.fireImpact(50, 50, 1);
  world.effects.popup("+100", 50, 50);
  world.effects.shake(3, 5);
  tick(world, 60);
  assert.equal(world.effects.particles.length, 0);
  assert.equal(world.effects.texts.length, 0);
  assert.deepEqual(world.effects.offset, { x: 0, y: 0 });
});

test("coins are collected once and counted", () => {
  // right on top of the player: coins bob by a random phase
  const data = arena({ coins: [{ id: "c1", left: 2.2, top: GROUND - 1 }] });
  const world = makeWorld(data);
  tick(world, 2);
  assert.equal(world.totalCoins, 1);
  assert.equal(world.coins.items.length, 0);
  world.setup(data);
  assert.equal(world.coins.items.length, 0, "collected coin should not come back");
});

test("death areas kill the player", () => {
  const world = makeWorld(
    arena({ death: [{ x: 2 * TILE, y: GROUND * TILE - 8, width: 16, height: 8 }] }),
  );
  let over = 0;
  tick(world, 2, () => over++);
  assert.equal(world.isPlayerDead, true);
  assert.equal(over, 1);
});

test("jump physics: about 2.7 tiles high", () => {
  const world = makeWorld(arena());
  const { player } = world;
  const start = player.y;
  player.jump();
  let top = start;
  for (let i = 0; i < 30; i++) {
    tick(world);
    top = Math.min(top, player.y);
  }
  const tiles = (start - top) / TILE;
  assert.ok(tiles > 2.4 && tiles < 3.0, `jump height ${tiles.toFixed(2)} tiles`);
  assert.equal(player.jumping, false, "landed");
});
