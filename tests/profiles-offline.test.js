/**
 * Spec §4.2: "A failed or offline call caches nothing, so the next board open
 * asks again." Only a real getProfiles answer is cached; the board shows
 * classic dinos meanwhile.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createProfiles } from "../app/profiles";
import { profileRows } from "../app/firebase/profiles";
import { loadProfiles, rowLooks } from "../app/profiles/avatar";

const GOLD = { skin: "gold", hat: "crown", companion: "none", seenDay: 20000 };

/** getProfiles as the game's backend sees it: answers, or fails like an offline callable. */
function callable() {
  const backend = {
    calls: 0,
    answer: null, // a function giving the call's result, or throwing
    async getMany(uids) {
      backend.calls += 1;
      return profileRows(await backend.answer(uids));
    },
    async set() {},
  };
  return backend;
}

const offline = () => {
  throw Object.assign(new Error("internal"), { code: "functions/unavailable" });
};

function quiet(fn) {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args);
  return Promise.resolve()
    .then(fn)
    .finally(() => (console.warn = warn))
    .then((value) => ({ value, warned }));
}

const boardOpen = (profiles, uids) =>
  loadProfiles(uids, { fetch: (list) => profiles.fetch(list), isCurrent: () => true });

test("offline: the board shows classic dinos, caches nothing, and the next open asks again", async () => {
  const backend = callable();
  const profiles = createProfiles({ backend, storage: { getItem: () => null, setItem() {} } });
  backend.answer = offline;
  const first = await quiet(() => boardOpen(profiles, ["a", "b"]));
  assert.equal(first.value, null, "classic dinos for now");
  assert.deepEqual(first.warned, [["Profiles failed:", "functions/unavailable"]]);
  const looks = rowLooks([{ uid: "a" }], new Map(), 20000);
  assert.equal(looks[0].profile, null);

  backend.answer = () => ({ a: GOLD });
  const second = await boardOpen(profiles, ["a", "b"]);
  assert.equal(backend.calls, 2, "asked again");
  assert.deepEqual(second.get("a"), GOLD);
  assert.equal(second.has("b"), false);

  // a real answer is cached: the third open asks nothing
  await boardOpen(profiles, ["a", "b"]);
  assert.equal(backend.calls, 2);
});

test("a malformed answer is a failure, never a board of players with no profile", async () => {
  for (const bad of [null, undefined, "x", 3, [], [["a", GOLD]]]) {
    assert.throws(() => profileRows(bad), /getProfiles/, JSON.stringify(bad));
  }
  const backend = callable();
  const profiles = createProfiles({ backend, storage: { getItem: () => null, setItem() {} } });
  backend.answer = () => null;
  const first = await quiet(() => boardOpen(profiles, ["a"]));
  assert.equal(first.value, null);
  backend.answer = () => ({ a: GOLD });
  const second = await boardOpen(profiles, ["a"]);
  assert.equal(backend.calls, 2);
  assert.deepEqual(second.get("a"), GOLD);
});

test("an empty answer is real: those players have no profile, and it is cached", async () => {
  assert.deepEqual(profileRows({}), []);
  const backend = callable();
  const profiles = createProfiles({ backend, storage: { getItem: () => null, setItem() {} } });
  backend.answer = () => ({});
  await boardOpen(profiles, ["a"]);
  await boardOpen(profiles, ["a"]);
  assert.equal(backend.calls, 1);
});

test("one failed batch of two caches neither", async () => {
  const backend = callable();
  const profiles = createProfiles({ backend, storage: { getItem: () => null, setItem() {} } });
  const uids = Array.from({ length: 40 }, (_, i) => `p${i}`);
  let call = 0;
  backend.answer = () => {
    call += 1;
    if (call === 2) offline();
    return {};
  };
  await quiet(() => boardOpen(profiles, uids));
  backend.answer = () => ({});
  await boardOpen(profiles, uids);
  assert.equal(backend.calls, 4, "both batches asked again");
});
