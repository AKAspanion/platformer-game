import Coins from "./coins";
import Water from "./water";
import Player from "./player";
import Object from "./object";
import Portal from "./portal";
import Enemies, { enemyTypes, enemyImages } from "./enemies";
import PowerUps from "./powerups";
import Collider from "./collider";
import Effects from "./effects";
import Combo from "./combo";
import Fireballs from "./fireballs";
import Projectiles, { SEED_IMAGES } from "./projectiles";
import { walkerShoots, storyDifficulty } from "../pcg/generator";
import Boss, { bossAssets, bossImages, BOSSES } from "./boss";
import { POWERUP_TICKS } from "./player";
import AudioController from "../controller/audio";
import { getSkin, audioSrc, hasAudio } from "../util/registry";
import areas from "../areas";
import { preloadArea } from "./preload";
import sfx, { ENEMY_SFX, BOSS_MOVE_SFX } from "../controller/sfx";

// particles when a projectile breaks, by kind
const PROJECTILE_BREAK = {
  seed: { count: 4, colors: ["#7a4a22", "#c89a5a"], speed: 1, life: 6 },
  sand: { count: 5, colors: ["#f3d9a0", "#c48a3a"], speed: 1.2, life: 6 },
  shard: { count: 5, colors: ["#e6f6ff", "#9fd8ff"], speed: 1.4, life: 7 },
  icicle: { count: 9, colors: ["#ffffff", "#bfe8ff", "#7cc8f5"], speed: 2, life: 9, gravity: 0.2 },
  orb: { count: 5, colors: ["#e0c8ff", "#a070e0"], speed: 1.2, life: 7, gravity: 0 },
  mud: { count: 5, colors: ["#6b4a2b", "#8f6a42", "#4a3220"], speed: 1.1, life: 6, gravity: 0.1 },
  glob: { count: 6, colors: ["#8be07a", "#c8f5a8", "#4fb04a"], speed: 1.3, life: 7, gravity: 0.08 },
  spit: { count: 5, colors: ["#d8f07a", "#f4ffb0", "#9ac83a"], speed: 1.2, life: 6, gravity: 0.04 },
  pebble: {
    count: 5,
    colors: ["#b8b2a8", "#8a847a", "#e0dcd0"],
    speed: 1.2,
    life: 6,
    gravity: 0.12,
  },
  missile: {
    count: 14,
    colors: ["#ffffff", "#ffd84d", "#ff7a2a", "#5a5560"],
    speed: 2.8,
    life: 11,
    gravity: 0.1,
  },
};

// the sound of a walker throwing its shot, by projectile kind
const THROW_SFX = {
  mud: "mud-throw",
  glob: "glob-throw",
  spit: "spit-throw",
  pebble: "pebble-throw",
};

const POWERUP_TEXT = { heart: "+1 HEART", shield: "SHIELD", triple: "TRIPLE FIRE", wings: "WINGS" };

/** Enemy kinds a boss calls in: its minion, and bats for a swarm. */
const bossMinions = (kind) => {
  const config = BOSSES[kind];
  if (!config) return [];
  const flyer = config.flyMinion || (config.moves.includes("swarm") && "bat");
  return flyer ? [config.minion, flyer] : [config.minion];
};

/** The enemy kinds, boss and seed sprites an area asks for. */
const needsOf = (area) => {
  const types = [...new Set((area.enemies || []).map(({ type }) => type))];
  const boss = area.boss ? area.boss.kind : null;
  const turret = types.some((type) => enemyTypes[type] && enemyTypes[type].kind === "turret");
  return { types, boss, minions: boss ? bossMinions(boss) : [], seed: turret || !!boss };
};

/**
 * What an area needs downloaded: { images, audio } urls. Sprites for the
 * enemy kinds in it (and the boss, its minions, the seed sprites for what
 * spits or lobs), and the area's music. Sound effects load on first play.
 */
export const assetsOf = (area) => {
  const { types, minions, boss, seed } = needsOf(area);
  const images = [
    ...enemyImages([...types, ...minions]),
    ...(boss ? bossImages(boss) : []),
    ...(seed ? SEED_IMAGES : []),
  ];
  const tracks = [area.theme, boss && `boss-${boss}`].filter((track) => track && !hasAudio(track));
  return { images, audio: tracks.map((track) => audioSrc(track, "mp3")) };
};

