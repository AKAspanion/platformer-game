/**
 * getDailyBoard and getEndlessBoard (functions/src/boards.js): the boards'
 * only read path. No client reads daily/{seed}/scores or endless (see
 * firestore.rules and tests/rules/boards.test.js), so these must hand out only
 * what a board shows, never a time.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  handleGetDailyBoard,
  handleGetEndlessBoard,
  BOARD_TOP,
  DAILY_FIELDS,
  ENDLESS_FIELDS,
} from "../functions/src/boards.js";
import { outranks } from "../functions/src/daily.js";
import { compareRuns } from "../functions/shared/modes/endless-rules.js";

const TODAY = 20261111;
const NOW = Date.UTC(2026, 10, 11, 12);
const now = () => NOW;

const user = (uid = "viewer") => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const rejected = (code) => (e) => e.code === code;

/** A Firestore Timestamp as the admin SDK hands one back. */
class Timestamp {
  constructor(seconds) {
    this.seconds = seconds;
    this.nanoseconds = 853403000;
  }

  toMillis() {
    return this.seconds * 1000;
  }
}
const stamp = new Timestamp(1794405591);

/** A row as the index.js adapters return it, plus the metadata Firestore keeps on every document. */
const rowOf = (uid, data) => ({
  uid,
  data,
  createTime: stamp,
  updateTime: stamp,
});

const order = (better) => (a, b) => (better(a.data, b.data) ? -1 : better(b.data, a.data) ? 1 : 0);
const endlessBetter = (a, b) => compareRuns(a, b) < 0;

/** daily/{seed}/scores/{uid}, best first and limited like the Firestore query; it refuses writes. */
function fakeDaily(days = {}) {
  const store = {
    reads: [],
    async top(seed, count) {
      store.reads.push(["top", seed, count]);
      const day = Object.hasOwn(days, seed) ? days[seed] : {};
      const rows = Object.keys(day).map((uid) => rowOf(uid, day[uid]));
      return rows.sort(order(outranks)).slice(0, count);
    },
    async get(seed, uid) {
      store.reads.push(["get", seed, uid]);
      const day = Object.hasOwn(days, seed) ? days[seed] : {};
      return Object.hasOwn(day, uid) ? rowOf(uid, day[uid]) : null;
    },
    async set() {
      throw new Error("a board read wrote an entry");
    },
  };
  return store;
}

/** endless/{uid}, best first and limited like the Firestore query; it refuses writes. */
function fakeEndless(entries = {}) {
  const store = {
    reads: [],
    async top(count) {
      store.reads.push(["top", count]);
      const rows = Object.keys(entries).map((uid) => rowOf(uid, entries[uid]));
      return rows.sort(order(endlessBetter)).slice(0, count);
    },
    async get(uid) {
      store.reads.push(["get", uid]);
      return Object.hasOwn(entries, uid) ? rowOf(uid, entries[uid]) : null;
    },
    async set() {
      throw new Error("a board read wrote an entry");
    },
  };
  return store;
}

const daily = (auth, data, deps) =>
  handleGetDailyBoard({ auth, data }, { now, log: () => {}, ...deps });
const endless = (auth, data, deps) =>
  handleGetEndlessBoard({ auth, data }, { log: () => {}, ...deps });

/** A stored entry as the submit functions wrote them before 4.4, plus things that must never leave. */
const storedDaily = (uid, score, seconds, extra = {}) => ({
  uid,
  name: `Name ${uid}`,
  score,
  seconds,
  updatedAt: NOW - 3600000,
  ...extra,
});
const storedEndless = (uid, level, score, seconds, extra = {}) => ({
  ...storedDaily(uid, score, seconds, extra),
  level,
  seed: 987654,
});

// --- only what the board shows

