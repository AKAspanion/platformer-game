import Coins from "./coins";
import Water from "./water";
import Player from "./player";
import Object from "./object";
import Portal from "./portal";
import Enemies from "./enemies";
import Collider from "./collider";
import Effects from "./effects";
import Fireballs from "./fireballs";
import AudioController from "../controller/audio";

export default class World {
  constructor(friction = 0.87, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 12;
    this.columns = 16;
    this.tileSize = 16;

    this.loaded = true;

    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";
    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.player = new Player();
    this.collider = new Collider();
    this.fireballs = new Fireballs();
    this.effects = new Effects();

    this.audioController = new AudioController();
  }

  setup(data) {
    if (this.theme !== data.theme) {
      if (data.theme) {
        this.playedThemeMusic = false;
        this.audioController.load(
          [
            { file: "fire", ext: "wav" },
            { file: "coin", ext: "wav" },
            { file: "foot", ext: "wav" },
            { file: "jump", ext: "wav" },
            { file: "hurt", ext: "wav" },
            { file: "fall", ext: "mp3" },
            { file: data.theme, ext: "mp3" },
          ],
          (val) => {
            this.loaded = val;
          },
        );

        this.stopThemeMusic();
        this.theme = data.theme;
      }
    }

    this.id = data.id;
    this.map = data.areaMap;
    this.isPlayerDead = false;
    this.objects = data.objectsMap;
    this.collisonMap = data.collisonMap;

    if (data.rows) {
      this.rows = data.rows;
      this.height = this.tileSize * this.rows;
    }
    if (data.columns) {
      this.columns = data.columns;
      this.width = this.tileSize * this.columns;
    }

    this.deathAreas = data.death.map(({ x, y, height, width }) => new Object(x, y, width, height));

    this.enemies = new Enemies(data.enemies, this.tileSize, this.killedEnemies);

    this.coins = new Coins(data.coins, this.tileSize, this.collectedCoins);

    this.portals = data.portals.map((p) => new Portal(p));

    this.water = new Water(data.water, this.tileSize);

    this.fireballs.reset();
    this.effects.reset();

    if (this.portal) {
      this.player.setCenterX(this.portal.destinationX);
      this.player.setCenterY(this.portal.destinationY);
      this.player.direction = this.portal.direction;

      this.portal = null;
    }
  }

  reset() {
    this.totalCoins = 0;
    this.totalEnemies = 0;
    this.killedEnemies = "";
    this.collectedCoins = "";

    this.player.reset();
  }

  playJumpSound() {
    AudioController.play("jump", "wav");
  }

  playFireSound() {
    AudioController.play("fire", "wav");
  }

  /** Fire from the player's mouth if the cooldown allows. Returns true if fired. */
  shootFireball(id) {
    const { player } = this;
    if (this.isPlayerDead || !player.fire()) return false;

    const offsetX = player.direction < 0 ? -32 : 8;
    this.fireballs.add(id, player.x + offsetX, player.y - 16, player.direction);
    this.effects.burst(player.getCenterX() + player.direction * 10, player.y - 8, {
      count: 4,
      colors: ["#fff6a8", "#ffb43f"],
      speed: 1.2,
      life: 5,
      gravity: 0,
      size: 1,
      direction: player.direction * 1.5,
    });
    this.playFireSound();
    return true;
  }

  playThemeMusic() {
    if (!this.theme) return;

    this.audioController.play(this.theme, "mp3");
    this.audioController.volume(this.theme, 8);
    this.audioController.loop(this.theme);
  }

  stopThemeMusic() {
    if (!this.theme) return;

    this.audioController.stop(this.theme);
  }

  pauseThemeMusic() {
    if (!this.theme) return;

    this.audioController.pause(this.theme);
  }

