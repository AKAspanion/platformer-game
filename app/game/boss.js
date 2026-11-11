import Object from "./object";
import Animator from "./animator";

/**
 * World bosses (level 6 of every world). Each is a big crowned version of one
 * of its world's enemies (sprites from scripts/generate-sprites.py) with its
 * own move set and look in motion. They get harder world by world (`tier`):
 * more health, shorter breaks, quicker wind-ups, attacks chained together, and
 * from tier 3 a final phase under a quarter of their health.
 *
 *   King Pig        charge, stomp, summon piglets
 *   Frost Slime     triple bounce, icicle rain, splits in two when hurt
 *   Sand Chameleon  vanish and reappear behind you, tongue lash, sand fan, charge
 *   Bat Lord        swoop dives, sonic rings, bat swarm
 *   Mecha Beetle    rocket charge (bounces back), missile barrage, floor laser, quake
 *
 * Every attack is telegraphed ("!", a tremble, ground marks or a red line)
 * before it lands. Both arena gates stay shut until the boss is beaten.
 */
export const BOSSES = {
  kingPig: {
    name: "King Pig",
    base: "pig",
    tier: 1,
    hp: 12,
    width: 44,
    height: 40,
    speed: 0.9,
    moves: ["charge", "stomp", "charge", "summon"],
    minion: "pig",
    colors: ["#e8e2d0", "#cfc6ae", "#a98d6a"],
  },
  frostSlime: {
    name: "Frost Slime",
    base: "slime",
    tier: 2,
    hp: 16,
    width: 50,
    height: 34,
    speed: 0.7,
    splits: true, // splits in two when first badly hurt
    moves: ["bounce", "icicles", "bounce", "icicles"],
    minion: "slime",
    colors: ["#e6f6ff", "#9fd8ff", "#5fb4f0"],
  },
  sandLizard: {
    name: "Sand Chameleon",
    base: "chameleon",
    tier: 3,
    hp: 20,
    width: 44,
    height: 40,
    speed: 0.9,
    moves: ["vanish", "fan", "charge", "vanish", "tongue"],
    minion: "beetle",
    colors: ["#f3d9a0", "#e2b860", "#c48a3a"],
  },
  batLord: {
    name: "Bat Lord",
    base: "bat",
    tier: 4,
    hp: 24,
    width: 44,
    height: 30,
    speed: 1.2,
    flyer: true,
    moves: ["swoop", "rings", "swoop", "swarm"],
    minion: "bat",
    colors: ["#c9a0ff", "#8a5cd0", "#ff5a8a"],
  },
  mechBeetle: {
    name: "Mecha Beetle",
    base: "beetle",
    tier: 5,
    hp: 28,
    width: 46,
    height: 32,
    speed: 0.9,
    moves: ["rocket", "missiles", "laser", "quake", "summon"],
    minion: "beetle",
    colors: ["#ffffff", "#ffd84d", "#ff7a2a"],
  },
};

// Base sprite heights at 2x (the crown adds 24px on top of those).
const BASE_HEIGHT = { pig: 60, slime: 60, chameleon: 76, bat: 48, beetle: 56 };
const CROWN = 24;
const DEATH_FRAMES = 8;

const frames = {};
const loader = { assetCount: 0, loadCount: 0 };

const drawn = new Set(); // bosses drawn in code (see registerBoss): no files

/** [frame set, url] for each sprite file of one built-in boss. */
const bossFiles = (kind) => {
  const root = `./assets/sprites/enemies`;
  const { base } = BOSSES[kind];
  const files = [];
  ["left", "right"].forEach((side) => {
    for (let i = 1; i <= 4; i++) {
      files.push([`walk-${side}`, `${root}/boss/${kind}/${side}/image_part_0${i}.png`]);
      files.push([`attack-${side}`, `${root}/boss/${kind}/attack/${side}/image_part_0${i}.png`]);
    }
    for (let i = 1; i <= DEATH_FRAMES; i++) {
      files.push([`dead-${side}`, `${root}/${base}/dead/${side}/image_part_0${i}.png`]);
    }
  });
  return files;
};

