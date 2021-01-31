export default class Player {
  constructor(x, y) {
    this.color = "#ff0000";
    this.height = 16;
    this.jumping = true;
    this.velocityX = 0;
    this.velocityY = 0;
    this.width = 16;
    this.x = 100;
    this.y = 50;
  }

  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.velocityY -= 20;
    }
  }

  moveLeft() {
    this.velocityX -= 0.5;
  }
  moveRight() {
    this.velocityX += 0.5;
  }

  update() {
    this.x += this.velocityX;
    this.y += this.velocityY;
  }
}
