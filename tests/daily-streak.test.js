import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createStreak, MAX_FREEZES } from "../app/daily/streak";

const KEY = "daily_streak";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const stored = (days, last, freezes, best = days) =>
  memoryStorage({ [KEY]: JSON.stringify({ days, best, freezes, last }) });

test("the freeze cap is 2", () => {
  assert.equal(MAX_FREEZES, 2);
});

test("first day starts a streak of 1 with 1 freeze", () => {
  const r = createStreak(memoryStorage()).record(20261111);
  assert.equal(r.days, 1);
  assert.equal(r.freezes, 1);
  assert.equal(r.grew, true);
  assert.equal(r.usedFreeze, false);
});

test("playing again on a counted day changes nothing", () => {
  const streak = createStreak(stored(3, 20261111, 1));
  const r = streak.record(20261111);
  assert.deepEqual(r, { days: 3, best: 3, freezes: 1, grew: false, usedFreeze: false });
});

test("missing one day uses a freeze", () => {
  const r = createStreak(stored(3, 20261111, 1)).record(20261113);
  assert.equal(r.days, 4);
  assert.equal(r.freezes, 0);
  assert.equal(r.usedFreeze, true);
  assert.equal(r.grew, true);
});

test("missing one day without a freeze restarts at 1", () => {
  const r = createStreak(stored(3, 20261111, 0)).record(20261113);
  assert.equal(r.days, 1);
  assert.equal(r.usedFreeze, false);
});

test("missing two days restarts at 1 and keeps the freezes", () => {
  const r = createStreak(stored(3, 20261111, 2)).record(20261114);
  assert.equal(r.days, 1);
  assert.equal(r.freezes, 2);
});

test("a freeze is earned at 7 days, capped at 2", () => {
  assert.equal(createStreak(stored(6, 20261111, 2)).record(20261112).freezes, 2);
  const r = createStreak(stored(6, 20261111, 1)).record(20261112);
  assert.equal(r.days, 7);
  assert.equal(r.freezes, 2);
});

test("consecutive days grow across month and year ends", () => {
  assert.equal(createStreak(stored(3, 20261130, 1)).record(20261201).days, 4);
  assert.equal(createStreak(stored(3, 20261231, 1)).record(20270101).days, 4);
});

test("best keeps the longest streak", () => {
  const r = createStreak(stored(9, 20261111, 0, 9)).record(20261115);
  assert.equal(r.days, 1);
  assert.equal(r.best, 9);
});

test("the streak persists through storage", () => {
  const storage = memoryStorage();
  createStreak(storage).record(20261111);
  const r = createStreak(storage).record(20261112);
  assert.equal(r.days, 2);
});

test("a seed before the last counted day changes nothing", () => {
  const r = createStreak(stored(3, 20261111, 1)).record(20261105);
  assert.equal(r.days, 3);
  assert.equal(r.grew, false);
});

test("current is not alive when a missed day has no freeze", () => {
  const s0 = createStreak(stored(5, 20261109, 0)).current(20261111);
  assert.equal(s0.alive, false);
  const s1 = createStreak(stored(5, 20261109, 1)).current(20261111);
  assert.equal(s1.alive, true);
  assert.equal(s1.days, 5);
});

test("current is alive on the same or next day, dead after 2 missed days", () => {
  assert.equal(createStreak(stored(5, 20261111, 0)).current(20261111).alive, true);
  assert.equal(createStreak(stored(5, 20261111, 0)).current(20261112).alive, true);
  assert.equal(createStreak(stored(5, 20261111, 2)).current(20261114).alive, false);
});

test("current does not change the stored streak", () => {
  const storage = stored(5, 20261109, 1);
  const before = storage.getItem(KEY);
  createStreak(storage).current(20261120);
  assert.equal(storage.getItem(KEY), before);
});

test("a corrupt stored value gives days 0 without throwing", () => {
  for (const bad of ["{not json", "null", "42", '{"days":"x"}', '{"days":-3,"last":1}']) {
    const r = createStreak(memoryStorage({ [KEY]: bad })).current(20261111);
    assert.equal(r.days, 0, bad);
    assert.equal(r.alive, false, bad);
  }
  const r = createStreak(memoryStorage({ [KEY]: "{not json" })).record(20261111);
  assert.equal(r.days, 1);
});

test("storage that throws does not break the streak", () => {
  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  const streak = createStreak(broken);
  assert.equal(streak.current(20261111).days, 0);
  assert.equal(streak.record(20261111).days, 1);
});