test("getDailyBoard hands out exactly uid, name, score and seconds", async () => {
  const leaky = storedDaily("p1", 900, 61.5, {
    createdAt: stamp,
    playedAt: stamp,
    email: "p1@example.com",
    ticket: "t1",
    uid: "victim", // the stored uid field is ignored: the document id is the player
  });
  const scores = fakeDaily({ [TODAY]: { p1: leaky } });
  const out = await daily(user("p1"), { seed: TODAY }, { scores });
  const expected = { uid: "p1", name: "Name p1", score: 900, seconds: 61.5 };
  assert.deepEqual(out, { top: [expected], me: expected });
  assert.deepEqual(Object.keys(out).sort(), ["me", "top"]);
  for (const entry of [out.top[0], out.me]) {
    assert.deepEqual(Object.keys(entry).sort(), ["name", "score", "seconds", "uid"]);
  }
  const text = JSON.stringify(out);
  for (const leak of ["updatedAt", "createTime", "updateTime", "example.com", "victim"]) {
    assert.equal(text.includes(leak), false, `${leak} leaked`);
  }
  assert.equal(text.includes(String(stamp.seconds)), false, "a timestamp leaked");
});

test("getEndlessBoard hands out exactly uid, name, level, score and seconds", async () => {
  const leaky = storedEndless("p1", 12, 4000, 300, { createdAt: stamp, uid: "victim" });
  const board = fakeEndless({ p1: leaky });
  const out = await endless(user("p1"), {}, { board });
  const expected = { uid: "p1", name: "Name p1", level: 12, score: 4000, seconds: 300 };
  assert.deepEqual(out, { top: [expected], me: expected });
  for (const entry of [out.top[0], out.me]) {
    assert.deepEqual(Object.keys(entry).sort(), ["level", "name", "score", "seconds", "uid"]);
  }
  const text = JSON.stringify(out);
  assert.equal(text.includes("updatedAt"), false);
  assert.equal(text.includes("987654"), false, "the run's seed leaked");
  assert.equal(text.includes(String(stamp.seconds)), false, "a timestamp leaked");
});

test("the field lists index.js masks the reads with are what the board shows", () => {
  assert.deepEqual(DAILY_FIELDS, ["name", "score", "seconds"]);
  assert.deepEqual(ENDLESS_FIELDS, ["name", "level", "score", "seconds"]);
  assert.equal(BOARD_TOP, 50);
});

// --- the top 50 and the caller's own entry, nobody else's

/** 60 daily players in board order: p01 first ... p60 last, with ties on score broken by time. */
const sixtyDaily = () => {
  const day = {};
  for (let i = 1; i <= 60; i++) {
    const uid = `p${String(i).padStart(2, "0")}`;
    // pairs share a score; the faster of each pair ranks first
    day[uid] = storedDaily(uid, 10000 - Math.ceil(i / 2) * 10, 100 + (i % 2 ? 0 : 5));
  }
  return day;
};

