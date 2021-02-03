import Player from "./player";
import Object from "./object";
import Portal from "./portal";
import Collider from "./collider";

export default class World {
  constructor(friction = 0.87, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
    this.collider = new Collider();
  }

  setup(data) {
    this.id = data.id;
    this.map = data.areaMap;
    this.collisonMap = data.collisonMap;

    this.deathAreas = data.death.map(
      ({ x, y, height, width }) => new Object(x, y, width, height)
    );

    this.portals = data.portals.map(
      ({ x, y, height, width, destinationX, destinationY, direction }) =>
        new Portal(x, y, width, height, destinationX, destinationY, direction)
    );

    if (this.portal) {
      this.player.setCenterX(this.portal.destinationX);
      this.player.setCenterY(this.portal.destinationY);
      this.player.direction = this.portal.direction;

      this.portal = null;
    }
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

  checkCollision(object1, object2) {
    if (
      object1.x < object2.x + object2.width &&
      object1.x + object1.width > object2.x &&
      object1.y < object2.y + object2.height &&
      object1.y + object1.height > object2.y
    ) {
      return true;
    }
    return false;
  }

  update(onGameOver) {
    this.player.update(this.gravity, this.friction);

    this.collideObject(this.player);

    let dead = false;
    for (let index = 0; index < this.deathAreas.length; index++) {
      dead = this.checkCollision(this.player, this.deathAreas[index]);
      if (dead) break;
    }

    if (!this.portal) {
      for (let index = 0; index < this.portals.length; index++) {
        if (this.checkCollision(this.player, this.portals[index])) {
          this.portal = this.portals[index];
          break;
        }
      }
    }

    this.player.updateAnimation({ dead });

    if (dead) {
      onGameOver();
    }
  }
}
