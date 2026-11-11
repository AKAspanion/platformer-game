import Object from "./object";
import Animator from "./animator";

/**
 * Water pits. `liquid` (optional, from a generated world's skin) is
 * { surface: frames[], body: frames[] }: lava, acid, goo... The top cell of
 * each column plays the surface frames, the cells below the body frames.
 */
export default class Water {
  constructor(waterObjects = [], tileSize, liquid = null) {
    this.items = [];
    this.loaded = false;
    this.frameSets = {};

    if (liquid) {
      this.assetCount = this.loadCount = 1;
      this.loaded = true;
      this.frameSets.water = liquid.surface;
      this.frameSets.body = liquid.body;
    } else {
      this.assetCount = 17;
      this.loadCount = 0;
      this.frameSets.water = [];
      for (let index = 1; index <= 17; index++) {
        const image = new Image();
        image.onload = image.onerror = () => {
          this.loadCount += 1;
          if (this.loadCount === 17) this.loaded = true;
        };
        image.src = `./assets/sprites/water/image ${index}.webp`;
        this.frameSets.water.push(image);
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
