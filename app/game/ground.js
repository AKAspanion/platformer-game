import Object from "./object";
import Animator from "./animator";
import { uid } from "../util";

export default class Ground {
  constructor(width, height) {
    this.items = [];
    this.loaded = false;
    this.width = width;
    this.height = height;

    const keys = [{ id: "", count: 1 }];

    this.frameSets = {};

    this.assetCount = 1;
    this.loadCount = 0;
    keys.forEach(({ count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.onload = () => {
          this.loadCount += 1;

          if (count === this.loadCount) {
            this.loaded = true;
          }
        };
        image.src = `./assets/sprites/dino/ground (${index}).png`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage("ground", image);
      }
    });
  }

  add(id, offset, x, y) {
    this.items.push(new GroundItem(id, offset, x, y, this.frameSets["ground"]));
  }

  remove(ground) {
    this.items.splice(this.items.indexOf(ground), 1);
  }

  reset() {
    this.add(uid(), 0, this.width, this.height, this.frameSets["ground"]);
    this.add(
      uid(),
      this.width,
      this.width,
      this.height,
      this.frameSets["ground"]
    );
  }

  update() {
    for (let index = 0; index < this.items.length; index++) {
      this.items[index].update();
    }
  }

  updateAnimation() {
    this.update();
    for (let index = 0; index < this.items.length; index++) {
      const g = this.items[index];
      console.log(g.width, g.x, index);
      g.updateAnimation();

      if (g.x <= this.width * -1) {
        this.remove(g);
        this.add(
          uid(),
          this.width,
          this.width,
          this.height,
          this.frameSets["ground"]
        );
      }
    }
  }
}

class GroundItem extends Object {
  constructor(id, offset, width, height, frameSet) {
    super(offset, height - 4, width, 4);

    this.id = id;

    this.velocity = 5;

    this.animator = new Animator(frameSet);
  }

  update() {
    this.xOld = this.x;
    this.x -= this.velocity;
  }

  updateAnimation() {
    this.animator.animate();
  }
}
