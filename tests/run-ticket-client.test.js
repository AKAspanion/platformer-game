import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createRunTickets, TICKET_WAIT_MS } from "../app/modes/run-ticket";
import { createPending } from "../app/daily/pending";
import { createEndlessPending } from "../app/modes/endless-pending";

const signedIn = async () => ({ uid: "u1" });

test("an endless ticket asks the server for the seed, not the client", async () => {
  const sent = [];
  const tickets = createRunTickets({
    call: async (name, data) => (sent.push([name, data]), { ticket: "t1", seed: 77, startedAt: 1 }),
    ensurePlayer: signedIn,
  });
  assert.deepEqual(await tickets.start("endless"), { ticket: "t1", seed: 77 });
  assert.deepEqual(sent, [["startRun", { mode: "endless" }]]);
  await tickets.start("daily", 20261111);
  assert.deepEqual(sent[1], ["startRun", { mode: "daily", seed: 20261111 }]);
});

test("offline, refused or odd answers give no ticket: the run plays unranked", async () => {
  const offline = createRunTickets({
    call: async () => assert.fail(),
    ensurePlayer: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await offline.start("endless"), null);
  const refused = createRunTickets({
    call: async () => {
      throw Object.assign(new Error("busy"), { code: "functions/resource-exhausted" });
    },
    ensurePlayer: signedIn,
  });
  assert.equal(await refused.start("endless"), null);
  const odd = createRunTickets({ call: async () => ({ seed: "x" }), ensurePlayer: signedIn });
  assert.equal(await odd.start("endless"), null);
});

test("a slow server: endless stops waiting, daily keeps waiting in the background", async () => {
  let timer = null;
  let answer;
  const tickets = createRunTickets({
    call: () => new Promise((resolve) => (answer = resolve)),
    ensurePlayer: signedIn,
    setTimer: (fn, ms) => {
      assert.equal(ms, TICKET_WAIT_MS);
      timer = fn;
    },
  });
  const endless = tickets.start("endless");
  await Promise.resolve();
  timer();
  assert.equal(await endless, null);

  timer = null;
  const daily = tickets.start("daily", 20261111, { wait: Infinity });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(timer, null, "no timeout for the daily ticket");
  answer({ ticket: "t2", seed: 20261111 });
  assert.deepEqual(await daily, { ticket: "t2", seed: 20261111 });
});

function memoryStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
  };
}

test("pending runs keep their tickets until they are sent", async () => {
  const daily = createPending(memoryStorage());
  daily.save({ seed: 20261111, score: 100, seconds: 60, ticket: "t1" });
  const sentDaily = [];
  await daily.flush(async (run) => sentDaily.push(run), Date.UTC(2026, 10, 11, 12));
  assert.deepEqual(sentDaily, [{ seed: 20261111, score: 100, seconds: 60, ticket: "t1" }]);

  const endless = createEndlessPending(memoryStorage());
  endless.save({ seed: 5, level: 3, score: 10, seconds: 50, ticket: "t2" });
  const sentEndless = [];
  await endless.flush(async (run) => sentEndless.push(run));
  assert.deepEqual(sentEndless, [{ seed: 5, level: 3, score: 10, seconds: 50, ticket: "t2" }]);
});
