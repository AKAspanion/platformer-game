/**
 * The combined leaderboard (functions/src/totals.js, getTotalBoard in
 * functions/src/boards.js): one all-time score per player, the sum of their
 * best per campaign level, per daily challenge and in endless.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  raisedTotal,
  handleSubmitCampaign,
  CAMPAIGN_LIMIT,
  dailyPart,
  levelPart,
  ENDLESS_PART,
} from "../functions/src/totals.js";
import { handleGetTotalBoard, TOTAL_FIELDS, BOARD_TOP } from "../functions/src/boards.js";
import { handleSubmitDaily } from "../functions/src/daily.js";
import { handleSubmitEndless } from "../functions/src/endless.js";
import { handleStartRun, CAMPAIGN_RUN_LIMIT } from "../functions/src/runs.js";
import { levelScoreCeiling } from "../functions/shared/campaign/score-rules.js";
import { compareRuns } from "../functions/shared/modes/endless-rules.js";
import { rankIn } from "../functions/src/daily.js";
import { fakeTickets, ticketed } from "./tickets-fake.js";

const SEED = 20261111;
const NOW = Date.UTC(2026, 10, 11, 12);
const now = () => NOW;
const open = async () => false;
const user = (uid = "u1", name = "Ana") => ({
  uid,
  token: { name, firebase: { sign_in_provider: "google.com" } },
});
const rejected = (code) => (e) => e.code === code;

/** totals/{uid} with the raise index.js runs in a transaction. */
function fakeTotals(initial = {}) {
  const docs = new Map(Object.entries(initial));
  return {
    docs,
    writes: 0,
    async raise(uid, offer) {
      const next = raisedTotal(docs.get(uid) || null, { uid, ...offer });
      if (next) {
        this.writes++;
        docs.set(uid, next);
      }
      return docs.get(uid) || null;
    },
  };
}

/** A campaign run with a ticket for its level, started an hour ago. */
function campaignRun(tickets, auth, data) {
  const id = `c${String(tickets.docs.size + 1).padStart(19, "0")}`;
  tickets.docs.set(id, {
    uid: auth.uid,
    mode: "campaign",
    seed: data.level,
    startedAt: NOW - 3600 * 1000,
    expiresAt: NOW + 86400000,
    used: false,
  });
  return { ...data, ticket: id };
}

const submitCampaign = (
  auth,
  data,
  { totals = fakeTotals(), tickets = fakeTickets(), limiter = open } = {},
) =>
  handleSubmitCampaign(
    { auth, data: auth ? campaignRun(tickets, auth, data) : data },
    { totals, tickets, limiter, now },
  );

test("raisedTotal keeps each part's best and adds the parts up", () => {
  const first = raisedTotal(null, { uid: "u1", name: "Ana", part: levelPart(1), score: 300 });
  assert.deepEqual(first, { uid: "u1", name: "Ana", score: 300, parts: { "level-1": 300 } });
  const second = raisedTotal(first, { uid: "u1", name: "Ana", part: dailyPart(SEED), score: 900 });
  assert.equal(second.score, 1200);
  // a worse run in a part changes nothing: no write
  assert.equal(
    raisedTotal(second, { uid: "u1", name: "Ana", part: levelPart(1), score: 100 }),
    null,
  );
  // a better one replaces that part only
  const third = raisedTotal(second, { uid: "u1", name: "Ana", part: levelPart(1), score: 500 });
  assert.deepEqual(third.parts, { "level-1": 500, "daily-20261111": 900 });
  assert.equal(third.score, 1400);
  // a new name is written even when the score doesn't move
  const renamed = raisedTotal(third, { uid: "u1", name: "Ana B", part: ENDLESS_PART, score: 0 });
  assert.equal(renamed.name, "Ana B");
  assert.equal(renamed.score, 1400);
});

test("raisedTotal refuses bad parts and scores, and drops bad stored parts", () => {
  const offer = { uid: "u1", name: "Ana" };
  for (const bad of [
    { part: "level-x", score: 5 },
    { part: "daily-1", score: 5 },
    { part: "__proto__", score: 5 },
    { part: "endless", score: -1 },
    { part: "endless", score: 1.5 },
    { part: "endless", score: "9" },
  ]) {
    assert.equal(raisedTotal(null, { ...offer, ...bad }), null, JSON.stringify(bad));
  }
  const stored = {
    uid: "u1",
    name: "Ana",
    score: 1e9,
    parts: { "level-1": 10, junk: 1e9, endless: -5 },
  };
  const next = raisedTotal(stored, { ...offer, part: "level-2", score: 20 });
  assert.deepEqual(next.parts, { "level-1": 10, "level-2": 20 });
  assert.equal(next.score, 30);
});

