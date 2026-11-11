import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyProgress,
  readLocal,
  writeLocal,
  mergeProgress,
  saveBytes,
  deviceId,
  SAVE_VERSION,
  MAX_SAVE_BYTES,
} from "../app/progress/save";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

const withProgress = (changes) => ({ ...emptyProgress(), ...changes });
const campaign = (reached, stars = {}, best = {}, last = 1) => ({ reached, last, stars, best });
const streak = (days, last) => ({ days, best: days, freezes: 1, last });

test("constants", () => {
  assert.equal(SAVE_VERSION, 1);
  assert.equal(MAX_SAVE_BYTES, 102400);
});

test("readLocal carries the existing keys and writeLocal leaves them byte-identical", () => {
  const raw = {
    campaign: JSON.stringify({
      reached: [1, 2, 7],
      last: 7,
      stars: { 1: 7, 2: 3 },
      best: { 1: 40.5 },
    }),
    mode_records: JSON.stringify({
      "endless:best": { score: 900, kind: "x" },
      "world:abc": { score: 12 },
    }),
    high_score: JSON.stringify(1234),
    daily_streak: JSON.stringify({ days: 4, best: 6, freezes: 1, last: 20261111 }),
  };
  const storage = memoryStorage(raw);
  const progress = readLocal(storage);
  assert.deepEqual(progress.campaign, JSON.parse(raw.campaign));
  assert.deepEqual(progress.records, JSON.parse(raw.mode_records));
  assert.equal(progress.highScore, 1234);
  assert.deepEqual(progress.streak, JSON.parse(raw.daily_streak));

  writeLocal(progress, storage);
  Object.keys(raw).forEach((key) => assert.equal(storage.data[key], raw[key], key));
});

test("writeLocal then readLocal returns what was written, new keys included", () => {
  const storage = memoryStorage();
  const p = withProgress({
    achievements: { "first-steps": 1000 },
    wallet: {
      earned: { dev: 5 },
      rewards: { "first-steps": 50 },
      owned: ["hat:cap"],
      worn: { skin: "classic", hat: "cap", fireball: "classic" },
      wornAt: 3,
    },
    stats: {
      kills: { dev: 9 },
      flawlessBoss: true,
      secretBoss: false,
      worldsFinished: ["w1"],
      bossRushBest: 252,
    },
  });
  writeLocal(p, storage);
  assert.deepEqual(readLocal(storage), p);
});

test("a fresh device reads as emptyProgress and does not write a streak", () => {
  const storage = memoryStorage();
  assert.deepEqual(readLocal(storage), emptyProgress());
  writeLocal(emptyProgress(), storage);
  assert.equal("daily_streak" in storage.data, false);
});

test("blocked storage reads as emptyProgress and writes do not throw", () => {
  assert.deepEqual(readLocal(blocked), emptyProgress());
  assert.doesNotThrow(() => writeLocal(emptyProgress(), blocked));
});

test("corrupt stored values are ignored key by key", () => {
  const storage = memoryStorage({
    campaign: "{not json",
    high_score: JSON.stringify("lots"),
    mode_records: JSON.stringify({ a: 5, b: { score: 7 } }),
    daily_streak: JSON.stringify({ days: -1 }),
    wallet: JSON.stringify([1]),
  });
  const p = readLocal(storage);
  assert.deepEqual(p.campaign, emptyProgress().campaign);
  assert.equal(p.highScore, 0);
  assert.deepEqual(p.records, { b: { score: 7 } });
  assert.equal(p.streak, null);
  assert.deepEqual(p.wallet, emptyProgress().wallet);
});

test("merge: levels reached are the union, stars combine, best time is the lower", () => {
  const a = withProgress({ campaign: campaign([1, 2, 7], { 1: 0b011 }, { 1: 40 }) });
  const b = withProgress({ campaign: campaign([1, 3], { 1: 0b100 }, { 1: 35 }) });
  const m = mergeProgress(a, b);
  assert.deepEqual(m.campaign.reached, [1, 2, 3, 7]);
  assert.deepEqual(m.campaign.stars, { 1: 0b111 });
  assert.deepEqual(m.campaign.best, { 1: 35 });
});

test("merge: records and the high score keep the higher", () => {
  const a = withProgress({ records: { x: { score: 5 }, y: { score: 9 } }, highScore: 50 });
  const b = withProgress({ records: { x: { score: 8 }, z: { score: 1 } }, highScore: 20 });
  const m = mergeProgress(a, b);
  assert.deepEqual(m.records, { x: { score: 8 }, y: { score: 9 }, z: { score: 1 } });
  assert.equal(m.highScore, 50);
});

test("merge: coins are counted per device and summed, not overwritten", () => {
  const wallet = (earned) => ({ ...emptyProgress().wallet, earned });
  const a = withProgress({ wallet: wallet({ devA: 300 }) });
  const b = withProgress({ wallet: wallet({ devA: 250, devB: 400 }) });
  assert.deepEqual(mergeProgress(a, b).wallet.earned, { devA: 300, devB: 400 });
});

