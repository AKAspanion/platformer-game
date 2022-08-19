import Object from "./object";
import Animator from "./animator";

export default class Dino extends Object {
  constructor() {
    super(40, 60, 24, 24);
    this.color = "#ff0000";
    this.loaded = false;

    this.offset = 0;
    this.renderWidth = 22;
    this.renderHeight = 23;

    this.running = false;
    this.ducking = false;
    this.jumping = true;
    this.velocityY = 0;

    const keys = [
      { id: "down", count: 2 },
      { id: "run", count: 2 },
      { id: "idle", count: 1 },
      { id: "hurt", count: 1 },
      { id: "jump", count: 1 },
    ];

    this.frameSets = {};

    this.loadCount = 0;
    this.assetCount = 8;
    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const image = new Image();
        image.onload = (e) => {
          this.loadCount += 1;

          if (count === this.loadCount) {
            this.loaded = true;
          }
        };
        image.src = `./assets/sprites/dino/${id} (${index}).png`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage(id, image);
      }
    });

    this.animator = new Animator(this.frameSets["idle"]);
  }

  getRenderWidth() {
    return this.renderWidth;
  }

  getRenderHeight() {
    return this.renderHeight;
  }

  setRenderWidth(width) {
    this.renderWidth = width;
  }

  getOffset() {
    return this.offset;
  }

  setOffset(offset) {
    this.offset = offset;
  }

  reset() {
    this.x = 40;
    this.y = 100;
    this.yOld = 100;
    this.running = false;
    this.jumping = false;
    this.running = false;
    this.velocityY = 0;
  }

  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 18;
    }
  }

  run() {
    this.running = true;
    this.ducking = false;
  }

  duck(value = true) {
    this.running = true;
    this.ducking = value;
  }

  setDimension(width, height) {
    this.width = width;
    this.height = height;
  }

  updateAnimation({ dead = false }) {
    // console.log(this);
    if (dead) {
      this.animator.changeFrameSet(this.frameSets["hurt"], 1);

      this.animator.animate(dead);
      return;
    }

    if (this.velocityY < 0) {
      this.setOffset(0);
      this.setRenderWidth(22);
      this.setDimension(24, 24);
      this.animator.changeFrameSet(this.frameSets["jump"], 1);
    } else if (this.running) {
      if (this.ducking) {
        this.setOffset(-8);
        this.setRenderWidth(30);
        this.setDimension(29, 16);
        this.animator.changeFrameSet(this.frameSets["down"]);
      } else {
        this.setOffset(0);
        this.setRenderWidth(22);
        this.setDimension(24, 24);
        this.animator.changeFrameSet(this.frameSets["run"]);
      }
    } else {
      this.setOffset(0);
      this.setDimension(24, 24);
      this.animator.changeFrameSet(this.frameSets["idle"]);
    }

    // else if (this.direction < 0) {
    //   if (this.velocityX < -0.1) {
    //     this.animator.changeFrameSet(this.frameSets["runLeft"]);
    //   } else {
    //     if (this.firing) {
    //       this.animator.changeFrameSet(this.frameSets["fireLeft"], 2);
    //     } else {
    //       this.animator.changeFrameSet(this.frameSets["idleLeft"]);
    //     }
    //   }
    // } else if (this.direction > 0) {
    //   if (this.velocityX > 0.1) {
    //     this.animator.changeFrameSet(this.frameSets["runRight"]);
    //   } else {
    //     if (this.firing) {
    //       this.animator.changeFrameSet(this.frameSets["fireRight"], 2);
    //     } else {
    //       this.animator.changeFrameSet(this.frameSets["idleRight"]);
    //     }
    //   }
    // }

    this.animator.animate();
  }

  update(gravity, friction) {
    this.yOld = this.y;
    this.velocityY += gravity;
    this.y += this.velocityY;

    this.velocityY *= friction;
  }
}
