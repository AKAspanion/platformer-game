import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  handleStartRun,
  ticketProblem,
  RUN_LIMIT,
  TICKET_TTL_MS,
  SLACK_RATIO,
  SLACK_SECONDS,
} from "../functions/src/runs.js";
import { handleSubmitDaily } from "../functions/src/daily.js";
import { handleSubmitEndless } from "../functions/src/endless.js";
import { rankIn } from "../functions/src/daily.js";
import { compareRuns } from "../functions/shared/modes/endless-rules.js";
import { fakeTickets } from "./tickets-fake.js";

const SEED = 20261111;
const T0 = Date.UTC(2026, 10, 11, 12);
const user = (uid = "u1") => ({
  uid,
  token: { name: "Ana", firebase: { sign_in_provider: "google.com" } },
});
const open = async () => false;
const CANT_RANK = (e) => e.code === "invalid-argument" && e.message === "That run can't be ranked.";

const start = (tickets, data, { auth = user(), at = T0, limiter = open, newSeed } = {}) =>
  handleStartRun({ auth, data }, { tickets, limiter, now: () => at, newSeed });

function fakeScores() {
  const day = new Map();
  return {
    day,
    get: async (seed, uid) => day.get(uid) || null,
    set: async (seed, uid, entry) => day.set(uid, entry),
    rankOf: async (seed, entry) => rankIn([...day.values()], entry),
    count: async () => day.size,
  };
}
function fakeBoard() {
  const entries = new Map();
  return {
    entries,
    get: async (uid) => entries.get(uid) || null,
    set: async (uid, entry) => entries.set(uid, entry),
    rankOf: async (entry) =>
      1 + [...entries.values()].filter((o) => compareRuns(o, entry) < 0).length,
    count: async () => entries.size,
  };
}
const daily = (tickets, data, { auth = user(), at, scores = fakeScores() } = {}) =>
  handleSubmitDaily({ auth, data }, { scores, tickets, limiter: open, now: () => at });
const endless = (tickets, data, { auth = user(), at, board = fakeBoard() } = {}) =>
  handleSubmitEndless({ auth, data }, { board, tickets, limiter: open, now: () => at });

test("startRun needs an account and a known mode", async () => {
  const tickets = fakeTickets();
  await assert.rejects(
    start(tickets, { mode: "daily", seed: SEED }, { auth: null }),
    (e) => e.code === "unauthenticated",
  );
  for (const data of [{ mode: "story" }, {}, null, []]) {
    await assert.rejects(start(tickets, data), CANT_RANK);
  }
  assert.equal(tickets.docs.size, 0);
});

test("startRun: a daily ticket is for an open day only", async () => {
  const tickets = fakeTickets();
  await assert.rejects(
    start(tickets, { mode: "daily", seed: 20261101 }),
    (e) => e.code === "failed-precondition",
  );
  const out = await start(tickets, { mode: "daily", seed: SEED });
  assert.equal(out.seed, SEED);
  assert.equal(out.startedAt, T0);
  const stored = tickets.docs.get(out.ticket);
  assert.equal(stored.uid, "u1");
  assert.equal(stored.mode, "daily");
  assert.equal(stored.used, false);
  assert.equal(stored.expiresAt, T0 + TICKET_TTL_MS.daily);
  assert.ok(stored.expireAt instanceof Date, "a Date for the TTL policy");
});

test("startRun: the server picks the endless seed, never the client", async () => {
  const tickets = fakeTickets();
  const out = await start(tickets, { mode: "endless", seed: 42 }, { newSeed: () => 777 });
  assert.equal(out.seed, 777);
  assert.equal(tickets.docs.get(out.ticket).seed, 777);
  // the real seed source stays in createEndlessSession's range
  const real = await start(tickets, { mode: "endless" });
  assert.ok(Number.isInteger(real.seed) && real.seed >= 1 && real.seed < 1e9);
});

test("startRun is rate limited per account", async () => {
  const tickets = fakeTickets();
  const asked = [];
  await assert.rejects(
    start(tickets, { mode: "endless" }, { limiter: async (...args) => (asked.push(args), true) }),
    (e) => e.code === "resource-exhausted",
  );
  assert.deepEqual(asked, [["u1", "run", RUN_LIMIT]]);
  assert.equal(tickets.docs.size, 0);
});

