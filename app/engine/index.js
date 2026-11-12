// Draw at most ~60 frames a second: a 120 Hz screen gets every other refresh. The
// game ticks at 30 Hz, so more frames only cost battery (the tolerance absorbs jitter).
export const MIN_FRAME_MS = 1000 / 60 - 2;

export default class GameEngine {
  constructor(timeStep, update, render) {
    this.timeStep = timeStep;
    this.update = update;
    this.render = render;
    this.started = false;

    this.pause = false;

    this.updated = false;

    this.time = null;
    this.extraTime = 0;
    this.lastRender = -Infinity;
    this.animationFrameRequest = null;
    this.engineLoop = (t) => this.loop(t);
  }

  loop(timeStamp) {
    if (this.pause) {
      return;
    }

    this.animationFrameRequest = window.requestAnimationFrame(this.engineLoop);

    this.extraTime += timeStamp - this.time;
    this.time = timeStamp;

    if (this.extraTime >= this.timeStep * 3) {
      this.extraTime = this.timeStep;
    }

    while (this.extraTime >= this.timeStep) {
      this.extraTime -= this.timeStep;

      this.update(this.timeStamp);

      this.updated = true;
    }

    // Draw once the game has ticked, up to ~60 times a second, with how far it is
    // into the next tick (0 to 1), so moving things can be drawn between ticks.
    if (this.updated && timeStamp - this.lastRender >= MIN_FRAME_MS) {
      this.lastRender = timeStamp;
      this.render(Math.min(1, this.extraTime / this.timeStep));
    }
  }

  start() {
    this.started = true;
    this.extraTime = this.timeStep;
    this.lastRender = -Infinity;

    this.time = window.performance.now();
    this.animationFrameRequest = window.requestAnimationFrame(this.engineLoop);
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrameRequest);
  }

  hold() {
    this.pause = true;
  }

  resume() {
    this.pause = false;
  }
}
