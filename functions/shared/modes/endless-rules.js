// GENERATED from app/modes/endless-rules.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * Endless mode's ranking rules, shared by the game and the server: the
 * submitEndlessScore function regenerates the run's seed the way endless mode
 * builds it and decides whether the run can be ranked.
 *
 * Pure: loads in Node and the browser (no window, document or localStorage).
 * Copied to functions/shared/ by scripts/sync-functions-shared.js.
 */
import { generateEndlessLevel } from "../pcg/generator.js";
import { COIN_SCORE, ENEMY_MAX_SCORE, FULL_HEART_BONUS } from "../daily/rules.js";

/** The lowest level a run is ranked at (reaching level 1 is just starting). */
export const MIN_LEVEL = 2;
export const MAX_LEVEL = 500;
/** Clearing a level takes at least this long. */
export const SECONDS_PER_LEVEL = 8;
export const MAX_ENDLESS_SECONDS = 36000;
/** Submissions per account per hour. */
export const ENDLESS_LIMIT = 30;

/** Area ids the ceiling's levels are generated under; any base gives the same counts. */
const CEILING_ID_BASE = 4000;
/** createEndlessSession (app/modes/index.js) offsets each level's seed by this. */
const LEVEL_SEED_STEP = 7919;

/**
 * The most a run can score through levels 1..level of this endless seed: it
 * regenerates the levels the way createEndlessSession builds them (each
 * level's entry height follows the previous exit), then counts 20 per coin,
 * the highest enemy score per enemy and the full-health heart bonus per
 * power-up.
 */
export function endlessScoreCeiling(seed, level) {
  let total = 0;
  let prevExit = 9;
  for (let index = 0; index < level; index++) {
    const { data, exit } = generateEndlessLevel({
      id: CEILING_ID_BASE + index,
      seed: seed + index * LEVEL_SEED_STEP,
      index,
      prevExit,
    });
    prevExit = exit;
    total +=
      data.coins.length * COIN_SCORE +
      data.enemies.length * ENEMY_MAX_SCORE +
      (data.powerups || []).length * FULL_HEART_BONUS;
  }
  return total;
}

/** Null when the run may be ranked, else the reason. */
export function checkEndlessRun(run) {
  const { seed, level, score, seconds } = run || {};
  if (!Number.isInteger(seed)) return "That run can't be ranked.";
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    return `Only levels ${MIN_LEVEL} to ${MAX_LEVEL} are ranked.`;
  }
  if (!Number.isFinite(seconds) || seconds > MAX_ENDLESS_SECONDS) {
    return "That run took too long to be ranked.";
  }
  if (seconds < (level - 1) * SECONDS_PER_LEVEL) return "That run was too fast to be ranked.";
  if (!Number.isInteger(score) || score < 0) return "That score can't be ranked.";
  if (score > endlessScoreCeiling(seed, level)) return "That score is more than the levels give.";
  return null;
}

/** Sort key: higher level, then higher score, then shorter time. Negative when a ranks above b. */
export function compareRuns(a, b) {
  return b.level - a.level || b.score - a.score || a.seconds - b.seconds;
}
