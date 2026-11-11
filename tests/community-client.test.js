import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createCommunity } from "../app/worlds/community-client";
import { FirestoreRepository, starterWorlds } from "../app/worlds/repository";
import { specFromPrompt, newWorld } from "../app/worlds/spec";

const NOW = Date.UTC(2026, 10, 11, 12);

function setup(overrides = {}) {
  const log = [];
  const backend = {
    async call(name, data) {
      log.push(["call", name, data]);
      return { counted: true };
    },
    async stats(ids) {
      log.push(["stats", ids]);
      return {};
    },
    async trending(limit) {
      log.push(["trending", limit]);
      return [];
    },
    async featured() {
      return null;
    },
    async likedBy(uid, ids) {
      log.push(["likedBy", uid, ids]);
      return new Set();
    },
    async week(ids, days) {
      log.push(["week", ids, days]);
      return {};
    },
    ...overrides,
  };
  const ensurePlayer = async () => {
    log.push(["ensurePlayer"]);
    return { uid: "u1" };
  };
  return { log, backend, community: createCommunity(backend, { ensurePlayer, now: () => NOW }) };
}

test("recordPlay skips built-in worlds", async () => {
  const { log, community } = setup();
  await community.recordPlay("starter-meadow", "play");
  await community.recordPlay("starfall-peaks", "finish");
  assert.deepEqual(log, []);
});

test("recordPlay makes the account first, then records once", async () => {
  const { log, community } = setup();
  await community.recordPlay("wabc", "play");
  assert.deepEqual(log, [
    ["ensurePlayer"],
    ["call", "recordWorldPlay", { worldId: "wabc", kind: "play" }],
  ]);
});

test("recordPlay never throws, offline or without an account", async () => {
  const offline = setup({
    async call() {
      throw new Error("No connection.");
    },
  });
  await assert.doesNotReject(offline.community.recordPlay("wabc", "finish"));
  const noAccount = createCommunity(setup().backend, {
    ensurePlayer: async () => {
      throw new Error("Couldn't check your account. Try again.");
    },
  });
  await assert.doesNotReject(noAccount.recordPlay("wabc", "play"));
});

test("toggleLike returns the result and rejects with the server's message", async () => {
  const ok = setup({
    async call(name, data) {
      assert.equal(name, "toggleWorldLike");
      assert.deepEqual(data, { worldId: "wabc" });
      return { liked: true, likes: 4 };
    },
  });
  assert.deepEqual(await ok.community.toggleLike("wabc"), { liked: true, likes: 4 });
  assert.equal(ok.log[0][0], "ensurePlayer");

  const slow = setup({
    async call() {
      throw Object.assign(new Error("Slow down a little, try again in a minute."), {
        code: "functions/resource-exhausted",
      });
    },
  });
  await assert.rejects(slow.community.toggleLike("wabc"), {
    message: "Slow down a little, try again in a minute.",
  });
});

test("trending leaves built-in ids out and asks for the top 30", async () => {
  const { log, community } = setup({
    async trending(limit) {
      log.push(["trending", limit]);
      return ["wone", "starter-meadow", "wtwo", "starfall-peaks"];
    },
  });
  assert.deepEqual(await community.trending(), ["wone", "wtwo"]);
  assert.deepEqual(log[0], ["trending", 30]);
});

test("featured is an id or null, never a built-in", async () => {
  assert.equal(await setup({ featured: async () => "wabc" }).community.featured(), "wabc");
  assert.equal(await setup({ featured: async () => null }).community.featured(), null);
  assert.equal(await setup({ featured: async () => "starter-frost" }).community.featured(), null);
});

test("myWeek asks for the last 7 day keys and sums the worlds", async () => {
  const { log, community } = setup({
    async week(ids, days) {
      log.push(["week", ids, days]);
      return {
        w1: { plays: 100, finishes: 30, likes: 10 },
        w2: { plays: 20, finishes: 7, likes: 5 },
      };
    },
  });
  const week = await community.myWeek(["w1", "w2", "starter-meadow"]);
  const [, ids, days] = log.find((entry) => entry[0] === "week");
  assert.deepEqual(ids, ["w1", "w2"]);
  assert.deepEqual(days, [
    "20261105",
    "20261106",
    "20261107",
    "20261108",
    "20261109",
    "20261110",
    "20261111",
  ]);
  assert.deepEqual(week, {
    plays: 120,
    finishes: 37,
    likes: 15,
    perWorld: {
      w1: { plays: 100, finishes: 30, likes: 10 },
      w2: { plays: 20, finishes: 7, likes: 5 },
    },
  });
});

test("myWeek keeps a world the server has no record of at zero", async () => {
  const week = await setup().community.myWeek(["w1"]);
  assert.deepEqual(week, {
    plays: 0,
    finishes: 0,
    likes: 0,
    perWorld: { w1: { plays: 0, finishes: 0, likes: 0 } },
  });
});

test("liked([]) and stats([]) call nothing", async () => {
  const { log, community } = setup();
  assert.deepEqual([...(await community.liked([]))], []);
  assert.deepEqual(await community.stats([]), {});
  assert.deepEqual(await community.liked(["starter-meadow"]), new Set());
  assert.deepEqual(log, []);
});

test("liked asks with the player's uid; stats fills zeros for worlds without counts", async () => {
  const { log, community } = setup({
    async likedBy(uid, ids) {
      log.push(["likedBy", uid, ids]);
      return new Set(["w1"]);
    },
    async stats() {
      return { w1: { plays: 3, finishes: 1, likes: 2 }, constructor: { plays: 9 } };
    },
  });
  assert.deepEqual([...(await community.liked(["w1", "w2"]))], ["w1"]);
  assert.deepEqual(log[1], ["likedBy", "u1", ["w1", "w2"]]);
  assert.deepEqual(await community.stats(["w1", "w2", "constructor"]), {
    w1: { plays: 3, finishes: 1, likes: 2 },
    w2: { plays: 0, finishes: 0, likes: 0 },
    constructor: { plays: 9, finishes: 0, likes: 0 },
  });
});

test("repo.publish sends the thumb along, and nothing extra without one", async () => {
  const made = newWorld(specFromPrompt("reef"), { uid: "u1", displayName: "Kai" });
  const calls = [];
  const repo = new FirestoreRepository({
    async publish(world, options) {
      calls.push(options);
      return world;
    },
  });
  await repo.publish(made, { thumb: "data:image/webp;base64,AAAA" });
  await repo.publish(made);
  assert.deepEqual(calls, [{ thumb: "data:image/webp;base64,AAAA" }, {}]);
});

test("repo.byIds returns the worlds that exist, sanitized", async () => {
  const [one] = starterWorlds();
  const repo = new FirestoreRepository({
    async get(id) {
      return id === "wone1" ? { ...one, id: "wone1" } : id === "bad" ? { id: "bad id!" } : null;
    },
  });
  const found = await repo.byIds(["wone1", "missing", "bad"]);
  assert.deepEqual(
    found.map((w) => w.id),
    ["wone1"],
  );
  assert.deepEqual(await repo.byIds([]), []);
});
