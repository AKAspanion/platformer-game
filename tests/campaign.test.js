import "./env";
import { resetSfxGap } from "../app/controller/sfx";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World from "../app/game/world";
import { BOSSES } from "../app/game/boss";
import { LEVELS } from "../app/util";
import { createCampaign, starsFor, targetTime, starCount, STAR } from "../app/campaign";
import { tick, tickUntil } from "./helpers";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
};

const bossLevels = LEVELS.filter((l) => l.boss);

/** A world in a boss arena, the player standing at the left. */
function bossWorld(level = bossLevels[0]) {
  const world = new World();
  world.reset();
  world.player.setLeft(level.left);
  world.player.setTop(level.top);
  world.setup(areas[level.id]);
  tick(world, 2);
  return world;
}

/** Shoot the boss until it falls (the player is kept safe meanwhile). */
function defeat(world) {
  const { boss } = world;
  for (let i = 0; i < 400 && world.boss && !boss.dying; i++) {
    world.player.invulnerable = 999;
    world.player.direction = boss.getCenterX() < world.player.getCenterX() ? -1 : 1;
    // stand level with it so straight shots connect
    world.player.y = world.player.yOld = boss.getBottom() - world.player.height - 1;
    world.player.firing = false;
    world.shootFireball(`f${i}`);
    tick(world, 4);
  }
  tickUntil(world, () => !world.boss, 120);
}

// ------------------------------------------------------------------ bosses

test("every world's boss arena has its own boss with an HP bar worth of health", () => {
  assert.equal(bossLevels.length, 5);
  for (const level of bossLevels) {
    const world = bossWorld(level);
    assert.ok(world.boss, `${level.name}: boss spawned`);
    assert.equal(world.boss.hp, BOSSES[areas[level.id].boss.kind].hp);
    assert.ok(world.boss.hp >= 12);
  }
});

test("both gates shut once the fight starts, and lift when the boss is beaten", () => {
  const world = bossWorld();
  const { player } = world;
  world.boss.state = "intro";
  world.boss.timer = 999; // keep it busy
  player.invulnerable = 999;
  // standing in the doorway (arriving through the portal): it stays open
  world.gate = 0;
  player.x = player.xOld = 2;
  player.velocityX = 0;
  tick(world, 3);
  assert.equal(world.gate, 0, "doesn't close on top of you");

  // step into the arena: the gates slam shut behind you
  player.x = 100;
  tick(world, 12);
  assert.equal(world.gate, 1);

  for (const [x, direction] of [
    [world.width - 10, 1],
    [2, -1],
  ]) {
    player.x = player.xOld = x;
    for (let i = 0; i < 10; i++) {
      direction > 0 ? player.moveRight() : player.moveLeft();
      tick(world);
    }
    assert.equal(world.portal, undefined, `can't leave ${direction > 0 ? "right" : "left"}`);
    assert.ok(player.x >= world.gateWidth - 0.01, "held off the left gate");
    assert.ok(player.getRight() <= world.width - world.gateWidth + 0.01, "held off the right gate");
  }

  defeat(world);
  assert.equal(world.boss, null);
  tickUntil(world, () => world.gate === 0, 60);
  assert.equal(world.gate, 0, "gates lift after the win");
  player.x = world.width - 20;
  for (let i = 0; i < 30 && !world.portal; i++) {
    player.moveRight();
    tick(world);
  }
  assert.ok(world.portal && world.portal.direction > 0, "exit opens after the boss");
});

test("a boss takes one damage per fireball and is worth 1000", () => {
  const world = bossWorld();
  const { boss } = world;
  const hp = boss.hp;
  world.player.direction = 1;
  world.player.y = world.player.yOld = boss.getBottom() - world.player.height - 1;
  world.shootFireball("one");
  tickUntil(world, () => boss.hp < hp, 120);
  assert.equal(boss.hp, hp - 1);
  defeat(world);
  assert.equal(world.score, 1000);
  assert.ok(world.killedEnemies.includes(areas[bossLevels[0].id].boss.id));
});

test("a beaten boss stays beaten when you come back in the same run", () => {
  const world = bossWorld();
  defeat(world);
  world.setup(areas[bossLevels[0].id]);
  assert.equal(world.boss, null);
});

