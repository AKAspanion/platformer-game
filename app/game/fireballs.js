import Object from "./object";
import Animator from "./animator";

export default class Fireballs {
  constructor() {
    this.items = [];
    this.loaded = false;

    this.frameSets = {};

    const keys = [{ id: "", count: 5 }];

    this.assetCount = 10;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
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
        imageLeft.src = `./assets/sprites/fireball/left/image ${index}.webp`;
        const imageRight = new Image();
        imageRight.onload = onImgLoad;
        imageRight.onerror = onImgLoad;
        imageRight.src = `./assets/sprites/fireball/right/image ${index}.webp`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage("fireballLeft", imageLeft);
        addImage("fireballRight", imageRight);
      }
    });
  }

  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].update();
    }
  }

  updateAnimation() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }

  /** `vy` angles the shot (triple-fire power-up). */
  add(id, x, y, direction, vy = 0) {
    this.items.push(
      new Fireball(
        id,
        x,
        y,
        direction,
        this.frameSets[`fireball${direction < 0 ? "Left" : "Right"}`],
        vy,
      ),
    );
  }

  remove(fireball) {
    const index = this.items.indexOf(fireball);
    if (index >= 0) this.items.splice(index, 1);
  }

  reset() {
    this.items = [];
  }
}

class Fireball extends Object {
  constructor(id, x, y, direction, frameSet, vy = 0) {
    super(x, y, 32, 16);

    this.id = id;
    this.direction = direction;
    this.vy = vy;

    this.velocity = 5;

    this.animator = new Animator(frameSet);
  }

  /**
   * The visible flame inside the 32x16 sprite box (the tail is mostly empty).
   * Used for hits, so a fireball only touches what it visibly touches.
   */
  hitbox() {
    return {
      x: this.direction < 0 ? this.x + 5 : this.x + 10,
      y: this.y + 3,
      width: 17,
      height: 12,
    };
  }

  /** Leading point of the flame, used for wall hits. */
  tip() {
    return { x: this.direction < 0 ? this.x + 5 : this.x + 27, y: this.y + 8 };
  }

  update() {
    this.y += this.vy;
    if (this.direction < 0) {
      this.x -= this.velocity;
    } else {
      this.x += this.velocity;
    }
  }

  updateAnimation() {
    this.animator.animate();
  }
}
