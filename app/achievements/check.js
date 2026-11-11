/** Which achievements a Progress has earned, and how far along the counters are. */
import { ACHIEVEMENTS } from "./catalog";
import { STAR } from "../campaign/index";
import { LEVELS } from "../util/index";
import { bossesBeaten, campaignStars } from "../progress/unlocks";
import { CATALOG, COMPANION_IDS, FREE, isHatchOnly } from "../shop/catalog";

const COINS_NEEDED = 1000;
const KILLS_NEEDED = 500;
const STREAK_NEEDED = 7;
const WORLDS_NEEDED = 3;
const STARS_SEEKER = 75;
const BOSSES_NEEDED = 5;
const COMBO_KING = 20;
const COMBO_UNBROKEN = 50;
const BURNED_NEEDED = 100;
const EGGS_NEEDED = 10;
const QUESTS_NEEDED = 25;
const CHESTS_NEEDED = 4;
const DEEPEST_NEEDED = 25;
const DEVOTED_NEEDED = 30;

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
      FREE[slot] !== id &&
      !isHatchOnly(slot, id)
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

const burned = (p) => sum(p.stats.burned);
const companions = (p) =>
  COMPANION_IDS.filter((id) => p.wallet.owned.includes(`companion:${id}`)).length;
const rewardsMatching = (p, pattern) =>
  Object.keys(p.wallet.rewards).filter((id) => pattern.test(id)).length;
const questsDone = (p) => rewardsMatching(p, /^q\d+[abc]$/);
const chestsOpened = (p) => rewardsMatching(p, /^c\d+$/);
const levelsFinished = (p, levels) =>
  levels.filter((level) => p.campaign.best[level.id] != null).length;
const grandTour = (p, levels) => levelsFinished(p, levels) + (p.stats.secretBoss ? 1 : 0);

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
  "world-conqueror": (p, levels) => bossesBeaten(p.campaign, levels) >= BOSSES_NEEDED,
  "grand-tour": (p, levels) => grandTour(p, levels) >= levels.length + 1,
  "combo-king": (p) => p.stats.bestCombo >= COMBO_KING,
  unbroken: (p) => p.stats.bestCombo >= COMBO_UNBROKEN,
  "shield-breaker": (p) => p.stats.shieldlessBoss,
  sharpshooter: (p) => burned(p) >= BURNED_NEEDED,
  "egg-hunter": (p) => p.nest.found.length >= EGGS_NEEDED,
  "full-nest": (p) => companions(p) >= COMPANION_IDS.length,
  questing: (p) => questsDone(p) >= QUESTS_NEEDED,
  "treasure-hunter": (p) => chestsOpened(p) >= CHESTS_NEEDED,
  "deep-diver": (p) => p.stats.endlessDeepest >= DEEPEST_NEEDED,
  devoted: (p) => streakBest(p) >= DEVOTED_NEEDED,
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
  unbroken: [(p) => p.stats.bestCombo, COMBO_UNBROKEN],
  sharpshooter: [burned, BURNED_NEEDED, "projectiles"],
  "egg-hunter": [(p) => p.nest.found.length, EGGS_NEEDED, "eggs"],
  "full-nest": [companions, COMPANION_IDS.length, "companions"],
  questing: [questsDone, QUESTS_NEEDED, "quests"],
  "treasure-hunter": [chestsOpened, CHESTS_NEEDED, "chests"],
  "deep-diver": [(p) => p.stats.endlessDeepest, DEEPEST_NEEDED, "levels"],
  devoted: [streakBest, DEVOTED_NEEDED, "days"],
};

/** For counters: progress toward an achievement, or null when it has no number. */
export function progressToward(id, progress, levels = LEVELS) {
  if (id === "star-seeker" || id === "completionist") {
    const need = id === "star-seeker" ? STARS_SEEKER : levels.length * 3;
    return { have: Math.min(need, campaignStars(progress.campaign, levels)), need };
  }
  if (id === "world-conqueror") {
    const have = bossesBeaten(progress.campaign, levels);
    return { have: Math.min(BOSSES_NEEDED, have), need: BOSSES_NEEDED, unit: "bosses" };
  }
  if (id === "grand-tour") {
    const need = levels.length + 1;
    return { have: Math.min(need, grandTour(progress, levels)), need, unit: "levels" };
  }
  if (!Object.hasOwn(COUNTERS, id)) return null;
  const [count, need, unit] = COUNTERS[id];
  const have = Math.min(need, count(progress));
  return unit ? { have, need, unit } : { have, need };
}
