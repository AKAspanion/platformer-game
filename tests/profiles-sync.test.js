import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createProfiles } from "../app/profiles";
import { createLastSeen } from "../app/progress/last-seen";
import { DAY_MS, PROFILE_BATCH } from "../app/profiles/rules";

const DAY = 20000;
const worn = (changes = {}) => ({ skin: "mint", hat: "cap", companion: "none", ...changes });

function fakeStorage({ broken = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem(key) {
      if (broken) throw new Error("blocked");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (broken) throw new Error("blocked");
      map.set(key, String(value));
    },
  };
}

function fakeBackend(docs = {}) {
  const backend = {
    docs,
    sets: [],
    gets: [],
    failSet: false,
    failGet: false,
    async set(uid, profile) {
      backend.sets.push({ uid, profile });
      if (backend.failSet) throw new Error("permission-denied");
    },
    async getMany(uids) {
      backend.gets.push(uids);
      if (backend.failGet) throw new Error("offline");
      return uids
        .filter((uid) => uid in backend.docs)
        .map((uid) => ({ uid, data: backend.docs[uid] }));
    },
  };
  return backend;
}

function setup(options = {}) {
  const backend = fakeBackend(options.docs);
  const storage = options.storage || fakeStorage();
  const clock = { ms: DAY * DAY_MS + 1000 };
  const profiles = createProfiles({ backend, storage, now: () => clock.ms });
  return { backend, storage, clock, profiles };
}

const on = { showLastSeen: true };
const off = { showLastSeen: false };

test("cloud save starting writes the worn items and today's day once", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  assert.deepEqual(backend.sets, [
    { uid: "u1", profile: { skin: "mint", hat: "cap", companion: "none", seenDay: DAY } },
  ]);
});

test("opening again the same day with the same items writes nothing", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  await profiles.sync("u1", worn(), on);
  assert.equal(backend.sets.length, 1);
});

test("the next UTC day writes the new seenDay", async () => {
  const { backend, clock, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  clock.ms += DAY_MS;
  await profiles.sync("u1", worn(), on);
  assert.equal(backend.sets.length, 2);
  assert.equal(backend.sets[1].profile.seenDay, DAY + 1);
});

test("wearing a new item writes it", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  await profiles.sync("u1", worn({ hat: "crown" }), on);
  assert.equal(backend.sets.length, 2);
  assert.equal(backend.sets[1].profile.hat, "crown");
});

test("switching last online off writes once without seenDay, then stays quiet on later days", async () => {
  const { backend, clock, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  await profiles.sync("u1", worn(), off);
  assert.equal(backend.sets.length, 2);
  assert.equal(Object.hasOwn(backend.sets[1].profile, "seenDay"), false);
  for (let i = 0; i < 3; i++) {
    clock.ms += DAY_MS;
    await profiles.sync("u1", worn(), off);
  }
  assert.equal(backend.sets.length, 2);
});

test("with the switch off a new skin is written without seenDay", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), off);
  await profiles.sync("u1", worn({ skin: "gold" }), off);
  assert.equal(backend.sets.length, 2);
  assert.equal(backend.sets[1].profile.skin, "gold");
  assert.equal(Object.hasOwn(backend.sets[1].profile, "seenDay"), false);
});

test("switching it back on writes today's seenDay", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), off);
  await profiles.sync("u1", worn(), on);
  assert.equal(backend.sets.length, 2);
  assert.equal(backend.sets[1].profile.seenDay, DAY);
});

test("a failed write resolves quietly, keeps the record and is not retried in a loop", async () => {
  const { backend, storage, profiles } = setup();
  backend.failSet = true;
  await assert.doesNotReject(profiles.sync("u1", worn(), on));
  assert.equal(backend.sets.length, 1); // no retry loop
  assert.equal(storage.map.has("profile"), false);
  backend.failSet = false;
  await profiles.sync("u1", worn(), on); // the next open or change tries again
  assert.equal(backend.sets.length, 2);
  assert.ok(storage.map.has("profile"));
});

