import Object from "./object";
export default class Player extends Object {
  constructor(x, y) {
    super(50, 100, 12, 12);
    this.color = "#ff0000";

    this.jumping = true;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 30;
    }
  }

  moveLeft() {
    this.velocityX -= 0.5;
  }
  moveRight() {
    this.velocityX += 0.5;
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