export default class World {
  constructor(friction = 0.87, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.loaded = true;

    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.bonus = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";
    this.collectedPowerups = "";
    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
    this.collider = new Collider();
    this.fireballs = new Fireballs();
    this.projectiles = new Projectiles();
    this.effects = new Effects();
    this.combo = new Combo();
    // game events for the shell (vibration, HUD): drained by the caller each frame
    this.events = [];

    this.audioController = new AudioController();
    // music downloads count towards the loading bar too
    this.music = { assetCount: 0, loadCount: 0 };
  }

  /** What an area needs downloaded: { images, audio } urls (see assetsOf). */
  assetsFor(area) {
    return assetsOf(area);
  }

  /** Once this level has loaded, start fetching the level its forward portal leads to. */
  preloadNext() {
    if (this.preloadStarted) return;
    this.preloadStarted = true;
    const forward = this.portals.find((p) => p.direction > 0 && p.destinationArea != null);
    if (forward) preloadArea(areas[forward.destinationArea]);
  }

  /** Download a track (once) and note when it is in. */
  loadTrack(track) {
    this.audioController.load([{ file: track, ext: "mp3" }], (val) => {
      this.loaded = val;
      if (!val) this.music.assetCount += 1;
      else if (this.music.loadCount < this.music.assetCount) this.music.loadCount += 1;
    });
  }

  /** Swap the looping music (world theme or a boss battle theme). */
  switchTrack(track) {
    if (!track || this.theme === track) return;
    this.stopThemeMusic();
    this.theme = track;
    this.playedThemeMusic = false;
    this.loadTrack(track);
  }

  setup(data) {
    // a boss arena with its boss still alive plays that boss's battle theme
    const bossAlive = data.boss && !new Set(this.killedEnemies.split(",")).has(data.boss.id);
    const track = bossAlive ? `boss-${data.boss.kind}` : data.theme;
    this.areaTheme = data.theme;
    this.musicSwap = 0;
    // music starts from update() once the level has loaded, never before
    this.playedThemeMusic = false;
    this.preloadStarted = false;
    if (this.theme !== track && track) {
      this.stopThemeMusic();
      this.theme = track;
      this.loadTrack(track);
    }

    this.id = data.id;
    this.map = data.areaMap;
    this.backdrop = data.backdrop || null; // factory back wall, drawn behind everything
    this.isPlayerDead = false;
    this.objects = data.objectsMap;
    this.collisonMap = data.collisonMap;

    if (data.rows) {
      this.rows = data.rows;
      this.height = this.tileSize * this.rows;
    }
    if (data.columns) {
      this.columns = data.columns;
      this.width = this.tileSize * this.columns;
    }

    this.deathAreas = data.death.map(({ x, y, height, width }) => new Object(x, y, width, height));

    // a story area's walkers shoot by where they stand and how hard the level is;
    // generated areas (community worlds) say so per entry
    const difficulty = storyDifficulty(data.id);
    const entries = data.enemies?.map((entry) =>
      entry.shoots === undefined && enemyTypes[entry.type]?.kind === "walker"
        ? { ...entry, shoots: walkerShoots(entry.left, difficulty, entry.sway) }
        : entry,
    );
    this.enemies = new Enemies(entries, this.tileSize, this.killedEnemies);

    this.coins = new Coins(data.coins, this.tileSize, this.collectedCoins);

    this.powerups = new PowerUps(data.powerups, this.tileSize, this.collectedPowerups);

    // level 6 of each world: a boss, unless already beaten in this run
    this.boss = null;
    this.bossState = null;
    this.shieldSeen = "none";
    this.bossArea = !!data.boss;
    // arena gates: 0 = open, 1 = shut. They start open and slam shut as the
    // fight begins; they lift again once the boss is beaten.
    this.gate = 0;
    this.gateWidth = 11;
    this.gateBottom = data.boss ? (data.boss.top + 1) * this.tileSize : 0;
    this.minions = 0;
    if (data.boss && !new Set(this.killedEnemies.split(",")).has(data.boss.id)) {
      this.boss = new Boss(data.boss, {
        minX: 4,
        maxX: this.width - 4,
        groundY: (data.boss.top + 1) * this.tileSize,
      });
      bossMinions(data.boss.kind).forEach((type) => this.enemies.load(type));
    }
    // what spits or lobs seeds needs those sprites (a boss may lob them too)
    if (this.boss || needsOf(data).seed) this.projectiles.load();
    this.combo.resetLevel();
    this.areaTicks = 0; // time spent in this area (stars: target time)

    this.portals = data.portals.map((p) => new Portal(p));

    const skin = getSkin(data.skin);
    this.water = new Water(data.water, this.tileSize, skin && skin.liquid);

    this.fireballs.reset();
    this.projectiles.reset();
    this.hazards = []; // boss attacks on the ground: marks, tongue, laser
    this.effects.reset();

    if (this.portal) {
      this.player.setCenterX(this.portal.destinationX);
      this.player.setCenterY(this.portal.destinationY);
      this.player.direction = this.portal.direction;

      this.portal = null;
    }

    // where to come back after falling in a pit, until a safer spot is seen
    this.spawn = { x: this.player.x, y: this.player.y };
    this.lastSafe = null;
    this.safeTicks = 0;
  }

