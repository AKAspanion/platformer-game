import "./env";
import { resetSfxGap } from "../app/controller/sfx";
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
import { MAX_HEARTS } from "../app/game/player";

const noFireballs = (world) => () => world.fireballs.items.length === 0;

// ------------------------------------------------------------------ hearts

test("three hearts: the third hit ends the game", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 6)] }));
  freeze(world);
  const pig = byId(world, "pig");
  let over = 0;
  for (let hit = 1; hit <= MAX_HEARTS; hit++) {
    world.player.invulnerable = 0;
    world.effects.freeze = 0; // skip the hit-stop between hits
    placePlayer(world, pig.x + 4);
    tick(world, 1, () => over++);
    assert.equal(world.player.hearts, MAX_HEARTS - hit);
  }
  assert.equal(world.isPlayerDead, true);
  assert.equal(over, 1);
});

test("after a hit the player blinks and can't be hit again straight away", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 6)] }));
  freeze(world);
  placePlayer(world, byId(world, "pig").x + 4);
  tick(world, 1);
  assert.equal(world.player.hearts, 2);
  assert.ok(world.player.invulnerable > 0);
  // still overlapping for a while: no second heart lost
  placePlayer(world, byId(world, "pig").x + 4);
  world.player.invulnerable = 30;
  tick(world, 10);
  assert.equal(world.player.hearts, 2);
  assert.ok(world.player.alpha < 1 || world.player.invulnerable % 6 >= 3, "blinking");
});

test("a hit knocks the player away from the enemy and takes control briefly", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 6)] }));
  freeze(world);
  const pig = byId(world, "pig");
  placePlayer(world, pig.x - 8); // player on the left of the pig
  tick(world, 1);
  assert.ok(world.player.velocityX < 0, "pushed left");
  const x = world.player.x;
  world.player.moveRight();
  assert.ok(world.player.velocityX < 0, "no control during knockback");
  tick(world, 6);
  assert.ok(world.player.x < x, "moved away");
});

test("falling in a pit costs a heart and respawns on safe ground", () => {
  const data = arena({ death: [{ x: 8 * TILE, y: 170, width: 32, height: 32 }] });
  const world = makeWorld(data, { col: 2 });
  tick(world, 12); // stand still long enough to remember this spot
  const safe = { ...world.lastSafe };
  assert.ok(world.lastSafe, "safe spot remembered");

  world.player.x = 8 * TILE + 4;
  world.player.y = 172;
  tick(world, 1);
  assert.equal(world.player.hearts, MAX_HEARTS - 1);
  assert.equal(world.isPlayerDead, false);
  assert.equal(Math.round(world.player.x), Math.round(safe.x));
});

test("the last heart lost in a pit is game over", () => {
  const data = arena({ death: [{ x: 8 * TILE, y: 170, width: 32, height: 32 }] });
  const world = makeWorld(data);
  world.player.hearts = 1;
  world.player.x = 8 * TILE + 4;
  world.player.y = 172;
  let over = 0;
  tick(world, 1, () => over++);
  assert.equal(world.isPlayerDead, true);
  assert.equal(over, 1);
});

test("the dino hops and fades out when it dies", () => {
  const world = makeWorld(arena({ enemies: [enemy("pig", 6)] }));
  freeze(world);
  world.player.hearts = 1;
  placePlayer(world, byId(world, "pig").x + 4);
  tick(world, 1);
  assert.equal(world.isPlayerDead, true);
  assert.ok(world.player.velocityY < 0, "death hop");
  tick(world, 70);
  assert.equal(world.player.alpha, 0, "faded out");
});

// ---------------------------------------------------------------- power-ups

const powerup = (type, left = 2) => ({ id: `p-${type}`, type, left, top: GROUND - 1 });

test("heart power-up restores a heart (score bonus when full)", () => {
  const world = makeWorld(arena({ powerups: [powerup("heart")] }), { col: 2 });
  world.player.hearts = 1;
  tick(world, 3);
  assert.equal(world.player.hearts, 2);
  assert.equal(world.powerups.items.length, 0);

  const full = makeWorld(arena({ powerups: [powerup("heart")] }), { col: 2 });
  tick(full, 3);
  assert.equal(full.player.hearts, MAX_HEARTS);
  assert.equal(full.score, 100);
});

