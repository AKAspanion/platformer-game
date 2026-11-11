import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_LIMIT, handleSubmitDaily, outranks, rankIn } from "../functions/src/daily.js";
import { handleDeleteAccount } from "../functions/src/handlers.js";
import { dailyScoreCeiling, generatedName } from "../functions/shared/daily/rules.js";

const SEED = 20261111;
const NOW = Date.UTC(2026, 10, 11, 12);
const now = () => NOW;

const user = (uid = "u1", name = "Ana") => ({
  uid,
  token: { name, firebase: { sign_in_provider: "google.com" } },
});
const anonymous = (uid = "a1") => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });

/** In-memory scores store with the same shape index.js builds on Firestore. */
function fakeScores(initial = {}) {
  const days = new Map(
    Object.entries(initial).map(([seed, v]) => [seed, new Map(Object.entries(v))]),
  );
  const day = (seed) => {
    if (!days.has(String(seed))) days.set(String(seed), new Map());
    return days.get(String(seed));
  };
  return {
    days,
    sets: 0,
    async get(seed, uid) {
      return day(seed).get(uid) || null;
    },
    async set(seed, uid, entry) {
      this.sets++;
      day(seed).set(uid, entry);
    },
    async rankOf(seed, entry) {
      return rankIn([...day(seed).values()], entry);
    },
    async count(seed) {
      return day(seed).size;
    },
  };
}
const open = async () => false;
const run = (auth, data, deps) =>
  handleSubmitDaily({ auth, data }, { scores: fakeScores(), limiter: open, now, ...deps });
const rejected = (code, message) => (e) =>
  e.code === code && (message === undefined || e.message === message);
const CANT_RANK = "That run can't be ranked.";

test("submitDaily needs an account", async () => {
  const scores = fakeScores();
  await assert.rejects(
    run(null, { seed: SEED, score: 100, seconds: 60 }, { scores }),
    rejected("unauthenticated"),
  );
  await assert.rejects(
    run({ token: {} }, { seed: SEED, score: 100, seconds: 60 }, { scores }),
    rejected("unauthenticated"),
  );
  assert.equal(scores.sets, 0);
});

test("submitDaily refuses a closed day", async () => {
  const scores = fakeScores();
  await assert.rejects(
    run(user(), { seed: 20261109, score: 100, seconds: 60 }, { scores }),
    rejected("failed-precondition", "That daily challenge has closed."),
  );
  for (const seed of [undefined, "20261111", 20261111.5, 20261340, null]) {
    await assert.rejects(
      run(user(), { seed, score: 100, seconds: 60 }, { scores }),
      rejected("failed-precondition"),
    );
  }
  assert.equal(scores.sets, 0);
});

test("submitDaily refuses scores no run can reach, and stores nothing", async () => {
  const scores = fakeScores();
  const ceiling = dailyScoreCeiling(SEED);
  const bad = [ceiling + 1, -1, 12.5, "100", NaN, Infinity, null, undefined, {}, [100]];
  for (const score of bad) {
    await assert.rejects(
      run(user(), { seed: SEED, score, seconds: 60 }, { scores }),
      rejected("invalid-argument", CANT_RANK),
      `score ${String(score)}`,
    );
  }
  assert.equal(scores.sets, 0);
  // the ceiling itself and zero are possible runs
  await run(user(), { seed: SEED, score: ceiling, seconds: 60 }, { scores });
  await run(user("u2"), { seed: SEED, score: 0, seconds: 60 }, { scores });
  assert.equal(scores.sets, 2);
});

test("submitDaily refuses times that are too fast, too slow or not numbers", async () => {
  const scores = fakeScores();
  for (const seconds of [29, 7201, NaN, Infinity, "60", null, undefined, -60]) {
    await assert.rejects(
      run(user(), { seed: SEED, score: 100, seconds }, { scores }),
      rejected("invalid-argument", CANT_RANK),
      `seconds ${String(seconds)}`,
    );
  }
  assert.equal(scores.sets, 0);
  await run(user(), { seed: SEED, score: 100, seconds: 30 }, { scores });
  await run(user("u2"), { seed: SEED, score: 100, seconds: 7200 }, { scores });
  assert.equal(scores.sets, 2);
});

test("submitDaily refuses a request without a body", async () => {
  const scores = fakeScores();
  for (const data of [null, undefined, "x", 5, []]) {
    await assert.rejects(run(user(), data, { scores }), (e) => e.code === "failed-precondition");
  }
  assert.equal(scores.sets, 0);
});

test("submitDaily is rate limited per user and counts hourly runs", async () => {
  const scores = fakeScores();
  const seen = [];
  await assert.rejects(
    run(
      user(),
      { seed: SEED, score: 100, seconds: 60 },
      {
        scores,
        limiter: async (uid, kind, max) => {
          seen.push([uid, kind, max]);
          return true;
        },
      },
    ),
    rejected("resource-exhausted", "Too many scores, try again in a minute."),
  );
  assert.deepEqual(seen, [["u1", "daily", DAILY_LIMIT]]);
  assert.equal(DAILY_LIMIT, 30);
  assert.equal(scores.sets, 0);
});

