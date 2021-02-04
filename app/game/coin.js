import Object from "./object";
import Animator from "./animator";

export default class Coin extends Object {
  constructor(x, y, offsetX = 0, offsetY = 0, frameSet) {
    super(x, y, 10, 12);

    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.frameSet = frameSet;

    this.baseX = x;
    this.baseY = y;
    this.positionX = Math.random() * Math.PI * 2;
    this.positionY = this.positionX * 2;

    this.animator = new Animator(this.frameSet);
  }

  update() {
    this.positionX += 0.1;
    this.positionY += 0.2;

    this.x = this.baseX + Math.cos(this.positionX) * 2;
    this.y = this.baseY + Math.sin(this.positionY);
  }

  updateAnimation() {
    this.animator.animate();
  }
}
