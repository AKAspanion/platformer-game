/**
 * The combined leaderboard in the game (app/leaderboard): one call loads it,
 * campaign levels are sent with their ticket and never a name, and the screen
 * shows the top three on the podium and the viewer's own row, always.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createTotalBoard } from "../app/leaderboard/total-board";
import { totalView, shortScore, TOTAL_EMPTY, NO_RANK, YOU } from "../app/leaderboard/view";
import { TOP_LIMIT } from "../app/daily/leaderboard";

const entry = (uid, score = 100) => ({ uid, name: `N ${uid}`, score });
const ranked = (uids) => uids.map((uid, i) => ({ ...entry(uid, 1000 - i), rank: i + 1 }));

test("totalBoard.load asks getTotalBoard once and ranks the rows, shown fields only", async () => {
  const calls = [];
  const board = createTotalBoard({
    call: async () => ({}),
    board: async () => (
      calls.push("board"),
      { top: [{ ...entry("a", 9), parts: { endless: 9 } }, entry("b", 5)], me: entry("b", 5) }
    ),
  });
  assert.deepEqual(await board.load(), {
    rows: [
      { uid: "a", name: "N a", score: 9, rank: 1 },
      { uid: "b", name: "N b", score: 5, rank: 2 },
    ],
    mine: { uid: "b", name: "N b", score: 5 },
  });
  assert.deepEqual(calls, ["board"]);
});

test("totalBoard.submitCampaign sends the level, score, time and ticket, never a name", async () => {
  const calls = [];
  const board = createTotalBoard({ call: async (...args) => (calls.push(args), { total: 5 }) });
  await board.submitCampaign({ level: 7, score: 300, seconds: 41.5, ticket: "t", name: "x" });
  assert.deepEqual(calls, [
    ["submitCampaignScore", { level: 7, score: 300, seconds: 41.5, ticket: "t" }],
  ]);
});

test("the podium holds the top three; empty steps wait", () => {
  const view = totalView({ rows: ranked(["a", "b"]), mine: null }, "me");
  assert.deepEqual(
    view.podium.map((e) => e && e.uid),
    ["a", "b", null],
  );
  assert.equal(view.status, "");
  assert.deepEqual(totalView({ rows: [], mine: null }, "me").status, TOTAL_EMPTY);
});

test("the viewer's own row is always pinned: on the board, below it, or not yet on it", () => {
  const onBoard = totalView({ rows: ranked(["a", "me"]), mine: entry("me") }, "me");
  assert.deepEqual(onBoard.mine, { entry: onBoard.rows[1].entry, ranked: true });
  assert.equal(onBoard.rows[1].me, true);

  const rows = ranked(Array.from({ length: TOP_LIMIT }, (_, i) => `p${i}`));
  const below = totalView({ rows, mine: entry("me", 3) }, "me");
  assert.deepEqual(below.mine, { entry: { ...entry("me", 3), rank: "50+" }, ranked: true });
  assert.equal(
    below.rows.some((row) => row.me),
    false,
  );

  const none = totalView({ rows: ranked(["a"]), mine: entry("other") }, "me");
  assert.deepEqual(none.mine, {
    entry: { uid: "me", name: YOU, score: 0, rank: NO_RANK },
    ranked: false,
  });
});

test("a podium score stays short: whole below 100k, then k and M, never rounded up", () => {
  assert.equal(shortScore(98765), "98765");
  assert.equal(shortScore(123456), "123.4k");
  assert.equal(shortScore(999999), "999.9k");
  assert.equal(shortScore(1248000), "1.2M");
});
