// import Object from "./object";
import Coin from "./coin";

export default class items {
  constructor(objects = [], tileSize, collectedCoins) {
    this.items = [];

    const keys = [{ id: "", count: 16 }];

    this.frameSets = {};

    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.src = `./assets/sprites/coin/image ${index}.png`;

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
      const { id, left, top, offsetX, offsetY } = objects[index];

      if (!collectedCoins.includes(id)) {
        this.items.push(
          new Coin(id, left * tileSize, top * tileSize, offsetX, offsetY, this.frameSets["coin"])
        );
      }
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
