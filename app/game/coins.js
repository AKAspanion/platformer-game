// import Object from "./object";
import Coin from "./coin";

export default class items {
  constructor(objects = [], tileSize) {
    this.items = [];

    const keys = [{ id: "", count: 16 }];

    this.frameSets = {};

    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.src = `./sprites/coin/image ${index}.png`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage("coin", image);
      }
    });

    for (let index = 0; index < objects.length; index++) {
      const { left, top, offsetX, offsetY } = objects[index];

      this.items.push(
        new Coin(left * tileSize + 5, top * tileSize + 5, offsetX, offsetY, this.frameSets["coin"])
      );
    }
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
}