test("submitCampaignScore needs an account", async () => {
  const totals = fakeTotals();
  await assert.rejects(
    submitCampaign(null, { level: 1, score: 10, seconds: 30 }, { totals }),
    rejected("unauthenticated"),
  );
  assert.equal(totals.writes, 0);
});

test("submitCampaignScore refuses what can't be ranked and stores nothing", async () => {
  const totals = fakeTotals();
  for (const bad of [
    { level: 5, score: 10, seconds: 30 }, // a passage, not a campaign level
    { level: 999, score: 10, seconds: 30 },
    { level: "1", score: 10, seconds: 30 },
    { level: 1, score: -1, seconds: 30 },
    { level: 1, score: 2.5, seconds: 30 },
    { level: 1, score: 10, seconds: 1 },
    { level: 1, score: 10, seconds: 99999 },
    { level: 1, score: 10, seconds: NaN },
  ]) {
    await assert.rejects(
      submitCampaign(user(), bad, { totals }),
      rejected("invalid-argument"),
      JSON.stringify(bad),
    );
  }
  assert.equal(totals.writes, 0);
});

test("submitCampaignScore needs the level's own unused ticket", async () => {
  const totals = fakeTotals();
  const tickets = fakeTickets();
  const run = campaignRun(tickets, user(), { level: 2, score: 100, seconds: 30 });
  // another level's ticket
  await assert.rejects(
    handleSubmitCampaign(
      { auth: user(), data: { ...run, level: 1 } },
      { totals, tickets, limiter: open, now },
    ),
    rejected("invalid-argument"),
  );
  // someone else's
  await assert.rejects(
    handleSubmitCampaign({ auth: user("u2"), data: run }, { totals, tickets, limiter: open, now }),
    rejected("invalid-argument"),
  );
  await handleSubmitCampaign({ auth: user(), data: run }, { totals, tickets, limiter: open, now });
  // used up
  await assert.rejects(
    handleSubmitCampaign({ auth: user(), data: run }, { totals, tickets, limiter: open, now }),
    rejected("invalid-argument"),
  );
  assert.equal(totals.writes, 1);
});

test("submitCampaignScore keeps the level's best, capped at what the level gives", async () => {
  const totals = fakeTotals();
  const tickets = fakeTickets();
  const out = await submitCampaign(
    user(),
    { level: 1, score: 400, seconds: 40 },
    { totals, tickets },
  );
  assert.deepEqual(out, { level: 1, best: 400, total: 400 });
  const worse = await submitCampaign(
    user(),
    { level: 1, score: 100, seconds: 40 },
    { totals, tickets },
  );
  assert.deepEqual(worse, { level: 1, best: 400, total: 400 });
  const other = await submitCampaign(
    user(),
    { level: 2, score: 50, seconds: 40 },
    { totals, tickets },
  );
  assert.deepEqual(other, { level: 2, best: 50, total: 450 });
  const capped = await submitCampaign(
    user(),
    { level: 1, score: 1e9, seconds: 40 },
    { totals, tickets },
  );
  assert.equal(capped.best, levelScoreCeiling(1));
  assert.equal(totals.docs.get("u1").name, "Ana");
});

test("submitCampaignScore is rate limited per account", async () => {
  const asked = [];
  const limiter = async (...args) => (asked.push(args), true);
  await assert.rejects(
    submitCampaign(user(), { level: 1, score: 10, seconds: 30 }, { limiter }),
    rejected("resource-exhausted"),
  );
  assert.deepEqual(asked, [["u1", "campaign", CAMPAIGN_LIMIT]]);
});

