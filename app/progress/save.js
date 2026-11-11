/**
 * Everything cloud save carries, read from and written to the device's
 * storage, and the merge that combines two copies of it.
 *
 * Existing keys keep their names and shapes ("campaign", "mode_records",
 * "high_score", "daily_streak"); new ones are "wallet", "achievements",
 * "stats" and "device_id". Every read survives blocked or corrupt storage and
 * every write fails silently.
 */
import { FREE, SLOTS } from "../shop/catalog";

export const SAVE_VERSION = 1;
export const MAX_SAVE_BYTES = 102400;

const KEYS = {
  campaign: "campaign",
  records: "mode_records",
  highScore: "high_score",
  streak: "daily_streak",
  wallet: "wallet",
  achievements: "achievements",
  stats: "stats",
  device: "device_id",
  resetAt: "progress_reset_at",
};

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const isCount = (n) => Number.isFinite(n) && n >= 0;
const isString = (value) => typeof value === "string";

export function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    return null;
  }
}

/** A map of id -> number, keeping only the entries `valid` accepts. */
function numberMap(raw, valid = isCount) {
  const out = {};
  if (isObject(raw)) {
    Object.keys(raw).forEach((key) => {
      if (valid(raw[key])) out[key] = raw[key];
    });
  }
  return out;
}

const stringList = (raw) => (Array.isArray(raw) ? raw.filter(isString) : []);

// ---- Normalising: whatever was stored becomes a well-formed value ----

function normalizeCampaign(raw) {
  const empty = { reached: [1], last: 1, stars: {}, best: {} };
  if (!isObject(raw) || !Array.isArray(raw.reached)) return empty;
  // Spread like the campaign module does, so a saved campaign keeps its bytes.
  return {
    ...empty,
    ...raw,
    reached: raw.reached.filter(Number.isFinite),
    stars: numberMap(raw.stars),
    best: numberMap(raw.best),
  };
}

function normalizeRecords(raw) {
  const out = {};
  if (isObject(raw)) {
    Object.keys(raw).forEach((key) => {
      if (isObject(raw[key]) && Number.isFinite(raw[key].score)) out[key] = raw[key];
    });
  }
  return out;
}

function normalizeStreak(raw) {
  if (
    isObject(raw) &&
    isCount(raw.days) &&
    isCount(raw.best) &&
    isCount(raw.freezes) &&
    isCount(raw.last)
  ) {
    return raw;
  }
  return null;
}

export function normalizeWallet(raw) {
  const wallet = isObject(raw) ? raw : {};
  const worn = isObject(wallet.worn) ? wallet.worn : {};
  const result = {
    earned: numberMap(wallet.earned),
    rewards: numberMap(wallet.rewards),
    owned: stringList(wallet.owned),
    worn: {},
    wornAt: isCount(wallet.wornAt) ? wallet.wornAt : 0,
  };
  SLOTS.forEach((slot) => {
    result.worn[slot] = isString(worn[slot]) ? worn[slot] : FREE[slot];
  });
  return result;
}

export function normalizeStats(raw) {
  const stats = isObject(raw) ? raw : {};
  return {
    kills: numberMap(stats.kills),
    flawlessBoss: stats.flawlessBoss === true,
    secretBoss: stats.secretBoss === true,
    worldsFinished: stringList(stats.worldsFinished),
    bossRushBest: isCount(stats.bossRushBest) ? stats.bossRushBest : null,
  };
}

export function emptyProgress() {
  return {
    v: SAVE_VERSION,
    updatedAt: 0,
    resetAt: 0,
    campaign: normalizeCampaign(null),
    records: {},
    highScore: 0,
    streak: null,
    wallet: normalizeWallet(null),
    achievements: {},
    stats: normalizeStats(null),
  };
}

function normalize(raw) {
  const p = isObject(raw) ? raw : {};
  return {
    v: SAVE_VERSION,
    updatedAt: isCount(p.updatedAt) ? p.updatedAt : 0,
    resetAt: isCount(p.resetAt) ? p.resetAt : 0,
    campaign: normalizeCampaign(p.campaign),
    records: normalizeRecords(p.records),
    highScore: isCount(p.highScore) ? p.highScore : 0,
    streak: normalizeStreak(p.streak),
    wallet: normalizeWallet(p.wallet),
    achievements: numberMap(p.achievements),
    stats: normalizeStats(p.stats),
  };
}

// ---- Storage ----

/** A stored JSON value as `normalize` sees it, or the empty one if unreadable. */
function load(storage, key, normalizeValue) {
  try {
    return normalizeValue(JSON.parse(storage.getItem(key)));
  } catch (error) {
    return normalizeValue(null);
  }
}

function store(storage, key, value) {
  try {
    const text = JSON.stringify(value);
    if (storage.getItem(key) !== text) storage.setItem(key, text);
  } catch (error) {
    // Storage full or blocked: progress lasts for this session only.
  }
}

/**
 * One normalised value kept under a storage key. If storage can't be read or
 * written, the last value written stays in memory for the session.
 */
export function createKeyStore(storage, key, normalizeValue) {
  let memory = null;
  return {
    read() {
      if (storage) {
        try {
          return normalizeValue(JSON.parse(storage.getItem(key)));
        } catch (error) {
          // fall through to memory
        }
      }
      return normalizeValue(memory);
    },
    write(value) {
      memory = value;
      if (storage) store(storage, key, value);
    },
  };
}

