import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { handleGetProfiles } from "../functions/src/profiles.js";
import { PROFILE_BATCH } from "../functions/shared/profiles/rules.js";

const user = (uid = "viewer") => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });

/**
 * players/{uid} as the admin SDK would hand it back: every stored field, plus
 * the document's create and update times, which must never reach a client.
 */
function fakeProfiles(docs = {}) {
  const store = {
    reads: [],
    async getAll(uids) {
      store.reads.push(uids);
      return uids
        .filter((uid) => Object.hasOwn(docs, uid))
        .map((uid) => ({
          uid,
          data: docs[uid],
          createTime: "2026-11-11T14:09:51.853403Z",
          updateTime: "2026-11-11T14:09:51.853403Z",
        }));
    },
    // a handler that writes fails loudly
    async set() {
      throw new Error("getProfiles wrote a profile");
    },
    async delete() {
      throw new Error("getProfiles deleted a profile");
    },
  };
  return store;
}

const ask = (uids, deps = {}, auth = user()) =>
  handleGetProfiles({ auth, data: { uids } }, { profiles: fakeProfiles(), ...deps });
const rejected = (code) => (e) => e.code === code;
const uidsOf = (n) => Array.from({ length: n }, (_, i) => `p${i}`);

test("getProfiles needs an account (the board signs in first)", async () => {
  const profiles = fakeProfiles({ a: { skin: "mint", hat: "cap", companion: "none" } });
  await assert.rejects(ask(["a"], { profiles }, null), rejected("unauthenticated"));
  await assert.rejects(ask(["a"], { profiles }, { token: {} }), rejected("unauthenticated"));
  assert.equal(profiles.reads.length, 0);
});

test("getProfiles takes 1 to 30 uids and refuses 31 before reading anything", async () => {
  const profiles = fakeProfiles();
  await assert.doesNotReject(ask(uidsOf(1), { profiles }));
  await assert.doesNotReject(ask(uidsOf(PROFILE_BATCH), { profiles }));
  assert.equal(PROFILE_BATCH, 30);
  await assert.rejects(ask(uidsOf(PROFILE_BATCH + 1), { profiles }), rejected("invalid-argument"));
  await assert.rejects(ask([], { profiles }), rejected("invalid-argument"));
  assert.deepEqual(
    profiles.reads.map((r) => r.length),
    [1, 30],
  );
});

test("getProfiles refuses anything but a list of distinct non-empty string uids", async () => {
  const profiles = fakeProfiles();
  const bad = [
    undefined,
    null,
    "a",
    42,
    { 0: "a", length: 1 },
    ["a", "a"],
    [""],
    ["a", 7],
    ["a", null],
    [["a"]],
    [{ uid: "a" }],
    ["x".repeat(129)],
    // not a document id: a path, the dot names and Firestore's reserved __name__ form
    ["a/b/c"],
    ["."],
    [".."],
    ["__proto__"],
    ["__name__"],
  ];
  for (const uids of bad) {
    await assert.rejects(
      ask(uids, { profiles }),
      rejected("invalid-argument"),
      JSON.stringify(uids),
    );
  }
  for (const data of [null, undefined, "uids", [["a"]], { uids: "a" }]) {
    await assert.rejects(
      handleGetProfiles({ auth: user(), data }, { profiles }),
      rejected("invalid-argument"),
    );
  }
  assert.equal(profiles.reads.length, 0);
  // the longest uid Firebase Auth issues is fine
  await assert.doesNotReject(ask(["x".repeat(128)], { profiles }));
});

test("getProfiles returns only skin, hat, companion and seenDay: no times, no other field", async () => {
  const profiles = fakeProfiles({
    a: {
      skin: "gold",
      hat: "crown",
      companion: "ptero",
      seenDay: 20768,
      name: "Rex",
      email: "rex@example.com",
      createTime: "2026-11-11T14:09:51Z",
      updateTime: "2026-11-11T14:09:51Z",
      seenAt: 1762870191853,
    },
  });
  const result = await ask(["a"], { profiles });
  assert.deepEqual(result, {
    a: { skin: "gold", hat: "crown", companion: "ptero", seenDay: 20768 },
  });
  assert.doesNotMatch(JSON.stringify(result), /Time|name|email|seenAt|2026-11-11/);
});

test("getProfiles cleans each profile like the game does", async () => {
  const profiles = fakeProfiles({
    unknown: { skin: "rainbow", hat: "<img src=x>", companion: "constructor", seenDay: 20768 },
    double: { skin: "mint", hat: "cap", companion: "none", seenDay: 20768.5 },
    text: { skin: "mint", hat: "cap", companion: "none", seenDay: "20768" },
    none: { skin: "mint", hat: "cap", companion: "none" },
    junk: "not a profile",
  });
  const result = await ask(["unknown", "double", "text", "none", "junk"], { profiles });
  assert.deepEqual(result.unknown, {
    skin: "classic",
    hat: "none",
    companion: "none",
    seenDay: 20768,
  });
  // a bad seenDay is dropped, key and all
  for (const uid of ["double", "text", "none"]) {
    assert.deepEqual(result[uid], { skin: "mint", hat: "cap", companion: "none" }, uid);
  }
  assert.equal(Object.hasOwn(result, "junk"), false);
});

test("getProfiles leaves out uids with no profile and rows it did not ask for", async () => {
  const profiles = fakeProfiles({ a: { skin: "mint", hat: "cap", companion: "none" } });
  profiles.getAll = async () => [
    { uid: "a", data: { skin: "mint", hat: "cap", companion: "none" } },
    { uid: "zzz", data: { skin: "gold", hat: "crown", companion: "none" } },
  ];
  const result = await ask(["a", "b"], { profiles });
  assert.deepEqual(Object.keys(result), ["a"]);
});

test("getProfiles reads exactly the uids asked for, once, and never writes", async () => {
  const profiles = fakeProfiles({ a: { skin: "mint", hat: "cap", companion: "none" } });
  await ask(["a", "b", "c"], { profiles });
  assert.deepEqual(profiles.reads, [["a", "b", "c"]]);
});

test("index.js exports getProfiles as a callable that reads players with a field mask", () => {
  const index = fs.readFileSync("functions/index.js", "utf8");
  assert.match(index, /export const getProfiles = callable\(/);
  assert.match(index, /handleGetProfiles\(request, \{ profiles: playerProfiles \}\)/);
  const adapter = index.slice(
    index.indexOf("const playerProfiles"),
    index.indexOf("export const getProfiles"),
  );
  assert.match(adapter, /fieldMask: PROFILE_FIELDS/);
  assert.match(adapter, /data: snap\.data\(\)/);
  assert.doesNotMatch(adapter, /createTime|updateTime|\.set\(|\.update\(|\.delete\(/);
});

test("the game asks getProfiles and never reads players/{uid} from Firestore", () => {
  const client = fs.readFileSync("app/firebase/profiles.js", "utf8");
  assert.match(client, /httpsCallable\(fb\.functions, "getProfiles"\)/);
  assert.doesNotMatch(client, /getDocs?\(|onSnapshot|collection\(/);
});