test("submitDaily names the entry from the server, never the request", async () => {
  const scores = fakeScores();
  await run(user("u1", "Ana"), { seed: SEED, score: 100, seconds: 60, name: "Hacker" }, { scores });
  assert.equal((await scores.get(SEED, "u1")).name, "Ana");
  await run(anonymous("a1"), { seed: SEED, score: 100, seconds: 60, name: "Hacker" }, { scores });
  assert.equal((await scores.get(SEED, "a1")).name, generatedName("a1"));
});

test("submitDaily stores only the validated fields under the caller's uid", async () => {
  const scores = fakeScores();
  await run(
    user("u1"),
    { seed: SEED, score: 100, seconds: 60, uid: "victim", extra: "x" },
    { scores },
  );
  assert.equal(await scores.get(SEED, "victim"), null);
  assert.deepEqual(await scores.get(SEED, "u1"), {
    uid: "u1",
    name: "Ana",
    score: 100,
    seconds: 60,
    updatedAt: NOW,
  });
});

test("submitDaily keeps each player's best run", async () => {
  const scores = fakeScores();
  const first = await run(user(), { seed: SEED, score: 4000, seconds: 200 }, { scores });
  assert.equal(first.improved, true);
  assert.deepEqual(first.best, { score: 4000, seconds: 200 });

  const worse = await run(user(), { seed: SEED, score: 3900, seconds: 150 }, { scores });
  assert.equal(worse.improved, false);
  assert.deepEqual(worse.best, { score: 4000, seconds: 200 });
  assert.equal((await scores.get(SEED, "u1")).score, 4000);
  assert.equal((await scores.get(SEED, "u1")).seconds, 200);
  assert.equal(scores.sets, 1);

  const same = await run(user(), { seed: SEED, score: 4000, seconds: 200 }, { scores });
  assert.equal(same.improved, false);

  const faster = await run(user(), { seed: SEED, score: 4000, seconds: 190 }, { scores });
  assert.equal(faster.improved, true);
  assert.deepEqual(faster.best, { score: 4000, seconds: 190 });
  assert.equal((await scores.get(SEED, "u1")).seconds, 190);

  const higher = await run(user(), { seed: SEED, score: 4100, seconds: 900 }, { scores });
  assert.equal(higher.improved, true);
});

test("ranks put the higher score first and the shorter time first on a tie", () => {
  const a = { score: 4000, seconds: 200 };
  const b = { score: 4000, seconds: 180 };
  const c = { score: 3500, seconds: 100 };
  const entries = [a, b, c];
  assert.deepEqual(
    [a, b, c].map((e) => rankIn(entries, e)),
    [2, 1, 3],
  );
  assert.equal(outranks(b, a), true);
  assert.equal(outranks(a, b), false);
  assert.equal(outranks(a, a), false);
  assert.equal(outranks(a, c), true);
});

test("submitDaily answers with rank and total", async () => {
  const scores = fakeScores({
    [SEED]: {
      x: { uid: "x", name: "X", score: 4000, seconds: 180 },
      y: { uid: "y", name: "Y", score: 3500, seconds: 100 },
    },
  });
  const out = await run(user("u1"), { seed: SEED, score: 4000, seconds: 200 }, { scores });
  assert.deepEqual(out, { rank: 2, total: 3, best: { score: 4000, seconds: 200 }, improved: true });
});

test("deleteAccount removes the caller's scores from every day before the account", async () => {
  const scores = fakeScores({
    20261110: { u9: { uid: "u9" }, other: { uid: "other" } },
    20261111: { u9: { uid: "u9" } },
  });
  const calls = [];
  const accounts = {
    anonymizeWorlds: async () => 0,
    deleteDailyScores: async (uid) => {
      calls.push("scores");
      for (const day of scores.days.values()) day.delete(uid);
    },
    deleteEndless: async () => calls.push("endless"),
    deleteSave: async () => calls.push("save"),
    deleteProfile: async () => calls.push("profile"),
    deleteReminders: async () => calls.push("reminders"),
    deleteData: async () => calls.push("data"),
    deleteUser: async () => calls.push("user"),
  };
  await handleDeleteAccount({ auth: user("u9") }, { accounts });
  assert.deepEqual(calls, ["scores", "endless", "save", "profile", "reminders", "data", "user"]);
  assert.equal(await scores.get(20261110, "u9"), null);
  assert.equal(await scores.get(20261111, "u9"), null);
  assert.ok(await scores.get(20261110, "other"));

  // the account stays when its scores couldn't be deleted
  calls.length = 0;
  accounts.deleteDailyScores = async () => {
    throw new Error("down");
  };
  await assert.rejects(handleDeleteAccount({ auth: user("u9") }, { accounts }), /down/);
  assert.deepEqual(calls, []);
});