test("a failed write leaves an earlier record unchanged", async () => {
  const { backend, storage, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  const before = storage.map.get("profile");
  backend.failSet = true;
  await profiles.sync("u1", worn({ hat: "crown" }), on);
  assert.equal(storage.map.get("profile"), before);
});

test("switching off while offline: the next successful write has no seenDay", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  backend.failSet = true;
  await profiles.sync("u1", worn(), off);
  backend.failSet = false;
  await profiles.sync("u1", worn(), off);
  const last = backend.sets[backend.sets.length - 1].profile;
  assert.equal(Object.hasOwn(last, "seenDay"), false);
  assert.equal(backend.sets.length, 3);
});

test("a different account writes its own profile and never touches the first one's", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("u1", worn(), on);
  await profiles.sync("u2", worn(), on);
  assert.deepEqual(
    backend.sets.map((s) => s.uid),
    ["u1", "u2"],
  );
});

test("without a usable uid nothing is written", async () => {
  const { backend, profiles } = setup();
  await profiles.sync("", worn(), on);
  await profiles.sync(null, worn(), on);
  await profiles.sync({ uid: "u1" }, worn(), on);
  assert.equal(backend.sets.length, 0);
});

test("storage that throws still writes, it just can't skip repeats", async () => {
  const { backend, profiles } = setup({ storage: fakeStorage({ broken: true }) });
  await profiles.sync("u1", worn(), on);
  await profiles.sync("u1", worn(), on);
  assert.equal(backend.sets.length, 2);
});

test("a corrupt record is treated as nothing written", async () => {
  const storage = fakeStorage();
  storage.map.set("profile", "{not json");
  const { backend, profiles } = setup({ storage });
  await profiles.sync("u1", worn(), on);
  assert.equal(backend.sets.length, 1);
});

test("a profile never carries more than the worn slots and seenDay", async () => {
  const { backend, profiles } = setup();
  await profiles.sync(
    "u1",
    { skin: "mint", hat: "cap", companion: "none", name: "Ann", extra: 1 },
    on,
  );
  assert.deepEqual(Object.keys(backend.sets[0].profile).sort(), [
    "companion",
    "hat",
    "seenDay",
    "skin",
  ]);
});

test("fetch asks in batches of 30 and then answers from the session cache", async () => {
  const { backend, profiles } = setup();
  const uids = Array.from({ length: 51 }, (_, i) => `p${i}`);
  await profiles.fetch(uids);
  assert.deepEqual(
    backend.gets.map((g) => g.length),
    [PROFILE_BATCH, 21],
  );
  await profiles.fetch(uids);
  assert.equal(backend.gets.length, 2);
});

test("fetch returns cleaned profiles and leaves out uids with no document", async () => {
  const { profiles } = setup({
    docs: { a: { skin: "mint", hat: "<script>", companion: "none", seenDay: 5, name: "x" } },
  });
  const map = await profiles.fetch(["a", "b"]);
  assert.deepEqual([...map.keys()], ["a"]);
  assert.deepEqual(map.get("a"), { skin: "mint", hat: "none", companion: "none", seenDay: 5 });
});

test("fetch ignores a row for a uid it did not ask for", async () => {
  const { backend, profiles } = setup();
  backend.getMany = async () => [{ uid: "zzz", data: { skin: "mint" } }];
  const map = await profiles.fetch(["a"]);
  assert.equal(map.size, 0);
});

test("fetch rejects when the backend does, and caches nothing for those uids", async () => {
  const { backend, profiles } = setup({
    docs: { a: { skin: "mint", hat: "cap", companion: "none" } },
  });
  backend.failGet = true;
  await assert.rejects(profiles.fetch(["a"]));
  backend.failGet = false;
  const map = await profiles.fetch(["a"]);
  assert.equal(backend.gets.length, 2);
  assert.ok(map.has("a"));
});

test("Settings has the last-online row, on by default", () => {
  assert.equal(createLastSeen(fakeStorage()).on(), true);
  const html = fs.readFileSync("app/index.html", "utf8");
  assert.match(html, /Show when I was last online[\s\S]*?id="setLastSeen"/);
});