test("a daily score needs its own unused ticket", async () => {
  const tickets = fakeTickets();
  const { ticket } = await start(tickets, { mode: "daily", seed: SEED });
  const at = T0 + 200 * 1000;
  const runOf = (extra = {}) => ({ seed: SEED, score: 100, seconds: 120, ticket, ...extra });
  await assert.rejects(daily(tickets, runOf({ ticket: undefined }), { at }), CANT_RANK);
  await assert.rejects(daily(tickets, runOf({ ticket: "x" }), { at }), CANT_RANK);
  await assert.rejects(daily(tickets, runOf({ ticket: "a".repeat(20) }), { at }), CANT_RANK);
  await assert.rejects(daily(tickets, runOf(), { at, auth: user("u2") }), CANT_RANK, "not yours");
  await assert.rejects(daily(tickets, runOf({ seed: SEED + 1 }), { at }), CANT_RANK, "another day");
  const out = await daily(tickets, runOf(), { at });
  assert.equal(out.rank, 1);
  await assert.rejects(daily(tickets, runOf(), { at }), CANT_RANK, "used once");
});

test("a run can't claim more time than really passed since its ticket", async () => {
  const tickets = fakeTickets();
  const { ticket } = await start(tickets, { mode: "daily", seed: SEED });
  // 60 real seconds later, a 120 second run is impossible
  await assert.rejects(
    daily(tickets, { seed: SEED, score: 100, seconds: 120, ticket }, { at: T0 + 60000 }),
    CANT_RANK,
  );
  assert.equal(tickets.docs.get(ticket).used, false, "a refused run leaves the ticket unused");
  // within the slack it counts
  const seconds = Math.floor(100 * SLACK_RATIO + SLACK_SECONDS);
  const out = await daily(
    tickets,
    { seed: SEED, score: 100, seconds, ticket },
    { at: T0 + 100000 },
  );
  assert.equal(out.improved, true);
});

test("an expired ticket ranks nothing", () => {
  const ticket = {
    uid: "u1",
    mode: "daily",
    seed: SEED,
    startedAt: T0,
    expiresAt: T0 + 1000,
    used: false,
  };
  const run = { uid: "u1", mode: "daily", seed: SEED, seconds: 30 };
  assert.equal(ticketProblem(ticket, { ...run, now: T0 + 60000 }), "expired");
  assert.equal(ticketProblem(null, { ...run, now: T0 }), "missing");
  assert.equal(
    ticketProblem({ ...ticket, expiresAt: T0 + 1e9 }, { ...run, now: T0 + 60000 }),
    null,
  );
});

test("an endless score must use the ticket's seed", async () => {
  const tickets = fakeTickets();
  const { ticket, seed } = await start(tickets, { mode: "endless" }, { newSeed: () => 4242 });
  const at = T0 + 3600 * 1000;
  const runOf = (extra = {}) => ({ seed, level: 3, score: 0, seconds: 100, ticket, ...extra });
  await assert.rejects(endless(tickets, runOf({ seed: 99 }), { at }), CANT_RANK);
  const { ticket: dailyTicket } = await start(tickets, { mode: "daily", seed: SEED });
  await assert.rejects(endless(tickets, runOf({ ticket: dailyTicket }), { at }), CANT_RANK);
  const out = await endless(tickets, runOf(), { at });
  assert.equal(out.rank, 1);
});

test("a ticket is given back when the score couldn't be stored", async () => {
  const tickets = fakeTickets();
  const { ticket } = await start(tickets, { mode: "daily", seed: SEED });
  const scores = fakeScores();
  scores.set = async () => {
    throw new Error("firestore down");
  };
  const data = { seed: SEED, score: 100, seconds: 60, ticket };
  await assert.rejects(daily(tickets, data, { at: T0 + 100000, scores }), /firestore down/);
  assert.deepEqual(tickets.released, [ticket]);
  assert.equal(tickets.docs.get(ticket).used, false, "the offline queue can send it again");
  const out = await daily(tickets, data, { at: T0 + 100000 });
  assert.equal(out.improved, true);
});
