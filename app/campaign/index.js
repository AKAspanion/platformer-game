/**
 * Campaign progress: which levels are unlocked, where to continue, and stars.
 *
 * A level unlocks only when the player has walked into it during a story run
 * (through a portal, or by starting it from the level select once unlocked).
 * Grassland 1 is always open.
 *
 * Stars (3 per level, each kept once earned):
 *   COINS   every coin in the level
 *   ENEMIES every enemy in the level (the boss, in a boss level)
 *   TIME    finished under the level's target time
 * A level is finished by leaving it forward (its right-hand exit).
 */
import { BOSSES } from "../game/boss";

export const STAR = { COINS: 1, ENEMIES: 2, TIME: 4 };
export const STAR_LIST = [
  ["COINS", STAR.COINS],
  ["ENEMIES", STAR.ENEMIES],
  ["TIME", STAR.TIME],
];

const KEY = "campaign";
const FIRST = 1;

const empty = () => ({ reached: [FIRST], last: FIRST, stars: {}, best: {} });

export const starCount = (mask = 0) =>
  (mask & STAR.COINS ? 1 : 0) + (mask & STAR.ENEMIES ? 1 : 0) + (mask & STAR.TIME ? 1 : 0);

/** Target time in seconds: room to fight and grab coins, but no dawdling. */
export const targetTime = (area) => {
  if (area.boss) return 50 + Math.round(((BOSSES[area.boss.kind] || {}).hp || 14) * 2.5);
  const enemies = area.enemies.length;
  const coins = area.coins.length;
  return Math.round(20 + enemies * 2 + coins * 0.4);
};

/**
 * Stars earned on finishing `area`, from the run's collected/killed id lists
 * ("id1,id2,") and the seconds spent in the level.
 */
export function starsFor(area, { collectedCoins = "", killedEnemies = "", seconds = Infinity }) {
  const got = new Set(collectedCoins.split(","));
  const killed = new Set(killedEnemies.split(","));
  let mask = 0;
  if (area.coins.every((c) => got.has(c.id))) mask |= STAR.COINS;
  const foes = [...area.enemies.map((e) => e.id), ...(area.boss ? [area.boss.id] : [])];
  if (foes.every((id) => killed.has(id))) mask |= STAR.ENEMIES;
  if (seconds <= targetTime(area)) mask |= STAR.TIME;
  return mask;
}

export function createCampaign(storage = globalThis.localStorage) {
  const read = () => {
    try {
      const saved = JSON.parse(storage.getItem(KEY));
      return saved && Array.isArray(saved.reached) ? { ...empty(), ...saved } : empty();
    } catch (error) {
      return empty();
    }
  };
  const write = (data) => {
    try {
      storage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      // storage blocked: progress lasts for this session only
    }
  };
  let state = read();

  return {
    get last() {
      return state.last;
    },
    isUnlocked(id) {
      return id === FIRST || state.reached.includes(id);
    },
    /** The player walked into `id` during a story run. */
    reach(id) {
      if (!state.reached.includes(id)) state.reached.push(id);
      state.last = id;
      write(state);
    },
    stars(id) {
      return state.stars[id] || 0;
    },
    bestTime(id) {
      return state.best[id] ?? null;
    },
    /** Record a finished level. Returns { mask, added } (added = newly earned). */
    finish(id, mask, seconds) {
      const before = state.stars[id] || 0;
      state.stars[id] = before | mask;
      if (state.best[id] == null || seconds < state.best[id]) {
        state.best[id] = Math.round(seconds * 10) / 10;
      }
      write(state);
      return { mask: state.stars[id], added: mask & ~before };
    },
    totalStars(ids) {
      return ids.reduce((sum, id) => sum + starCount(state.stars[id]), 0);
    },
    reset() {
      state = empty();
      write(state);
    },
    /** Testing helper (?debug): open every level. */
    unlockAll(ids) {
      ids.forEach((id) => !state.reached.includes(id) && state.reached.push(id));
      write(state);
    },
  };
}
