import Object from "./object";
import Animator from "./animator";

import { randomIntFromInterval } from "../util";

export default class Cactuses {
  constructor() {
    this.items = [];
    this.loaded = false;

    this.frameSets = {};

    const keys = [{ id: "", count: 6 }];

    this.assetCount = 6;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        const onImgLoad = () => {
          this.loadCount += 1;

          if (this.assetCount === this.loadCount) {
            this.loaded = true;
          }
        };

        image.src = `./assets/sprites/dino/cactuses (${index}).png`;
        image.onload = onImgLoad;

        const addImage = (k, i) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(i);
        };

        addImage(`cactus-${index}`, image);
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

  add(id, x, y) {
    const chance = randomIntFromInterval(1, 6);

    this.items.push(
      new Cactus(id, x, y, chance, this.frameSets[`cactus-${chance}`])
    );
  }

  remove(cactus) {
    this.items.splice(this.items.indexOf(cactus), 1);
  }

  reset() {
    this.items = [];
  }
}

class Cactus extends Object {
  constructor(id, x, y, type, frameSet) {
    let height, width;
    switch (type) {
      case 1:
        height = 24;
        width = 13;
        break;
      case 2:
        height = 24;
        width = 25;
        break;
      case 3:
        height = 24;
        width = 36;
        break;
      case 4:
        height = 18;
        width = 9;
        break;
      case 5:
        height = 18;
        width = 17;
        break;
      case 6:
        height = 18;
        width = 26;
        break;
      default:
        break;
    }
    super(x, y - height, width, height);

    this.id = id;
    this.type = type;

    this.velocity = 6;

    this.animator = new Animator(frameSet);
  }

  update() {
    this.x -= this.velocity;
  }

  updateAnimation() {
    this.animator.animate();
  }
}