/** Every sprite url a boss needs (none for one drawn in code). */
export const bossImages = (kind) =>
  BOSSES[kind] && !drawn.has(kind) ? bossFiles(kind).map(([, src]) => src) : [];

const load = (kind) => {
  if (frames[kind]) return frames[kind];
  const set = (frames[kind] = {});
  bossFiles(kind).forEach(([key, src]) => {
    const image = new Image();
    image.onload = image.onerror = () => {
      loader.loadCount += 1;
    };
    image.src = src;
    (set[key] = set[key] || []).push(image);
    loader.assetCount += 1;
  });
  return set;
};

/**
 * Add a boss at runtime (generated worlds). `config` is like a BOSSES entry,
 * plus `crown` (px of headroom drawn above the hit box) and optionally
 * `flyMinion` (what "swarm" calls). `set` holds drawn frames:
 * { "walk-left": [], "walk-right": [], "attack-left": [], ..., "dead-right": [] }.
 */
export const registerBoss = (kind, config, set) => {
  BOSSES[kind] = config;
  drawn.add(kind);
  frames[kind] = set;
};

export const bossAssets = {
  get assetCount() {
    return loader.assetCount;
  },
  get loadCount() {
    return loader.loadCount;
  },
  get loaded() {
    return loader.loadCount >= loader.assetCount;
  },
};

/** The shield: 3 hits within 2 s raise it (after a 0.5 s glow) for 3 s, then 4 s of cooldown. */
export const SHIELD_HITS = 3;
export const SHIELD_WINDOW = 60;
export const SHIELD_GLOW = 15;
export const SHIELD_TICKS = 90;
export const SHIELD_COOLDOWN = 120;

const ease = (value, target, rate) => value + (target - value) * rate;

export default class Boss extends Object {
  /**
   * `spec` is the area's boss entry { id, kind, left, top }. `arena` gives the
   * walkable span { minX, maxX, groundY } in world pixels.
   */
  constructor(spec, arena) {
    const config = BOSSES[spec.kind] || BOSSES.kingPig;
    super(spec.left * 16, arena.groundY - config.height, config.width, config.height);

    this.id = spec.id;
    this.kind = spec.kind;
    this.config = config;
    this.tier = config.tier;
    this.name = config.name;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.arena = arena;
    this.frames = load(spec.kind);
    this.direction = -1;
    this.state = "intro";
    this.timer = 45; // a beat before the fight starts
    this.cooldown = 30;
    this.moveIndex = 0;
    this.flash = 0;
    this.vx = 0;
    this.vy = 0;
    this.phase = 0;
    this.step = 0; // sub-step inside a multi-part move
    this.hoverY = 30;
    if (config.flyer) this.y = this.hoverY;
    this.dying = false;
    this.dead = false;
    this.split = false;
    this.shield = "none"; // none | glow | up | cooldown
    this.shieldTimer = 0;
    this.bounces = 0; // fireballs bounced off the shield this fight
    this.ticks = 0; // fight clock, for the hit window
    this.recentHits = []; // ticks of the latest hits, for the shield
    this.performed = new Set(); // moves used so far (tests, debugging)
    this.crown = config.crown ?? (config.height * CROWN) / BASE_HEIGHT[config.base];

    // look in motion
    this.scaleX = 1;
    this.scaleY = 1;
    this.tilt = 0;
    this.alpha = 1;
    this.jitter = 0;
    this.trail = [];

    this.animator = new Animator(this.frames["walk-left"], 4);
  }

  /** Below half health: faster and more aggressive. */
  get enraged() {
    return this.hp <= this.maxHp / 2;
  }

  /** Tier 3+ under a quarter of their health: chains two attacks at a time. */
  get final() {
    return this.tier >= 3 && this.hp <= this.maxHp / 4;
  }

  get speed() {
    return this.config.speed * (this.enraged ? 1.35 : 1) * (this.final ? 1.2 : 1);
  }

