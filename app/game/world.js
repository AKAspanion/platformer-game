import Coins from "./coins";
import Water from "./water";
import Player from "./player";
import Object from "./object";
import Portal from "./portal";
import Collider from "./collider";
import AudioController from "../controller/audio";

export default class World {
  constructor(friction = 0.87, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.coins = [];
    this.totalSnacks = 0;
    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
    this.collider = new Collider();

    this.audioController = new AudioController();
  }

  setup(data) {
    this.id = data.id;
    this.map = data.areaMap;
    this.objects = data.objectsMap;
    this.collisonMap = data.collisonMap;

    this.deathAreas = data.death.map(({ x, y, height, width }) => new Object(x, y, width, height));

    this.portals = data.portals.map((p) => new Portal(p));

    this.coins = new Coins(data.coins, this.tileSize);

    this.water = new Water(data.water, this.tileSize);

    if (this.portal) {
      this.player.setCenterX(this.portal.destinationX);
      this.player.setCenterY(this.portal.destinationY);
      this.player.direction = this.portal.direction;

      this.portal = null;
    }
  }

  collideObject(object) {
    if (object.getLeft() < 0 - this.player.width / 2) {
      object.setLeft(-this.player.width / 2);
      object.velocityX = 0;
    } else if (object.getRight() > this.width + this.player.width / 2) {
      object.setRight(this.width + this.player.width / 2);
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

    let bottom, left, right, top;

    const setTop = () => {
      top = this._normalizeIndex(Math.floor(object.getTop() / this.tileSize), this.rows);
    };

    const setBottom = () => {
      bottom = this._normalizeIndex(Math.floor(object.getBottom() / this.tileSize), this.rows);
    };

    const setLeft = () => {
      left = Math.floor(object.getLeft() / this.tileSize);
    };

    const setRight = () => {
      right = Math.floor(object.getRight() / this.tileSize);
    };

    setTop();
    setLeft();
    this.collider.collide(
      this.collisonMap[top][left],
      object,
      left * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );

    setTop();
    setRight();
    this.collider.collide(
      this.collisonMap[top][right],
      object,
      right * this.tileSize,
      top * this.tileSize,
      this.tileSize
    );

    setBottom();
    setLeft();
    this.collider.collide(
      this.collisonMap[bottom][left],
      object,
      left * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );

    setBottom();
    setRight();
    this.collider.collide(
      this.collisonMap[bottom][right],
      object,
      right * this.tileSize,
      bottom * this.tileSize,
      this.tileSize
    );
  }

  _normalizeIndex(index, maxIndex) {
    if (index >= maxIndex - 1) {
      return maxIndex - 1;
    } else if (index < 0) {
      return 0;
    }

    return index;
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

    for (let index = 0; index < this.coins.items.length; index++) {
      const coin = this.coins.items[index];

      coin.update();
      coin.updateAnimation();

      if (this.checkCollision(this.player, coin)) {
        this.coins.items.splice(this.coins.items.indexOf(coin), 1);
        this.audioController.play("coin");
        this.totalSnacks += 1;
      }
    }

    let dead = false;
    if (!dead) {
      for (let index = 0; index < this.deathAreas.length; index++) {
        if (this.checkCollision(this.player, this.deathAreas[index])) {
          if (this.isPlayerDead === undefined) {
            this.audioController.play("fall", "mp3");
          }
          this.isPlayerDead = true;
          dead = true;
          break;
        }
      }
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

    this.water.update();

    if (dead) {
      this.player.velocityX = 0;
      onGameOver();
    }
  }
}