import Object from "./object";
import Animator from "./animator";
import { requestImage } from "./preload";

/**
 * Enemy projectiles. `kind` picks the look: seed (spitter, default), sand,
 * shard and icicle (ice), orb (Bat Lord), missile (Mecha Beetle), and the
 * walkers' shots: mud (pig), glob (slime, community walkers, in their
 * `colors`), spit (chameleon), pebble (beetle). They hurt
 * the player, stop at walls, and with a `floor` break on the ground.
 */
let frames = null;
const loader = { assetCount: 0, loadCount: 0 };

/** The seed sprites' urls (spitters, and bosses that lob things, need them). */
export const SEED_IMAGES = [1, 2, 3, 4].map(
  (i) => `./assets/sprites/enemies/spitter/seed/image_part_0${i}.png`,
);

/** Start downloading the seed sprites unless that already happened. */
export const loadFrames = () => {
  if (frames) return frames;
  frames = [];
  SEED_IMAGES.forEach((src) => {
    frames.push(requestImage(src, loader));
  });
  return frames;
};

export default class Projectiles {
  constructor() {
    this.items = [];
  }

  /** Make sure the seed sprites are on their way (a level with spitters or a boss). */
  load() {
    loadFrames();
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

  /** `options` { vx, vy, gravity, kind, floor, colors } override the spitter's default lob. */
  add(x, y, direction, options = {}) {
    this.items.push(new Seed(x, y, direction, loadFrames(), options));
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
  constructor(
    x,
    y,
    direction,
    frameSet,
    { vx, vy, gravity = 0.04, kind = "seed", floor, colors } = {},
  ) {
    super(x - 3.5, y - 3.5, 7, 7);
    this.kind = kind;
    this.vx = vx ?? 2.2 * direction;
    this.vy = vy ?? -0.6;
    this.gravity = gravity;
    this.floor = floor;
    this.colors = colors; // a community creature's colours (glob)
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