  reset() {
    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.bonus = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";
    this.collectedPowerups = "";
    this.events = [];
    this.combo.resetLevel();

    this.player.reset();
  }

  get score() {
    return this.totalEnemies * 100 + this.totalCoins * 20 + this.bonus;
  }

  /**
   * A kill or coin worth `points`: steps the combo and puts the multiplier's
   * extra into the bonus. Returns the points it came to.
   */
  comboScore(points) {
    const { multiplier, count, tierUp } = this.combo.step();
    this.bonus += points * (multiplier - 1);
    sfx(`combo-${Math.min(count, 8)}`);
    if (tierUp) {
      sfx("combo-chime");
      this.emit("combo-up");
    }
    return points * multiplier;
  }

  /** A coin picked up: 20 points, multiplied by the combo. */
  scoreCoin() {
    this.totalCoins += 1;
    return this.comboScore(20);
  }

  /** The combo ends: a heart was lost. */
  endCombo() {
    this.combo.end();
  }

  emit(type) {
    this.events.push(type);
    if (this.events.length > 20) this.events.shift();
  }

  playJumpSound() {
    AudioController.play("jump", "wav");
  }

  playFireSound() {
    AudioController.play("fire", "wav");
  }

  /** Fire from the player's mouth if the cooldown allows. Returns true if fired. */
  shootFireball(id) {
    const { player } = this;
    if (this.isPlayerDead || !player.fire()) return false;

    const offsetX = player.direction < 0 ? -32 : 8;
    const x = player.x + offsetX;
    // low enough to hit short enemies (beetles) standing on the same ground
    const y = player.y - 14;
    this.fireballs.add(id, x, y, player.direction);
    if (player.triple > 0) {
      this.fireballs.add(`${id}u`, x, y, player.direction, -1.3);
      this.fireballs.add(`${id}d`, x, y, player.direction, 1.3);
    }
    this.effects.burst(player.getCenterX() + player.direction * 10, player.y - 8, {
      count: 4,
      colors: ["#fff6a8", "#ffb43f"],
      speed: 1.2,
      life: 5,
      gravity: 0,
      size: 1,
      direction: player.direction * 1.5,
    });
    this.playFireSound();
    return true;
  }

  playThemeMusic() {
    // nothing plays while the level is still downloading (update() starts it then)
    if (!this.theme || !this.isLoaded()) return;

    this.audioController.play(this.theme, "mp3");
    this.audioController.volume(this.theme, 8);
    this.audioController.loop(this.theme);
  }

  stopThemeMusic() {
    if (!this.theme) return;

    this.audioController.stop(this.theme);
  }

  pauseThemeMusic() {
    if (!this.theme) return;

    this.audioController.pause(this.theme);
  }

  collideObject(object) {
    if (object.getLeft() < 0 - this.player.width / 2) {
      object.setLeft(-this.player.width / 2);
      object.velocityX = 0;
    } else if (object.getRight() > this.width + this.player.width / 2) {
      object.setRight(this.width + this.player.width / 2);
      object.velocityX = 0;
    }
    if (object.getTop() < 0 - this.player.height * 2.5) {
      object.setTop(0 - this.player.height * 2.5);
      object.velocityY = 0;
    } else if (object.getBottom() - 1 > this.height) {
      object.setBottom(this.height);
      object.velocityY = 0;
      object.jumping = false;
      object.landed = true;
    }

    let bottom, left, right, top;

    const setTop = () => {
      top = this._normalizeIndex(Math.floor(object.getTop() / this.tileSize), this.rows);
    };

    const setBottom = () => {
      bottom = this._normalizeIndex(Math.floor(object.getBottom() / this.tileSize), this.rows);
    };

    const setLeft = () => {
      left = Math.floor(object.getLeft() / this.tileSize);
    };

    const setRight = () => {
      right = Math.floor(object.getRight() / this.tileSize);
    };

    setTop();
    setLeft();
    this.collider.collide(
      this.collisonMap[top][left],
      object,
      left * this.tileSize,
      top * this.tileSize,
      this.tileSize,
    );

    setTop();
    setRight();
    this.collider.collide(
      this.collisonMap[top][right],
      object,
      right * this.tileSize,
      top * this.tileSize,
      this.tileSize,
    );

    setBottom();
    setLeft();
    this.collider.collide(
      this.collisonMap[bottom][left],
      object,
      left * this.tileSize,
      bottom * this.tileSize,
      this.tileSize,
    );

    setBottom();
    setRight();
    this.collider.collide(
      this.collisonMap[bottom][right],
      object,
      right * this.tileSize,
      bottom * this.tileSize,
      this.tileSize,
    );
  }