test("merge: lifetime stats are per device, owned and rewards are unions", () => {
  const s = (kills, extra = {}) => ({ ...emptyProgress().stats, kills, ...extra });
  const a = withProgress({
    stats: s({ d1: 10 }, { worldsFinished: ["a"], bossRushBest: 300 }),
    wallet: { ...emptyProgress().wallet, owned: ["hat:cap"], rewards: { r1: 50 } },
  });
  const b = withProgress({
    stats: s({ d1: 4, d2: 6 }, { worldsFinished: ["b"], flawlessBoss: true, bossRushBest: 250 }),
    wallet: { ...emptyProgress().wallet, owned: ["skin:mint"], rewards: { r2: 100 } },
  });
  const m = mergeProgress(a, b);
  assert.deepEqual(m.stats.kills, { d1: 10, d2: 6 });
  assert.deepEqual(m.stats.worldsFinished, ["a", "b"]);
  assert.equal(m.stats.flawlessBoss, true);
  assert.equal(m.stats.bossRushBest, 250);
  assert.deepEqual(m.wallet.owned, ["hat:cap", "skin:mint"]);
  assert.deepEqual(m.wallet.rewards, { r1: 50, r2: 100 });
});

test("merge: the streak with the later day wins; on the same day the longer one", () => {
  const a = withProgress({ streak: streak(4, 20261111) });
  const b = withProgress({ streak: streak(9, 20261109) });
  assert.deepEqual(mergeProgress(a, b).streak, a.streak);
  assert.deepEqual(mergeProgress(b, a).streak, a.streak);

  const c = withProgress({ streak: streak(4, 20261111) });
  const d = withProgress({ streak: streak(9, 20261111) });
  assert.deepEqual(mergeProgress(c, d).streak, d.streak);
  assert.deepEqual(mergeProgress(d, c).streak, d.streak);
  assert.deepEqual(mergeProgress(a, withProgress({})).streak, a.streak);
  assert.equal(mergeProgress(withProgress({}), withProgress({})).streak, null);
});

test("merge: an achievement keeps the earliest date", () => {
  const a = withProgress({ achievements: { "first-steps": 1000, x: 5 } });
  const b = withProgress({ achievements: { "first-steps": 900, y: 7 } });
  assert.deepEqual(mergeProgress(a, b).achievements, { "first-steps": 900, x: 5, y: 7 });
});

test("merge: worn cosmetics come from the save changed last", () => {
  const w = (hat, wornAt) => ({
    ...emptyProgress().wallet,
    worn: { skin: "classic", hat, fireball: "classic" },
    wornAt,
  });
  const a = withProgress({ wallet: w("crown", 5) });
  const b = withProgress({ wallet: w("cap", 9) });
  assert.equal(mergeProgress(a, b).wallet.worn.hat, "cap");
  assert.equal(mergeProgress(b, a).wallet.worn.hat, "cap");
});

test("merge is commutative and idempotent, and merging a result again changes nothing", () => {
  const a = withProgress({
    updatedAt: 5,
    campaign: campaign([1, 2], { 1: 1 }, { 1: 50 }, 2),
    records: { x: { score: 3 } },
    highScore: 7,
    streak: streak(3, 20261110),
    achievements: { q: 10 },
    wallet: { ...emptyProgress().wallet, earned: { a: 1 }, owned: ["hat:cap"], wornAt: 4 },
  });
  const b = withProgress({
    updatedAt: 9,
    campaign: campaign([1, 5], { 1: 2, 5: 7 }, { 1: 45 }, 5),
    records: { x: { score: 3, extra: 1 } },
    highScore: 7,
    streak: streak(3, 20261110),
    achievements: { q: 12, r: 1 },
    wallet: { ...emptyProgress().wallet, earned: { b: 2 }, owned: ["skin:mint"], wornAt: 4 },
  });
  const ab = mergeProgress(a, b);
  assert.deepEqual(ab, mergeProgress(b, a));
  assert.deepEqual(mergeProgress(ab, a), ab);
  assert.deepEqual(mergeProgress(ab, b), ab);
  assert.deepEqual(mergeProgress(ab, ab), ab);
});

test("merge ignores malformed input instead of throwing", () => {
  const a = withProgress({ highScore: 4 });
  assert.equal(mergeProgress(a, { highScore: "x", campaign: 5 }).highScore, 4);
  assert.doesNotThrow(() => mergeProgress(null, undefined));
});

test("saveBytes is the size of the serialised progress", () => {
  const p = emptyProgress();
  assert.equal(saveBytes(p), Buffer.byteLength(JSON.stringify(p)));
  assert.ok(saveBytes(p) < MAX_SAVE_BYTES);
  assert.equal(saveBytes({ s: "é" }), Buffer.byteLength('{"s":"é"}'));
});

test("deviceId is random, made once and kept in device_id", () => {
  const storage = memoryStorage();
  const id = deviceId(storage);
  assert.ok(id.length >= 8);
  assert.equal(deviceId(storage), id);
  assert.equal(storage.data.device_id, id);
  assert.notEqual(deviceId(memoryStorage()), id);
});

test("deviceId with blocked storage still gives a stable id for the session", () => {
  const id = deviceId(blocked);
  assert.ok(id.length >= 8);
  assert.equal(deviceId(blocked), id);
});
