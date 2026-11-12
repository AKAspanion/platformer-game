import Object from "./object";
import Animator from "./animator";
import { SKIN_PALETTES, tintFrames, hatImage } from "./cosmetics";
import { FREE } from "../shop/catalog";

export const MAX_HEARTS = 3;
const INVULNERABLE_TICKS = 45; // 1.5s of blinking after a hit
const HURT_TICKS = 10; // knocked back, no control
const FIRE_COOLDOWN = 9;

// Jump feel, in ticks (30 per second). The full, held jump is the one the level
// generator plans for (app/pcg/generator.js jumpReach): change JUMP_SPEED there too.
export const JUMP_SPEED = 18;
const WINGS_JUMP_SPEED = 15;
export const COYOTE_TICKS = 3; // can still jump ~0.1 s after walking off a ledge
export const JUMP_BUFFER_TICKS = 4; // a press up to ~0.13 s before landing still jumps
const JUMP_CUT = 0.5; // letting go while rising halves the upward speed...
const JUMP_MIN_TICKS = 1; // ...but not before the first tick, so a tap still clears a tile

// Wall slide and wall jump: push into a wall in the air to slide down it, jump to
// leap up and away. Levels never need it (the generator plans with normal jumps);
// it's for shortcuts, speed and saves.
export const WALL_SLIDE_SPEED = 1; // fall speed cap while sliding (~3 px a tick)
const WALL_JUMP_SPEED = 16;
const WALL_JUMP_PUSH = 5; // px a tick away from the wall
const WALL_GRACE_TICKS = 3; // a wall jump still works ~0.1 s after leaving the wall
const WALL_LOCK_TICKS = 6; // pushing back toward the wall is ignored for ~0.2 s

// Power-up durations in ticks (30 per second)
export const POWERUP_TICKS = { triple: 30 * 15, wings: 30 * 20 };