  _normalizeIndex(index, maxIndex) {
    if (index >= maxIndex - 1) {
      return maxIndex - 1;
    } else if (index < 0) {
      return 0;
    }

    return index;
  }

  /** Side walls (anything the player can't walk through) block fireballs. */
  isWallAt(x, y) {
    const column = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) return false;
    const value = this.collisonMap[row] && this.collisonMap[row][column];
    return typeof value === "string" && /[lr]/.test(value);
  }

  /** A fireball hit an enemy: armoured ones take two hits. */
  killEnemy(enemy, direction) {
    const x = enemy.getCenterX();
    const y = enemy.getCenterY();

    if (!enemy.hit(direction)) {
      if (!enemy.dying) {
        // armour held
        this.effects.burst(x, y, {
          count: 8,
          colors: ["#ffffff", "#cfe6ff", "#7db4f0"],
          speed: 2,
          life: 8,
        });
        this.effects.popup("CLANK", x, enemy.getTop() - 2, "#cfe6ff");
        this.effects.hitStop(1);
        this.emit("armor");
        sfx("beetle-armor");
      }
      return;
    }

    this.killedEnemies += `${enemy.id},`;
    this.totalEnemies += 1;
    this.bonus += enemy.score - 100;
    const points = this.comboScore(enemy.score);

    this.effects.enemyDeath(x, y, direction);
    this.effects.popup(`+${points}`, x, enemy.getTop() - 2, "#ffe066");
    this.effects.hitStop(2);
    this.emit("kill");

    sfx((ENEMY_SFX[enemy.type] || ENEMY_SFX.pig).die);
  }

  /** The first live enemy in the fireball's path, if it touches one. */
  fireballTarget(fireball) {
    const hitbox = fireball.hitbox();
    let target = null;
    for (let index = 0; index < this.enemies.items.length; index++) {
      const enemy = this.enemies.items[index];
      if (enemy.dying || !this.checkCollision(enemy, hitbox)) continue;
      // nearest to where the fireball came from wins
      if (
        !target ||
        (fireball.direction < 0 ? enemy.getRight() > target.getRight() : enemy.x < target.x)
      ) {
        target = enemy;
      }
    }
    return target;
  }

  playerJumped() {
    this.effects.dust(this.player.getCenterX(), this.player.getBottom(), 4);
  }

  /** Enemy, seed or spike hit. Shield absorbs it; otherwise lose a heart. */
  hurtPlayer(fromX, onGameOver) {
    if (this.isPlayerDead) return;
    const result = this.player.damage(fromX);
    if (!result) return;

    const { player } = this;
    if (result === "shield") {
      this.effects.burst(player.getCenterX(), player.getCenterY(), {
        count: 14,
        colors: ["#9fd0ff", "#e6f4ff", "#4a90e2"],
        speed: 2.6,
        life: 10,
        gravity: 0.05,
      });
      this.effects.popup("BLOCKED", player.getCenterX(), player.getTop() - 8, "#9fd0ff");
      this.emit("shield");
      sfx("shield-block");
      return;
    }
    this.effects.shake(2, 6);
    if (result === "dead") {
      this.die(onGameOver);
      return;
    }
    this.effects.burst(player.getCenterX(), player.getCenterY(), {
      count: 10,
      colors: ["#ff5a6a", "#ffd0d6", "#ffffff"],
      speed: 2.4,
      life: 9,
    });
    this.effects.hitStop(3);
    this.endCombo();
    this.emit("hurt");
    AudioController.play("hurt");
  }

  /** Fell in a pit: lose a heart and come back at the last safe spot. */
  fallInPit(onGameOver) {
    const { player } = this;
    if (player.invulnerable <= 0) {
      player.hearts = Math.max(0, player.hearts - 1);
      this.endCombo();
      this.effects.shake(2, 6);
      if (player.hearts === 0) {
        this.die(onGameOver, "fall");
        return;
      }
    }
    const to = this.lastSafe || this.spawn;
    this.effects.dust(player.getCenterX(), Math.min(player.getBottom(), this.height - 4), 8);
    player.x = player.xOld = to.x;
    player.y = player.yOld = to.y;
    player.velocityX = player.velocityY = 0;
    player.invulnerable = 45;
    this.effects.burst(player.getCenterX(), player.getCenterY(), {
      count: 12,
      colors: ["#ffffff", "#e8e2d0"],
      speed: 2,
      life: 10,
      gravity: 0,
    });
    this.emit("hurt");
    AudioController.play("hurt");
  }

  die(onGameOver, audio = "fall") {
    // a little hop before falling over
    this.player.velocityY = -10;
    this.player.velocityX = 0;
    this.player.invulnerable = 0;
    this.endCombo();
    this.emit("death");
    this.onPlayerDead(onGameOver, audio);
  }

  /** Remember solid ground the player stood on, away from hazards. */
  trackSafeGround() {
    const { player } = this;
    if (!player.grounded || player.hurtTimer > 0) {
      this.safeTicks = 0;
      return;
    }
    this.safeTicks += 1;
    if (this.safeTicks < 8) return;
    const margin = 24;
    const nearHazard = this.deathAreas.some(
      (area) =>
        player.x < area.x + area.width + margin && player.x + player.width > area.x - margin,
    );
    const nearEnemy = this.enemies.items.some(
      (enemy) =>
        !enemy.dying &&
        Math.abs(enemy.getCenterX() - player.getCenterX()) < 40 &&
        Math.abs(enemy.getCenterY() - player.getCenterY()) < 24,
    );
    if (!nearHazard && !nearEnemy) this.lastSafe = { x: player.x, y: player.y };
  }

  applyPowerup(item) {
    const { player } = this;
    switch (item.type) {
      case "heart":
        if (!player.heal()) this.bonus += 100;
        break;
      case "shield":
        player.shield = true;
        break;
      case "triple":
        player.triple = POWERUP_TICKS.triple;
        break;
      case "wings":
        player.wings = POWERUP_TICKS.wings;
        break;
      default:
        break;
    }
    this.collectedPowerups += `${item.id},`;
    this.effects.burst(item.getCenterX(), item.getCenterY(), {
      count: 14,
      colors: ["#fff7c2", "#ffd84d", "#ffffff", "#9fd0ff"],
      speed: 2.2,
      life: 12,
      gravity: 0,
    });
    this.effects.popup(POWERUP_TEXT[item.type], item.getCenterX(), item.getTop() - 4, "#fff7c2");
    this.emit("powerup");
    sfx(item.type === "heart" ? "heart" : "powerup");
  }

  checkCollision(object1, object2, offsetX = 0, offsetY = 0) {
    if (
      object1.x < object2.x + object2.width + offsetX &&
      object1.x + object1.width > object2.x - offsetX &&
      object1.y < object2.y + object2.height + offsetY &&
      object1.y + object1.height > object2.y - offsetY
    ) {
      return true;
    }
    return false;
  }

  /** Both arena gates stay shut while a boss is alive. */
  get exitLocked() {
    return !!(this.boss && !this.boss.dying);
  }

  /** Gates close once the player is clear of them, and open after the win. */
  updateGates() {
    if (!this.bossArea) return;
    const { player } = this;
    const clear =
      player.x > this.gateWidth + 4 && player.getRight() < this.width - this.gateWidth - 4;
    const shut = this.exitLocked && (this.gate > 0 || clear);
    const before = this.gate;
    this.gate = shut ? Math.min(1, this.gate + 0.12) : Math.max(0, this.gate - 0.04);
    if (before < 1 && this.gate === 1) {
      // slammed shut
      this.effects.dust(this.gateWidth / 2, this.height - 3 * 16, 8);
      this.effects.dust(this.width - this.gateWidth / 2, this.height - 3 * 16, 8);
      this.emit("armor");
      sfx("gate");
    }
  }

  bossActions() {
    const boss = this.boss;
    const colors = boss.config.colors;
    return {
      warn: (x, y) => {
        this.effects.popup("!", x, y, "#ff5a5a");
        sfx(`roar-${boss.kind}`);
      },
      shoot: (x, y, options = {}) =>
        this.projectiles.add(x, y, Math.sign(options.vx || 1), { gravity: 0.05, ...options }),
      slam: (x, y) => {
        sfx("boss-slam");
        this.effects.burst(x, y - 2, {
          count: 10,
          colors,
          speed: 2.4,
          life: 10,
          gravity: 0.15,
          spreadY: 0.4,
        });
        this.emit("armor");
      },
      particles: (x, y, count = 3) =>
        this.effects.burst(x, y, { count, colors, speed: 1.2, life: 8, gravity: 0.05, size: 1 }),
      hazard: (h) => this.hazards.push({ ...h, maxWarn: h.warn }),
      summon: (type, count = 2) => {
        sfx("summon");
        const alive = this.enemies.items.filter((e) => !e.dying && e.id.startsWith(boss.id)).length;
        const room = Math.max(0, 3 - alive);
        const top = Math.round(boss.arena.groundY / this.tileSize) - 1;
        const spots = [1, this.columns - 2.5, 4, this.columns - 5.5];
        for (let i = 0; i < Math.min(count, room); i++) {
          this.minions += 1;
          const enemy = this.enemies.add({
            id: `${boss.id}m${this.minions}`,
            type,
            left: spots[i % spots.length],
            top: enemyTypes[type] && enemyTypes[type].kind === "flyer" ? top - 4 : top,
            sway: 24,
            dir: i % 2 === 0 ? 1 : -1,
          });
          if (enemy) this.effects.dust(enemy.getCenterX(), enemy.getBottom(), 8);
        }
      },
    };
  }

  updateHazards(onGameOver) {
    const { player } = this;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      if (h.warn > 0) {
        h.warn -= 1;
        if (h.warn === 0 && h.kind === "tongue") sfx("tongue");
        if (h.warn === 0 && h.kind === "laser") sfx("laser-fire");
        continue;
      }
      if (h.active > 0) {
        h.active -= 1;
        if (!this.isPlayerDead && this.checkCollision(player, h)) {
          this.hurtPlayer(h.x + h.width / 2, onGameOver);
        }
        continue;
      }
      this.hazards.splice(i, 1);
    }
  }

  hitBoss(direction) {
    const { boss } = this;
    const result = boss.hit(direction);
    const x = boss.getCenterX();
    const y = boss.getCenterY();
    if (result === "hit") {
      this.effects.burst(x, y, {
        count: 8,
        colors: ["#ffffff", "#ffd84d", "#ff8c1a"],
        speed: 2.4,
        life: 8,
      });
      this.effects.hitStop(1);
      this.emit("kill");
      sfx((boss.config.sounds && boss.config.sounds.hit) || "boss-hit");
    } else if (result === "bounced") {
      // the shield throws the fireball back the way it came
      const tip = { x: boss.getCenterX() - direction * (boss.width / 2 + 4), y };
      this.effects.burst(tip.x, tip.y, {
        count: 8,
        colors: ["#ffffff", "#cfe8ff", "#7cc8f5"],
        speed: 2.8,
        life: 8,
        gravity: 0,
        direction: -direction * 2,
      });
      this.emit("shield-bounce");
      sfx("shield-clang");
    } else if (result === "dead") {
      this.killedEnemies += `${boss.id},`;
      this.totalEnemies += 1;
      this.bonus += 1000 - 100;
      const points = this.comboScore(1000);
      for (let i = 0; i < 3; i++) this.effects.enemyDeath(x + (i - 1) * 12, y, direction);
      this.effects.popup(`+${points}`, x, boss.getTop() - 6, "#ffe066");
      this.effects.popup(`${boss.name} defeated!`, this.width / 2, 60, "#ffffff");
      this.effects.hitStop(8);
      // minions flee with their boss
      this.enemies.items.forEach((e) => e.id.startsWith(boss.id) && e.kill(direction));
      this.emit("boss");
      // victory fanfare, then the world's own music again
      this.stopThemeMusic();
      sfx((boss.config.sounds && boss.config.sounds.defeat) || "boss-defeat");
      this.musicSwap = 75;
    }
  }

  get parts() {
    return [
      bossAssets,
      this.coins,
      this.water,
      this.player,
      this.enemies,
      this.fireballs,
      this.powerups,
      this.projectiles,
    ];
  }

  get assetCount() {
    return this.parts.reduce((sum, part) => sum + part.assetCount, this.music.assetCount);
  }

  get loadCount() {
    return this.parts.reduce((sum, part) => sum + part.loadCount, this.music.loadCount);
  }

  isLoaded() {
    return this.loaded && this.isAssetsLoaded();
  }

  isAssetsLoaded() {
    return this.parts.every((part) => part.loaded);
  }

  onPlayerDead(onGameOver, audio = "fall") {
    if (!this.isPlayerDead) {
      AudioController.play(audio, "mp3");

      this.player.velocityX = 0;
      this.stopThemeMusic();
      onGameOver();
    }
    this.isPlayerDead = true;
    this.collectedCoins = "";
    this.killedEnemies = "";
    this.collectedPowerups = "";
    this.theme = null;
  }

  update(onGameOver) {
    const { player } = this;
    AudioController.animate(() => {
      AudioController.play("foot", "wav", 0.15);
    }, player.running && player.grounded);

    if (!this.playedThemeMusic) {
      if (this.isLoaded()) {
        this.playThemeMusic();
        this.playedThemeMusic = true;
      }
    }
    if (!this.preloadStarted && this.isLoaded()) this.preloadNext();

    // hit-stop: freeze the world for a couple of ticks when something is hit
    if (this.effects.freeze > 0) {
      this.effects.freeze -= 1;
      return;
    }

    this.effects.tickShake();
    this.effects.update();
    this.combo.tick();
    this.areaTicks += 1;
    if (this.musicSwap > 0 && --this.musicSwap === 0) this.switchTrack(this.areaTheme);

    player.update(this.gravity, this.friction);
    if (this.isPlayerDead) player.updateDeath();

    const fallSpeed = player.velocityY;
    player.landed = false;
    this.collideObject(player);
    if (player.landed) {
      if (fallSpeed > 4 && !this.isPlayerDead) {
        this.effects.dust(player.getCenterX(), player.getBottom(), 5);
      }
      player.land(fallSpeed);
    }
    if (!this.isPlayerDead) this.trackSafeGround();

    // coins (backwards: collecting removes from the list)
    for (let index = this.coins.items.length - 1; index >= 0; index--) {
      const coin = this.coins.items[index];

      coin.update();
      coin.updateAnimation();

      if (!this.isPlayerDead && this.checkCollision(player, coin, 5, 5)) {
        this.coins.remove(coin);

        this.collectedCoins += `${coin.id},`;

        AudioController.play("coin");
        this.effects.coinSparkle(
          coin.getCenterX() + coin.offsetX,
          coin.getCenterY() + coin.offsetY,
        );
        this.scoreCoin();
      }
    }

    // power-ups
    this.powerups.update();
    for (let index = this.powerups.items.length - 1; index >= 0; index--) {
      const item = this.powerups.items[index];
      if (!this.isPlayerDead && this.checkCollision(player, item, 3, 3)) {
        this.powerups.remove(item);
        this.applyPowerup(item);
      }
    }

    // fireballs: one fireball, one kill. It burns out on the first enemy,
    // seed or wall it touches. (Backwards: hits remove from the list.)
    for (let index = this.fireballs.items.length - 1; index >= 0; index--) {
      const fireball = this.fireballs.items[index];

      fireball.update();
      fireball.updateAnimation();

      const tip = fireball.tip();
      const target = this.fireballTarget(fireball);
      const hitbox = fireball.hitbox();
      const seed = this.projectiles.items.find((item) => this.checkCollision(item, hitbox));
      const bossHit = this.boss && this.boss.hittable && this.checkCollision(this.boss, hitbox);
      if (target) {
        this.killEnemy(target, fireball.direction);
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (bossHit) {
        this.hitBoss(fireball.direction);
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (seed) {
        this.projectiles.remove(seed);
        this.emit("burn");
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (this.isWallAt(tip.x, tip.y)) {
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (
        fireball.x >= this.width + 50 ||
        fireball.x + fireball.width < -50 ||
        fireball.y < -40 ||
        fireball.y > this.height + 20
      ) {
        this.fireballs.remove(fireball);
      }
    }

    // pits send you back to safe ground; spikes hurt like an enemy
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.deathAreas.length; index++) {
        const area = this.deathAreas[index];
        if (!this.checkCollision(player, area)) continue;
        if (area.y >= this.height - 40) this.fallInPit(onGameOver);
        else this.hurtPlayer(area.getCenterX(), onGameOver);
        break;
      }
    }

    // enemies: live ones hurt on contact (an attack is a lunge into you). The
    // contact box is a few pixels inside the sprite so only real touches count.
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.enemies.items.length; index++) {
        const enemy = this.enemies.items[index];

        if (!enemy.dying && this.checkCollision(player, enemy, -3, -3)) {
          this.hurtPlayer(enemy.getCenterX(), onGameOver);
          break;
        }
      }
    }
    if (this.boss) {
      const { boss } = this;
      boss.update(this.isPlayerDead ? null : player, this.bossActions());
      if (boss.state !== this.bossState) {
        this.bossState = boss.state;
        if (BOSS_MOVE_SFX[boss.state]) sfx(BOSS_MOVE_SFX[boss.state]);
      }
      boss.updateAnimation();
      if (boss.shield !== this.shieldSeen) {
        this.shieldSeen = boss.shield;
        if (boss.shield === "up") {
          this.emit("shield-up");
          sfx("shield-up");
        }
      }
      if (!this.isPlayerDead && !boss.dying && this.checkCollision(player, boss, -5, -5)) {
        this.hurtPlayer(boss.getCenterX(), onGameOver);
      }
      if (boss.dead) this.boss = null;
      // the gates hold the player in while the boss is alive
      if (this.exitLocked && this.gate > 0) {
        const edge = this.gateWidth * this.gate;
        if (player.getRight() > this.width - edge) {
          player.setRight(this.width - edge);
          player.velocityX = Math.min(0, player.velocityX);
        }
        if (player.x < edge) {
          player.setLeft(edge);
          player.velocityX = Math.max(0, player.velocityX);
        }
      }
    }

    this.updateGates();
    this.updateHazards(onGameOver);

    const spit = (x, y, direction, options) => {
      this.projectiles.add(x, y, direction, options);
      if (options && THROW_SFX[options.kind]) sfx(THROW_SFX[options.kind]);
    };
    this.enemies.update(this.isPlayerDead ? null : player, spit);
    this.enemies.updateAnimation();
    // enemy cries: a walker winding up, a bat diving, a spitter spitting
    for (let index = 0; index < this.enemies.items.length; index++) {
      const enemy = this.enemies.items[index];
      if (enemy.state !== enemy.heard) {
        const cue = ENEMY_SFX[enemy.type];
        const attack =
          enemy.state === "windup" ||
          enemy.state === "spit" ||
          (enemy.kind === "flyer" && enemy.state === "lunge");
        if (cue && attack && !enemy.dying) sfx(cue.attack);
        enemy.heard = enemy.state;
      }
    }
    // a "!" over a walker that is about to lunge
    this.enemies.items.forEach((enemy) => {
      if (enemy.state === "windup" && enemy.stateTimer === 8) {
        this.effects.popup("!", enemy.getCenterX(), enemy.getTop() - 2, "#ff5a5a");
      }
    });

    // enemy seeds
    for (let index = this.projectiles.items.length - 1; index >= 0; index--) {
      const seed = this.projectiles.items[index];
      seed.update();
      if (!this.isPlayerDead && this.checkCollision(player, seed, -1, -1)) {
        this.projectiles.remove(seed);
        this.hurtPlayer(seed.getCenterX(), onGameOver);
        if (seed.kind === "missile") {
          this.effects.burst(seed.getCenterX(), seed.getCenterY(), PROJECTILE_BREAK.missile);
          this.hazards.push({
            x: seed.getCenterX() - 12,
            y: seed.getBottom() - 14,
            width: 24,
            height: 14,
            warn: 0,
            active: 6,
            kind: "blast",
          });
        }
      } else if (
        seed.life <= 0 ||
        (seed.floor !== undefined && seed.getBottom() >= seed.floor) ||
        this.isWallAt(seed.getCenterX(), seed.getCenterY()) ||
        seed.y > this.height ||
        seed.x < -10 ||
        seed.x > this.width + 10
      ) {
        const look = PROJECTILE_BREAK[seed.kind] || PROJECTILE_BREAK.seed;
        if (seed.kind === "icicle") sfx("icicle-shatter");
        if (seed.kind === "shard") sfx("icicle-shatter", 0.2);
        if (seed.kind === "missile") sfx("explosion");
        this.effects.burst(seed.getCenterX(), seed.getCenterY(), look);
        // a missile blows up where it lands
        if (seed.kind === "missile" && seed.floor !== undefined && seed.getBottom() >= seed.floor) {
          this.hazards.push({
            x: seed.getCenterX() - 12,
            y: seed.floor - 14,
            width: 24,
            height: 14,
            warn: 0,
            active: 6,
            kind: "blast",
          });
          this.emit("armor");
        }
        this.projectiles.remove(seed);
      }
    }

    if (!this.portal && !this.isPlayerDead) {
      for (let index = 0; index < this.portals.length; index++) {
        const portal = this.portals[index];
        // a portal with no destination is the edge of the world (endless mode start)
        if (portal.destinationArea == null) continue;
        if (this.exitLocked && this.gate > 0) continue; // both gates shut during a boss fight
        if (this.checkCollision(player, portal)) {
          this.portal = portal;
          break;
        }
      }
    }

    player.updateAnimation({ dead: this.isPlayerDead });

    this.water.update();
  }
}
