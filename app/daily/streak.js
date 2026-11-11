/**
 * The daily streak: a day counts when the player finishes at least one daily
 * level that day (local date, passed in as a YYYYMMDD seed). Kept in
 * localStorage under "daily_streak" as { days, best, freezes, last }.
 */
import { daysBetween } from "./rules.js";

export const MAX_FREEZES = 2;
const STORAGE_KEY = "daily_streak";
const START_FREEZES = 1;
/** A freeze is earned at every multiple of this many days of streak. */
const FREEZE_EVERY = 7;

const EMPTY = { days: 0, best: 0, freezes: START_FREEZES, last: 0 };

const isCount = (n) => Number.isInteger(n) && n >= 0;

function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function load(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (
      data &&
      typeof data === "object" &&
      isCount(data.days) &&
      isCount(data.best) &&
      isCount(data.freezes) &&
      Number.isFinite(daysBetween(data.last, data.last))
    ) {
      return { ...data, freezes: Math.min(data.freezes, MAX_FREEZES) };
    }
  } catch {
    // Missing, unreadable or corrupt: start again from nothing.
  }
  return { ...EMPTY };
}

function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the streak still counts for this session.
  }
}

export function createStreak(storage = defaultStorage()) {
  // Without any storage the streak lives in memory for the session.
  let memory = null;
  const read = () => (storage ? load(storage) : { ...(memory || EMPTY) });
  const write = (state) => {
    memory = state;
    if (storage) save(storage, state);
  };

  return {
    record(seed) {
      const state = read();
      const gap = state.days ? daysBetween(state.last, seed) : NaN;
      const unchanged = { days: state.days, best: state.best, freezes: state.freezes };
      if (state.days && !(gap >= 1)) {
        // The same day again, an earlier day, or a bad seed: nothing to count.
        return { ...unchanged, grew: false, usedFreeze: false };
      }
      if (!Number.isFinite(daysBetween(seed, seed))) {
        return { ...unchanged, grew: false, usedFreeze: false };
      }

      let days = 1;
      let freezes = state.freezes;
      let usedFreeze = false;
      if (!state.days) {
        freezes = START_FREEZES;
      } else if (gap === 1) {
        days = state.days + 1;
      } else if (gap === 2 && freezes > 0) {
        days = state.days + 1;
        freezes -= 1;
        usedFreeze = true;
      }
      if (days > 1 && days % FREEZE_EVERY === 0) freezes = Math.min(freezes + 1, MAX_FREEZES);

      const next = { days, best: Math.max(state.best, days), freezes, last: seed };
      write(next);
      return { days, best: next.best, freezes, grew: true, usedFreeze };
    },

    current(todaySeed) {
      const { days, best, freezes, last } = read();
      if (!days) return { days: 0, best, freezes, alive: false };
      const gap = daysBetween(last, todaySeed);
      const alive = gap <= 1 || (gap === 2 && freezes > 0);
      return { days, best, freezes, alive };
    },
  };
}