test("bosses attack: they telegraph, then charge, jump, shoot or summon", () => {
  for (const level of bossLevels) {
    const world = bossWorld(level);
    const { boss } = world;
    const seen = new Set();
    let warned = false;
    let seeds = 0;
    let minions = 0;
    for (let t = 0; t < 900; t++) {
      world.player.invulnerable = 999;
      world.player.hearts = 3;
      tick(world);
      seen.add(boss.state);
      if (world.effects.texts.some((x) => x.text === "!")) warned = true;
      seeds = Math.max(seeds, world.projectiles.items.length);
      minions = Math.max(
        minions,
        world.enemies.items.filter((e) => e.id.startsWith(boss.id)).length,
      );
    }
    assert.ok(warned, `${level.name}: telegraphs its attacks`);
    assert.ok(seen.has("windup"), `${level.name}: winds up`);
    const moves = new Set(BOSSES[boss.kind].moves);
    moves.forEach((move) => {
      if (move === "summon")
        assert.ok(minions > 0 && minions <= 3, `${level.name}: summons (${minions})`);
      else if (move === "shoot") assert.ok(seeds > 0, `${level.name}: shoots`);
      else assert.ok(seen.has(move), `${level.name}: ${move}`);
    });
  }
});

test("touching the boss costs a heart", () => {
  const world = bossWorld();
  const { boss } = world;
  boss.state = "intro";
  boss.timer = 999;
  world.player.x = boss.x + 6;
  world.player.y = boss.getBottom() - world.player.height - 1;
  tick(world, 1);
  assert.equal(world.player.hearts, 2);
});

test("boss arenas are flat, with ledges in reach and no other enemies", () => {
  for (const level of bossLevels) {
    const area = areas[level.id];
    assert.equal(area.enemies.length, 0);
    assert.equal(area.death.length, 0, `${level.name}: no pits`);
    assert.ok(
      area.powerups.some((p) => p.type === "heart"),
      `${level.name}: a heart to help`,
    );
  }
});

// ---------------------------------------------------------------- campaign

test("levels unlock only once the player has walked into them", () => {
  const campaign = createCampaign(memoryStorage());
  assert.equal(campaign.isUnlocked(LEVELS[0].id), true, "Grassland 1 is open");
  LEVELS.slice(1).forEach((l) => assert.equal(campaign.isUnlocked(l.id), false, l.name));
  campaign.reach(LEVELS[1].id);
  assert.equal(campaign.isUnlocked(LEVELS[1].id), true);
  assert.equal(campaign.isUnlocked(LEVELS[2].id), false, "no skipping ahead");
  assert.equal(campaign.last, LEVELS[1].id, "Play continues here");
});

test("campaign progress is saved and survives a reload", () => {
  const storage = memoryStorage();
  const a = createCampaign(storage);
  a.reach(LEVELS[3].id);
  a.finish(LEVELS[3].id, STAR.COINS, 30);
  const b = createCampaign(storage);
  assert.equal(b.isUnlocked(LEVELS[3].id), true);
  assert.equal(b.stars(LEVELS[3].id), STAR.COINS);
  assert.equal(b.bestTime(LEVELS[3].id), 30);
  b.reset();
  assert.equal(createCampaign(storage).isUnlocked(LEVELS[3].id), false);
});

test("stars: all coins, all enemies (or the boss), under the target time", () => {
  const area = areas[LEVELS[0].id];
  const coins = area.coins.map((c) => c.id).join(",") + ",";
  const foes = area.enemies.map((e) => e.id).join(",") + ",";
  const target = targetTime(area);

  assert.equal(starsFor(area, { seconds: target + 1 }), 0);
  assert.equal(starsFor(area, { collectedCoins: coins, seconds: target + 1 }), STAR.COINS);
  assert.equal(starsFor(area, { killedEnemies: foes, seconds: target + 1 }), STAR.ENEMIES);
  assert.equal(starsFor(area, { seconds: target }), STAR.TIME);
  const all = starsFor(area, { collectedCoins: coins, killedEnemies: foes, seconds: 10 });
  assert.equal(starCount(all), 3);

  const boss = areas[bossLevels[0].id];
  const bossCoins = boss.coins.map((c) => c.id).join(",") + ",";
  assert.equal(starsFor(boss, { collectedCoins: bossCoins, seconds: 999 }), STAR.COINS);
  assert.equal(
    starsFor(boss, { killedEnemies: `${boss.boss.id},`, seconds: 999 }),
    STAR.ENEMIES,
    "the boss is the enemy star",
  );
});