  /** Telegraph length: later bosses give you less time to react. */
  get windupTicks() {
    const base = 20 - this.tier * 2;
    return Math.max(8, Math.round(base * (this.enraged ? 0.75 : 1)));
  }

  nextCooldown() {
    const base = 84 - this.tier * 9;
    const mood = this.final ? 0.45 : this.enraged ? 0.65 : 1;
    return Math.max(16, Math.round(base * mood + Math.random() * 16));
  }

  /** Fireballs pass through while it's vanished. */
  get hittable() {
    return !this.dying && this.alpha > 0.45;
  }

  setFrames(name, delay = 4) {
    const side = this.direction < 0 ? "left" : "right";
    const set = this.frames[`${name}-${side}`];
    if (set) this.animator.changeFrameSet(set, delay);
  }

  face(player) {
    if (!player) return;
    const direction = player.getCenterX() < this.getCenterX() ? -1 : 1;
    if (direction !== this.direction) {
      this.direction = direction;
      this.setFrames(this.state === "walk" ? "walk" : "attack");
    }
  }

  setState(state, timer = 0) {
    this.state = state;
    this.timer = timer;
    this.step = 0;
    if (state === "walk" || state === "stunned") this.setFrames("walk", this.enraged ? 3 : 4);
    else this.setFrames("attack", 3);
  }

  get onGround() {
    return this.y + this.height >= this.arena.groundY - 0.5;
  }

  /** A fireball hit. Returns "hit", "dead", "bounced" (shield up) or null. One damage per fireball. */
  hit() {
    if (!this.hittable) return null;
    if (this.shield === "up") {
      this.bounces += 1;
      return "bounced";
    }
    this.hp -= 1;
    this.flash = 6;
    this.scaleX = 1.1;
    this.scaleY = 0.9;
    if (this.hp > 0) {
      this.countHit();
      return "hit";
    }
    this.shield = "none";
    this.dying = true;
    this.state = "dying";
    this.alpha = 1;
    this.tilt = 0;
    const side = this.direction < 0 ? "left" : "right";
    this.animator.changeFrameSet(this.frames[`dead-${side}`], 3);
    return "dead";
  }

  /** Note a hit that did damage; the third within the window starts the glow. */
  countHit() {
    if (this.shield !== "none") return; // glowing: it's coming anyway; cooldown: doesn't count
    this.recentHits.push(this.ticks);
    if (this.recentHits.length > SHIELD_HITS) this.recentHits.shift();
    if (this.recentHits.length === SHIELD_HITS && this.ticks - this.recentHits[0] < SHIELD_WINDOW) {
      this.shield = "glow";
      this.shieldTimer = SHIELD_GLOW;
      this.recentHits = [];
    }
  }

  updateShield() {
    if (this.shield === "none" || this.shield === undefined) return;
    this.shieldTimer -= 1;
    if (this.shieldTimer > 0) return;
    if (this.shield === "glow") {
      this.shield = "up";
      this.shieldTimer = SHIELD_TICKS;
    } else if (this.shield === "up") {
      this.shield = "cooldown";
      this.shieldTimer = SHIELD_COOLDOWN;
    } else {
      this.shield = "none";
      this.recentHits = [];
    }
  }

  clampX() {
    const { minX, maxX } = this.arena;
    if (this.x < minX) {
      this.x = minX;
      return true;
    }
    if (this.x + this.width > maxX) {
      this.x = maxX - this.width;
      return true;
    }
    return false;
  }

  land() {
    this.y = this.arena.groundY - this.height;
    this.vy = 0;
    this.scaleX = 1.3;
    this.scaleY = 0.72;
  }

  addTrail() {
    this.trail.push({ x: this.x, y: this.y, frame: this.animator.frameValue, life: 8 });
    if (this.trail.length > 6) this.trail.shift();
  }

