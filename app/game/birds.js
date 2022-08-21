import Object from "./object";
import Animator from "./animator";

export default class Birds {
  constructor() {
    this.items = [];
    this.loaded = false;

    this.frameSets = {};

    const keys = [{ id: "", count: 2 }];

    this.assetCount = 2;
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

        image.src = `./assets/sprites/dino/bird (${index}).png`;
        image.onload = onImgLoad;

        const addImage = (k, i) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(i);
        };

        addImage("bird", image);
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
    this.items.push(new Bird(id, x, y, this.frameSets["bird"]));
  }

  remove(bird) {
    this.items.splice(this.items.indexOf(bird), 1);
  }

  reset() {
    this.items = [];
  }
}

class Bird extends Object {
  constructor(id, x, y, frameSet) {
    super(x, y - 24 - 10, 21, 18);

    this.id = id;

    this.velocity = 5;

    this.animator = new Animator(frameSet);
  }

  update() {
    this.x -= this.velocity;
  }

  updateAnimation() {
    this.animator.animate();
  }
}