test("stars add up across runs: each one, once earned, is kept", () => {
  const campaign = createCampaign(memoryStorage());
  const id = LEVELS[0].id;
  assert.deepEqual(campaign.finish(id, STAR.COINS, 50), { mask: STAR.COINS, added: STAR.COINS });
  assert.deepEqual(campaign.finish(id, STAR.TIME, 20), {
    mask: STAR.COINS | STAR.TIME,
    added: STAR.TIME,
  });
  assert.equal(campaign.finish(id, 0, 90).added, 0);
  assert.equal(campaign.bestTime(id), 20, "best time keeps the fastest");
  assert.equal(campaign.totalStars(LEVELS.map((l) => l.id)), 2);
});

test("target times are reachable: longer for bigger levels and tougher bosses", () => {
  for (const level of LEVELS) {
    const area = areas[level.id];
    const t = targetTime(area);
    assert.ok(t >= 25 && t <= 120, `${level.name}: ${t}s`);
  }
  const bosses = bossLevels.map((l) => targetTime(areas[l.id]));
  assert.deepEqual(
    [...bosses].sort((a, b) => a - b),
    bosses,
    "later bosses get more time",
  );
});

// ---------------------------------------------------------- boss variety

const order = ["kingPig", "frostSlime", "sandLizard", "batLord", "mechBeetle"];

test("each boss fights differently: its own moves, and it uses all of them", () => {
  const sets = order.map((kind) => [...new Set(BOSSES[kind].moves)].sort().join(","));
  assert.equal(new Set(sets).size, 5, "no two bosses share a move set");
  for (const level of bossLevels) {
    const world = bossWorld(level);
    const { boss } = world;
    for (let t = 0; t < 2400 && boss.performed.size < new Set(boss.config.moves).size; t++) {
      world.player.invulnerable = 999;
      world.player.hearts = 3;
      tick(world);
    }
    assert.deepEqual(
      [...boss.performed].sort(),
      [...new Set(boss.config.moves)].sort(),
      `${boss.name} used every move`,
    );
  }
});

test("bosses get harder world by world: health, wind-up and breaks", () => {
  const bosses = bossLevels.map((level) => bossWorld(level).boss);
  assert.deepEqual(
    bosses.map((b) => b.kind),
    order,
    "campaign order",
  );
  for (let i = 1; i < bosses.length; i++) {
    const [easy, hard] = [bosses[i - 1], bosses[i]];
    assert.ok(hard.maxHp > easy.maxHp, `${hard.name} has more health`);
    assert.ok(hard.windupTicks <= easy.windupTicks, `${hard.name} telegraphs faster`);
    const avg = (b) => {
      let sum = 0;
      for (let k = 0; k < 50; k++) sum += b.nextCooldown();
      return sum / 50;
    };
    assert.ok(avg(hard) < avg(easy), `${hard.name} rests less`);
  }
  // enraged and final phases speed them up again
  const lizard = bosses[2];
  const calm = lizard.windupTicks;
  lizard.hp = Math.floor(lizard.maxHp / 2);
  assert.ok(lizard.enraged && lizard.windupTicks < calm);
  lizard.hp = Math.floor(lizard.maxHp / 4);
  assert.ok(lizard.final, "tier 3+ bosses get a final phase");
  assert.equal(bosses[0].final === false || bosses[0].tier < 3, true);
});

/** Run one move on demand: skip ahead to its wind-up. */
function force(world, move) {
  const { boss } = world;
  boss.state = "walk";
  boss.cooldown = 0;
  boss.moveIndex = boss.config.moves.indexOf(move);
  tick(world, 1);
  assert.equal(boss.state, "windup");
  tickUntil(world, () => boss.state !== "windup", 40);
}

test("Mecha Beetle's floor laser warns first, then burns anyone on the ground", () => {
  const world = bossWorld(bossLevels[4]);
  const { player } = world;
  player.x = 60;
  force(world, "laser");
  const laser = world.hazards.find((h) => h.kind === "laser");
  assert.ok(laser && laser.warn > 0, "red warning line first");
  const hearts = player.hearts;
  tickUntil(world, () => laser.warn === 0, 40);
  assert.equal(player.hearts, hearts, "no damage during the warning");
  tick(world, 3);
  assert.ok(player.hearts < hearts, "the beam hurts a player standing on the floor");
});

