import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { handleSubmitEndless, ENDLESS_LIMIT } from "../functions/src/endless.js";
import { compareRuns } from "../functions/shared/modes/endless-rules.js";
import { generatedName } from "../functions/shared/daily/rules.js";
import { fakeTickets, ticketed } from "./tickets-fake.js";

const SEED = 20261111;
const NOW = Date.UTC(2026, 10, 11, 12);
const now = () => NOW;
// a level-N run that takes long enough and scores nothing (always rankable)
const runOf = (level, score = 0, seconds = level * 30) => ({ seed: SEED, level, score, seconds });

const user = (uid = "u1", name = "Ana") => ({
  uid,
  token: { name, firebase: { sign_in_provider: "google.com" } },
});
const anonymous = (uid = "a1") => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });

/** In-memory board with the same shape index.js builds on Firestore. */
function fakeBoard(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    sets: 0,
    async get(uid) {
      return entries.get(uid) || null;
    },
    async set(uid, entry) {
      this.sets++;
      entries.set(uid, entry);
    },
    async rankOf(entry) {
      return 1 + [...entries.values()].filter((other) => compareRuns(other, entry) < 0).length;
    },
    async count() {
      return entries.size;
    },
  };
}
const open = async () => false;
// every run gets a valid ticket unless the test gives one (tests/run-tickets.test.js tests them)
const submit = (auth, data, deps = {}) => {
  const tickets = deps.tickets || fakeTickets();
  const sent = ticketed(tickets, auth, "endless", data, now());
  return handleSubmitEndless(
    { auth, data: sent },
    { board: fakeBoard(), limiter: open, now, ...deps, tickets },
  );
};
const rejected = (code, message) => (e) =>
  e.code === code && (message === undefined || e.message === message);

test("submitEndless needs an account", async () => {
  const board = fakeBoard();
  await assert.rejects(submit(null, runOf(5), { board }), rejected("unauthenticated"));
  await assert.rejects(submit({ token: {} }, runOf(5), { board }), rejected("unauthenticated"));
  assert.equal(board.sets, 0);
});

test("submitEndless refuses a run the rules refuse and stores nothing", async () => {
  const board = fakeBoard();
  const bad = [
    { ...runOf(5), level: 1 },
    { ...runOf(5), level: 501 },
    { ...runOf(5), level: 2.5 },
    { ...runOf(5), seconds: 1 },
    { ...runOf(5), seconds: NaN },
    { ...runOf(5), score: 99999999 },
    { ...runOf(5), score: -1 },
    { ...runOf(5), seed: "x" },
    null,
    [],
  ];
  for (const data of bad) {
    await assert.rejects(
      submit(user(), data, { board }),
      rejected("invalid-argument", "That run can't be ranked."),
    );
  }
  assert.equal(board.sets, 0);
});

test("submitEndless allows 30 runs an hour and refuses the 31st", async () => {
  const board = fakeBoard();
  const calls = [];
  const limiter = async (uid, kind, max) => {
    calls.push([uid, kind, max]);
    return calls.length > ENDLESS_LIMIT;
  };
  assert.equal(ENDLESS_LIMIT, 30);
  for (let i = 0; i < 30; i++) await submit(user(), runOf(5), { board, limiter });
  assert.deepEqual(calls[0], ["u1", "endless", 30]);
  const stored = board.sets;
  await assert.rejects(
    submit(user(), runOf(9), { board, limiter }),
    rejected("resource-exhausted", "Too many scores, try again in a minute."),
  );
  assert.equal(board.sets, stored);
});

test("submitEndless names the entry from the server, never the request", async () => {
  const board = fakeBoard();
  await submit(user("u1", "Ana"), { ...runOf(5), name: "Hacker", uid: "victim" }, { board });
  assert.equal(board.entries.get("u1").name, "Ana");
  assert.equal(board.entries.get("u1").uid, "u1");
  assert.equal(board.entries.has("victim"), false);
  await submit(anonymous("a1"), { ...runOf(5), name: "Hacker" }, { board });
  assert.equal(board.entries.get("a1").name, generatedName("a1"));
  assert.deepEqual(Object.keys(board.entries.get("u1")).sort(), [
    "level",
    "name",
    "score",
    "seconds",
    "seed",
    "uid",
    "updatedAt",
  ]);
  assert.equal(board.entries.get("u1").updatedAt, NOW);
});

