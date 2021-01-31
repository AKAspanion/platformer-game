export default class GameEngine {
  constructor(timeStep, update, render) {
    this.timeStep = timeStep;
    this.update = update;
    this.render = render;

    this.updated = false;

    this.time = null;
    this.extraTime = 0;
    this.animationFrameRequest = null;
  }

  loop() {
    this.animationFrameRequest = window.requestAnimationFrame(() =>
      this.loop()
    );

    this.extraTime += this.timeStep - this.time;
    this.time = this.timeStep;

    if (this.extraTime >= this.timeStep * 3) {
      this.extraTime = this.timeStep;
    }

    while (this.extraTime >= this.timeStep) {
      this.extraTime -= this.timeStep;

      this.update(this.timeStep);

      this.updated = true;
    }

    if (this.updated) {
      this.updated = false;
      this.render(this.timeStep);
    }
  }

  start() {
    this.extraTime = this.timeStep;

    this.time = window.performance.now();
    this.animationFrameRequest = window.requestAnimationFrame(() =>
      this.loop()
    );
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrameRequest);
  }
}
