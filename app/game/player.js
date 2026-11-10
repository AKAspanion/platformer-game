import Object from "./object";
import Animator from "./animator";

export const MAX_HEARTS = 3;
const INVULNERABLE_TICKS = 45; // 1.5s of blinking after a hit
const HURT_TICKS = 10; // knocked back, no control
const FIRE_COOLDOWN = 9;

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

    this.loadCount = 0;
    this.assetCount = 38 * 2;
    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = () => {
          this.loadCount += 1;

          if (this.assetCount === this.loadCount) {
            this.loaded = true;
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

    // Jump is a full cycle (crouch, rise, peak, fall, land): split it so rising
    // and falling each hold the right pose instead of looping the whole jump.
    ["Left", "Right"].forEach((side) => {
      const jump = this.frameSets[`jump${side}`];
      this.frameSets[`rise${side}`] = jump.slice(1, 4);
      this.frameSets[`fall${side}`] = jump.slice(5, 7);
      this.frameSets[`hurt${side}`] = [jump[6]];
    });

    this.animator = new Animator(this.frameSets["idleRight"]);
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

  jump() {
    if (!this.canControl) return false;
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 18;
      this.stretch(0.8, 1.25);
      return true;
    }
    // wings: one extra jump in the air
    if (this.wings > 0 && this.airJumps === 0) {
      this.airJumps = 1;
      this.velocityY = -15;
      this.stretch(0.85, 1.2);
      return true;
    }
    return false;
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
    if (!this.canControl) return;
    this.direction = -1;
    this.velocityX -= 0.5;
  }
  moveRight() {
    if (!this.canControl) return;
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