test("submitEndless keeps the best run: level, then score, then time", async () => {
  const board = fakeBoard();
  const first = await submit(user(), runOf(9, 100, 400), { board });
  assert.deepEqual(first, {
    rank: 1,
    total: 1,
    best: { level: 9, score: 100, seconds: 400 },
    improved: true,
  });

  const lower = await submit(user(), runOf(8, 500, 300), { board });
  assert.equal(lower.improved, false);
  assert.deepEqual(lower.best, { level: 9, score: 100, seconds: 400 });
  assert.equal(board.entries.get("u1").level, 9);

  const worseScore = await submit(user(), runOf(9, 50, 300), { board });
  assert.equal(worseScore.improved, false);
  const slower = await submit(user(), runOf(9, 100, 500), { board });
  assert.equal(slower.improved, false);
  assert.equal(board.sets, 1);

  const higherScore = await submit(user(), runOf(9, 200, 450), { board });
  assert.equal(higherScore.improved, true);
  assert.equal(board.entries.get("u1").score, 200);
  const faster = await submit(user(), runOf(9, 200, 350), { board });
  assert.equal(faster.improved, true);
  assert.equal(board.entries.get("u1").seconds, 350);
  const deeper = await submit(user(), runOf(10, 0, 400), { board });
  assert.equal(deeper.improved, true);
  assert.equal(board.entries.get("u1").level, 10);
});

test("rankOf orders level, then score, then time", async () => {
  const board = fakeBoard({
    a: { uid: "a", level: 9, score: 100, seconds: 400 },
    b: { uid: "b", level: 9, score: 100, seconds: 500 },
    c: { uid: "c", level: 8, score: 900, seconds: 300 },
  });
  assert.equal(await board.rankOf(board.entries.get("a")), 1);
  assert.equal(await board.rankOf(board.entries.get("b")), 2);
  assert.equal(await board.rankOf(board.entries.get("c")), 3);
  // a new player's run slots in with the same rule and the response says so
  const out = await submit(user("d"), runOf(9, 100, 450), { board });
  assert.equal(out.rank, 2);
  assert.equal(out.total, 4);
});

// ------------------------------------------------ check-functions-public.js

/** Runs the checker against a local server; `answer(name)` is the status it gives each function. */
async function checker(answer) {
  const paths = [];
  const server = http.createServer((req, res) => {
    const name = req.url.slice(1);
    paths.push(name);
    req.resume();
    res.writeHead(answer(name), { "Content-Type": "application/json" });
    res.end('{"error":{"status":"UNAUTHENTICATED"}}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await new Promise((resolve) => {
      execFile(
        process.execPath,
        ["scripts/check-functions-public.js", base],
        { cwd: process.cwd() },
        (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr, paths }),
      );
    });
  } finally {
    server.close();
  }
}

test("check-functions-public calls every callable and skips the HTTP and scheduled ones", async () => {
  const out = await checker(() => 401);
  assert.equal(out.code, 0, out.stderr);
  for (const name of ["submitEndlessScore", "submitDailyScore", "deleteAccount", "designWorld"]) {
    assert.ok(out.paths.includes(name), name);
  }
  assert.equal(out.paths.includes("worldPage"), false);
  assert.equal(out.paths.includes("pickWorldOfWeek"), false);
});

test("check-functions-public passes when every callable answers 400 or 401", async () => {
  assert.equal((await checker((name) => (name.length % 2 ? 400 : 401))).code, 0);
});

test("check-functions-public exits 1 naming each function that answers 403", async () => {
  const out = await checker((name) =>
    name === "submitEndlessScore" || name === "deleteAccount" ? 403 : 401,
  );
  assert.equal(out.code, 1);
  assert.match(out.stderr, /submitEndlessScore/);
  assert.match(out.stderr, /deleteAccount/);
  assert.doesNotMatch(out.stderr, /submitDailyScore/);
});

test("submitEndless rate limits before checking the run", async () => {
  const order = [];
  const limiter = async () => {
    order.push("limit");
    return true;
  };
  await assert.rejects(
    submit(user(), { ...runOf(5), score: 99999999 }, { limiter }),
    rejected("resource-exhausted"),
  );
  assert.deepEqual(order, ["limit"]);
});
