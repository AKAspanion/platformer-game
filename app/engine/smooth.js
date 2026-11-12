/**
 * The game ticks 30 times a second but the screen refreshes 60 to 120 times.
 * Frames between ticks draw moving objects part of the way from where they were
 * before the tick to where they are now, so movement is smooth instead of stepping.
 *
 * snapshot() before each tick; apply(alpha) before drawing, restore() right after,
 * so the game itself only ever sees its real positions.
 */
export const MAX_STEP = 24; // px; a bigger move in one tick (a portal, a respawn) is drawn as a jump

export default class Smoother {
  constructor(maxStep = MAX_STEP) {
    this.maxStep = maxStep;
    this.before = new Map();
    this.moved = [];
  }

  /** Remember where each object is, just before a tick. */
  snapshot(objects) {
    this.before = new Map();
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      if (object) this.before.set(object, { x: object.x, y: object.y });
    }
  }

  /** Move each object `alpha` (0 to 1) of the way from its snapshot to where it is now. */
  apply(objects, alpha) {
    this.restore();
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      const from = object && this.before.get(object);
      if (!from) continue;
      const dx = object.x - from.x;
      const dy = object.y - from.y;
      if (Math.abs(dx) > this.maxStep || Math.abs(dy) > this.maxStep) continue;
      this.moved.push(object, object.x, object.y);
      object.x = from.x + dx * alpha;
      object.y = from.y + dy * alpha;
    }
  }

  /** Put every object back where the game has it. */
  restore() {
    for (let i = 0; i < this.moved.length; i += 3) {
      this.moved[i].x = this.moved[i + 1];
      this.moved[i].y = this.moved[i + 2];
    }
    this.moved.length = 0;
  }
}
