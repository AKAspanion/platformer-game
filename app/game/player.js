import Object from "./object";
import Animator from "./animator";
export default class Player extends Object {
  constructor() {
    super(50, 100, 12, 12);
    this.color = "#ff0000";

    this.jumping = true;
    this.velocityX = 0;
    this.velocityY = 0;
    this.direction = 1;

    const keys = [
      { id: "Run", count: 8 },
      { id: "Jump", count: 8 },
      { id: "Dead", count: 8 },
      { id: "Idle", count: 10 },
    ];

    this.frameSets = {};

    keys.forEach(({ id, count }) => {
      for (let index = 1; index <= count; index++) {
        const imageLeft = new Image();
        const imageRight = new Image();
        imageLeft.src = `./sprites/player/left/${id} (${index}).png`;
        imageRight.src = `./sprites/player/right/${id} (${index}).png`;

        const keyLeft = `${id.toLowerCase()}Left`;
        const keyRight = `${id.toLowerCase()}Right`;

        const addImage = (k, image) => {
          if (!this.frameSets[k]) {
            this.frameSets[k] = [];
          }
          this.frameSets[k].push(image);
        };

        addImage(keyLeft, imageLeft);
        addImage(keyRight, imageRight);
      }
    });

    this.animator = new Animator(this.frameSets["idleRight"]);
  }

  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 18;
    }
  }

  moveLeft() {
    this.direction = -1;
    this.velocityX -= 0.5;
  }
  moveRight() {
    this.direction = 1;
    this.velocityX += 0.5;
  }

  updateAnimation({ dead = false }) {
    if (dead) {
      if (this.direction < 0) this.animator.changeFrameSet(this.frameSets["deadLeft"], 2);
      else this.animator.changeFrameSet(this.frameSets["deadRight"], 2);

      this.animator.animate(dead);
      return;
    }

    if (this.velocityY < 0) {
      if (this.direction < 0) this.animator.changeFrameSet(this.frameSets["jumpLeft"], 2);
      else this.animator.changeFrameSet(this.frameSets["jumpRight"], 2);
    } else if (this.direction < 0) {
      if (this.velocityX < -0.1) this.animator.changeFrameSet(this.frameSets["runLeft"]);
      else this.animator.changeFrameSet(this.frameSets["idleLeft"]);
    } else if (this.direction > 0) {
      if (this.velocityX > 0.1) this.animator.changeFrameSet(this.frameSets["runRight"]);
      else this.animator.changeFrameSet(this.frameSets["idleRight"]);
    }

    this.animator.animate();
  }

  update(gravity, friction) {
    this.xOld = this.x;
    this.yOld = this.y;
    this.velocityY += gravity;
    this.x += this.velocityX;
    this.y += this.velocityY;

    this.velocityX *= friction;
    this.velocityY *= friction;
  }
}
