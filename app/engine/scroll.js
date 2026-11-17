/**
 * The levels of a world read as one long level. Areas join on into one run the
 * camera scrolls through (app/game/world.js extend); where the next area isn't in
 * yet, walking out the side pans the camera across instead of cutting.
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

/** At most this many areas are laid out behind a level that starts mid-run. */
export const MAX_RUN_BEHIND = 10;

/**
 * The run that leads into area `id` of `areas`, oldest first: the levels of its world
 * before it that join on, so a level started mid-world can be walked back out of.
 * Just [area] when none join (a world's first level, a boss arena).
 */
export function runInto(areas, id) {
  const run = [areas[id]];
  while (run.length <= MAX_RUN_BEHIND) {
    const back = run[0].portals.find((p) => p.direction === -1 && p.destinationArea != null);
    const prev = back && areas[back.destinationArea];
    const on =
      prev && prev.portals.find((p) => p.direction === 1 && p.destinationArea === run[0].id);
    if (!on || !joinsSeamlessly(prev, run[0], on)) break;
    run.unshift(prev);
  }
  return run;
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
