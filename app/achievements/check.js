/** Which achievements a Progress has earned, and how far along the counters are. */
import { ACHIEVEMENTS } from "./catalog";
import { STAR } from "../campaign/index";
import { LEVELS } from "../util/index";
import { campaignStars } from "../progress/unlocks";
import { CATALOG, FREE } from "../shop/catalog";

const COINS_NEEDED = 1000;
const KILLS_NEEDED = 500;
const STREAK_NEEDED = 7;
const WORLDS_NEEDED = 3;
const STARS_SEEKER = 75;

const sum = (map) => Object.keys(map).reduce((total, key) => total + map[key], 0);

const coinsEarned = (p) => sum(p.wallet.earned);
const kills = (p) => sum(p.stats.kills);
const streakBest = (p) => (p.streak ? p.streak.best : 0);
const worlds = (p) => p.stats.worldsFinished.length;

/** Items bought: owned ids that aren't the free item of their slot. */
const bought = (p) =>
  p.wallet.owned.filter((owned) => {
    const [slot, ...rest] = owned.split(":");
    const id = rest.join(":");
    return (
      Object.hasOwn(CATALOG, slot) &&
      CATALOG[slot].some((item) => item.id === id) &&
      FREE[slot] !== id
    );
  }).length;

function speedy(p, levels) {
  const stars = p.campaign.stars;
  const names = [...new Set(levels.map((level) => level.world))];
  return names.some((world) =>
    levels
      .filter((level) => level.world === world)
      .every((level) => ((stars[level.id] || 0) & STAR.TIME) !== 0),
  );
}

const RULES = {
  "first-steps": (p) => p.campaign.best[1] != null,
  "coin-collector": (p) => coinsEarned(p) >= COINS_NEEDED,
  "big-spender": (p) => bought(p) >= 1,
  exterminator: (p) => kills(p) >= KILLS_NEEDED,
  untouchable: (p) => p.stats.flawlessBoss,
  speedy: (p, levels) => speedy(p, levels),
  "daily-habit": (p) => streakBest(p) >= STREAK_NEEDED,
  "star-seeker": (p, levels) => campaignStars(p.campaign, levels) >= STARS_SEEKER,
  completionist: (p, levels) => campaignStars(p.campaign, levels) >= levels.length * 3,
  "peak-performer": (p) => p.stats.secretBoss,
  "rush-hour": (p) => p.stats.bossRushBest !== null,
  "world-traveller": (p) => worlds(p) >= WORLDS_NEEDED,
};

/** Ids whose condition holds in this Progress and that aren't unlocked yet. */
export function newlyEarned(progress, levels = LEVELS) {
  return ACHIEVEMENTS.filter(
    ({ id }) => !Object.hasOwn(progress.achievements, id) && RULES[id](progress, levels),
  ).map(({ id }) => id);
}

const COUNTERS = {
  "coin-collector": [coinsEarned, COINS_NEEDED],
  exterminator: [kills, KILLS_NEEDED],
  "daily-habit": [streakBest, STREAK_NEEDED],
  "world-traveller": [worlds, WORLDS_NEEDED],
};

/** For counters: progress toward an achievement, or null when it has no number. */
export function progressToward(id, progress, levels = LEVELS) {
  if (id === "star-seeker" || id === "completionist") {
    const need = id === "star-seeker" ? STARS_SEEKER : levels.length * 3;
    return { have: Math.min(need, campaignStars(progress.campaign, levels)), need };
  }
  if (!Object.hasOwn(COUNTERS, id)) return null;
  const [count, need] = COUNTERS[id];
  return { have: Math.min(need, count(progress)), need };
}