test("shield blocks one hit", () => {
  const world = makeWorld(arena({ powerups: [powerup("shield")], enemies: [enemy("pig", 9)] }), {
    col: 2,
  });
  freeze(world);
  tick(world, 3);
  assert.equal(world.player.shield, true);
  placePlayer(world, byId(world, "pig").x + 4);
  tick(world, 1);
  assert.equal(world.player.shield, false);
  assert.equal(world.player.hearts, MAX_HEARTS);
});

test("triple fire shoots three fireballs, each still one kill at most", () => {
  const world = makeWorld(
    arena({ powerups: [powerup("triple")], enemies: [enemy("a", 7), enemy("b", 7.2)] }),
    { col: 2 },
  );
  freeze(world);
  tick(world, 3);
  assert.ok(world.player.triple > 0);
  world.shootFireball("t");
  assert.equal(world.fireballs.items.length, 3);
  tickUntil(world, noFireballs(world));
  // two enemies, three fireballs: both die, nobody is killed twice
  assert.equal(world.totalEnemies, 2);
});

test("wings give one extra jump in the air", () => {
  const world = makeWorld(arena({ powerups: [powerup("wings")] }), { col: 2 });
  tick(world, 3);
  const { player } = world;
  assert.ok(player.wings > 0);
  assert.equal(player.jump(), true);
  tick(world, 6);
  assert.equal(player.jump(), true, "double jump");
  tick(world, 2);
  assert.equal(player.jump(), false, "only one in the air");
});

test("collected power-ups stay collected when coming back to an area", () => {
  const data = arena({ powerups: [powerup("shield")] });
  const world = makeWorld(data, { col: 2 });
  tick(world, 3);
  world.setup(data);
  assert.equal(world.powerups.items.length, 0);
});

// ------------------------------------------------------------- enemy attacks

test("a walker winds up, then lunges at a close player in front of it", () => {
  const world = makeWorld(arena({ enemies: [{ ...enemy("pig", 6.5), sway: 40, dir: -1 }] }), {
    col: 4,
  });
  freeze(world);
  const pig = byId(world, "pig");
  pig.direction = -1;
  world.player.invulnerable = 999; // watch the attack, don't get hurt
  tick(world, 2);
  assert.equal(pig.state, "windup");
  assert.ok(
    world.effects.texts.some((t) => t.text === "!"),
    "warning shown",
  );
  const x = pig.x;
  tickUntil(world, () => pig.state === "lunge", 20);
  tick(world, 4);
  assert.ok(pig.x < x - 6, `lunged toward the player (${x} -> ${pig.x})`);
  assert.equal(pig.animator.frameSet, pig.attackFrames());
});

test("walkers don't attack a player behind them or far away", () => {
  const world = makeWorld(arena({ enemies: [{ ...enemy("pig", 8), sway: 0, dir: 1 }] }), {
    col: 4,
  });
  freeze(world);
  const pig = byId(world, "pig");
  pig.direction = 1; // facing away
  tick(world, 5);
  assert.equal(pig.state, "patrol");
  placePlayer(world, pig.x + 120);
  tick(world, 5);
  assert.equal(pig.state, "patrol");
});

test("beetles are armoured: two fireballs to kill", () => {
  const world = makeWorld(arena({ enemies: [enemy("bug", 7, "beetle")] }), { col: 2 });
  freeze(world);
  const bug = byId(world, "bug");
  world.shootFireball("1");
  tickUntil(world, noFireballs(world));
  assert.equal(bug.dying, false);
  assert.equal(bug.hp, 1);
  assert.ok(world.effects.texts.some((t) => t.text === "CLANK"));
  tickUntil(world, () => !world.player.firing);
  bug.x = bug.baseX; // undo the knockback for a clean second shot
  world.shootFireball("2");
  tickUntil(world, noFireballs(world));
  assert.equal(bug.dying, true);
  assert.equal(world.score, 200);
});

