export default class Animator {
  constructor(frameSet, delay = 4) {
    this.count = 0;
    this.delay = delay >= 1 ? delay : 1;
    this.frameSet = frameSet;
    this.frameIndex = 0;
    this.frameValue = frameSet[0];
  }

  animate() {
    this.loop();
  }

  changeFrameSet(frameSet, delay = 4, frameIndex = 0) {
    if (this.frameSet === frameSet) {
      return;
    }

    this.count = 0;
    this.delay = delay;
    this.frameSet = frameSet;
    this.frameIndex = frameIndex;
    this.frameValue = frameSet[frameIndex];
  }

  loop() {
    this.count++;

    while (this.count > this.delay) {
      this.count -= this.delay;

      this.frameIndex =
        this.frameIndex < this.frameSet.length - 1 ? this.frameIndex + 1 : 0;

      this.frameValue = this.frameSet[this.frameIndex];
    }
  }
}
