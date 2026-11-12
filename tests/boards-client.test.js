/**
 * The game's side of board privacy (spec 4.4): both boards load with one
 * function call (getDailyBoard / getEndlessBoard) and never from Firestore,
 * and the board shows the same rows, ranks, pinned row and copy as before
 * (fixes-and-leaderboards spec).
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLeaderboard, TOP_LIMIT } from "../app/daily/leaderboard";
import { createEndlessBoard } from "../app/modes/endless-board";
import { boardView, BOARD_EMPTY, BOARD_FAILED } from "../app/daily/board-view";

const SEED = 20261111;
const entry = (uid, score = 100, seconds = 40) => ({ uid, name: `N ${uid}`, score, seconds });
const endlessEntry = (uid, level = 5) => ({ ...entry(uid), level });

/** A backend that answers board calls with `answer` and records them. */
const backendFor = (answer) => {
  const calls = [];
  return {
    calls,
    call: async (name, data) => (calls.push([name, data]), { rank: 1 }),
    board: async (...args) => (calls.push(["board", ...args]), answer),
  };
};

// --- the daily board

test("leaderboard.load asks for the day's board once and ranks its rows in order", async () => {
  const backend = backendFor({
    top: [{ ...entry("a", 900), extra: "x", updatedAt: 5 }, entry("b", 800), entry("c", 800, 41)],
    me: null,
  });
  const board = createLeaderboard(backend);
  const out = await board.load(SEED);
  assert.deepEqual(backend.calls, [["board", SEED]]);
  assert.deepEqual(out, {
    rows: [
      { uid: "a", name: "N a", score: 900, seconds: 40, rank: 1 },
      { uid: "b", name: "N b", score: 800, seconds: 40, rank: 2 },
      { uid: "c", name: "N c", score: 800, seconds: 41, rank: 3 },
    ],
    mine: null,
  });
});

test("leaderboard.load gives the caller's own entry as mine, shown fields only", async () => {
  const board = createLeaderboard(
    backendFor({ top: [entry("a")], me: { ...entry("me", 5), updatedAt: 9 } }),
  );
  const { mine } = await board.load(SEED);
  assert.deepEqual(mine, { uid: "me", name: "N me", score: 5, seconds: 40 });
});

test("leaderboard.load passes a failed call on unchanged", async () => {
  const failure = Object.assign(new Error("Can't reach the server right now."), {
    code: "unavailable",
  });
  const board = createLeaderboard({
    call: async () => Promise.reject(failure),
    board: async () => Promise.reject(failure),
  });
  await assert.rejects(board.load(SEED), (error) => error === failure);
});

test("leaderboard.load treats an answer that isn't a board as a failed load", async () => {
  for (const answer of [
    null,
    undefined,
    "board",
    [],
    {},
    { top: "x" },
    { top: [null] },
    { top: ["a"] },
    { top: [], me: "me" },
  ]) {
    const board = createLeaderboard(backendFor(answer));
    await assert.rejects(
      board.load(SEED),
      (error) => error.code === "bad-answer",
      JSON.stringify(answer),
    );
  }
});

test("leaderboard.submit is unchanged: seed, score, seconds and the ticket, never a name", async () => {
  const backend = backendFor(null);
  await createLeaderboard(backend).submit({
    seed: SEED,
    score: 10,
    seconds: 40,
    ticket: "t1",
    name: "Hacker",
  });
  assert.deepEqual(backend.calls, [
    ["submitDailyScore", { seed: SEED, score: 10, seconds: 40, ticket: "t1" }],
  ]);
});

// --- the endless board

test("endlessBoard.load asks for the board once, ranks its rows and gives mine", async () => {
  const backend = backendFor({
    top: [{ ...endlessEntry("a", 9), seed: 5, updatedAt: 1 }, endlessEntry("b", 8)],
    me: endlessEntry("me", 2),
  });
  const out = await createEndlessBoard(backend).load();
  assert.deepEqual(backend.calls, [["board"]]);
  assert.deepEqual(out, {
    rows: [
      { uid: "a", name: "N a", level: 9, score: 100, seconds: 40, rank: 1 },
      { uid: "b", name: "N b", level: 8, score: 100, seconds: 40, rank: 2 },
    ],
    mine: { uid: "me", name: "N me", level: 2, score: 100, seconds: 40 },
  });
});

test("endlessBoard.load passes a failure on and refuses an answer that isn't a board", async () => {
  const failure = new Error("Can't reach the server right now.");
  await assert.rejects(
    createEndlessBoard({ board: async () => Promise.reject(failure) }).load(),
    (error) => error === failure,
  );
  for (const answer of [null, { top: {} }, { top: [7] }, { top: [], me: 3 }]) {
    await assert.rejects(
      createEndlessBoard(backendFor(answer)).load(),
      (error) => error.code === "bad-answer",
    );
  }
});

