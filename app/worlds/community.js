/**
 * The rules of the community: how worlds trend, which one is the world of the
 * week, how counts and links read. Pure: it loads in Node (the functions get
 * a synced copy in functions/shared/worlds/) and in the browser, and touches
 * no browser globals.
 */

/** Each play counts half as much for every 3 days that pass. */
export const HALF_LIFE_DAYS = 3;
/** Trending shows the top 30. */
export const TRENDING_LIMIT = 30;
/** The world of the week is picked from the last 14 days... */
export const FEATURE_WINDOW_DAYS = 14;
/** ...among worlds with at least this many plays in them. */
export const FEATURE_MIN_PLAYS = 20;
/** The largest thumbnail the server stores. */
export const MAX_THUMB_BYTES = 102400;
export const THUMB_SIZE = { width: 480, height: 270 };
/** Plays + finishes one account may record per hour. */
export const PLAY_LIMIT = 120;
/** Likes + unlikes one account may make per hour. */
export const LIKE_LIMIT = 60;

const DAY_MS = 86400000;
const ORIGIN = "https://dino.spanion.in";
const WORLD_ID = /^[A-Za-z0-9_-]{4,48}$/;
/** The secret world's id: repeated from app/modes/secret.js, which imports browser code. */
const STARFALL_ID = "starfall-peaks";

/** "20261111" for a UTC day. */
export function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * The trending score after one more play at `now`: log2 of the sum of
 * 2^(t/halfLife) over the plays (t in days), kept in the log domain so it
 * never overflows and can be stored and ordered. `score` is null for a world
 * with no plays yet.
 */
export function trendAfterPlay(score, now) {
  const own = now / DAY_MS / HALF_LIFE_DAYS;
  if (score === null || score === undefined || !Number.isFinite(score)) return own;
  const high = Math.max(score, own);
  const low = Math.min(score, own);
  return high + Math.log2(1 + 2 ** (low - high));
}

/**
 * The world of the week, or null. `candidates`: { id, createdAt, plays14,
 * likes14 }[]; `lastWeek`: the id featured last week (never picked twice in a
 * row). Most likes per play wins; then more plays; then the newer world.
 */
export function pickFeatured(candidates, lastWeek) {
  let best = null;
  for (const c of candidates || []) {
    if (!c || c.id === lastWeek || !(c.plays14 >= FEATURE_MIN_PLAYS)) continue;
    if (!best || beats(c, best)) best = c;
  }
  return best ? best.id : null;
}

function beats(a, b) {
  // likes/plays compared by cross-multiplying, so equal ratios tie exactly
  const ratio = a.likes14 * b.plays14 - b.likes14 * a.plays14;
  if (ratio !== 0) return ratio > 0;
  if (a.plays14 !== b.plays14) return a.plays14 > b.plays14;
  return a.createdAt > b.createdAt;
}

/** "999", "1k", "1.2k", "12.3k". */
export function formatCount(n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count < 1000) return String(count);
  const tenths = Math.floor(count / 100) / 10;
  return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}k`;
}

/** "120 plays · 37 beat the boss · 15 ❤ this week" */
export function weekNote(week) {
  const { plays = 0, finishes = 0, likes = 0 } = week || {};
  return `${plays} plays · ${finishes} beat the boss · ${likes} ❤ this week`;
}

/** The Dino Team's own worlds ("starter-*" and Starfall Peaks) have no counts, likes or link. */
export function isBuiltIn(worldId) {
  const id = String(worldId || "");
  return id.startsWith("starter-") || id === STARFALL_ID;
}

export function worldLink(worldId) {
  return `${ORIGIN}/w/${worldId}`;
}

/** The world id in a path like "/w/<id>" or a "?world=<id>" query, or null. */
export function linkedWorldId(location) {
  const { pathname = "", search = "" } = location || {};
  const inPath = /^\/w\/([^/]*)\/?$/.exec(pathname);
  const candidate = inPath ? inPath[1] : new URLSearchParams(search).get("world");
  return candidate && WORLD_ID.test(candidate) ? candidate : null;
}
