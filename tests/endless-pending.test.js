import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createEndlessPending } from "../app/modes/endless-pending";

const KEY = "endless_pending";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const run = (level = 7, score = 400, seconds = 200, seed = 1234) => ({
  seed,
  level,
  score,
  seconds,
});
const stored = (storage) => JSON.parse(storage.getItem(KEY));

test("only the better of two saved runs is kept", () => {
  const storage = memoryStorage();
  const pending = createEndlessPending(storage);
  pending.save(run(7));
  pending.save(run(5, 900));
  assert.deepEqual(stored(storage), run(7));
});

test("a better later run replaces the kept one", () => {
  const storage = memoryStorage();
  const pending = createEndlessPending(storage);
  pending.save(run(5));
  pending.save(run(7));
  assert.deepEqual(stored(storage), run(7));
});

test("flush sends the kept run once and removes it", async () => {
  const storage = memoryStorage();
  const pending = createEndlessPending(storage);
  pending.save(run(7));
  const sent = [];
  const send = async (r) => sent.push(r);
  assert.deepEqual(await pending.flush(send), { sent: 1, kept: 0, dropped: 0 });
  assert.deepEqual(sent, [run(7)]);
  assert.equal(storage.getItem(KEY), null);
  assert.deepEqual(await pending.flush(send), { sent: 0, kept: 0, dropped: 0 });
  assert.equal(sent.length, 1);
});

test("a failed send keeps the run", async () => {
  const storage = memoryStorage();
  const pending = createEndlessPending(storage);
  pending.save(run(7));
  const result = await pending.flush(async () => Promise.reject(new Error("offline")));
  assert.deepEqual(result, { sent: 0, kept: 1, dropped: 0 });
  assert.deepEqual(stored(storage), run(7));
});

test("a run refused with invalid-argument is dropped", async () => {
  const storage = memoryStorage();
  const pending = createEndlessPending(storage);
  pending.save(run(7));
  const error = Object.assign(new Error("no"), { code: "functions/invalid-argument" });
  const result = await pending.flush(async () => Promise.reject(error));
  assert.deepEqual(result, { sent: 0, kept: 0, dropped: 1 });
  assert.equal(storage.getItem(KEY), null);
});

test("corrupt or malformed stored data is ignored", async () => {
  const pending = createEndlessPending(memoryStorage({ [KEY]: "{nope" }));
  assert.deepEqual(await pending.flush(async () => {}), { sent: 0, kept: 0, dropped: 0 });
  const bad = createEndlessPending(
    memoryStorage({ [KEY]: JSON.stringify({ seed: "x", level: 3 }) }),
  );
  assert.deepEqual(await bad.flush(async () => {}), { sent: 0, kept: 0, dropped: 0 });
});

test("a run saved below the ranked level is not kept", () => {
  const storage = memoryStorage();
  createEndlessPending(storage).save(run(1));
  assert.equal(storage.getItem(KEY), null);
});