export function readLocal(storage = defaultStorage()) {
  if (!storage) return emptyProgress();
  const identity = (value) => value;
  return normalize({
    campaign: load(storage, KEYS.campaign, identity),
    records: load(storage, KEYS.records, identity),
    highScore: load(storage, KEYS.highScore, identity),
    streak: load(storage, KEYS.streak, identity),
    wallet: load(storage, KEYS.wallet, identity),
    achievements: load(storage, KEYS.achievements, identity),
    stats: load(storage, KEYS.stats, identity),
    resetAt: load(storage, KEYS.resetAt, identity),
  });
}

export function writeLocal(progress, storage = defaultStorage()) {
  if (!storage) return;
  const p = normalize(progress);
  store(storage, KEYS.campaign, p.campaign);
  store(storage, KEYS.records, p.records);
  store(storage, KEYS.highScore, p.highScore);
  if (p.streak) store(storage, KEYS.streak, p.streak);
  else if (p.resetAt > 0) {
    // A reset save has no streak: the device's old one must not outlive it.
    try {
      storage.removeItem(KEYS.streak);
    } catch (error) {
      // blocked storage: nothing to erase
    }
  }
  store(storage, KEYS.wallet, p.wallet);
  store(storage, KEYS.achievements, p.achievements);
  store(storage, KEYS.stats, p.stats);
  store(storage, KEYS.resetAt, p.resetAt);
}

/** Erases every key cloud save carries, keeps device_id, and stamps resetAt = now. Returns the empty Progress. */
export function resetLocal(storage = defaultStorage(), now = Date.now()) {
  const empty = { ...emptyProgress(), resetAt: now };
  if (!storage) return empty;
  writeLocal(empty, storage);
  return readLocal(storage);
}

/** Used only when storage can't hold the ID, so the session still has one. */
let memoryDevice = null;

const randomId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** This device's random ID, made once and kept in "device_id". */
export function deviceId(storage = defaultStorage()) {
  try {
    const saved = storage.getItem(KEYS.device);
    if (isString(saved) && saved) return saved;
    const id = randomId();
    storage.setItem(KEYS.device, id);
    return id;
  } catch (error) {
    // Blocked or full storage: this session's ID lives in memory.
    if (!memoryDevice) memoryDevice = randomId();
    return memoryDevice;
  }
}

// ---- Merging ----

/** Combine two id -> number maps, `pick` choosing the number when both have an id. */
function mergeNumbers(a, b, pick) {
  const out = { ...a };
  Object.keys(b).forEach((key) => {
    out[key] = key in a ? pick(a[key], b[key]) : b[key];
  });
  return out;
}

const union = (a, b) => [...new Set([...a, ...b])];
const sortedUnion = (a, b) => union(a, b).sort((x, y) => x - y);
const sortedStrings = (a, b) => union(a, b).sort();

/** A total order on JSON values, to break ties the same way in either direction. */
const cmp = (a, b) => {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

function mergeCampaign(a, b) {
  return {
    reached: sortedUnion(a.reached, b.reached),
    last: Math.max(a.last, b.last),
    stars: mergeNumbers(a.stars, b.stars, (x, y) => x | y),
    best: mergeNumbers(a.best, b.best, Math.min),
  };
}

function mergeRecords(a, b) {
  const out = { ...a };
  Object.keys(b).forEach((key) => {
    if (!(key in a)) out[key] = b[key];
    else if (b[key].score > a[key].score) out[key] = b[key];
    else if (b[key].score === a[key].score && cmp(b[key], a[key]) < 0) out[key] = b[key];
  });
  return out;
}

/** The streak with the later day wins; on the same day, the longer one. */
function mergeStreak(a, b) {
  if (!a || !b) return a || b;
  const order = a.last - b.last || a.days - b.days || a.best - b.best || a.freezes - b.freezes;
  if (order) return order > 0 ? a : b;
  return cmp(a, b) <= 0 ? a : b;
}

function mergeWallet(a, b) {
  const newer = a.wornAt > b.wornAt || (a.wornAt === b.wornAt && cmp(a.worn, b.worn) <= 0) ? a : b;
  return {
    earned: mergeNumbers(a.earned, b.earned, Math.max),
    rewards: mergeNumbers(a.rewards, b.rewards, Math.max),
    owned: sortedStrings(a.owned, b.owned),
    worn: { ...newer.worn },
    wornAt: Math.max(a.wornAt, b.wornAt),
  };
}

function mergeStats(a, b) {
  const bests = [a.bossRushBest, b.bossRushBest].filter((n) => n !== null);
  return {
    kills: mergeNumbers(a.kills, b.kills, Math.max),
    flawlessBoss: a.flawlessBoss || b.flawlessBoss,
    secretBoss: a.secretBoss || b.secretBoss,
    worldsFinished: sortedStrings(a.worldsFinished, b.worldsFinished),
    bossRushBest: bests.length ? Math.min(...bests) : null,
  };
}

/** Merged, never overwritten: see spec section 1. Order of arguments never matters. */
export function mergeProgress(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  // The later reset wins outright: what the other side holds predates it.
  if (x.resetAt !== y.resetAt) {
    const winner = x.resetAt > y.resetAt ? x : y;
    return { ...winner, updatedAt: Math.max(x.updatedAt, y.updatedAt) };
  }
  return {
    v: SAVE_VERSION,
    updatedAt: Math.max(x.updatedAt, y.updatedAt),
    resetAt: x.resetAt,
    campaign: mergeCampaign(x.campaign, y.campaign),
    records: mergeRecords(x.records, y.records),
    highScore: Math.max(x.highScore, y.highScore),
    streak: mergeStreak(x.streak, y.streak),
    wallet: mergeWallet(x.wallet, y.wallet),
    achievements: mergeNumbers(x.achievements, y.achievements, Math.min),
    stats: mergeStats(x.stats, y.stats),
  };
}

export function saveBytes(progress) {
  return new TextEncoder().encode(JSON.stringify(progress)).length;
}