test("startRun takes campaign levels only, with their own limit", async () => {
  const tickets = fakeTickets();
  const asked = [];
  const limiter = async (...args) => (asked.push(args), false);
  const start = (data) => handleStartRun({ auth: user(), data }, { tickets, limiter, now });
  for (const seed of [5, 999, "1", undefined]) {
    await assert.rejects(start({ mode: "campaign", seed }), rejected("invalid-argument"));
  }
  const out = await start({ mode: "campaign", seed: 25 });
  assert.equal(out.seed, 25);
  assert.equal(tickets.docs.get(out.ticket).mode, "campaign");
  assert.deepEqual(asked, [["u1", "campaignRun", CAMPAIGN_RUN_LIMIT]]);
});

test("daily and endless scores count towards the total", async () => {
  const totals = fakeTotals();
  const tickets = fakeTickets();
  const day = new Map();
  const scores = {
    get: async (seed, uid) => day.get(uid) || null,
    set: async (seed, uid, entry) => day.set(uid, entry),
    rankOf: async (seed, entry) => rankIn([...day.values()], entry),
    count: async () => day.size,
  };
  const daily = (score) =>
    handleSubmitDaily(
      {
        auth: user(),
        data: ticketed(tickets, user(), "daily", { seed: SEED, score, seconds: 120 }, NOW),
      },
      { scores, totals, tickets, limiter: open, now },
    );
  await daily(600);
  await daily(200); // worse: the day's best stays 600
  assert.deepEqual(totals.docs.get("u1").parts, { "daily-20261111": 600 });

  const entries = new Map();
  const board = {
    get: async (uid) => entries.get(uid) || null,
    set: async (uid, entry) => entries.set(uid, entry),
    rankOf: async (entry) =>
      1 + [...entries.values()].filter((o) => compareRuns(o, entry) < 0).length,
    count: async () => entries.size,
  };
  const endless = (level, score) =>
    handleSubmitEndless(
      {
        auth: user(),
        data: ticketed(
          tickets,
          user(),
          "endless",
          { seed: 77, level, score, seconds: level * 30 },
          NOW,
        ),
      },
      { board, totals, tickets, limiter: open, now },
    );
  await endless(3, 0);
  await endless(2, 0);
  assert.equal(totals.docs.get("u1").score, 600);
});

test("a failed total gives the daily ticket back", async () => {
  const tickets = fakeTickets();
  const totals = {
    raise: async () => {
      throw new Error("firestore down");
    },
  };
  const scores = {
    get: async () => null,
    set: async () => {},
    rankOf: async () => 1,
    count: async () => 1,
  };
  const data = ticketed(tickets, user(), "daily", { seed: SEED, score: 10, seconds: 120 }, NOW);
  await assert.rejects(
    handleSubmitDaily({ auth: user(), data }, { scores, totals, tickets, limiter: open, now }),
    /firestore down/,
  );
  assert.deepEqual(tickets.released, [data.ticket]);
});

test("getTotalBoard hands out name and score only, best first", async () => {
  const stamp = { seconds: 1794405591, nanoseconds: 1 };
  const rows = {
    a: { name: "A", score: 50, parts: { endless: 50 } },
    b: { name: "B", score: 900, parts: { endless: 900 } },
    c: { name: "C", score: "lots" }, // not an entry: left out and logged
  };
  const reads = [];
  const totals = {
    async top(count) {
      reads.push(["top", count]);
      return Object.keys(rows).map((uid) => ({ uid, data: rows[uid], updateTime: stamp }));
    },
    async get(uid) {
      reads.push(["get", uid]);
      return rows[uid] ? { uid, data: rows[uid], updateTime: stamp } : null;
    },
  };
  const logs = [];
  const out = await handleGetTotalBoard(
    { auth: user("a") },
    { totals, log: (m) => logs.push(m), now },
  );
  assert.deepEqual(out, {
    top: [
      { uid: "b", name: "B", score: 900 },
      { uid: "a", name: "A", score: 50 },
    ],
    me: { uid: "a", name: "A", score: 50 },
  });
  assert.deepEqual(reads, [["top", BOARD_TOP]]);
  assert.equal(logs.length, 1);
  assert.deepEqual(TOTAL_FIELDS, ["name", "score"]);

  // signed out: the board, no entry of one's own
  const signedOut = await handleGetTotalBoard({ auth: null }, { totals, log: () => {}, now });
  assert.equal(signedOut.me, null);
  // outside the board: the caller's own entry is read
  const stranger = await handleGetTotalBoard({ auth: user("z") }, { totals, log: () => {}, now });
  assert.equal(stranger.me, null);
});