test("getDailyBoard: 60 entries give the top 50 in order, the 57th caller's own, never the 58th", async () => {
  const scores = fakeDaily({ [TODAY]: sixtyDaily() });
  const out = await daily(user("p57"), { seed: TODAY }, { scores });
  assert.equal(out.top.length, 50);
  assert.deepEqual(
    out.top.map((e) => e.uid),
    Array.from({ length: 50 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`),
  );
  assert.deepEqual(out.me, { uid: "p57", name: "Name p57", score: 9710, seconds: 100 });
  assert.equal(JSON.stringify(out).includes("p58"), false, "another player outside the top 50");
  assert.deepEqual(scores.reads, [
    ["top", TODAY, 50],
    ["get", TODAY, "p57"],
  ]);
});

test("getEndlessBoard: 60 entries give the top 50 in order, the 57th caller's own, never the 58th", async () => {
  const entries = {};
  for (let i = 1; i <= 60; i++) {
    const uid = `p${String(i).padStart(2, "0")}`;
    // level first, then score, then the shorter time
    const level = 100 - Math.ceil(i / 4);
    const score = 5000 - ((Math.ceil(i / 2) - 1) % 2) * 100;
    entries[uid] = storedEndless(uid, level, score, 200 + (i % 2 ? 0 : 7));
  }
  const board = fakeEndless(entries);
  const out = await endless(user("p57"), {}, { board });
  assert.equal(out.top.length, 50);
  assert.deepEqual(
    out.top.map((e) => e.uid),
    Array.from({ length: 50 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`),
  );
  assert.equal(out.me.uid, "p57");
  assert.equal(JSON.stringify(out).includes("p58"), false, "another player outside the top 50");
  assert.deepEqual(board.reads, [
    ["top", 50],
    ["get", "p57"],
  ]);
});

test("a board is never longer than 50 or out of order, whatever the store hands back", async () => {
  const day = sixtyDaily();
  const shuffled = Object.keys(day)
    .reverse()
    .map((uid) => rowOf(uid, day[uid]));
  const scores = { top: async () => shuffled, get: async () => null };
  const out = await daily(null, { seed: TODAY }, { scores });
  assert.equal(out.top.length, 50);
  assert.equal(out.top[0].uid, "p01");
  assert.equal(out.top[49].uid, "p50");

  const runs = {};
  for (let i = 1; i <= 60; i++) runs[`e${i}`] = storedEndless(`e${i}`, i, 0, 10);
  const rows = Object.keys(runs).map((uid) => rowOf(uid, runs[uid]));
  const board = { top: async () => rows, get: async () => null };
  const ranked = await endless(null, {}, { board });
  assert.equal(ranked.top.length, 50);
  assert.equal(ranked.top[0].uid, "e60");
  assert.equal(ranked.top[49].uid, "e11");
});

test("a caller inside the top 50 gets their entry as me, with no second read", async () => {
  const scores = fakeDaily({ [TODAY]: sixtyDaily() });
  const out = await daily(user("p03"), { seed: TODAY }, { scores });
  assert.deepEqual(out.me, out.top[2]);
  assert.deepEqual(scores.reads, [["top", TODAY, 50]]);
});

test("a caller with no entry gets me: null", async () => {
  const scores = fakeDaily({ [TODAY]: sixtyDaily() });
  assert.equal((await daily(user("nobody"), { seed: TODAY }, { scores })).me, null);
  const board = fakeEndless({ a: storedEndless("a", 3, 0, 30) });
  assert.equal((await endless(user("nobody"), {}, { board })).me, null);
});

test("an empty board is { top: [], me: null }", async () => {
  assert.deepEqual(await daily(user(), { seed: TODAY }, { scores: fakeDaily() }), {
    top: [],
    me: null,
  });
  assert.deepEqual(await endless(user(), {}, { board: fakeEndless() }), { top: [], me: null });
});

// --- signed out

test("a signed-out call gets the top and me: null, and reads no single entry", async () => {
  for (const auth of [null, undefined, { token: {} }, { uid: "" }, { uid: 7 }]) {
    const scores = fakeDaily({ [TODAY]: sixtyDaily() });
    const out = await daily(auth, { seed: TODAY }, { scores });
    assert.equal(out.top.length, 50, JSON.stringify(auth));
    assert.equal(out.me, null);
    assert.deepEqual(scores.reads, [["top", TODAY, 50]]);

    const board = fakeEndless({ a: storedEndless("a", 3, 0, 30) });
    const ranked = await endless(auth, {}, { board });
    assert.equal(ranked.top.length, 1);
    assert.equal(ranked.me, null);
    assert.deepEqual(board.reads, [["top", 50]]);
  }
});

// --- the seed

test("getDailyBoard takes yesterday's, today's and tomorrow's seed by UTC", async () => {
  for (const seed of [20261110, TODAY, 20261112]) {
    const scores = fakeDaily({ [seed]: { p1: storedDaily("p1", 1, 40) } });
    const out = await daily(user(), { seed }, { scores });
    assert.equal(out.top.length, 1, String(seed));
  }
});

test("getDailyBoard refuses any other seed with invalid-argument, before reading", async () => {
  const bad = [
    { seed: 20261109 },
    { seed: 20261113 },
    { seed: 20251111 },
    { seed: "20261111" },
    { seed: 20261111.5 },
    { seed: NaN },
    { seed: Infinity },
    { seed: null },
    { seed: [TODAY] },
    { seed: { valueOf: () => TODAY } },
    { seed: 20261131 },
    {},
    null,
    undefined,
    "20261111",
    [TODAY],
    Object.create({ seed: TODAY }), // inherited, not the request's own
  ];
  for (const data of bad) {
    const scores = fakeDaily({ [TODAY]: sixtyDaily() });
    await assert.rejects(
      daily(user(), data, { scores }),
      rejected("invalid-argument"),
      String(JSON.stringify(data)),
    );
    assert.deepEqual(scores.reads, [], "nothing read");
  }
});

test("getEndlessBoard reads nothing from the request", async () => {
  const board = fakeEndless({ a: storedEndless("a", 3, 0, 30), b: storedEndless("b", 2, 0, 30) });
  const plain = await endless(user("a"), {}, { board });
  for (const data of [undefined, null, "x", { limit: 1000, uid: "b", seed: 1 }, [1, 2]]) {
    const other = fakeEndless({
      a: storedEndless("a", 3, 0, 30),
      b: storedEndless("b", 2, 0, 30),
    });
    assert.deepEqual(await endless(user("a"), data, { board: other }), plain);
    assert.deepEqual(other.reads, [["top", 50]]);
  }
});

// --- stored values are untrusted too

test("a malformed stored entry is left out and logged without its uid", async () => {
  const logs = [];
  const log = (message) => logs.push(message);
  const scores = fakeDaily({
    [TODAY]: {
      good: storedDaily("good", 500, 40),
      noName: { score: 400, seconds: 40 },
      textScore: storedDaily("textScore", "300", 40),
      badTime: storedDaily("badTime", 200, Infinity),
      objectName: storedDaily("objectName", 100, 40, { name: { toString: () => "x" } }),
    },
  });
  const out = await daily(user("textScore"), { seed: TODAY }, { scores, log });
  assert.deepEqual(
    out.top.map((e) => e.uid),
    ["good"],
  );
  assert.equal(out.me, null, "the caller's own malformed entry isn't handed out either");
  assert.ok(logs.length >= 4, "every dropped entry logs");
  for (const line of logs) {
    assert.doesNotMatch(line, /good|noName|textScore|badTime|objectName/);
  }

  const board = fakeEndless({
    ok: storedEndless("ok", 5, 10, 40),
    floatLevel: storedEndless("floatLevel", 5.5, 10, 40),
    noLevel: storedDaily("noLevel", 10, 40),
  });
  const endlessLogs = [];
  const ranked = await endless(user("ok"), {}, { board, log: (m) => endlessLogs.push(m) });
  assert.deepEqual(
    ranked.top.map((e) => e.uid),
    ["ok"],
  );
  assert.equal(endlessLogs.length, 2);
});

test("a store failure reaches the caller as it is (the callable wrapper hides it)", async () => {
  const failure = new Error("9 FAILED_PRECONDITION: The query requires an index");
  const scores = { top: async () => Promise.reject(failure), get: async () => null };
  await assert.rejects(daily(user(), { seed: TODAY }, { scores }), (e) => e === failure);
});

// --- wiring

test("index.js serves both boards through the App Check callable, reading only the shown fields", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.match(index, /export const getDailyBoard = callable\(/);
  assert.match(index, /export const getEndlessBoard = callable\(/);
  assert.match(index, /getDailyBoard\(\{ seed \}\)\s+-> \{ top, me \}/);
  assert.match(index, /getEndlessBoard\(\)\s+-> \{ top, me \}/);
  const adapters = index.slice(
    index.indexOf("const boardReads"),
    index.indexOf("export const getEndlessBoard"),
  );
  assert.match(adapters, /\.select\(\.\.\.DAILY_FIELDS\)/);
  assert.match(adapters, /\.select\(\.\.\.ENDLESS_FIELDS\)/);
  assert.match(adapters, /fieldMask: DAILY_FIELDS/);
  assert.match(adapters, /fieldMask: ENDLESS_FIELDS/);
  assert.doesNotMatch(adapters, /createTime|updateTime|\.set\(|\.update\(|\.delete\(/);
});
