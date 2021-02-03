import Player from "./player";
import Collider from "./collider";

export default class World {
  constructor(friction = 0.92, gravity = 3) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.map = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 2, 2, 3, 0, 0, 0, 0, 0, 13, 15, 0, 0, 0, 0, 0],
      [9, 9, 9, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2],
      [0, 0, 0, 0, 0, 0, 13, 15, 0, 0, 0, 0, 0, 4, 5, 5],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 9, 9],
      [0, 0, 0, 13, 14, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 4, 5, 6, 0, 0, 0, 0, 0, 0],
      [2, 3, 0, 0, 0, 0, 1, 2, 2, 2, 2, 3, 0, 0, 0, 0],
      [2, 2, 2, 3, 17, 17, 4, 5, 5, 5, 5, 10, 2, 3, 17, 17],
      [5, 5, 5, 6, 18, 18, 4, 5, 5, 5, 5, 5, 5, 6, 18, 18],
    ];

    this.collisonMap = [
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["t", "t", "t", "tr", "", "", "", "", "", "t", "t", "", "", "", "", ""],
      ["", "", "", "", "r", "", "", "", "", "", "", "", "", "lt", "t", "t"],
      ["", "", "", "", "r", "", "t", "t", "", "", "", "", "", "l", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "l", "", ""],
      ["", "", "", "t", "t", "t", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "t", "t", "t", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      [
        "t",
        "t",
        "",
        "",
        "",
        "",
        "tl",
        "t",
        "t",
        "t",
        "t",
        "tr",
        "",
        "",
        "",
        "",
      ],
      [
        "tb",
        "tb",
        "tb",
        "tr",
        "",
        "",
        "l",
        "",
        "",
        "",
        "",
        "",
        "t",
        "tr",
        "",
        "",
      ],
      ["", "", "", "rt", "lb", "rb", "l", "", "", "", "", "", "", "r", "", ""],
    ];

    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
    this.collider = new Collider();
  }

  collideObject(object) {
    if (object.getLeft() < 0) {
      object.setLeft(0);
      object.velocityX = 0;
    } else if (object.getRight() > this.width) {
      object.setRight(this.width);
      object.velocityX = 0;
    }
    if (object.getTop() < 0) {
      object.setTop(0);
      object.velocityY = 0;
    } else if (object.getBottom() - 1 > this.height) {
      object.setBottom(this.height);
      object.velocityY = 0;
      object.jumping = false;
    }

    let bottom, left, right, top, value;

    top = Math.floor(object.getTop() / this.tileSize);
    left = Math.floor(object.getLeft() / this.tileSize);
    value = this.collisonMap[top][left];
    this.collider.collide(
      value,
      object,
      left * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );

    top = Math.floor(object.getTop() / this.tileSize);
    right = Math.floor(object.getRight() / this.tileSize);
    value = this.collisonMap[top][right];
    this.collider.collide(
      value,
      object,
      right * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );

    bottom = Math.floor((object.getBottom() - 0.01) / this.tileSize);
    left = Math.floor(object.getLeft() / this.tileSize);
    value = this.collisonMap[bottom][left];
    this.collider.collide(
      value,
      object,
      left * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );

    bottom = Math.floor((object.getBottom() - 0.01) / this.tileSize);
    right = Math.floor(object.getRight() / this.tileSize);
    value = this.collisonMap[bottom][right];
    this.collider.collide(
      value,
      object,
      right * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );
  }

  update() {
    this.player.update(this.gravity, this.friction);

    this.collideObject(this.player);

    this.player.updateAnimation();
  }
}