  collideObject(object) {
    if (object.getLeft() < 0 - this.player.width / 2) {
      object.setLeft(-this.player.width / 2);
      object.velocityX = 0;
    } else if (object.getRight() > this.width + this.player.width / 2) {
      object.setRight(this.width + this.player.width / 2);
      object.velocityX = 0;
    }
    if (object.getTop() < 0 - this.player.height * 2.5) {
      object.setTop(0 - this.player.height * 2.5);
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
      this.tileSize,
    );

    setTop();
    setRight();
    this.collider.collide(
      this.collisonMap[top][right],
      object,
      right * this.tileSize,
      top * this.tileSize,
      this.tileSize,
    );

    setBottom();
    setLeft();
    this.collider.collide(
      this.collisonMap[bottom][left],
      object,
      left * this.tileSize,
      bottom * this.tileSize,
      this.tileSize,
    );

    setBottom();
    setRight();
    this.collider.collide(
      this.collisonMap[bottom][right],
      object,
      right * this.tileSize,
      bottom * this.tileSize,
      this.tileSize,
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

  /** Side walls (anything the player can't walk through) block fireballs. */
  isWallAt(x, y) {
    const column = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) return false;
    const value = this.collisonMap[row] && this.collisonMap[row][column];
    return typeof value === "string" && /[lr]/.test(value);
  }

  killEnemy(enemy, direction) {
    if (!enemy.kill(direction)) return;

    this.killedEnemies += `${enemy.id},`;
    this.totalEnemies += 1;

    const x = enemy.getCenterX();
    const y = enemy.getCenterY();
    this.effects.enemyDeath(x, y, direction);
    this.effects.popup("+100", x, enemy.getTop() - 2, "#ffe066");
    this.effects.shake(2, 5);
    this.effects.hitStop(2);

    AudioController.play("hurt");
  }

  /** The first live enemy in the fireball's path, if it touches one. */
  fireballTarget(fireball) {
    const hitbox = fireball.hitbox();
    let target = null;
    for (let index = 0; index < this.enemies.items.length; index++) {
      const enemy = this.enemies.items[index];
      if (enemy.dying || !this.checkCollision(enemy, hitbox)) continue;
      // nearest to where the fireball came from wins
      if (
        !target ||
        (fireball.direction < 0 ? enemy.getRight() > target.getRight() : enemy.x < target.x)
      ) {
        target = enemy;
      }
    }
    return target;
  }

  playerJumped() {
    this.effects.dust(this.player.getCenterX(), this.player.getBottom(), 4);
  }

  checkCollision(object1, object2, offsetX = 0, offsetY = 0) {
    if (
      object1.x < object2.x + object2.width + offsetX &&
      object1.x + object1.width > object2.x - offsetX &&
      object1.y < object2.y + object2.height + offsetY &&
      object1.y + object1.height > object2.y - offsetY
    ) {
      return true;
    }
    return false;
  }

  get assetCount() {
    return (
      this.coins.assetCount +
      this.water.assetCount +
      this.player.assetCount +
      this.enemies.assetCount +
      this.fireballs.assetCount
    );
  }

  get loadCount() {
    return (
      this.coins.loadCount +
      this.water.loadCount +
      this.player.loadCount +
      this.enemies.loadCount +
      this.fireballs.loadCount
    );
  }

  isLoaded() {
    return this.loaded && this.isAssetsLoaded();
  }

  isAssetsLoaded() {
    return (
      this.coins.loaded &&
      this.water.loaded &&
      this.player.loaded &&
      this.enemies.loaded &&
      this.fireballs.loaded
    );
  }

  onPlayerDead(onGameOver, audio = "fall") {
    if (!this.isPlayerDead) {
      AudioController.play(audio, "mp3");

      this.player.velocityX = 0;
      this.stopThemeMusic();
      onGameOver();
    }
    this.isPlayerDead = true;
    this.collectedCoins = "";
    this.killedEnemies = "";
    this.theme = null;
  }

  update(onGameOver) {
    AudioController.animate(() => {
      AudioController.play("foot", "wav", 0.15);
    }, this.player.running);

    if (!this.playedThemeMusic) {
      if (this.isLoaded()) {
        this.playThemeMusic();
        this.playedThemeMusic = true;
      }
    }

    // hit-stop: freeze the world for a couple of ticks when something is hit
    if (this.effects.freeze > 0) {
      this.effects.freeze -= 1;
      return;
    }

    this.effects.update();

    this.player.update(this.gravity, this.friction);

    const fallSpeed = this.player.velocityY;
    this.collideObject(this.player);
    if (fallSpeed > 4 && this.player.velocityY === 0 && !this.isPlayerDead) {
      this.effects.dust(this.player.getCenterX(), this.player.getBottom(), 5);
    }

    // coins (backwards: collecting removes from the list)
    for (let index = this.coins.items.length - 1; index >= 0; index--) {
      const coin = this.coins.items[index];

      coin.update();
      coin.updateAnimation();

      if (this.checkCollision(this.player, coin, 5, 5)) {
        this.coins.remove(coin);

        this.collectedCoins += `${coin.id},`;

        AudioController.play("coin");
        this.effects.coinSparkle(
          coin.getCenterX() + coin.offsetX,
          coin.getCenterY() + coin.offsetY,
        );
        this.totalCoins += 1;
      }
    }

    // fireballs: one fireball, one kill. It burns out on the first enemy or
    // wall it touches. (Backwards: hits remove from the list.)
    for (let index = this.fireballs.items.length - 1; index >= 0; index--) {
      const fireball = this.fireballs.items[index];

      fireball.update();
      fireball.updateAnimation();

      const tip = fireball.tip();
      const target = this.fireballTarget(fireball);
      if (target) {
        this.killEnemy(target, fireball.direction);
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (this.isWallAt(tip.x, tip.y)) {
        this.effects.fireImpact(tip.x, tip.y, fireball.direction);
        this.fireballs.remove(fireball);
      } else if (fireball.x >= this.width + 50 || fireball.x + fireball.width < -50) {
        this.fireballs.remove(fireball);
      }
    }

    if (!this.isPlayerDead) {
      for (let index = 0; index < this.deathAreas.length; index++) {
        if (this.checkCollision(this.player, this.deathAreas[index])) {
          this.effects.shake(2, 8);
          this.onPlayerDead(onGameOver);
          break;
        }
      }
    }

    // enemies. Dying enemies are harmless. The contact box is a few pixels
    // inside the sprite so a hit only counts when the sprites really touch.
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.enemies.items.length; index++) {
        const enemy = this.enemies.items[index];

        if (!enemy.dying && this.checkCollision(this.player, enemy, -3, -3)) {
          this.effects.shake(3, 10);
          this.onPlayerDead(onGameOver, "fall");
          break;
        }
      }
    }
    this.enemies.update();
    this.enemies.updateAnimation();

    if (!this.portal && !this.isPlayerDead) {
      for (let index = 0; index < this.portals.length; index++) {
        if (this.checkCollision(this.player, this.portals[index])) {
          this.portal = this.portals[index];
          break;
        }
      }
    }

    this.player.updateAnimation({ dead: this.isPlayerDead });

    this.water.update();
  }
}
