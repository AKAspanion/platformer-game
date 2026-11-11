/** What the campaign's stars and boss times unlock. */
import { LEVELS } from "../util/index";
import { starCount } from "../campaign/index";

/** Stars (of the campaign's 90) that open the secret world, Starfall Peaks. */
export const SECRET_STARS = 75;

export function campaignStars(campaign, levels = LEVELS) {
  const stars = (campaign && campaign.stars) || {};
  return levels.reduce((sum, level) => sum + starCount(stars[level.id]), 0);
}

export const secretWorldOpen = (campaign, levels = LEVELS) =>
  campaignStars(campaign, levels) >= SECRET_STARS;

/** Boss levels the player has finished: a boss counts once its level has a best time. */
export function bossesBeaten(campaign, levels = LEVELS) {
  const best = (campaign && campaign.best) || {};
  return levels.filter((level) => level.boss && best[level.id] != null).length;
}

export function bossRushOpen(campaign, levels = LEVELS) {
  const bosses = levels.filter((level) => level.boss).length;
  return bosses > 0 && bossesBeaten(campaign, levels) === bosses;
}