  /**
   * `act` callbacks from the world:
   *   warn(x, y), shoot(x, y, { vx, vy, gravity, kind, floor }), slam(x, y),
   *   summon(type, count), hazard({ x, y, width, height, warn, active, kind }),
   *   particles(x, y, count)
   */
  update(player, act) {
    if (this.flash > 0) this.flash -= 1;
    // ease the look back to normal
    this.scaleX = ease(this.scaleX, 1, 0.2);
    this.scaleY = ease(this.scaleY, 1, 0.2);
    this.tilt = ease(this.tilt, 0, 0.15);
    this.jitter = 0;
    this.trail.forEach((t) => (t.life -= 1));
    this.trail = this.trail.filter((t) => t.life > 0);
    if (this.dying) return;
    this.ticks += 1;
    this.updateShield();
    this.phase += 0.08;
    if (this.timer > 0) this.timer -= 1;

    // split in two when first hurt badly (Frost Slime)
    if (this.config.splits && this.enraged && !this.split) {
      this.split = true;
      act.summon(this.config.minion, 2);
      this.scaleX = 0.7;
      this.scaleY = 1.3;
      act.particles(this.getCenterX(), this.getCenterY(), 16);
    }

    const handler = MOVES[this.state];
    if (handler) return handler.update(this, player, act);

    switch (this.state) {
      case "intro":
        this.idle();
        if (this.timer <= 0) this.setState("walk");
        return;
      case "walk":
        return this.walk(player, act);
      case "windup":
        return this.windup(player, act);
      case "stunned":
        this.idle();
        this.tilt = Math.sin(this.phase * 6) * 0.06; // dizzy wobble
        if (this.timer <= 0) this.recover();
        return;
      default:
        return;
    }
  }

  idle() {
    if (this.config.flyer) this.y = this.hoverY + Math.sin(this.phase * 2) * 5;
    // breathing
    this.scaleY = ease(this.scaleY, 1 + Math.sin(this.phase * 2) * 0.03, 0.3);
  }

  recover() {
    // later bosses chain a second attack straight away in their final phase
    if (this.final && !this.chained) {
      this.chained = true;
      this.cooldown = 0;
    } else {
      this.chained = false;
      this.cooldown = this.nextCooldown();
    }
    this.setState("walk");
  }

  walk(player, act) {
    this.face(player);
    this.idle();
    if (this.config.flyer) {
      this.x += this.speed * this.direction;
    } else if (player) {
      const dx = player.getCenterX() - this.getCenterX();
      if (Math.abs(dx) > 44) {
        this.x += this.speed * Math.sign(dx);
        // a little bob as it walks
        this.scaleY = 1 + Math.abs(Math.sin(this.phase * 4)) * 0.05;
      }
    }
    this.clampX();
    this.cooldown -= 1;
    if (this.cooldown <= 0 && player) {
      this.nextMove = this.config.moves[this.moveIndex++ % this.config.moves.length];
      this.setState("windup", this.windupTicks);
      act.warn(this.getCenterX(), this.y - this.crown - 4);
    }
  }

  windup(player, act) {
    this.face(player);
    const move = MOVES[this.nextMove];
    // each move has its own tell
    if (move && move.tell) move.tell(this, player, act);
    else this.jitter = 1;
    if (this.timer > 0) return;
    this.performed.add(this.nextMove);
    if (move) {
      this.setState(this.nextMove, move.length ? move.length(this) : 30);
      move.start(this, player, act);
    } else this.setState("walk");
  }

  updateAnimation() {
    if (this.dying) {
      if (this.animator.frameIndex === this.animator.frameSet.length - 1) {
        this.holdLast = (this.holdLast || 0) + 1;
        if (this.holdLast > 6) this.dead = true;
        return;
      }
      this.animator.animate(true);
      return;
    }
    this.animator.animate(this.state !== "walk" && this.state !== "intro");
  }

  /** Draw rect: the sprite has crown headroom above the hit box; deaths are 2x. */
  drawRect() {
    if (this.dying) {
      return {
        x: this.x - this.width * 0.5,
        y: this.y - this.height * 0.75,
        width: this.width * 2,
        height: this.height * 2,
      };
    }
    const shake = this.jitter ? (Math.random() * 2 - 1) * this.jitter * 1.5 : 0;
    return {
      x: this.x + shake,
      y: this.y - this.crown + 1,
      width: this.width,
      height: this.height + this.crown,
    };
  }
}