test("endlessBoard.submit is unchanged and never sends a name", async () => {
  const backend = backendFor(null);
  await createEndlessBoard(backend).submit({
    seed: 1,
    level: 2,
    score: 3,
    seconds: 9,
    ticket: "t1",
    name: "Hacker",
  });
  assert.deepEqual(backend.calls, [
    ["submitEndlessScore", { seed: 1, level: 2, score: 3, seconds: 9, ticket: "t1" }],
  ]);
});

// --- what the board shows

const ranked = (uids) => uids.map((uid, i) => ({ ...entry(uid), rank: i + 1 }));

test("the board shows the top rows in rank order and marks the viewer's row", () => {
  const view = boardView({ rows: ranked(["a", "me", "c"]), mine: null }, "me");
  assert.equal(view.status, "");
  assert.deepEqual(
    view.rows.map(({ entry: e, me, pinned }) => [e.uid, e.rank, me, pinned]),
    [
      ["a", 1, false, false],
      ["me", 2, true, false],
      ["c", 3, false, false],
    ],
  );
});

test("a viewer outside the top 50 gets their row pinned last, ranked 50+", () => {
  const rows = ranked(Array.from({ length: TOP_LIMIT }, (_, i) => `p${i}`));
  const view = boardView({ rows, mine: entry("me", 3) }, "me");
  assert.equal(view.rows.length, TOP_LIMIT + 1);
  const last = view.rows.at(-1);
  assert.deepEqual(last, {
    entry: { ...entry("me", 3), rank: "50+" },
    me: true,
    pinned: true,
  });
  assert.equal(
    view.rows.slice(0, -1).some((row) => row.pinned || row.me),
    false,
  );
});

test("a viewer already in the top isn't pinned twice", () => {
  const view = boardView({ rows: ranked(["a", "me"]), mine: entry("me") }, "me");
  assert.equal(view.rows.length, 2);
  assert.equal(
    view.rows.some((row) => row.pinned),
    false,
  );
});

test("someone else's entry is never pinned as the viewer's", () => {
  const view = boardView({ rows: ranked(["a"]), mine: entry("other") }, "me");
  assert.deepEqual(
    view.rows.map((row) => row.entry.uid),
    ["a"],
  );
});

test("an empty board says so; one with only the viewer's entry shows it pinned", () => {
  assert.deepEqual(boardView({ rows: [], mine: null }, "me"), { status: BOARD_EMPTY, rows: [] });
  const solo = boardView({ rows: [], mine: entry("me") }, "me");
  assert.equal(solo.status, "");
  assert.deepEqual(
    solo.rows.map((row) => [row.entry.rank, row.pinned]),
    [["50+", true]],
  );
});

test("the board's copy is the fixes-and-leaderboards spec's", () => {
  assert.equal(BOARD_EMPTY, "No scores yet. Be the first!");
  assert.equal(BOARD_FAILED, "Leaderboard didn't load.");
  const game = fs.readFileSync("app/index.js", "utf8");
  // the failed load shows BOARD_FAILED and the Try again button
  const failed = game.slice(
    game.indexOf("const loadLeaderboard"),
    game.indexOf('$("leaderboardsBtn").onclick'),
  );
  assert.match(
    failed,
    /board\.status\.textContent = BOARD_FAILED;\s+board\.retry\.style\.display = "inline-block";/,
  );
  assert.match(failed, /totalView\(await totalBoard\.load\(\), uid\)/);
});

// --- the game never reads the boards from Firestore

test("the game asks the board functions and never reads a board from Firestore", () => {
  const daily = fs.readFileSync("app/firebase/daily.js", "utf8");
  assert.match(daily, /"getDailyBoard", \{ seed \}/);
  const endless = fs.readFileSync("app/firebase/endless.js", "utf8");
  assert.match(endless, /"getEndlessBoard", \{\}/);
  const totals = fs.readFileSync("app/firebase/totals.js", "utf8");
  assert.match(totals, /"getTotalBoard", \{\}/);
  for (const [file, source] of [
    ["daily", daily],
    ["endless", endless],
    ["totals", totals],
  ]) {
    assert.doesNotMatch(source, /getDocs?\(|onSnapshot|collection\(|storeApi/, file);
  }
  const game = fs.readFileSync("app/index.js", "utf8");
  assert.doesNotMatch(game, /\.top\(|\.mine\(/);
});

test("PRIVACY.md says what a board entry holds and that no time of a run leaves the server", () => {
  const policy = fs.readFileSync("PRIVACY.md", "utf8");
  const section = policy.slice(
    policy.indexOf("### Leaderboards\n"),
    policy.indexOf("### Leaderboard Profile"),
  );
  assert.ok(section.length > 0, "a Leaderboards section before the profile");
  assert.match(section, /New entries store no date or time of day of the run\./);
  assert.match(section, /never shown to players/);
  assert.match(section, /never when an entry was created or last changed/);
  assert.match(section, /top 50 and your own entry/);
  assert.match(section, /Deleting your account in Settings deletes your entries too\./);
});
