import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import areas from "../app/areas";
import World from "../app/game/world";
import Boss, {
  BOSSES,
  registerBoss,
  SHIELD_GLOW,
  SHIELD_TICKS,
  SHIELD_COOLDOWN,
} from "../app/game/boss";
import { LEVELS } from "../app/util";
import { tick } from "./helpers";

const act = {
  warn() {},
  shoot() {},
  slam() {},
  summon() {},
  hazard() {},
  particles() {},
};

/** A boss standing still: it only ages (no player, so it never attacks). */
const makeBoss = (kind = "kingPig") => {
  const boss = new Boss(
    { id: "b1", kind, left: 10, top: 10 },
    { minX: 4, maxX: 400, groundY: 176 },
  );
  boss.state = "intro";
  boss.timer = 9999;
  return boss;
};
const age = (boss, n) => {
  for (let i = 0; i < n; i++) boss.update(null, act);
};
/** Hit when the boss clock (ticks since it was made) reaches each of the given ticks. */
const hitAt = (boss, ticks) =>
  ticks.map((t) => {
    age(boss, t - boss.ticks);
    return boss.hit();
  });

test("3 hits within 2 s start the glow, on the third", () => {
  const boss = makeBoss();
  hitAt(boss, [0, 20]);
  assert.equal(boss.shield, "none");
  hitAt(boss, [59]);
  assert.equal(boss.shield, "glow");
});

test("hits at 0, 30 and 61 are too slow for the shield", () => {
  const boss = makeBoss();
  hitAt(boss, [0, 30, 61]);
  assert.equal(boss.shield, "none");
});

test("hits during the glow do damage; the shield rises 15 ticks after the glow starts", () => {
  const world = bossWorld();
  const { boss } = world;
  boss.hit();
  boss.hit();
  boss.hit();
  assert.equal(boss.shield, "glow");
  const hp = boss.hp;
  assert.equal(boss.hit(), "hit");
  assert.equal(boss.hp, hp - 1);
  tick(world, SHIELD_GLOW - 1);
  assert.equal(boss.shield, "glow");
  assert.ok(!world.events.includes("shield-up"));
  tick(world, 1);
  assert.equal(boss.shield, "up");
  assert.ok(world.events.includes("shield-up"));
});

test("fireballs bounce off the shield: no damage, counted, removed, one event each", () => {
  const world = bossWorld();
  const { boss } = world;
  raiseShield(world);
  world.events = [];
  const hp = boss.hp;
  for (let i = 0; i < 4; i++) {
    fireballAt(world, boss);
    tick(world, 1);
  }
  assert.equal(boss.hp, hp);
  assert.equal(boss.bounces, 4);
  assert.equal(world.fireballs.items.length, 0);
  assert.equal(world.events.filter((e) => e === "shield-bounce").length, 4);
});

test("up for 90 ticks, then 120 ticks of cooldown where hits count for damage only", () => {
  const boss = makeBoss();
  boss.hit();
  boss.hit();
  boss.hit();
  age(boss, SHIELD_GLOW);
  assert.equal(boss.shield, "up");
  age(boss, SHIELD_TICKS - 1);
  assert.equal(boss.shield, "up");
  age(boss, 1);
  assert.equal(boss.shield, "cooldown");
  const hp = boss.hp;
  boss.hit();
  boss.hit();
  boss.hit();
  assert.equal(boss.hp, hp - 3);
  assert.equal(boss.shield, "cooldown");
  age(boss, SHIELD_COOLDOWN);
  assert.equal(boss.shield, "none");
  boss.hit();
  boss.hit();
  boss.hit();
  assert.equal(boss.shield, "glow");
});

test("the cooldown's hits are forgotten when it ends", () => {
  const boss = makeBoss();
  boss.shield = "cooldown";
  boss.shieldTimer = 1;
  boss.hit();
  boss.hit();
  age(boss, 1);
  assert.equal(boss.shield, "none");
  boss.hit(); // the third hit overall, but the first of a fresh count
  assert.equal(boss.shield, "none");
});

test("a killing third hit raises no glow", () => {
  const boss = makeBoss();
  boss.hp = 2;
  assert.equal(boss.hit(), "hit");
  assert.equal(boss.hit(), "dead");
  assert.equal(boss.shield, "none");
});

test("a vanished Sand Chameleon takes no hits and counts none", () => {
  const boss = makeBoss("sandLizard");
  boss.alpha = 0.2;
  assert.equal(boss.hit(), null);
  assert.equal(boss.hit(), null);
  assert.equal(boss.hit(), null);
  boss.alpha = 1;
  boss.hit();
  assert.equal(boss.shield, "none");
});

test("a community boss has the shield too", () => {
  registerBoss(
    "shieldtest",
    { ...BOSSES.kingPig, name: "Test", sounds: {} },
    { "walk-left": [], "walk-right": [] },
  );
  const boss = new Boss(
    { id: "c1", kind: "shieldtest", left: 10, top: 10 },
    { minX: 4, maxX: 400, groundY: 176 },
  );
  boss.hit();
  boss.hit();
  boss.hit();
  assert.equal(boss.shield, "glow");
});

// ---------------------------------------------------------------- helpers
function bossWorld() {
  const level = LEVELS.find((l) => l.boss);
  const world = new World();
  world.reset();
  world.player.setLeft(level.left);
  world.player.setTop(level.top);
  world.setup(areas[level.id]);
  tick(world, 2);
  world.boss.state = "intro";
  world.boss.timer = 9999;
  return world;
}

function raiseShield(world) {
  const { boss } = world;
  boss.hit();
  boss.hit();
  boss.hit();
  tick(world, SHIELD_GLOW);
  assert.equal(boss.shield, "up");
}

/** A fireball flying right, about to reach the boss. */
function fireballAt(world, boss) {
  world.fireballs.add("f", boss.x - 24, boss.getCenterY() - 8, 1);
  return world.fireballs.items[world.fireballs.items.length - 1];
}