// --------------------------------------------------------------------- moves
// Each move: tell (during the wind-up), start, update (return when done),
// and length (ticks; also a safety timeout).

const towards = (boss, player) => (player ? player.getCenterX() : boss.getCenterX());

const MOVES = {
  // ground dash across the arena; stuns itself on the wall
  charge: {
    tell(boss, player, act) {
      boss.jitter = 1;
      boss.tilt = -0.18 * boss.direction; // lean back
      if (boss.timer % 4 === 0)
        act.particles(boss.getCenterX() - boss.direction * 18, boss.getBottom(), 2);
    },
    length: () => 60,
    start() {},
    update(boss, player, act) {
      boss.x += (4 + boss.tier * 0.5) * boss.direction * (boss.enraged ? 1.15 : 1);
      boss.tilt = 0.14 * boss.direction;
      boss.scaleX = 1.12;
      boss.addTrail();
      if (boss.timer % 2 === 0)
        act.particles(boss.getCenterX() - boss.direction * 20, boss.getBottom(), 2);
      if (boss.clampX() || boss.timer <= 0) {
        act.slam(boss.direction < 0 ? boss.x : boss.x + boss.width, boss.arena.groundY);
        boss.scaleX = 0.8;
        boss.scaleY = 1.15;
        boss.setState("stunned", Math.max(14, 40 - boss.tier * 5));
      }
    },
  },

  // Mecha Beetle: faster charge that bounces off the wall and comes back
  rocket: {
    tell(boss, player, act) {
      boss.jitter = 1.5;
      boss.tilt = -0.2 * boss.direction;
      act.particles(boss.getCenterX() - boss.direction * 22, boss.getCenterY(), 1);
    },
    length: () => 90,
    start(boss) {
      boss.bounces = boss.enraged ? 2 : 1;
    },
    update(boss, player, act) {
      boss.x += 6.5 * boss.direction;
      boss.tilt = 0.1 * boss.direction;
      boss.addTrail();
      act.particles(boss.getCenterX() - boss.direction * 24, boss.getCenterY() + 4, 2);
      if (boss.clampX()) {
        act.slam(boss.direction < 0 ? boss.x : boss.x + boss.width, boss.arena.groundY);
        if (boss.bounces-- > 0) {
          boss.direction *= -1;
          boss.setFrames("attack", 2);
          boss.scaleX = 0.75;
        } else boss.setState("stunned", 18);
      }
      if (boss.timer <= 0) boss.setState("stunned", 18);
    },
  },

  // King Pig: a heavy hop at the player; rolling seeds on landing
  stomp: {
    tell(boss) {
      boss.scaleX = 1.18;
      boss.scaleY = 0.82; // crouch
    },
    length: () => 60,
    start(boss, player) {
      boss.vy = -12;
      boss.vx = (towards(boss, player) - boss.getCenterX()) / 26;
      boss.scaleX = 0.85;
      boss.scaleY = 1.2;
    },
    update(boss, player, act) {
      boss.vy += 0.9;
      boss.x += boss.vx;
      boss.y += boss.vy;
      boss.clampX();
      if (boss.vy > 0 && boss.onGround) {
        boss.land();
        act.slam(boss.getCenterX(), boss.arena.groundY);
        const speed = 2 + boss.tier * 0.3;
        act.shoot(boss.x, boss.arena.groundY - 6, { vx: -speed, vy: 0, gravity: 0 });
        act.shoot(boss.x + boss.width, boss.arena.groundY - 6, { vx: speed, vy: 0, gravity: 0 });
        boss.setState("stunned", 26);
      } else if (boss.timer <= 0) boss.setState("stunned", 10);
    },
  },

  // Frost Slime: three hops at the player, the last one high and hard
  bounce: {
    tell(boss) {
      boss.scaleX = 1.25;
      boss.scaleY = 0.75;
    },
    length: () => 140,
    start(boss, player) {
      boss.hops = 3;
      MOVES.bounce.hop(boss, player);
    },
    hop(boss, player) {
      const last = boss.hops === 1;
      boss.vy = last ? -17 : -10;
      boss.vx = (towards(boss, player) - boss.getCenterX()) / (last ? 36 : 22);
      boss.scaleX = 0.75;
      boss.scaleY = 1.3;
    },
    update(boss, player, act) {
      boss.vy += 0.9;
      boss.x += boss.vx;
      boss.y += boss.vy;
      boss.scaleY = ease(boss.scaleY, boss.vy < 0 ? 1.15 : 0.95, 0.2);
      boss.clampX();
      if (boss.vy > 0 && boss.onGround) {
        boss.land();
        act.particles(boss.getCenterX(), boss.arena.groundY, 6);
        boss.hops -= 1;
        if (boss.hops > 0) {
          boss.face(player);
          MOVES.bounce.hop(boss, player);
        } else {
          act.slam(boss.getCenterX(), boss.arena.groundY);
          // ice shards fly up and out
          [-2.6, -1.4, 1.4, 2.6].forEach((vx) =>
            act.shoot(boss.getCenterX(), boss.y + 8, { vx, vy: -4, gravity: 0.25, kind: "shard" }),
          );
          boss.setState("stunned", 22);
        }
      }
      if (boss.timer <= 0) boss.setState("stunned", 10);
    },
  },

  // Frost Slime: icicles fall where marks appear around the player
  icicles: {
    tell(boss) {
      boss.scaleY = 1.12;
      boss.scaleX = 0.92;
      boss.jitter = 0.6;
    },
    length: (boss) => 50 + boss.tier * 4,
    start(boss, player, act) {
      const count = 4 + (boss.enraged ? 2 : 0);
      const px = towards(boss, player);
      const { minX, maxX, groundY } = boss.arena;
      boss.marks = [];
      for (let i = 0; i < count; i++) {
        const x = Math.max(
          minX + 8,
          Math.min(maxX - 8, px + (i - (count - 1) / 2) * 30 + (Math.random() * 10 - 5)),
        );
        boss.marks.push(x);
        // the mark stays until its icicle lands
        act.hazard({
          x: x - 6,
          y: groundY - 3,
          width: 12,
          height: 3,
          warn: 42 + i * 4,
          active: 0,
          kind: "mark",
        });
      }
    },
    update(boss, player, act) {
      boss.idle();
      // drop each icicle as its mark runs out
      const elapsed = MOVES.icicles.length(boss) - boss.timer;
      boss.marks.forEach((x, i) => {
        if (elapsed === 14 + i * 4) {
          act.shoot(x, -6, {
            vx: 0,
            vy: 1,
            gravity: 0.32,
            kind: "icicle",
            floor: boss.arena.groundY,
          });
        }
      });
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Sand Chameleon: fades out, reappears behind the player, then lashes
  vanish: {
    tell(boss) {
      boss.alpha = ease(boss.alpha, 0.5, 0.2);
    },
    length: () => 46,
    start(boss) {
      boss.step = 0;
    },
    update(boss, player, act) {
      const t = 46 - boss.timer;
      if (t < 12) boss.alpha = ease(boss.alpha, 0.05, 0.3);
      else if (t === 12 && player) {
        // pop up on the far side of the player
        const side = player.getCenterX() < boss.getCenterX() ? -1 : 1;
        boss.x = player.getCenterX() + side * 60 - boss.width / 2;
        boss.clampX();
        boss.face(player);
        act.particles(boss.getCenterX(), boss.getBottom(), 8);
      } else if (t > 12) boss.alpha = ease(boss.alpha, 1, 0.3);
      if (t === 24) {
        MOVES.tongue.start(boss, player, act);
      }
      if (boss.timer <= 0) {
        boss.alpha = 1;
        boss.recover();
      }
    },
  },

  // Sand Chameleon: a long tongue straight ahead (jump over it)
  tongue: {
    tell(boss) {
      boss.scaleX = 0.9;
      boss.tilt = -0.08 * boss.direction;
    },
    length: () => 30,
    start(boss, player, act) {
      const reach = 110 + boss.tier * 10;
      const mouth = boss.direction > 0 ? boss.x + boss.width - 6 : boss.x + 6;
      act.hazard({
        x: boss.direction > 0 ? mouth : mouth - reach,
        y: boss.y + boss.height * 0.45,
        width: reach,
        height: 6,
        warn: 10,
        active: 10,
        kind: "tongue",
        direction: boss.direction,
      });
    },
    update(boss) {
      boss.scaleX = ease(boss.scaleX, 1.1, 0.2);
      if (boss.timer <= 0) boss.recover();
    },
  },

  // a fan of seeds at the player (more seeds on harder bosses)
  fan: {
    tell(boss) {
      boss.scaleY = 0.88;
      boss.scaleX = 1.1;
    },
    length: () => 20,
    start(boss, player, act) {
      const n = 3 + Math.floor(boss.tier / 2) + (boss.enraged ? 2 : 0);
      const mouthX = boss.getCenterX() + boss.direction * boss.width * 0.4;
      const mouthY = boss.y + boss.height * 0.35;
      for (let i = 0; i < n; i++) {
        const vy = -2 + (i * 2.6) / Math.max(1, n - 1);
        act.shoot(mouthX, mouthY, { vx: 2.6 * boss.direction, vy, gravity: 0.04, kind: "sand" });
      }
      boss.scaleX = 0.85;
    },
    update(boss) {
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Bat Lord: dive at the player and climb back (twice when enraged)
  swoop: {
    tell(boss) {
      boss.y = ease(boss.y, boss.hoverY - 10, 0.2); // rises before diving
      boss.jitter = 0.5;
    },
    length: (boss) => (boss.enraged ? 64 : 34),
    start(boss, player) {
      boss.dives = boss.enraged ? 2 : 1;
      MOVES.swoop.aim(boss, player);
    },
    aim(boss, player) {
      boss.diveT = 0;
      boss.diveDepth = player
        ? Math.max(24, player.getCenterY() - boss.hoverY - boss.height / 2)
        : 60;
      boss.vx = (towards(boss, player) - boss.getCenterX()) / 16;
    },
    update(boss, player, act) {
      boss.diveT += 1;
      const t = Math.min(1, boss.diveT / 30);
      boss.x += boss.vx;
      boss.y = boss.hoverY + Math.sin(t * Math.PI) * boss.diveDepth;
      boss.tilt = t < 0.5 ? 0.25 * Math.sign(boss.vx || 1) : -0.15 * Math.sign(boss.vx || 1);
      boss.addTrail();
      if (boss.diveT % 3 === 0) act.particles(boss.getCenterX(), boss.getCenterY(), 1);
      boss.clampX();
      if (t >= 1) {
        boss.dives -= 1;
        if (boss.dives > 0 && player) {
          boss.face(player);
          MOVES.swoop.aim(boss, player);
        } else {
          boss.y = boss.hoverY;
          boss.recover();
        }
      }
      if (boss.timer <= 0) {
        boss.y = boss.hoverY;
        boss.recover();
      }
    },
  },

  // Bat Lord: rings of sonic orbs from its body
  rings: {
    tell(boss) {
      boss.scaleX = 1 + Math.sin(boss.phase * 20) * 0.08;
      boss.scaleY = 1 - Math.sin(boss.phase * 20) * 0.08;
    },
    length: (boss) => (boss.enraged ? 40 : 24),
    start(boss, player, act) {
      MOVES.rings.ring(boss, act, 0);
    },
    ring(boss, act, offset) {
      const n = 8 + (boss.enraged ? 4 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + offset;
        act.shoot(boss.getCenterX(), boss.getCenterY(), {
          vx: Math.cos(a) * 1.7,
          vy: Math.sin(a) * 1.7,
          gravity: 0,
          kind: "orb",
        });
      }
      boss.scaleX = 1.25;
      boss.scaleY = 1.25;
    },
    update(boss, player, act) {
      boss.idle();
      // a second, offset ring when enraged
      if (boss.enraged && boss.timer === 20) MOVES.rings.ring(boss, act, Math.PI / 12);
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Bat Lord: calls a swarm
  swarm: {
    tell(boss) {
      boss.scaleX = 1.2;
      boss.jitter = 0.8;
    },
    length: () => 24,
    start(boss, player, act) {
      act.summon(boss.config.flyMinion || "bat", boss.enraged ? 3 : 2);
    },
    update(boss) {
      boss.idle();
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Mecha Beetle: lobs missiles at where the player is standing
  missiles: {
    tell(boss) {
      boss.tilt = -0.12 * boss.direction;
      boss.jitter = 0.6;
    },
    length: (boss) => (boss.enraged ? 52 : 40),
    start(boss) {
      boss.fired = 0;
    },
    update(boss, player, act) {
      const count = boss.enraged ? 5 : 3;
      const elapsed = MOVES.missiles.length(boss) - boss.timer;
      if (boss.fired < count && elapsed % 9 === 0) {
        boss.fired += 1;
        const fromX = boss.getCenterX() + boss.direction * 10;
        const fromY = boss.y;
        const toX = towards(boss, player) + (Math.random() * 24 - 12);
        const flight = 40;
        act.hazard({
          x: toX - 7,
          y: boss.arena.groundY - 3,
          width: 14,
          height: 3,
          warn: flight,
          active: 0,
          kind: "mark",
        });
        act.shoot(fromX, fromY, {
          vx: (toX - fromX) / flight,
          vy: -7,
          gravity: (2 * (7 * flight + (boss.arena.groundY - fromY))) / (flight * flight),
          kind: "missile",
          floor: boss.arena.groundY,
        });
        boss.scaleY = 0.9;
      }
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Mecha Beetle: a laser along the floor after a red warning line (jump!)
  laser: {
    tell(boss) {
      boss.jitter = 1;
      boss.scaleX = 1.05;
    },
    length: () => 48,
    start(boss, player, act) {
      const { minX, maxX, groundY } = boss.arena;
      act.hazard({
        x: minX,
        y: groundY - 12,
        width: maxX - minX,
        height: 9,
        warn: 26,
        active: 14,
        kind: "laser",
      });
    },
    update(boss) {
      boss.jitter = 0.6;
      if (boss.timer <= 0) boss.recover();
    },
  },

  // Mecha Beetle: a big jump; two waves of rolling seeds when it lands
  quake: {
    tell(boss) {
      boss.scaleX = 1.2;
      boss.scaleY = 0.8;
    },
    length: () => 80,
    start(boss, player) {
      boss.vy = -15;
      boss.vx = (towards(boss, player) - boss.getCenterX()) / 33;
      boss.landed = false;
    },
    update(boss, player, act) {
      const { groundY } = boss.arena;
      if (!boss.landed) {
        boss.vy += 0.9;
        boss.x += boss.vx;
        boss.y += boss.vy;
        boss.clampX();
        if (boss.vy > 0 && boss.onGround) {
          boss.land();
          boss.landed = true;
          boss.waveAt = boss.timer - 14;
          act.slam(boss.getCenterX(), groundY);
          MOVES.quake.wave(boss, act);
        }
      } else if (boss.timer === boss.waveAt) {
        act.slam(boss.getCenterX(), groundY);
        MOVES.quake.wave(boss, act);
      }
      if (boss.timer <= 0) boss.setState("stunned", 16);
    },
    wave(boss, act) {
      const y = boss.arena.groundY - 6;
      act.shoot(boss.x, y, { vx: -3, vy: 0, gravity: 0 });
      act.shoot(boss.x + boss.width, y, { vx: 3, vy: 0, gravity: 0 });
    },
  },

  summon: {
    tell(boss) {
      boss.scaleY = 1.15;
      boss.jitter = 0.8;
    },
    length: () => 24,
    start(boss, player, act) {
      act.summon(boss.config.minion, 2);
    },
    update(boss) {
      boss.idle();
      if (boss.timer <= 0) boss.recover();
    },
  },
};

export const BOSS_MOVES = globalThis.Object.keys(MOVES);
