/**
 * The boards' short server cache (spec 4.4): polling getDailyBoard or
 * getEndlessBoard can't time a top-50 player's improvement more finely than
 * BOARD_CACHE_MS, while the caller's own entry is always fresh.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  handleGetDailyBoard,
  handleGetEndlessBoard,
  createBoardCache,
  BOARD_CACHE_MS,
} from "../functions/src/boards.js";

const TODAY = 20261111;
const T0 = Date.UTC(2026, 10, 11, 12);
const user = (uid) => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });

/** A store whose entries can change between calls; it counts its reads. */
function liveDaily(entries) {
  const store = {
    entries,
    tops: 0,
    gets: 0,
    fail: false,
    async top(seed, count) {
      store.tops += 1;
      if (store.fail) throw new Error("firestore down");
      return Object.entries(store.entries)
        .map(([uid, data]) => ({ uid, data: { ...data } }))
        .sort((a, b) => b.data.score - a.data.score || a.data.seconds - b.data.seconds)
        .slice(0, count);
    },
    async get(seed, uid) {
      store.gets += 1;
      return Object.hasOwn(store.entries, uid) ? { uid, data: { ...store.entries[uid] } } : null;
    },
  };
  return store;
}
const entry = (score, seconds = 60) => ({ name: "N", score, seconds });

const callDaily = (store, cache, at, auth = null, seed = TODAY) =>
  handleGetDailyBoard(
    { auth, data: { seed } },
    { scores: store, cache, log: () => {}, now: () => at },
  );

test("the cache keeps a board for 60 seconds", () => {
  assert.equal(BOARD_CACHE_MS, 60000);
});

test("a second call within 60 s reads no new top, and gets the same top even if a score improved", async () => {
  const store = liveDaily({ a: entry(500), b: entry(400) });
  const cache = createBoardCache();
  const first = await callDaily(store, cache, T0);
  store.entries.b = entry(900); // b improves
  const second = await callDaily(store, cache, T0 + 59999);
  assert.equal(store.tops, 1);
  assert.deepEqual(second.top, first.top);
});

test("after 60 s the next call reads the top again and shows the improvement", async () => {
  const store = liveDaily({ a: entry(500), b: entry(400) });
  const cache = createBoardCache();
  await callDaily(store, cache, T0);
  store.entries.b = entry(900);
  const later = await callDaily(store, cache, T0 + 60000);
  assert.equal(store.tops, 2);
  assert.equal(later.top[0].uid, "b");
});

test("each day's board and the endless board are cached apart", async () => {
  const store = liveDaily({ a: entry(500) });
  const cache = createBoardCache();
  await callDaily(store, cache, T0, null, TODAY);
  await callDaily(store, cache, T0, null, TODAY + 1);
  assert.equal(store.tops, 2);
  const endless = {
    tops: 0,
    async top() {
      endless.tops += 1;
      return [{ uid: "e", data: { name: "E", level: 3, score: 10, seconds: 5 } }];
    },
    async get() {
      return null;
    },
  };
  await handleGetEndlessBoard(
    { auth: null },
    { board: endless, cache, log: () => {}, now: () => T0 },
  );
  await handleGetEndlessBoard(
    { auth: null },
    { board: endless, cache, log: () => {}, now: () => T0 + 1000 },
  );
  assert.equal(endless.tops, 1);
  assert.equal(store.tops, 2);
});

test("calls at the same moment share one read", async () => {
  const store = liveDaily({ a: entry(500) });
  const cache = createBoardCache();
  await Promise.all([
    callDaily(store, cache, T0),
    callDaily(store, cache, T0),
    callDaily(store, cache, T0),
  ]);
  assert.equal(store.tops, 1);
});

test("a failed read is never cached: the next call reads again", async () => {
  const store = liveDaily({ a: entry(500) });
  const cache = createBoardCache();
  store.fail = true;
  await assert.rejects(callDaily(store, cache, T0));
  store.fail = false;
  const board = await callDaily(store, cache, T0 + 1);
  assert.equal(store.tops, 2);
  assert.equal(board.top.length, 1);
});

test("the caller's own entry is fresh even when the top comes from the cache", async () => {
  const store = liveDaily({ a: entry(500), me: entry(100) });
  const cache = createBoardCache();
  await callDaily(store, cache, T0, user("me"));
  store.entries.me = entry(800); // the caller just improved
  const board = await callDaily(store, cache, T0 + 1000, user("me"));
  assert.equal(store.tops, 1);
  assert.equal(board.me.score, 800);
});

test("a fresh top that holds the caller needs no second read", async () => {
  const store = liveDaily({ me: entry(500) });
  const cache = createBoardCache();
  const board = await callDaily(store, cache, T0, user("me"));
  assert.equal(store.gets, 0);
  assert.equal(board.me.score, 500);
});

test("the cache holds a handful of boards at most: the oldest goes first", async () => {
  const cache = createBoardCache({ max: 2 });
  let loads = 0;
  const load = async () => (loads += 1);
  await cache.get("x", T0, load);
  await cache.get("y", T0, load);
  await cache.get("z", T0, load); // evicts x
  await cache.get("y", T0, load);
  await cache.get("x", T0, load);
  assert.equal(loads, 4);
});

test("index.js shares one board cache between both board functions", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.match(index, /const boardCache = createBoardCache\(\)/);
  assert.match(index, /handleGetDailyBoard\(request, \{[^}]*cache: boardCache/);
  assert.match(index, /handleGetEndlessBoard\(request, \{[^}]*cache: boardCache/);
});
