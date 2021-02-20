import Object from "./object";
import Animator from "./animator";

export default class Enemies {
  constructor(enemies = [], tileSize = 16, killedEnemies = "") {
    this.items = [];

    const keys = [{ id: "pig", count: 16 }];

    this.frameSets = {};

    this.loadCount = 0;
    this.assetCount = keys.reduce((total, { count }) => total + count * 2, 0);

    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const onImgLoad = () => {
          this.loadCount += 1;

          if (this.assetCount === this.loadCount) {
            this.loaded = true;
          }
        };
        const imageLeft = new Image();
        const imageRight = new Image();
        imageLeft.onload = onImgLoad;
        imageRight.onload = onImgLoad;
        imageLeft.src = `./assets/sprites/enemies/${id}/left/image_part_0${index}.png`;
        imageRight.src = `./assets/sprites/enemies/${id}/right/image_part_0${index}.png`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage(`${id}Left`, imageLeft);
        addImage(`${id}Right`, imageRight);
      }
    });

    for (let index = 0; index < enemies.length; index++) {
      const { id, type, left, top, sway } = enemies[index];

      if (!killedEnemies.includes(id)) {
        this.items.push(
          new Enemy(
            id,
            left * tileSize,
            top * tileSize,
            [this.frameSets[`${type}Left`], this.frameSets[`${type}Right`]],
            sway
          )
        );
      }
    }
  }

  remove(enemy) {
    this.items.splice(this.items.indexOf(enemy), 1);
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

class Enemy extends Object {
  constructor(id, x, y, frameSets, sway = 24) {
    super(x, y - 4, 20, 20);

    this.id = id;
    this.sway = sway;
    this.frameSets = frameSets;

    this.baseX = x;
    this.baseY = y;
    this.direction = 1;

    this.animator = new Animator(frameSets[1], 2);
  }

  update() {
    this.x += 0.5 * this.direction;

    if (this.x > this.baseX + this.sway) {
      this.direction = -1;
      this.animator.changeFrameSet(this.frameSets[0], 2);
    } else if (this.x <= this.baseX - this.sway) {
      this.direction = 1;
      this.animator.changeFrameSet(this.frameSets[1], 2);
    }
  }

  updateAnimation() {
    this.animator.animate();
  }
}
