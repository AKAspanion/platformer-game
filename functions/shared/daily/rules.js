// GENERATED from app/daily/rules.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * The daily challenge's rules, shared by the game and the server: the game
 * generates the day's levels from the seed, and the submitDaily function uses
 * the same code to decide which days are open and what score is possible.
 *
 * Pure: loads in Node and the browser (no window, document or localStorage).
 * Copied to functions/shared/ by scripts/sync-functions-shared.js.
 */
import { generateSequence, themeFor } from "../pcg/generator.js";

export const DAILY_LEVELS = 5;
export const MIN_SECONDS = 30;
export const MAX_SECONDS = 7200;
export const COIN_SCORE = 20;
/** The most one enemy gives: the beetle's `score` in app/game/enemies.js (tests keep them equal). */
export const ENEMY_MAX_SCORE = 200;
/** A heart picked up at full health gives this bonus (app/game/world.js): the most a power-up gives. */
export const FULL_HEART_BONUS = 100;
/** Area ids the ceiling's levels are generated under; any base gives the same counts. */
const CEILING_ID_BASE = 3000;
const DAY_MS = 86400000;

/** The level configs a daily run is generated from. */
export function dailyLevels(seed) {
  return Array.from({ length: DAILY_LEVELS }, (_, i) => ({
    theme: themeFor((seed + i * 3) % 9),
    difficulty: 1 + i,
    powerupCount: i === 0 ? 1 : 2,
  }));
}

/**
 * The highest score the seed's levels can give: 20 per coin plus the highest
 * enemy score per enemy, plus the full-health heart bonus per power-up (a
 * player may bank it). The daily levels have no boss arena.
 */
export function dailyScoreCeiling(seed) {
  const areas = generateSequence({ idBase: CEILING_ID_BASE, seed, levels: dailyLevels(seed) });
  return areas.reduce(
    (sum, area) =>
      sum +
      area.coins.length * COIN_SCORE +
      area.enemies.length * ENEMY_MAX_SCORE +
      (area.powerups || []).length * FULL_HEART_BONUS,
    0,
  );
}

/** A seed (YYYYMMDD) as a UTC date, or null when it isn't a real date. */
export function seedToDate(seed) {
  if (!Number.isInteger(seed)) return null;
  const year = Math.floor(seed / 10000);
  const month = Math.floor(seed / 100) % 100;
  const day = seed % 100;
  if (year < 1970 || year > 9999) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? date : null;
}

const seedOf = (date) =>
  date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();

/** Whole days from seed a to seed b (b later gives a positive number); NaN if either isn't a date. */
export function daysBetween(a, b) {
  const from = seedToDate(a);
  const to = seedToDate(b);
  if (!from || !to) return NaN;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** True when the seed is yesterday, today or tomorrow by UTC date at `now`, so every time zone's local day is open. */
export function seedIsOpen(seed, now = Date.now()) {
  if (!seedToDate(seed)) return false;
  const today = seedOf(new Date(now));
  return Math.abs(daysBetween(today, seed)) <= 1;
}

const ADJECTIVES = [
  "Swift",
  "Brave",
  "Clever",
  "Mighty",
  "Sneaky",
  "Jolly",
  "Fierce",
  "Lucky",
  "Mellow",
  "Nimble",
  "Plucky",
  "Rowdy",
  "Sunny",
  "Wild",
  "Zesty",
  "Bold",
];
const ANIMALS = [
  "Raptor",
  "Stego",
  "Trike",
  "Ptero",
  "Dino",
  "Rex",
  "Croc",
  "Lizard",
  "Gecko",
  "Newt",
  "Drake",
  "Wyvern",
  "Turtle",
  "Mammoth",
  "Sabre",
  "Dodo",
];

/** "Swift Raptor 42": the same uid always gives the same name, at most 20 characters. */
export function generatedName(uid) {
  let hash = 2166136261; // FNV-1a
  for (const char of String(uid)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const adjective = ADJECTIVES[hash % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(hash / 16) % ANIMALS.length];
  const number = Math.floor(hash / 256) % 100;
  return `${adjective} ${animal} ${number}`.slice(0, 20);
}
