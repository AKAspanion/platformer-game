/**
 * While the game is paused (pause menu, results, a modal) the world is frozen, so the
 * frame on screen is drawn once and then left alone instead of redrawn every refresh.
 * invalidate() asks for one more draw: resizing the canvas clears it.
 */
export default class StillFrame {
  constructor() {
    this.drawn = false;
  }

  /** True when a frame should be drawn now. */
  shouldDraw(paused) {
    if (!paused) {
      this.drawn = false;
      return true;
    }
    if (this.drawn) return false;
    this.drawn = true;
    return true;
  }

  invalidate() {
    this.drawn = false;
  }
}
