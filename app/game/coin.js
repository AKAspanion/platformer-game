import Object from "./object";
import Animator from "./animator";

import { uid } from "../util";

export default class Coin extends Object {
  constructor(id, x, y, offsetX = 0, offsetY = 0, frameSet) {
    super(x, y, 8, 10);

    this.id = id;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    this.baseX = x;
    this.baseY = y;
    this.positionX = Math.random() * Math.PI * 2;
    this.positionY = this.positionX * 2;

    this.animator = new Animator(frameSet);
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
