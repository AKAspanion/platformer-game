/**
 * Daily quests and the weekly chest.
 *
 * Each local day has three quests (one easy, one medium, one hard), one of them
 * a mode quest for the unlocked mode played least in the last 7 days. Each
 * finished quest gives the chest a key; 12 keys in a Monday-to-Sunday week open it.
 * State lives under the storage key "quests" (see `normalizeQuests`).
 */
import { ENEMY_TYPES, mulberry32 } from "../pcg/generator.js";
import { LEVELS, WORLDS } from "../util/index.js";
import { bossRushOpen } from "../progress/unlocks.js";
import { normalizeQuests, createKeyStore } from "../progress/save.js";
import { chestEggId } from "./eggs.js";

export const QUEST_COINS = [50, 75, 100];
export const CHEST_KEYS = 12;
export const CHEST_COINS = 500;
export const MODES = ["story", "daily", "endless", "community", "bossrush"];

const DAY_MS = 86400000;
const PLAYED_DAYS = 7;
const KEY = "quests";

const PLURALS = {
  pig: "pigs",
  slime: "slimes",
  chameleon: "chameleons",
  beetle: "beetles",
  bat: "bats",
  spitter: "spitter plants",
};

/** Days since 1970-01-01 of the local calendar date. */
export function localDay(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** The day number of that week's Monday (day 0, 1970-01-01, was a Thursday). */
export function weekStart(day) {
  return day - ((((day + 3) % 7) + 7) % 7);
}

export const questRewardId = (day, index) => `q${day}${"abc"[index]}`;
export const chestRewardId = (weekDay) => `c${weekDay}`;

/** Enemy types of the worlds the player has reached. */
export function metEnemies(campaign) {
  const reached = (campaign && Array.isArray(campaign.reached) && campaign.reached) || [1];
  const worlds = new Set();
  reached.forEach((id) => {
    const level = LEVELS.find((l) => l.id === id);
    const world = level ? WORLDS.indexOf(level.world) + 1 : 0;
    if (world > 0) worlds.add(world);
  });
  const types = [];
  [...worlds]
    .sort((a, b) => a - b)
    .forEach((world) => {
      (ENEMY_TYPES[world] || []).forEach((t) => {
        if (!types.includes(t)) types.push(t);
      });
    });
  return types;
}

export function unlockedModes(campaign) {
  const modes = ["story", "daily", "endless", "community"];
  if (bossRushOpen(campaign)) modes.push("bossrush");
  return modes;
}

const DEFAULT_CONTEXT = () => ({
  unlocked: ["story", "daily", "endless", "community"],
  metEnemies: ["pig", "chameleon", "beetle", "bat"],
});

const plural = (n, one, many) => (n === 1 ? one : many);

// General quests: [targets per tier, text, stat]. Defined by id, in a fixed order.
const GENERAL = {
  "defeat-type": {
    stat: "kill-type",
    targets: [4, 8, 12],
    text: (n, pick) => `Defeat ${n} ${PLURALS[pick.enemy] || `${pick.enemy}s`} with fireballs`,
  },
  defeat: { stat: "kill", targets: [8, 15, 25], text: (n) => `Defeat ${n} enemies` },
  coins: { stat: "coin", targets: [75, 150, 300], text: (n) => `Collect ${n} coins` },
  flawless: {
    stat: "flawless",
    targets: [1, 2, 3],
    text: (n) =>
      n === 1
        ? "Finish a level without losing a heart"
        : `Finish ${n} levels without losing a heart`,
  },
  combo: {
    stat: "combo",
    targets: [5, 10, 20],
    text: (n, pick, tier) => `Reach a x${[2, 3, 4][tier]} combo`,
  },
  burn: { stat: "burn", targets: [3, 5, 8], text: (n) => `Burn ${n} enemy projectiles` },
  powerups: { stat: "powerup", targets: [2, 3, 5], text: (n) => `Pick up ${n} power-ups` },
};

const MODE_QUESTS = {
  story: {
    stat: "level",
    targets: [1, 2, 3],
    text: (n) => (n === 1 ? "Finish a story level" : `Finish ${n} story levels`),
  },
  daily: {
    stat: "level",
    targets: [2, 3, 5],
    text: (n, pick, tier) =>
      tier === 2 ? "Finish today's daily challenge" : `Finish ${n} daily levels`,
  },
  endless: {
    stat: "endless-level",
    targets: [3, 5, 8],
    text: (n) => `Reach endless level ${n}`,
  },
  community: {
    stat: "level",
    targets: [1, 2, 4],
    text: (n) =>
      n === 1 ? "Finish a community world level" : `Finish ${n} community world levels`,
  },
  bossrush: {
    stat: "boss",
    targets: [2, 3, 1],
    finishStat: "bossrush-finished",
    text: (n, pick, tier) => (tier === 2 ? "Finish boss rush" : `Beat ${n} bosses in boss rush`),
  },
};

function buildPick(id, def, tier, extra = {}) {
  const pick = {
    id,
    tier,
    target: def.targets[tier],
    coins: QUEST_COINS[tier],
    stat: tier === 2 && def.finishStat ? def.finishStat : def.stat,
    ...extra,
  };
  pick.text = def.text(pick.target, pick, tier);
  return pick;
}

/** The day's three picks, sorted easy to hard; they depend only on the arguments. */
export function pickQuests(day, played, context) {
  const ctx = context || DEFAULT_CONTEXT();
  const rng = mulberry32((day * 7919 + 104729) >>> 0);
  const unlocked = MODES.filter((m) => (ctx.unlocked || []).includes(m));
  const modes = unlocked.length ? unlocked : ["story"];

  const recent = (mode) =>
    ((played && played[mode]) || []).filter((d) => d > day - PLAYED_DAYS && d <= day).length;
  const fewest = Math.min(...modes.map(recent));
  const ties = modes.filter((m) => recent(m) === fewest);
  const mode = ties[Math.floor(rng() * ties.length)];
  const modeTier = Math.floor(rng() * 3);

  const enemies = ctx.metEnemies || [];
  const ids = Object.keys(GENERAL).filter((id) => id !== "defeat-type" || enemies.length > 0);
  // a seeded shuffle; the first two are the day's general quests
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const enemy = enemies.length ? enemies[Math.floor(rng() * enemies.length)] : null;

  const tiers = [0, 1, 2].filter((t) => t !== modeTier);
  const picks = [buildPick(mode, MODE_QUESTS[mode], modeTier, { mode })];
  tiers.forEach((tier, i) => {
    const id = ids[i];
    picks.push(buildPick(id, GENERAL[id], tier, id === "defeat-type" ? { enemy } : {}));
  });
  return picks.sort((a, b) => a.tier - b.tier);
}

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

/** Does `feat`, recorded in `mode`, count toward `pick`? Returns the new progress, or null. */
function advance(pick, have, feat, mode) {
  if (pick.mode && pick.mode !== mode) return null;
  switch (pick.stat) {
    case "kill-type":
      return feat.type === "kill" && feat.enemy === pick.enemy ? have + 1 : null;
    case "kill":
      return feat.type === "kill" ? have + 1 : null;
    case "coin":
      return feat.type === "coin" ? have + feat.n : null;
    case "powerup":
      return feat.type === "powerup" ? have + 1 : null;
    case "burn":
      return feat.type === "burn" ? have + 1 : null;
    case "combo":
      return feat.type === "combo" ? Math.max(have, feat.value) : null;
    case "flawless":
      return feat.type === "level" && feat.flawless ? have + 1 : null;
    case "level":
      return feat.type === "level" ? have + 1 : null;
    case "endless-level":
      return feat.type === "endless-level" ? Math.max(have, feat.level) : null;
    case "boss":
      return feat.type === "boss" ? have + 1 : null;
    case "bossrush-finished":
      return feat.type === "bossrush-finished" ? have + 1 : null;
    default:
      return null;
  }
}

/** The chest is due while the week holds 12 keys, however they got there (a cloud merge adds keys too). */
const chestOf = (state) =>
  state.weekDone.length >= CHEST_KEYS
    ? { rewardId: chestRewardId(state.week), eggWeek: state.week }
    : null;

/** Pays each finished quest through the wallet; returns the ones that paid (a paid reward id pays nothing). */
export function payFinished(finished, wallet) {
  return finished.filter(({ pick, rewardId }) => wallet.reward(rewardId, pick.coins));
}

/**
 * Opens a due chest: 500 coins and one egg. The wallet's reward id for the week pays it once, on
 * this device and across devices, so a chest that was already paid does nothing. True when it paid.
 */
export function claimChest(chest, wallet, nest) {
  if (!chest || !wallet.reward(chest.rewardId, CHEST_COINS)) return false;
  nest.find(chestEggId(chest.eggWeek), "chest");
  return true;
}

export function createQuests(
  storage = defaultStorage(),
  now = () => new Date(),
  context = DEFAULT_CONTEXT,
) {
  const store = createKeyStore(storage, KEY, normalizeQuests);
  let memory = null; // the last state written, used while storage can't keep it
  let persisted = true;

  const load = () => (!persisted && memory ? memory : store.read());
  const save = (state) => {
    memory = state;
    store.write(state);
    persisted = JSON.stringify(store.read()) === JSON.stringify(normalizeQuests(state));
  };

  /**
   * The state for today: new picks on the first call of a local day, new keys on a new week.
   * A date earlier than the stored day (a clock set back, travel west) changes nothing: the stored
   * quests and keys stay as they are until a later date comes.
   */
  function current() {
    const state = load();
    const day = Math.max(localDay(now()), state.day);
    const week = weekStart(day);
    let changed = false;
    if (state.day !== day || state.picks.length !== QUEST_COINS.length) {
      let ctx;
      try {
        ctx = context();
      } catch (error) {
        ctx = DEFAULT_CONTEXT();
      }
      state.picks = pickQuests(day, state.played, ctx);
      state.progress = state.picks.map(() => 0);
      state.day = day;
      changed = true;
    }
    if (week > state.week) {
      state.week = week;
      state.weekDone = [];
      changed = true;
    }
    Object.keys(state.played).forEach((mode) => {
      const days = state.played[mode].filter((d) => d > day - PLAYED_DAYS);
      if (days.length !== state.played[mode].length) changed = true;
      if (days.length) state.played[mode] = days;
      else delete state.played[mode];
    });
    if (changed) save(state);
    return state;
  }

  const view = (state) =>
    state.picks.map((pick, i) => {
      const have = Math.min(state.progress[i] || 0, pick.target);
      return { ...pick, have, done: have >= pick.target };
    });

  return {
    today: () => view(current()),

    record(feat, mode) {
      const state = current();
      const finished = [];
      let changed = false;
      state.picks.forEach((pick, i) => {
        const have = state.progress[i] || 0;
        if (have >= pick.target) return;
        const next = advance(pick, have, feat, mode);
        if (next === null || !(next > have)) return;
        state.progress[i] = Math.min(next, pick.target);
        changed = true;
        if (state.progress[i] >= pick.target) {
          const rewardId = questRewardId(state.day, i);
          finished.push({ pick, rewardId });
          if (!state.weekDone.includes(rewardId)) state.weekDone.push(rewardId);
        }
      });
      if (changed) save(state);
      return { finished, chest: chestOf(state) };
    },

    played(mode) {
      const state = current();
      const list = state.played[mode] || [];
      if (list.includes(state.day)) return;
      state.played[mode] = [...list, state.day];
      save(state);
    },

    /** The chest this week's keys have earned, or null: it holds until it is paid. */
    chest: () => chestOf(current()),

    keys: () => Math.min(CHEST_KEYS, current().weekDone.length),
  };
}
