import Dino from "./dino";
import Cactuses from "./cactuses";
import Collider from "./collider";
import AudioController from "../controller/audio";
import Birds from "./birds";
import Ground from "./ground";

export default class World {
  constructor(friction = 0.92, gravity = 2) {
    this.friction = friction;
    this.gravity = gravity;

    this.rows = 4;
    this.columns = 16;
    this.tileSize = 20;

    this.loaded = true;

    this.height = this.tileSize * this.rows;
    this.width = this.tileSize * this.columns;

    this.ground = new Ground(this.width, this.height);

    this.dino = new Dino();
    this.collider = new Collider();
    this.birds = new Birds();
    this.cactuses = new Cactuses();

    this.audioController = new AudioController();
  }

  setup() {
    this.isPlayerDead = false;
  }

  reset() {
    this.dino.reset();
    this.birds.reset();
    this.ground.reset();
    this.cactuses.reset();
  }

  playJumpSound() {
    AudioController.play("jump", "wav");
  }

  playFireSound() {
    AudioController.play("fire", "wav");
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
    if (object.getLeft() < 0 - this.dino.width / 2) {
      object.setLeft(-this.dino.width / 2);
      object.velocityX = 0;
    } else if (object.getRight() > this.width + this.dino.width / 2) {
      object.setRight(this.width + this.dino.width / 2);
      object.velocityX = 0;
    }
    if (object.getTop() < 0 - this.dino.height * 2.5) {
      object.setTop(0 - this.dino.height * 2.5);
      object.velocityY = 0;
    } else if (object.getBottom() - 1 > this.height) {
      object.setBottom(this.height);
      object.velocityY = 0;
      object.jumping = false;
    }
  }

  _normalizeIndex(index, maxIndex) {
    if (index >= maxIndex - 1) {
      return maxIndex - 1;
    } else if (index < 0) {
      return 0;
    }

    return index;
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
    return 1;
  }

  get loadCount() {
    return true;
  }

  isLoaded() {
    return this.loaded && this.isAssetsLoaded();
  }

  isAssetsLoaded() {
    return true;
  }

  onPlayerDead(onGameOver, audio = "fall") {
    if (!this.isPlayerDead) {
      AudioController.play(audio, "mp3");

      this.stopThemeMusic();
      onGameOver();
    }
    this.isPlayerDead = true;
  }

  update(onGameOver) {
    this.dino.update(this.gravity, this.friction);

    this.collideObject(this.dino);
    if (!this.isPlayerDead) {
      this.ground.updateAnimation();
    }

    // cactuses
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.cactuses.items.length; index++) {
        const cactus = this.cactuses.items[index];

        if (this.checkCollision(this.dino, cactus)) {
          this.onPlayerDead(onGameOver);
          break;
        }

        cactus.update();
        cactus.updateAnimation();

        if (cactus.x <= -100) {
          this.cactuses.remove(cactus);
        }
      }
    }

    // birds
    if (!this.isPlayerDead) {
      for (let index = 0; index < this.birds.items.length; index++) {
        const bird = this.birds.items[index];

        if (this.checkCollision(this.dino, bird)) {
          this.onPlayerDead(onGameOver);
          break;
        }

        bird.update();
        bird.updateAnimation();

        if (bird.x <= -100) {
          this.birds.remove(bird);
        }
      }
    }

    this.dino.updateAnimation({ dead: this.isPlayerDead });
  }
}
