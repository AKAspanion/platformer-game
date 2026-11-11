import Object from "./object";
import Animator from "./animator";
import { requestImage } from "./preload";
export default class items {
  constructor(objects = [], tileSize, collectedCoins) {
    this.items = [];

    // the frames are requested once per session: a second level counts nothing
    // in flight, so it reports loaded straight away
    this.assetCount = 0;
    this.loadCount = 0;
    this.frameSets = { coin: [] };
    for (let index = 1; index <= 16; index++) {
      this.frameSets.coin.push(requestImage(`./assets/sprites/coin/image ${index}.webp`, this));
    }

    // ids are stored as "id1,id2,"; match whole ids, not substrings
    const collected = new Set(collectedCoins.split(","));
    for (let index = 0; index < objects.length; index++) {
      const { id, left, top, offsetX, offsetY } = objects[index];

      if (!collected.has(id)) {
        this.items.push(
          new Coin(id, left * tileSize, top * tileSize, offsetX, offsetY, this.frameSets["coin"]),
        );
      }
    }
  }

  get loaded() {
    return this.loadCount >= this.assetCount;
  }

  remove(coin) {
    this.items.splice(this.items.indexOf(coin), 1);
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

class Coin extends Object {
  constructor(id, x, y, offsetX = 3, offsetY = 3, frameSet) {
    super(x, y, 8, 10);

    this.id = id;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    this.baseX = x;
    this.baseY = y;
    this.positionX = Math.random() * Math.PI * 2;
    this.positionY = this.positionX * 2;

    this.animator = new Animator(frameSet);
  }

  update() {
    this.positionX += 0.1;
    this.positionY += 0.15;

    this.x = this.baseX + Math.cos(this.positionX) * 1.5;
    this.y = this.baseY + Math.sin(this.positionY);
  }

  updateAnimation() {
    this.animator.animate();
  }
}
