import Object from "./object";
import Animator from "./animator";
import { requestImage } from "./preload";

/**
 * Water pits. `liquid` (optional, from a generated world's skin) is
 * { surface: frames[], body: frames[] }: lava, acid, goo... The top cell of
 * each column plays the surface frames, the cells below the body frames.
 */
export default class Water {
  constructor(waterObjects = [], tileSize, liquid = null) {
    this.items = [];
    this.frameSets = {};

    this.assetCount = 0;
    this.loadCount = 0;
    if (liquid) {
      this.frameSets.water = liquid.surface;
      this.frameSets.body = liquid.body;
    } else {
      // requested once per session: a second level counts nothing in flight
      this.frameSets.water = [];
      for (let index = 1; index <= 17; index++) {
        this.frameSets.water.push(requestImage(`./assets/sprites/water/image ${index}.webp`, this));
      }
    }

    const topOf = {};
    waterObjects.forEach(({ left, top }) => {
      topOf[left] = Math.min(topOf[left] ?? Infinity, top);
    });
    for (let index = 0; index < waterObjects.length; index++) {
      const { left, top } = waterObjects[index];
      const frames =
        this.frameSets.body && top > topOf[left] ? this.frameSets.body : this.frameSets.water;
      this.items.push(new WaterObject(left * tileSize, top * tileSize, frames, tileSize));
    }
  }

  get loaded() {
    return this.loadCount >= this.assetCount;
  }

  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].updateAnimation();
    }
  }
}

class WaterObject extends Object {
  constructor(x, y, frameSet, tileSize) {
    super(x, y, tileSize, tileSize);

    this.animator = new Animator(frameSet, 3);
  }

  updateAnimation() {
    this.animator.animate();
  }
}
