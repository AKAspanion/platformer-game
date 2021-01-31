import Player from "./player";

export default class World {
  constructor(friction = 0.9, gravity = 3) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.map = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 2, 2, 3, 0, 0, 0, 0, 0, 13, 15, 0, 0, 1, 2, 2],
      [9, 9, 9, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5, 5],
      [0, 0, 0, 0, 0, 0, 13, 15, 0, 0, 0, 0, 0, 12, 9, 9],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 13, 14, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 4, 5, 6, 0, 0, 0, 0, 0, 0],
      [2, 3, 0, 0, 0, 0, 1, 2, 2, 2, 2, 3, 0, 0, 0, 0],
      [2, 2, 2, 3, 17, 17, 4, 5, 5, 5, 5, 10, 2, 3, 17, 17],
      [5, 5, 5, 6, 18, 18, 4, 5, 5, 5, 5, 5, 5, 6, 18, 18],
    ];

    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
  }

  collideObject(object) {
    if (object.x < 0) {
      object.x = 0;
      object.velocityX = 0;
    } else if (object.x + object.width > this.width) {
      object.x = this.width - object.width;
      object.velocityX = 0;
    }
    if (object.y < 0) {
      object.y = 0;
      object.velocityY = 0;
    } else if (object.y + object.height > this.height) {
      object.jumping = false;
      object.y = this.height - object.height;
      object.velocityY = 0;
    }
  }

  update() {
    this.player.velocityY += this.gravity;
    this.player.update();

    this.player.velocityX *= this.friction;
    this.player.velocityY *= this.friction;

    this.collideObject(this.player);
  }
}
