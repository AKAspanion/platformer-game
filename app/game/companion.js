import { requestImage } from "./preload";

/**
 * The worn companion: it follows the dino a few steps behind, along the
 * dino's own path. It never collides, collects, hurts or changes anything;
 * it is only drawn (by the shell, from createFollower's position).
 */
export const FOLLOW_TICKS = 10; // how far behind the dino it walks
/** The size a companion is drawn at: its sprites are 32 x 28, so 1x and no pixel row is dropped. */
export const COMPANION_SIZE = { width: 32, height: 28 };

/** A trail of the dino's positions; `at()` is where the companion stands, `delay` ticks back. */
export function createFollower(delay = FOLLOW_TICKS) {
  let trail = [];
  return {
    /** The dino's position this tick: call once per tick. */
    push(point) {
      trail.push({ x: point.x, y: point.y, direction: point.direction });
      if (trail.length > delay + 2) trail.shift();
    },
    /** Where the companion is, and whether it is on the move (walking, not standing); null before any push. */
    at() {
      if (!trail.length) return null;
      const index = Math.max(0, trail.length - 1 - delay);
      const here = trail[index];
      const other = trail[index + 1] || trail[index - 1];
      const moving = !!other && (other.x !== here.x || other.y !== here.y);
      return { x: here.x, y: here.y, direction: here.direction, moving };
    },
    /** A level starts or the dino respawns: forget the trail. */
    reset() {
      trail = [];
    },
  };
}

const frameSets = new Map(); // companion id -> [frame 1, frame 2]
const idle = { assetCount: 0, loadCount: 0 }; // companions never hold up the loading bar

const failed = (image) => image.complete === true && image.naturalWidth === 0;

/**
 * [frame 1, frame 2] of a companion, loaded once through the shared image
 * registry; [] for "none" or an unknown id. Ask again when a level starts: a
 * sprite that failed to load is requested afresh then.
 */
export function companionFrames(id) {
  if (typeof id !== "string" || !/^[a-z]+$/.test(id) || id === "none") return [];
  const have = frameSets.get(id);
  if (have && !have.some(failed)) return have;
  const frames = [1, 2].map((n) =>
    requestImage(`./assets/sprites/companions/${id}-${n}.png`, idle),
  );
  frameSets.set(id, frames);
  return frames;
}
