// GENERATED from app/campaign/score-rules.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * Campaign scoring rules for the combined leaderboard, shared by the game and
 * the server: each campaign level counts the player's best score in it, and
 * the submitCampaignScore function caps that score at what the level gives.
 *
 * Pure: loads in Node and the browser (no window, document or localStorage).
 * Copied to functions/shared/ by scripts/sync-functions-shared.js, so the level
 * contents are listed here rather than read from app/areas (348 KB of maps the
 * server has no use for). tests/campaign-score.test.js checks every count
 * against app/areas and the campaign's level list: regenerate the levels, then
 * update CAMPAIGN_LEVELS from the failure message.
 */
import { COIN_SCORE, COMBO_MAX, ENEMY_MAX_SCORE, FULL_HEART_BONUS } from "../daily/rules.js";

/** A boss gives this many points (app/game/world.js), before the combo. */
export const BOSS_SCORE = 1000;
/** Boss minions keep coming while the fight lasts: this many count towards the cap. */
export const MINION_ALLOWANCE = 20;
/** The shortest time a campaign level can be finished in. */
export const MIN_LEVEL_SECONDS = 3;
/** The longest a ranked campaign level may take. */
export const MAX_LEVEL_SECONDS = 3600;
/** Campaign scores per account per hour (a level takes half a minute at best). */
export const CAMPAIGN_LIMIT = 120;

/** Each campaign level (by area id): coins, enemies, power-ups and whether it is a boss arena. */
export const CAMPAIGN_LEVELS = {
  1: { coins: 25, enemies: 4, powerups: 1, boss: false },
  2: { coins: 25, enemies: 5, powerups: 1, boss: false },
  3: { coins: 25, enemies: 5, powerups: 1, boss: false },
  7: { coins: 21, enemies: 6, powerups: 1, boss: false },
  8: { coins: 16, enemies: 6, powerups: 1, boss: false },
  9: { coins: 31, enemies: 5, powerups: 1, boss: false },
  10: { coins: 28, enemies: 6, powerups: 1, boss: false },
  11: { coins: 19, enemies: 5, powerups: 1, boss: false },
  12: { coins: 26, enemies: 7, powerups: 1, boss: false },
  13: { coins: 28, enemies: 5, powerups: 1, boss: false },
  14: { coins: 28, enemies: 3, powerups: 1, boss: false },
  15: { coins: 30, enemies: 6, powerups: 1, boss: false },
  16: { coins: 29, enemies: 4, powerups: 1, boss: false },
  17: { coins: 29, enemies: 6, powerups: 1, boss: false },
  18: { coins: 30, enemies: 5, powerups: 1, boss: false },
  19: { coins: 28, enemies: 6, powerups: 1, boss: false },
  20: { coins: 29, enemies: 7, powerups: 1, boss: false },
  21: { coins: 34, enemies: 6, powerups: 1, boss: false },
  22: { coins: 29, enemies: 8, powerups: 1, boss: false },
  23: { coins: 31, enemies: 7, powerups: 1, boss: false },
  24: { coins: 34, enemies: 6, powerups: 1, boss: false },
  25: { coins: 12, enemies: 0, powerups: 1, boss: true },
  26: { coins: 30, enemies: 5, powerups: 1, boss: false },
  27: { coins: 12, enemies: 0, powerups: 1, boss: true },
  28: { coins: 28, enemies: 7, powerups: 1, boss: false },
  29: { coins: 12, enemies: 0, powerups: 1, boss: true },
  30: { coins: 24, enemies: 7, powerups: 1, boss: false },
  31: { coins: 12, enemies: 0, powerups: 1, boss: true },
  32: { coins: 22, enemies: 8, powerups: 1, boss: false },
  33: { coins: 12, enemies: 0, powerups: 1, boss: true },
};

/** True when `id` is a campaign level that can be ranked. */
export const isCampaignLevel = (id) =>
  Number.isInteger(id) && Object.hasOwn(CAMPAIGN_LEVELS, String(id));

/**
 * The most a level can score: COMBO_MAX times (20 per coin, the highest enemy
 * score per enemy, and in a boss arena the boss and MINION_ALLOWANCE minions),
 * plus the full-health heart bonus per power-up. 0 for a level that isn't one.
 */
export function levelScoreCeiling(id) {
  if (!isCampaignLevel(id)) return 0;
  const { coins, enemies, powerups, boss } = CAMPAIGN_LEVELS[id];
  const foes = enemies + (boss ? MINION_ALLOWANCE : 0);
  return (
    COMBO_MAX * (coins * COIN_SCORE + foes * ENEMY_MAX_SCORE + (boss ? BOSS_SCORE : 0)) +
    powerups * FULL_HEART_BONUS
  );
}

/**
 * What a finished level adds to the board: the score capped at the level's
 * ceiling (boss minions past the allowance count for nothing), or null when the
 * run can't be ranked at all.
 */
export function campaignScore({ level, score, seconds }) {
  if (!isCampaignLevel(level)) return null;
  if (!Number.isInteger(score) || score < 0) return null;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  if (seconds < MIN_LEVEL_SECONDS || seconds > MAX_LEVEL_SECONDS) return null;
  return Math.min(score, levelScoreCeiling(level));
}
