/**
 * The profile follows the account's merged save: no profile write happens in
 * a session until cloud save has merged the account's save (worn items and the
 * last-online switch), so a fresh or stale device never publishes its local
 * defaults over the account's look.
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createProfileGate } from "../app/profiles/gate";
import { createProfiles } from "../app/profiles";
import { createCloudSave } from "../app/progress/cloud";
import { emptyProgress, readLocal, writeLocal, SAVE_VERSION } from "../app/progress/save";
import { DAY_MS } from "../app/profiles/rules";

const CLASSIC = { skin: "classic", hat: "none", fireball: "classic", companion: "none" };
const GOLD = { skin: "gold", hat: "crown", fireball: "classic", companion: "ptero" };

function memoryStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function gateWith(read) {
  const calls = [];
  const gate = createProfileGate({
    sync: (uid, worn, options) => calls.push({ uid, worn, ...options }),
    read,
  });
  return { gate, calls };
}

test("before the merge nothing is written; the merge writes once with the merged look", () => {
  let worn = CLASSIC;
  const { gate, calls } = gateWith(() => ({ worn, showLastSeen: true }));
  gate.start("u1");
  gate.changed(); // the player wore something, or flipped the switch
  gate.changed();
  assert.equal(calls.length, 0);
  worn = GOLD; // what the merge wrote to the device
  gate.merged("u1");
  assert.deepEqual(calls, [{ uid: "u1", worn: GOLD, showLastSeen: true }]);
  gate.changed();
  assert.equal(calls.length, 2);
});

test("a merge for another account, or one after sign-out, writes nothing", () => {
  const { gate, calls } = gateWith(() => ({ worn: GOLD, showLastSeen: true }));
  gate.merged("u1"); // not started
  gate.start("u2");
  gate.merged("u1"); // a stale run of the previous account
  assert.equal(calls.length, 0);
  gate.stop();
  gate.merged("u2");
  gate.changed();
  assert.equal(calls.length, 0);
});

test("starting a new account holds writes again until its own merge", () => {
  const { gate, calls } = gateWith(() => ({ worn: GOLD, showLastSeen: false }));
  gate.start("u1");
  gate.merged("u1");
  assert.equal(calls.length, 1);
  gate.start("u2");
  gate.changed();
  assert.equal(calls.length, 1);
  gate.merged("u2");
  assert.deepEqual(calls[1], { uid: "u2", worn: GOLD, showLastSeen: false });
});

// ---- with the real cloud save and profile writer

function deviceWith(remote) {
  const storage = memoryStorage();
  const local = { read: () => readLocal(storage), write: (p) => writeLocal(p, storage) };
  const saveBackend = {
    failGet: false,
    async get(uid) {
      if (saveBackend.failGet) throw new Error("offline");
      return remote[uid] || null;
    },
    async set(uid, save) {
      remote[uid] = save;
    },
    async update(uid, step) {
      const save = step(await saveBackend.get(uid));
      if (save) await saveBackend.set(uid, save);
      return save;
    },
  };
  const writes = [];
  const profiles = createProfiles({
    backend: {
      async set(uid, profile) {
        writes.push({ uid, profile });
      },
      async getMany() {
        return [];
      },
    },
    storage,
    now: () => 20000 * DAY_MS,
  });
  const gate = createProfileGate({
    sync: (uid, worn, options) => profiles.sync(uid, worn, options),
    read: () => {
      const progress = readLocal(storage);
      return { worn: progress.wallet.worn, showLastSeen: progress.lastSeen.on };
    },
  });
  const timers = { setTimeout: () => 0, clearTimeout() {} };
  const cloud = createCloudSave({
    backend: saveBackend,
    local,
    timers,
    onMerge: (uid) => gate.merged(uid),
  });
  return { storage, saveBackend, cloud, gate, writes };
}

const accountSave = (worn, wornAt, lastSeen = { on: true, changedAt: 0 }) => ({
  v: SAVE_VERSION,
  updatedAt: 50,
  data: { ...emptyProgress(), wallet: { ...emptyProgress().wallet, worn, wornAt }, lastSeen },
});

test("a fresh device publishes the account's look, never its own defaults", async () => {
  const { cloud, gate, writes } = deviceWith({ u1: accountSave(GOLD, 500) });
  gate.start("u1");
  const started = cloud.start("u1");
  gate.changed(); // the shell's own sync calls while the pull is in flight
  assert.equal(writes.length, 0);
  await started;
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].profile.skin, "gold");
  assert.equal(writes[0].profile.hat, "crown");
  assert.equal(writes[0].profile.companion, "ptero");
});

test("the account's switch, off, is what the first write follows", async () => {
  const save = accountSave(GOLD, 500, { on: false, changedAt: 400 });
  const { cloud, gate, writes } = deviceWith({ u1: save });
  gate.start("u1");
  await cloud.start("u1");
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 1);
  assert.equal(Object.hasOwn(writes[0].profile, "seenDay"), false);
});

test("offline at start: no profile write until a later sync merges the account's save", async () => {
  const { cloud, gate, saveBackend, writes } = deviceWith({ u1: accountSave(GOLD, 500) });
  saveBackend.failGet = true;
  gate.start("u1");
  await cloud.start("u1");
  gate.changed();
  assert.equal(writes.length, 0);
  saveBackend.failGet = false;
  cloud.changed();
  await cloud.flush(); // the next push pulls and merges first
  await new Promise((r) => setImmediate(r));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].profile.skin, "gold");
});

test("the game starts the gate with cloud save and writes the profile only through it", () => {
  const index = fs.readFileSync("app/index.js", "utf8");
  assert.match(index, /onMerge: \(uid\) => profileGate\.merged\(uid\)/);
  const syncCloud = index.slice(
    index.indexOf("const syncCloud = "),
    index.indexOf("auth.onAuthStateChanged(syncCloud)"),
  );
  assert.match(syncCloud, /profileGate\.start\(user\.uid\);\s*cloud\.start\(user\.uid\)/);
  assert.match(syncCloud, /profileGate\.stop\(\)/);
  assert.doesNotMatch(syncCloud, /syncProfile\(\)|profiles\.sync/);
  // every other profile write goes through the gate
  assert.equal(index.match(/profiles\.sync\(/g), null);
});

test("an after-merge step that throws is logged, and cloud save still sends the merge", async () => {
  const remote = {};
  const storage = memoryStorage();
  writeLocal({ ...emptyProgress(), highScore: 40 }, storage);
  const cloud = createCloudSave({
    backend: {
      async update(uid, step) {
        const save = step(remote[uid] || null);
        if (save) remote[uid] = save;
        return save;
      },
    },
    local: { read: () => readLocal(storage), write: (p) => writeLocal(p, storage) },
    timers: { setTimeout: () => 0, clearTimeout() {} },
    onMerge: () => {
      throw new TypeError("boom");
    },
  });
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args);
  try {
    await cloud.start("u1");
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(warned, [["Cloud save: after-merge step failed:", "TypeError"]]);
  assert.equal(remote.u1.data.highScore, 40);
});
