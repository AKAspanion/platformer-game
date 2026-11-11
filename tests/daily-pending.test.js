import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createPending } from "../app/daily/pending";

const KEY = "daily_pending";
const NOW = Date.UTC(2026, 10, 11, 12);

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

const run = (seed = 20261111, score = 500, seconds = 120) => ({ seed, score, seconds });
const stored = (storage) => JSON.parse(storage.getItem(KEY));

test("a pending run for an open seed is sent once and removed", async () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run());
  const sent = [];
  const send = async (r) => sent.push(r);
  assert.deepEqual(await pending.flush(send, NOW), { sent: 1, kept: 0, dropped: 0 });
  assert.deepEqual(sent, [run()]);
  assert.deepEqual(stored(storage), {});
  assert.deepEqual(await pending.flush(send, NOW), { sent: 0, kept: 0, dropped: 0 });
  assert.equal(sent.length, 1);
});

test("a run whose send rejects is kept", async () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run());
  const result = await pending.flush(async () => Promise.reject(new Error("offline")), NOW);
  assert.deepEqual(result, { sent: 0, kept: 1, dropped: 0 });
  assert.deepEqual(stored(storage), { 20261111: run() });
});

test("a run for a closed seed is dropped without sending", async () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run(20261101));
  let calls = 0;
  const result = await pending.flush(async () => calls++, NOW);
  assert.deepEqual(result, { sent: 0, kept: 0, dropped: 1 });
  assert.equal(calls, 0);
  assert.deepEqual(stored(storage), {});
});

test("saving a second run for a seed keeps only the higher score", () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run(20261111, 500, 100));
  pending.save(run(20261111, 800, 150));
  pending.save(run(20261111, 600, 90));
  assert.deepEqual(stored(storage), { 20261111: run(20261111, 800, 150) });
});

test("runs for different seeds are kept side by side", () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run(20261110));
  pending.save(run(20261111));
  assert.deepEqual(Object.keys(stored(storage)).sort(), ["20261110", "20261111"]);
});

test("corrupt storage and bad runs are ignored", async () => {
  const storage = memoryStorage({ [KEY]: "{not json" });
  const pending = createPending(storage);
  pending.save({ seed: "x", score: NaN, seconds: 1 });
  assert.equal(storage.getItem(KEY), "{not json");
  assert.deepEqual(await pending.flush(async () => {}, NOW), { sent: 0, kept: 0, dropped: 0 });
  const odd = memoryStorage({
    [KEY]: JSON.stringify({ 20261111: { seed: 20261111, score: "9" } }),
  });
  assert.deepEqual(await createPending(odd).flush(async () => {}, NOW), {
    sent: 0,
    kept: 0,
    dropped: 0,
  });
});

test("a run saved while another is being sent is not lost", async () => {
  const storage = memoryStorage();
  const pending = createPending(storage);
  pending.save(run(20261111, 500));
  await pending.flush(async () => {
    pending.save(run(20261110, 300));
  }, NOW);
  assert.deepEqual(stored(storage), { 20261110: run(20261110, 300) });
});

test("works without storage, in memory", async () => {
  const pending = createPending(null);
  pending.save(run());
  const sent = [];
  await pending.flush(async (r) => sent.push(r), NOW);
  assert.equal(sent.length, 1);
});

const refused = (code) => Object.assign(new Error("refused"), { code });

test("a run the server refuses as invalid or closed is dropped, not kept", async () => {
  for (const code of ["functions/invalid-argument", "failed-precondition"]) {
    const storage = memoryStorage();
    const pending = createPending(storage);
    pending.save(run());
    const result = await pending.flush(async () => Promise.reject(refused(code)), NOW);
    assert.deepEqual(result, { sent: 0, kept: 0, dropped: 1 }, code);
    assert.deepEqual(stored(storage), {}, code);
  }
});

test("a run that fails with unavailable or resource-exhausted is kept", async () => {
  for (const code of ["functions/unavailable", "functions/resource-exhausted"]) {
    const storage = memoryStorage();
    const pending = createPending(storage);
    pending.save(run());
    const result = await pending.flush(async () => Promise.reject(refused(code)), NOW);
    assert.deepEqual(result, { sent: 0, kept: 1, dropped: 0 }, code);
    assert.deepEqual(stored(storage), { 20261111: run() }, code);
  }
});
