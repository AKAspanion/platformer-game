import Object from "./object";
import Animator from "./animator";

/**
 * Enemy projectiles. `kind` picks the look: seed (spitter, default), sand,
 * shard and icicle (ice), orb (Bat Lord), missile (Mecha Beetle). They hurt
 * the player, stop at walls, and with a `floor` break on the ground.
 */
let frames = null;
const loader = { assetCount: 0, loadCount: 0 };

const loadFrames = () => {
  if (frames) return frames;
  frames = [];
  for (let i = 1; i <= 4; i++) {
    const image = new Image();
    image.onload = image.onerror = () => {
      loader.loadCount += 1;
    };
    image.src = `./assets/sprites/enemies/spitter/seed/image_part_0${i}.png`;
    frames.push(image);
    loader.assetCount += 1;
  }
  return frames;
};

export default class Projectiles {
  constructor() {
    this.frames = loadFrames();
    this.items = [];
  }

  get assetCount() {
    return loader.assetCount;
  }

  get loadCount() {
    return loader.loadCount;
  }

  get loaded() {
    return loader.loadCount >= loader.assetCount;
  }

  /** `options` { vx, vy, gravity } override the spitter's default lob. */
  add(x, y, direction, options = {}) {
    this.items.push(new Seed(x, y, direction, this.frames, options));
  }

  remove(item) {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  reset() {
    this.items = [];
  }
}

class Seed extends Object {
  constructor(x, y, direction, frameSet, { vx, vy, gravity = 0.04, kind = "seed", floor } = {}) {
    super(x - 3.5, y - 3.5, 7, 7);
    this.kind = kind;
    this.vx = vx ?? 2.2 * direction;
    this.vy = vy ?? -0.6;
    this.gravity = gravity;
    this.floor = floor;
    // seeds drift down gently; thrown and falling things don't
    this.maxVy = kind === "seed" || kind === "sand" ? 1.2 : 9;
    this.life = 180;
    this.animator = new Animator(frameSet, 3);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy = Math.min(this.maxVy, this.vy + this.gravity);
    this.life -= 1;
    this.animator.animate();
  }
}
