/**
 * Eggs and the nest. An egg is found once (in a story level, a daily
 * challenge or a weekly chest), sits in the nest for 24 hours by the device's
 * clock, then hatches into one of 8 companions: 6 common and 2 rare. A
 * companion already owned pays coins instead. The nest lives in storage key
 * "nest" (shape: normalizeNest in app/progress/save.js).
 */
import { createKeyStore, defaultStorage, normalizeNest } from "../progress/save.js";
import { COMMON_COMPANIONS, RARE_COMPANIONS } from "../shop/catalog.js";
import { mulberry32 } from "../pcg/generator.js";

export const HATCH_MS = 86400000; // 24 hours
export const RARE_CHANCE = 0.1;
export const DUPLICATE_COINS = 100;

const HOUR_MS = 3600000;

export const storyEggId = (areaId) => `s${areaId}`;
export const dailyEggId = (seed) => `d${seed}`;
export const chestEggId = (weekDay) => `c${weekDay}`;
/** The wallet reward id a duplicate's coins are paid under (paid once per egg). */
export const duplicateRewardId = (eggId) => `e${eggId}`;

/** A 32-bit hash of a string (FNV-1a), the seed for the egg's own dice. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Which of a daily challenge's five levels holds the egg: 0..4, the same for everyone. */
export function dailyEggLevel(seed) {
  return Math.floor(mulberry32((Number(seed) >>> 0) ^ 0x9e3779b9)() * 5);
}

/** What an egg hatches into. Deterministic from the egg: 10% a rare, else a common. */
export function companionFor(egg) {
  const rng = mulberry32(hash(`${egg.id}:${egg.foundAt}`));
  const pool = rng() < RARE_CHANCE ? RARE_COMPANIONS : COMMON_COMPANIONS;
  return pool[Math.floor(rng() * pool.length)];
}

/** How long an egg has been in the nest; a clock set back before the find counts as no time. */
const age = (egg, now) => Math.max(0, now - egg.foundAt);

/** "Hatches in 5h" (rounded up to the hour) or "Ready!". */
export function hatchLabel(egg, now) {
  const left = HATCH_MS - age(egg, now);
  return left <= 0 ? "Ready!" : `Hatches in ${Math.ceil(left / HOUR_MS)}h`;
}

export function createNest(storage = defaultStorage(), now = Date.now) {
  const keep = createKeyStore(storage, "nest", normalizeNest);
  const isDue = (egg) => age(egg, now()) >= HATCH_MS;
  const byAge = (a, b) => a.foundAt - b.foundAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  return {
    /** Found before, hatched or not. */
    has(id) {
      const nest = keep.read();
      return nest.found.includes(id) || nest.hatched.includes(id);
    },
    /** Puts a newly found egg in the nest; false when it was found before. */
    find(id, source) {
      const nest = keep.read();
      if (typeof id !== "string" || !id || nest.found.includes(id) || nest.hatched.includes(id)) {
        return false;
      }
      const egg = { id, source, foundAt: now() };
      const next = normalizeNest({
        eggs: [...nest.eggs, egg],
        found: [...nest.found, id],
        hatched: nest.hatched,
      });
      if (!next.eggs.some((e) => e.id === id)) return false; // an unknown source
      keep.write(next);
      return true;
    },
    /** The unhatched eggs, oldest first. */
    list() {
      return keep
        .read()
        .eggs.slice()
        .sort(byAge)
        .map((egg) => ({ ...egg, ready: isDue(egg) }));
    },
    /** The unhatched eggs at least 24 hours old. */
    due() {
      return this.list()
        .filter((egg) => egg.ready)
        .map(({ id, source, foundAt }) => ({ id, source, foundAt }));
    },
    /**
     * Hatches a due egg: grants its companion, or pays the duplicate's coins
     * once. Null when the egg isn't there, isn't due or already hatched.
     */
    hatch(id, wallet) {
      const nest = keep.read();
      const egg = nest.eggs.find((e) => e.id === id);
      if (!egg || !isDue(egg)) return null;
      const companion = companionFor(egg);
      const duplicate = wallet.owns("companion", companion);
      if (duplicate) wallet.reward(duplicateRewardId(id), DUPLICATE_COINS);
      else wallet.grant("companion", companion);
      keep.write({
        eggs: nest.eggs.filter((e) => e.id !== id),
        found: nest.found,
        hatched: [...nest.hatched, id],
      });
      return { companion, duplicate };
    },
  };
}