export default class Player extends Object {
  constructor() {
    super(40, 100, 12, 12);
    this.loaded = false;

    this.hearts = MAX_HEARTS;
    this.resetState();
    this.firing = true; // no fireballs before the first reset()

    const keys = [
      { id: "Idle", count: 10 },
      { id: "Run", count: 8 },
      { id: "Jump", count: 8 },
      { id: "Dead", count: 8 },
      { id: "Fire", count: 4 },
    ];

    this.frameSets = {};
    this.look = { skin: FREE.skin, hat: FREE.hat };
    this.skinCache = {};

    this.loadCount = 0;
    this.assetCount = 38 * 2;
    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = () => {
          this.loadCount += 1;

          if (this.assetCount === this.loadCount) {
            this.loaded = true;
            this.applyLook();
          }
        };

        const imageLeft = new Image();
        imageLeft.onload = onImgLoad;
        imageLeft.onerror = onImgLoad;
        const imageRight = new Image();
        imageRight.onload = onImgLoad;
        imageRight.onerror = onImgLoad;
        imageLeft.src = `./assets/sprites/player/left/${id} (${index}).webp`;
        imageRight.src = `./assets/sprites/player/right/${id} (${index}).webp`;

        const keyLeft = `${id.toLowerCase()}Left`;
        const keyRight = `${id.toLowerCase()}Right`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage(keyLeft, imageLeft);
        addImage(keyRight, imageRight);
      }
    });

    this.baseFrameSets = this.frameSets;
    this.frameSets = this.withJumpSplits(this.baseFrameSets);
    this.skinCache.classic = this.frameSets;

    this.animator = new Animator(this.frameSets["idleRight"]);
  }

  // Jump is a full cycle (crouch, rise, peak, fall, land): split it so rising
  // and falling each hold the right pose instead of looping the whole jump.
  withJumpSplits(base) {
    const sets = { ...base };
    ["Left", "Right"].forEach((side) => {
      const jump = sets[`jump${side}`];
      sets[`rise${side}`] = jump.slice(1, 4);
      sets[`fall${side}`] = jump.slice(5, 7);
      sets[`hurt${side}`] = [jump[6]];
    });
    return sets;
  }

  /** Wear a skin and a hat: looks only, nothing here touches the physics. */
  setLook({ skin = FREE.skin, hat = FREE.hat } = {}) {
    this.look = { skin, hat };
    this.applyLook();
  }

  // Skins are tinted from the loaded frames, so they wait for the load.
  applyLook() {
    if (!this.loaded) return;
    const { skin } = this.look;
    if (!this.skinCache[skin]) {
      const palette = SKIN_PALETTES[skin];
      const tinted = {};
      // (`Object` is the game object class in this file, so no Object.keys)
      for (const key in this.baseFrameSets) {
        tinted[key] = tintFrames(this.baseFrameSets[key], palette);
      }
      this.skinCache[skin] = this.withJumpSplits(tinted);
    }
    const next = this.skinCache[skin];
    if (next === this.frameSets) return;

    // keep the current pose and frame, in the new colours
    const { animator } = this;
    let name = null;
    for (const key in this.frameSets) {
      if (this.frameSets[key] === animator.frameSet) name = key;
    }
    this.frameSets = next;
    if (name) {
      animator.frameSet = next[name];
      animator.frameValue = next[name][animator.frameIndex] || next[name][0];
    }
  }

  /** The hat sprite worn now, or null. */
  get hatImage() {
    return hatImage(this.look.hat);
  }

  resetState() {
    this.firing = false;
    this.fireTimer = 0;
    this.running = false;
    this.jumping = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.direction = 1;

    this.invulnerable = 0;
    this.hurtTimer = 0;
    this.deadTimer = 0;
    this.grounded = false;
    this.airJumps = 0;
    this.airTicks = 0; // ticks since last on the ground
    this.jumpBuffer = 0; // ticks a jump press is still remembered
    this.jumpHeld = false;
    this.jumpRising = false; // rising from a jump (not a knockback), so letting go cuts it
    this.jumpTicks = 0;
    this.pushing = 0; // direction held this tick (-1, 0, 1)
    this.wallDir = 0; // side of the wall being slid on, 0 when none
    this.wallSide = 0; // side of the last wall touched
    this.wallGrace = 0;
    this.wallLock = 0;
    this.wallLockDir = 0;

    // power-ups
    this.shield = false;
    this.triple = 0;
    this.wings = 0;

    // squash & stretch (drawn around the feet)
    this.scaleX = 1;
    this.scaleY = 1;
  }

  /** New game: full hearts, no power-ups. */
  reset() {
    this.x = 40;
    this.y = 100;
    this.xOld = 40;
    this.yOld = 100;
    this.hearts = MAX_HEARTS;
    this.resetState();
  }

  get canControl() {
    return this.hurtTimer <= 0;
  }

  /** On a wall: in the air, pushing into it (sliding down when falling). */
  get wallSliding() {
    return this.wallDir !== 0;
  }

  /**
   * Called by the world every tick after collision: `side` is the wall the player
   * is in the air pushing into (-1 left, 1 right), or 0.
   */
  touchWall(side) {
    this.wallDir = side;
    if (side) {
      this.wallSide = side;
      this.wallGrace = WALL_GRACE_TICKS;
      if (this.velocityY > WALL_SLIDE_SPEED) this.velocityY = WALL_SLIDE_SPEED;
    } else if (this.wallGrace > 0) {
      this.wallGrace -= 1;
    }
    this.pushing = 0;
  }

  /** On the ground, or just off a ledge (coyote time), and not already jumping. */
  get canGroundJump() {
    return !this.jumping && (this.grounded || this.airTicks < COYOTE_TICKS);
  }

  /** Jump now if possible. Returns true if it jumped. */
  jump() {
    if (!this.canControl) return false;
    if (this.canGroundJump) {
      this.jumping = true;
      this.velocityY = -JUMP_SPEED;
      this.stretch(0.8, 1.25);
      this.startRise();
      return true;
    }
    // off a wall (or just after leaving it): up and away
    if (this.wallGrace > 0) {
      const away = -this.wallSide;
      this.jumping = true;
      this.velocityY = -WALL_JUMP_SPEED;
      this.velocityX = away * WALL_JUMP_PUSH;
      this.direction = away;
      this.wallDir = 0;
      this.wallGrace = 0;
      this.wallLock = WALL_LOCK_TICKS;
      this.wallLockDir = -away;
      this.stretch(0.8, 1.25);
      this.startRise();
      return true;
    }
    // wings: one extra jump in the air
    if (this.wings > 0 && this.airJumps === 0) {
      this.airJumps = 1;
      this.velocityY = -WINGS_JUMP_SPEED;
      this.stretch(0.85, 1.2);
      this.startRise();
      return true;
    }
    return false;
  }

  startRise() {
    this.jumpRising = true;
    this.jumpHeld = true;
    this.jumpTicks = 0;
  }

  /** Jump pressed: remembered for a few ticks so a press just before landing still jumps. */
  queueJump() {
    this.jumpBuffer = JUMP_BUFFER_TICKS;
  }

  /** Jump let go: a jump still rising is cut short. */
  releaseJump() {
    this.jumpHeld = false;
  }

  /** Jumps if a press is remembered and a jump is possible now. Returns true if it jumped. */
  takeJump() {
    if (this.jumpBuffer <= 0 || !this.jump()) return false;
    this.jumpBuffer = 0;
    return true;
  }

  // Cooldown in ticks (30 per second) rather than a timer, so it pauses with
  // the game and works the same in tests.
  fire() {
    if (this.firing || !this.canControl) return false;
    this.firing = true;
    this.fireTimer = FIRE_COOLDOWN;
    this.stretch(1.1, 0.92);
    return true;
  }

  moveLeft() {
    if (!this.canControl || (this.wallLock > 0 && this.wallLockDir === -1)) return;
    this.pushing = -1;
    this.direction = -1;
    this.velocityX -= 0.5;
  }
  moveRight() {
    if (!this.canControl || (this.wallLock > 0 && this.wallLockDir === 1)) return;
    this.pushing = 1;
    this.direction = 1;
    this.velocityX += 0.5;
  }

  /**
   * Take a hit. Returns "shield" (absorbed), "hurt" (lost a heart) or "dead".
   * Ignored while blinking after the last hit.
   */
  damage(fromX) {
    if (this.invulnerable > 0) return null;

    if (this.shield) {
      this.shield = false;
      this.invulnerable = 20;
      return "shield";
    }

    this.hearts = Math.max(0, this.hearts - 1);
    if (this.hearts === 0) return "dead";

    this.invulnerable = INVULNERABLE_TICKS;
    this.hurtTimer = HURT_TICKS;
    // knocked away from whatever hit us, and a little up
    const away = fromX === undefined ? -this.direction : this.getCenterX() < fromX ? -1 : 1;
    this.velocityX = 4 * away;
    this.velocityY = -9;
    this.jumping = true;
    this.jumpRising = false; // a knockback isn't a jump: letting go doesn't cut it
    this.stretch(1.25, 0.8);
    return "hurt";
  }

  heal() {
    if (this.hearts >= MAX_HEARTS) return false;
    this.hearts += 1;
    return true;
  }

  stretch(scaleX, scaleY) {
    this.scaleX = scaleX;
    this.scaleY = scaleY;
  }

  /** Blink while invulnerable. */
  get alpha() {
    if (this.deadTimer > 0) return Math.max(0, Math.min(1, (60 - this.deadTimer) / 20));
    if (this.invulnerable > 0 && Math.floor(this.invulnerable / 3) % 2 === 0) return 0.35;
    return 1;
  }

  updateAnimation({ dead = false }) {
    const side = this.direction < 0 ? "Left" : "Right";
    const set = (name, delay = 4) =>
      this.animator.changeFrameSet(this.frameSets[name + side], delay);

    if (dead) {
      set("dead", 2);
      this.animator.animate(true);
      return;
    }

    const speed = Math.abs(this.velocityX);
    if (this.hurtTimer > 0) {
      set("hurt", 4);
    } else if (!this.grounded && this.velocityY < 0) {
      set("rise", 3);
    } else if (!this.grounded && this.velocityY > 2) {
      set("fall", 4);
    } else if (speed > 0.6) {
      // faster run, faster legs
      set("run", speed > 2.6 ? 2 : 3);
    } else if (this.firing) {
      set("fire", 2);
    } else {
      set("idle", 4);
    }

    const holdLast =
      this.animator.frameSet === this.frameSets["rise" + side] ||
      this.animator.frameSet === this.frameSets["fall" + side];
    this.animator.animate(holdLast);
  }

  update(gravity, friction) {
    if (this.fireTimer > 0) {
      this.fireTimer -= 1;
      if (this.fireTimer === 0) this.firing = false;
    }
    if (this.invulnerable > 0) this.invulnerable -= 1;
    if (this.hurtTimer > 0) this.hurtTimer -= 1;
    if (this.triple > 0) this.triple -= 1;
    if (this.wings > 0) this.wings -= 1;
    if (this.jumpBuffer > 0) this.jumpBuffer -= 1;
    if (this.wallLock > 0) this.wallLock -= 1;
    this.airTicks = this.grounded ? 0 : this.airTicks + 1;

    // ease squash & stretch back to normal
    this.scaleX += (1 - this.scaleX) * 0.3;
    this.scaleY += (1 - this.scaleY) * 0.3;

    this.xOld = this.x;
    this.yOld = this.y;
    this.velocityY += gravity;
    this.x += this.velocityX;
    this.y += this.velocityY;

    this.velocityX *= friction;
    this.velocityY *= friction;

    if (this.jumpRising) {
      this.jumpTicks += 1;
      if (this.velocityY >= 0) this.jumpRising = false;
      else if (!this.jumpHeld && this.jumpTicks >= JUMP_MIN_TICKS) {
        this.velocityY *= JUMP_CUT;
        this.jumpRising = false;
      }
    }

    const absVelocityX = Math.abs(this.velocityX);
    this.running = absVelocityX === 0.435 ? false : absVelocityX >= 0.2;
    this.grounded = false; // set again by collision this tick
  }

  /** Called by the world after collision resolution when standing on something. */
  land(fallSpeed) {
    if (!this.grounded && fallSpeed > 4) this.stretch(1.25, 0.78);
    this.grounded = true;
    this.airJumps = 0;
  }

  updateDeath() {
    this.deadTimer += 1;
  }
}
