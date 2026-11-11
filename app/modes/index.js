import areas from "../areas";
import { FINISH, generateEndlessLevel, generateSequence } from "../pcg/generator";
import { buildWorld } from "../gen";
import { LEVELS_PER_WORLD } from "../worlds/spec";
import { DAILY_LEVELS, dailyLevels } from "../daily/rules";
import { dailyEggId, dailyEggLevel } from "../rewards/eggs";
import { eggSpot } from "../rewards/egg-spot";

/**
 * Game modes built on the level generator:
 *  - daily:   5 levels from today's date, the same for everyone that day
 *  - endless: generated forever, one level ahead, getting harder
 *  - custom:  a world the player created from a prompt (see app/creator)
 * Generated areas are added to the shared `areas` map under their own id
 * ranges, so the normal engine plays them like any other area.
 */
export { DAILY_LEVELS };
export { FINISH }; // portal destination for "this run is complete"

const RANGES = { endless: 2000, daily: 3000, custom: 4000 };

const clearRange = (base) => {
  Object.keys(areas)
    .map(Number)
    .filter((id) => id >= base && id < base + 1000)
    .forEach((id) => delete areas[id]);
};

const register = (list) => list.forEach((data) => (areas[data.id] = data));

/** A number for the day, e.g. 20261111. Uses the local date. */
export const dailySeed = (date = new Date()) =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

const START = { left: 24, top: 9 * 16 - 20 };

export function createDailySession(date = new Date()) {
  const seed = dailySeed(date);
  clearRange(RANGES.daily);
  const levels = generateSequence({ idBase: RANGES.daily, seed, levels: dailyLevels(seed) });
  // one of the day's levels holds the day's egg (the world skips it once it was found)
  const holder = levels[dailyEggLevel(seed)];
  const spot = holder && eggSpot(holder, seed);
  if (spot) holder.egg = { id: dailyEggId(seed), ...spot };
  register(levels);
  return {
    kind: "daily",
    key: String(seed),
    startId: RANGES.daily,
    ...START,
    label: (id) => `Daily ${id - RANGES.daily + 1}/${DAILY_LEVELS}`,
    ensure: () => {},
  };
}

export function createEndlessSession(seed = Math.floor(Math.random() * 1e9)) {
  clearRange(RANGES.endless);
  const exits = {};
  const make = (index) => {
    const id = RANGES.endless + index;
    if (areas[id]) return;
    if (index > 0) make(index - 1);
    const { data, exit } = generateEndlessLevel({
      id,
      seed: seed + index * 7919,
      index,
      prevExit: exits[index - 1] || 9,
    });
    exits[index] = exit;
    areas[id] = data;
  };
  make(0);
  make(1); // one level ahead, so walking right never waits
  return {
    kind: "endless",
    key: String(seed),
    startId: RANGES.endless,
    ...START,
    label: (id) => `Endless ${id - RANGES.endless + 1}`,
    level: (id) => id - RANGES.endless + 1,
    // called before entering an area: keep one generated level ahead
    ensure: (id) => {
      const index = id - RANGES.endless;
      if (index >= 0 && index < 999) make(index + 1);
    },
  };
}

/**
 * A created world: 5 levels and a boss arena, with its own generated art,
 * creatures, boss, music and sounds (app/gen). `world` is a world record
 * { id, name, spec, seed }. `options.audio` is passed to buildWorld.
 */
export function createCustomSession(world, options = {}) {
  clearRange(RANGES.custom);
  const assets = buildWorld(world, options);
  const levels = generateSequence({
    idBase: RANGES.custom,
    seed: assets.seed,
    levels: assets.levels,
  });
  levels.forEach((data) => (data.skin = assets.key));
  register(levels);
  return {
    kind: "custom",
    key: world.id,
    world,
    startId: RANGES.custom,
    ...START,
    label: (id) => {
      const n = id - RANGES.custom + 1;
      return n === LEVELS_PER_WORLD
        ? `${world.name} · Boss`
        : `${world.name} ${n}/${LEVELS_PER_WORLD}`;
    },
    ensure: () => {},
  };
}

/** Best scores per mode, kept on this device. */
export const records = {
  read() {
    try {
      return JSON.parse(localStorage.getItem("mode_records")) || {};
    } catch (error) {
      return {};
    }
  },
  /** Saves `score` for kind/key if it beats the old one; returns the best. */
  submit(kind, key, score, extra = {}) {
    const all = this.read();
    const id = `${kind}:${key}`;
    const old = all[id];
    if (!old || score > old.score) all[id] = { score, ...extra };
    if (kind === "endless") {
      const best = all["endless:best"];
      if (!best || score > best.score) all["endless:best"] = { score, ...extra };
    }
    try {
      localStorage.setItem("mode_records", JSON.stringify(all));
    } catch (error) {
      // storage full or blocked: the record just isn't kept
    }
    return all[id];
  },
  best(kind, key) {
    return this.read()[`${kind}:${key}`] || null;
  },
};
