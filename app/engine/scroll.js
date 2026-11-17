/**
 * The levels of a world read as one long level: walking out the side of one into
 * the next pans the camera across, the two screens side by side, instead of cutting.
 * A boss arena stays its own room (a cut in and out), and so does a change of world.
 */

/** How long the pan takes, in ticks (30 a second). */
export const SLIDE_TICKS = 12;

const sizeOf = (area) => [
  area.columns ?? area.areaMap?.[0]?.length,
  area.rows ?? area.areaMap?.length,
];

/** True when walking through `portal` from area `from` into area `to` pans rather than cuts. */
export function joinsSeamlessly(from, to, portal) {
  if (!from || !to || !portal) return false;
  if (Math.abs(portal.direction) !== 1) return false;
  if (from.boss || to.boss) return false;
  if (from.world !== to.world || (from.skin || null) !== (to.skin || null)) return false;
  const [fromColumns, fromRows] = sizeOf(from);
  const [toColumns, toRows] = sizeOf(to);
  return fromColumns === toColumns && fromRows === toRows;
}

/** Slow out, slow in. */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * One pan from the level just left into the next.
 * - direction: +1 walking right (the next level comes in from the right), -1 left
 * - width: a level's width in pixels
 * - from: the player's top-left in the level just left, as they walked out
 * - to: the player's top-left in the next level, where its portal puts them
 */
export function createSlide({ direction, width, from, to, ticks = SLIDE_TICKS }) {
  let tick = 0;
  // where the player walked out, in the next level's coordinates
  const start = { x: from.x - direction * width, y: from.y };

  const progress = (alpha = 0) => ease(Math.min(1, Math.max(0, (tick + alpha) / ticks)));

  return {
    get done() {
      return tick >= ticks;
    },
    step() {
      if (tick < ticks) tick += 1;
    },
    progress,
    /** Screen x of the left edge of the level just left (`old`) and of the next (`next`). */
    frame(alpha = 0) {
      const panned = progress(alpha) * width;
      return direction > 0
        ? { old: -panned, next: width - panned }
        : { old: panned, next: panned - width };
    },
    /** Where to draw the player, in the next level's coordinates: it walks across the seam. */
    player(alpha = 0) {
      const t = progress(alpha);
      return { x: lerp(start.x, to.x, t), y: lerp(start.y, to.y, t) };
    },
  };
}