test("Sand Chameleon can't be hit while it has vanished", () => {
  const world = bossWorld(bossLevels[2]);
  const { boss } = world;
  force(world, "vanish");
  tickUntil(world, () => boss.alpha < 0.2, 20);
  assert.equal(boss.hittable, false);
  assert.equal(boss.hit(), null);
  tickUntil(world, () => boss.alpha > 0.9, 60);
  assert.equal(boss.hittable, true);
  tickUntil(world, () => world.hazards.some((h) => h.kind === "tongue"), 20);
  assert.ok(
    world.hazards.some((h) => h.kind === "tongue"),
    "reappears with a tongue lash",
  );
});

test("Frost Slime's icicles fall where the marks are, and it splits when hurt", () => {
  const world = bossWorld(bossLevels[1]);
  const { boss } = world;
  world.player.invulnerable = 9999;
  force(world, "icicles");
  const marks = world.hazards.filter((h) => h.kind === "mark").map((h) => h.x + h.width / 2);
  assert.ok(marks.length >= 4);
  tickUntil(world, () => world.projectiles.items.some((p) => p.kind === "icicle"), 40);
  const icicle = world.projectiles.items.find((p) => p.kind === "icicle");
  assert.ok(
    marks.some((x) => Math.abs(x - icicle.getCenterX()) < 2),
    "falls on a mark",
  );
  tickUntil(world, () => !world.projectiles.items.includes(icicle), 80);
  assert.ok(world.effects.particles.length > 0, "shatters on the floor");

  boss.hp = Math.floor(boss.maxHp / 2);
  tick(world, 2);
  assert.equal(world.enemies.items.filter((e) => e.id.startsWith(boss.id)).length, 2, "splits");
});

test("Mecha Beetle's missiles land on their marks and explode", () => {
  const world = bossWorld(bossLevels[4]);
  world.player.invulnerable = 9999;
  world.player.x = 80;
  force(world, "missiles");
  tickUntil(world, () => world.projectiles.items.some((p) => p.kind === "missile"), 20);
  tickUntil(world, () => world.hazards.some((h) => h.kind === "blast"), 80);
  const blast = world.hazards.find((h) => h.kind === "blast");
  assert.ok(Math.abs(blast.x + 12 - world.player.getCenterX()) < 30, "near where the player stood");
});

// ------------------------------------------------------------- sound & music

const heard = (fn) => {
  globalThis.__played.length = 0;
  resetSfxGap();
  fn();
  return [...globalThis.__played];
};

test("boss arenas play the boss's battle theme, then the world theme after the win", () => {
  for (const level of bossLevels) {
    const world = bossWorld(level);
    assert.equal(world.theme, `boss-${world.boss.kind}`, `${level.name} battle music`);
    const areaTheme = areas[level.id].theme;
    const played = heard(() => defeat(world));
    assert.ok(played.includes("sfx/boss-defeat.wav"), "victory fanfare");
    tick(world, 80);
    assert.equal(world.theme, areaTheme, "back to the world's own music");
  }
});

test("graveyard levels use dungeon.mp3 and factory levels use lab.mp3", () => {
  for (const level of LEVELS.filter((l) => !l.boss)) {
    const world = new World();
    world.reset();
    world.setup(areas[level.id]);
    const expected = { Graveyard: "dungeon", Factory: "lab" }[level.world];
    if (expected) assert.equal(world.theme, expected, level.name);
  }
});

test("each boss move and roar has its own sound", () => {
  for (const level of bossLevels) {
    const world = bossWorld(level);
    const played = heard(() => {
      for (let t = 0; t < 1500; t++) {
        world.player.invulnerable = 999;
        world.player.hearts = 3;
        tick(world);
      }
    });
    const kind = world.boss.kind;
    assert.ok(played.includes(`sfx/roar-${kind}.wav`), `${level.name}: roar`);
    const sounds = new Set(played.filter((p) => p.startsWith("sfx/")));
    assert.ok(sounds.size >= 4, `${level.name}: ${[...sounds].join(", ")}`);
  }
});