test("spitters shoot seeds that hurt; fireballs burn seeds", () => {
  const world = makeWorld(arena({ enemies: [{ ...enemy("plant", 7, "spitter") }] }), { col: 3 });
  const plant = byId(world, "plant");
  plant.spitTimer = 1;
  tickUntil(world, () => world.projectiles.items.length > 0, 30);
  assert.equal(world.projectiles.items.length, 1);
  tickUntil(world, () => world.player.hearts < MAX_HEARTS, 80);
  assert.equal(world.player.hearts, MAX_HEARTS - 1);

  // a fireball meets the next seed head-on
  plant.spitTimer = 1;
  world.player.invulnerable = 999;
  tickUntil(world, () => world.projectiles.items.length > 0, 30);
  world.player.direction = 1;
  world.player.firing = false;
  world.shootFireball("f");
  tickUntil(world, () => world.projectiles.items.length === 0, 60);
  assert.equal(world.player.hearts, MAX_HEARTS - 1);
});

test("bats swoop down at a player below them", () => {
  const world = makeWorld(
    arena({ enemies: [{ id: "bat", type: "bat", left: 6, top: GROUND - 5, sway: 30, dir: -1 }] }),
    { col: 4 },
  );
  const bat = byId(world, "bat");
  bat.direction = -1;
  world.player.invulnerable = 999;
  const startY = bat.y;
  tickUntil(world, () => bat.state === "lunge", 60);
  tick(world, 12);
  assert.ok(bat.y > startY + 20, `dived (${startY} -> ${bat.y})`);
  tickUntil(world, () => bat.state !== "lunge", 30);
  assert.equal(bat.y, bat.baseY, "climbs back");
});

test("every enemy type has walk, death (and attack) frames loaded", () => {
  const types = ["pig", "slime", "chameleon", "beetle", "bat", "spitter"];
  const world = makeWorld(arena({ enemies: types.map((t, i) => enemy(t, 2 + i * 2.5, t)) }));
  for (const t of types) {
    const e = byId(world, t);
    assert.ok(e.walkFrames().length >= 4, `${t} walk`);
    assert.equal(e.deathFrameSets[0].length, 8, `${t} death`);
    if (t !== "bat") assert.ok(e.attackFrames().length >= 3, `${t} attack`);
  }
});

// ------------------------------------------------------------------- dino

test("dino animation states: rise, fall, land squash, run speed", () => {
  const world = makeWorld(arena());
  const { player } = world;
  const side = "Right";

  player.jump();
  tick(world, 2);
  assert.equal(player.animator.frameSet, player.frameSets["rise" + side]);
  tickUntil(world, () => player.velocityY > 2.5, 30);
  tick(world, 1);
  assert.equal(player.animator.frameSet, player.frameSets["fall" + side]);
  tickUntil(world, () => player.grounded, 30);
  assert.ok(player.scaleY < 0.95, "squashed on landing");
  tick(world, 15);
  assert.ok(Math.abs(player.scaleY - 1) < 0.02, "back to normal");

  for (let i = 0; i < 20; i++) {
    player.moveRight();
    tick(world);
  }
  assert.equal(player.animator.frameSet, player.frameSets["run" + side]);
  assert.equal(player.animator.delay, 2, "fast legs at full speed");
});

test("enemies have their own attack and death sounds", () => {
  const heard = (fn) => {
    globalThis.__played.length = 0;
    resetSfxGap();
    fn();
    return [...globalThis.__played];
  };
  // a pig winds up to lunge, then dies to a fireball
  const world = makeWorld(arena({ enemies: [{ ...enemy("pig", 6.5), sway: 40, dir: -1 }] }), {
    col: 4,
  });
  freeze(world);
  byId(world, "pig").direction = -1;
  world.player.invulnerable = 999;
  const attack = heard(() => tick(world, 3));
  assert.ok(attack.includes("sfx/pig-attack.wav"), attack.join(","));
  world.player.direction = 1;
  world.player.firing = false;
  const death = heard(() => {
    world.shootFireball("x");
    tickUntil(world, () => byId(world, "pig").dying, 30);
  });
  assert.ok(death.includes("sfx/pig-die.wav"), death.join(","));

  // a beetle's armour clanks
  const armoured = makeWorld(arena({ enemies: [enemy("bug", 7, "beetle")] }), { col: 2 });
  freeze(armoured);
  const clank = heard(() => {
    armoured.shootFireball("1");
    tickUntil(armoured, () => armoured.fireballs.items.length === 0);
  });
  assert.ok(clank.includes("sfx/beetle-armor.wav"));
});
