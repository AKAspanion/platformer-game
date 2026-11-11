import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createPlayed, MAX_PLAYED } from "../app/worlds/played.js";

const memory = () => {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
};

test("played worlds: a marked world is played, others aren't", () => {
  const played = createPlayed(memory());
  assert.equal(played.has("wlavalake1"), false);
  played.mark("wlavalake1");
  assert.equal(played.has("wlavalake1"), true);
  assert.equal(played.has("wcandyland"), false);
});

test("played worlds: marking twice keeps one entry, and it survives a new instance", () => {
  const store = memory();
  createPlayed(store).mark("wlavalake1");
  createPlayed(store).mark("wlavalake1");
  assert.deepEqual(JSON.parse(store.data.played_worlds), ["wlavalake1"]);
  assert.equal(createPlayed(store).has("wlavalake1"), true);
});

test("played worlds: the oldest drop off past the limit", () => {
  const store = memory();
  const played = createPlayed(store);
  for (let i = 0; i <= MAX_PLAYED; i++) played.mark(`world${i}`);
  assert.equal(played.has("world0"), false);
  assert.equal(played.has(`world${MAX_PLAYED}`), true);
  assert.equal(JSON.parse(store.data.played_worlds).length, MAX_PLAYED);
});

test("played worlds: corrupt, blocked or full storage never throws", () => {
  const corrupt = memory();
  corrupt.data.played_worlds = "{not json";
  assert.equal(createPlayed(corrupt).has("w1abc"), false);
  createPlayed(corrupt).mark("w1abc");
  assert.equal(createPlayed(corrupt).has("w1abc"), true);

  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() => createPlayed(blocked).mark("w1abc"));
  assert.equal(createPlayed(blocked).has("w1abc"), false);
});

test("played worlds: bad ids are ignored", () => {
  const store = memory();
  const played = createPlayed(store);
  played.mark("");
  played.mark(null);
  played.mark(42);
  assert.equal(store.data.played_worlds, undefined);
});
