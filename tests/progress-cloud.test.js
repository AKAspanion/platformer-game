import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createCloudSave, SAVE_DELAY } from "../app/progress/cloud";
import { emptyProgress, mergeProgress, saveBytes, SAVE_VERSION } from "../app/progress/save";

const withProgress = (changes) => ({ ...emptyProgress(), ...changes });
const campaign = (reached, stars = {}) => ({ reached, last: 1, stars, best: {} });
const doc = (data, updatedAt = 50) => ({ v: SAVE_VERSION, updatedAt, data });
const dataOf = (progress) => ({ ...progress, updatedAt: 0 });

function fakeBackend(remote = {}) {
  const calls = { get: [], set: [] };
  const backend = {
    remote,
    calls,
    failGet: false,
    failSet: false,
    async get(uid) {
      calls.get.push(uid);
      if (backend.failGet) throw new Error("offline");
      return Object.hasOwn(backend.remote, uid) ? backend.remote[uid] : null;
    },
    async set(uid, save) {
      calls.set.push([uid, save]);
      if (backend.failSet) throw new Error("server error");
      backend.remote[uid] = save;
    },
    // runs once between the transaction's read and its write: another device's write
    contend: null,
    /** A transaction: the step may run again, on the newer save, when another write lands first. */
    async update(uid, step) {
      let save = step(await backend.get(uid));
      if (backend.contend) {
        const write = backend.contend;
        backend.contend = null;
        write();
        save = step(await backend.get(uid));
      }
      if (save) await backend.set(uid, save);
      return save;
    },
  };
  return backend;
}

function fakeLocal(initial = emptyProgress()) {
  const local = {
    value: initial,
    writes: 0,
    read: () => local.value,
    write(p) {
      local.writes += 1;
      local.value = p;
    },
  };
  return local;
}

function fakeTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    pending,
    setTimeout(fn, ms) {
      const id = nextId++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    async fire() {
      const jobs = [...pending.values()];
      pending.clear();
      jobs.forEach((j) => j.fn());
      await new Promise((r) => setImmediate(r));
    },
  };
}

function setup({ remote, local = emptyProgress() } = {}) {
  const backend = fakeBackend(remote);
  const store = fakeLocal(local);
  const timers = fakeTimers();
  const cloud = createCloudSave({ backend, local: store, timers, now: () => 1000 });
  return { backend, store, timers, cloud };
}

test("no remote save: the local progress is pushed once and the status is saved", async () => {
  const mine = withProgress({ highScore: 40 });
  const { backend, cloud } = setup({ local: mine });
  assert.equal(cloud.status(), "device");
  await cloud.start("u1");
  assert.equal(backend.calls.set.length, 1);
  assert.equal(backend.calls.set[0][0], "u1");
  assert.equal(backend.calls.set[0][1].data.highScore, 40);
  assert.equal(backend.calls.set[0][1].v, SAVE_VERSION);
  assert.equal(backend.calls.set[0][1].updatedAt, 1000);
  assert.equal(cloud.status(), "saved");
});

test("a remote save with stars this device lacks: local gains them and the merge is pushed", async () => {
  const remoteData = withProgress({ campaign: campaign([1, 2, 3], { 1: 7, 2: 5 }) });
  const mine = withProgress({ campaign: campaign([1], { 1: 3 }), highScore: 90 });
  const { backend, store, cloud } = setup({ remote: { u1: doc(remoteData) }, local: mine });
  await cloud.start("u1");
  assert.equal(store.writes, 1);
  assert.deepEqual(store.value.campaign.stars, { 1: 7, 2: 5 });
  assert.equal(store.value.highScore, 90);
  assert.equal(backend.calls.set.length, 1);
  assert.deepEqual(dataOf(backend.calls.set[0][1].data), dataOf(store.value));
});

test("remote already equals the merge: nothing is pushed", async () => {
  const mine = withProgress({ highScore: 10, campaign: campaign([1, 2], { 1: 3 }) });
  const theirs = withProgress({ highScore: 20, campaign: campaign([1, 2], { 1: 5 }) });
  const merged = mergeProgress(mine, theirs);
  const { backend, cloud } = setup({ remote: { u1: doc(merged) }, local: mine });
  await cloud.start("u1");
  assert.equal(backend.calls.set.length, 0);
  assert.equal(cloud.status(), "saved");
});

test("signing in to an existing account: local and remote both end as the merge", async () => {
  const anonymous = withProgress({ highScore: 500, campaign: campaign([1, 2], { 1: 3, 2: 1 }) });
  const account = withProgress({ highScore: 80, campaign: campaign([1, 2, 3], { 1: 7, 3: 5 }) });
  const { backend, store, cloud } = setup({ remote: { existing: doc(account) }, local: anonymous });
  await cloud.start("existing");
  const expected = dataOf(mergeProgress(anonymous, account));
  assert.deepEqual(dataOf(store.value), expected);
  assert.deepEqual(dataOf(backend.remote.existing.data), expected);
  assert.equal(store.value.highScore, 500);
  assert.deepEqual(store.value.campaign.stars, { 1: 7, 2: 1, 3: 5 });
});

test("three changes within 5 s send exactly one push, 5 s after the last", async () => {
  const { backend, store, timers, cloud } = setup();
  await cloud.start("u1");
  backend.calls.set.length = 0;
  store.value = withProgress({ highScore: 5 });
  cloud.changed();
  cloud.changed();
  cloud.changed();
  assert.equal(cloud.status(), "pending");
  assert.equal(timers.pending.size, 1);
  assert.equal([...timers.pending.values()][0].ms, SAVE_DELAY);
  assert.equal(SAVE_DELAY, 5000);
  assert.equal(backend.calls.set.length, 0);
  await timers.fire();
  assert.equal(backend.calls.set.length, 1);
  assert.equal(backend.calls.set[0][1].data.highScore, 5);
  assert.equal(backend.calls.set[0][1].updatedAt, 1000);
  assert.equal(cloud.status(), "saved");
});

test("flush sends a pending change now, and only when something is pending", async () => {
  const { backend, store, timers, cloud } = setup();
  await cloud.start("u1");
  backend.calls.set.length = 0;
  await cloud.flush();
  assert.equal(backend.calls.set.length, 0);
  store.value = withProgress({ highScore: 6 });
  cloud.changed();
  await cloud.flush();
  assert.equal(backend.calls.set.length, 1);
  assert.equal(timers.pending.size, 0);
  assert.equal(cloud.status(), "saved");
  // a change the account already holds is merged, not sent again
  cloud.changed();
  await cloud.flush();
  assert.equal(backend.calls.set.length, 1);
  assert.equal(cloud.status(), "saved");
});

test("a change made while a push is in flight stays pending", async () => {
  const { backend, store, cloud } = setup();
  await cloud.start("u1");
  const update = backend.update;
  backend.update = async (uid, step) => {
    const written = await update(uid, step);
    store.value = withProgress({ highScore: 9 }); // after the push read the device
    cloud.changed();
    return written;
  };
  store.value = withProgress({ highScore: 6 });
  cloud.changed();
  await cloud.flush();
  assert.equal(backend.remote.u1.data.highScore, 6);
  assert.equal(cloud.status(), "pending");
  backend.update = update;
  await cloud.flush();
  assert.equal(backend.remote.u1.data.highScore, 9);
  assert.equal(cloud.status(), "saved");
});

test("a rejected set throws nothing, stays pending, and the next change sends it", async () => {
  const { backend, store, timers, cloud } = setup();
  await cloud.start("u1");
  backend.calls.set.length = 0;
  backend.failSet = true;
  store.value = withProgress({ highScore: 7 });
  cloud.changed();
  await timers.fire();
  assert.equal(backend.calls.set.length, 1);
  assert.equal(cloud.status(), "pending");
  backend.failSet = false;
  cloud.changed();
  await timers.fire();
  assert.equal(backend.calls.set.length, 2);
  assert.equal(backend.remote.u1.data.highScore, 7);
  assert.equal(cloud.status(), "saved");
});

test("a rejected set at start leaves the device copy and the next change retries", async () => {
  const mine = withProgress({ highScore: 9 });
  const { backend, store, timers, cloud } = setup({ local: mine });
  backend.failSet = true;
  await cloud.start("u1");
  assert.equal(cloud.status(), "pending");
  assert.equal(store.value.highScore, 9);
  backend.failSet = false;
  cloud.changed();
  await timers.fire();
  assert.equal(backend.remote.u1.data.highScore, 9);
  assert.equal(cloud.status(), "saved");
});

test("a rejected get at start leaves local alone; a later change pulls before it pushes", async () => {
  const remoteData = withProgress({ campaign: campaign([1, 2], { 2: 5 }) });
  const mine = withProgress({ highScore: 3 });
  const { backend, store, timers, cloud } = setup({ remote: { u1: doc(remoteData) }, local: mine });
  backend.failGet = true;
  await cloud.start("u1");
  assert.equal(store.writes, 0);
  assert.equal(store.value, mine);
  assert.equal(backend.calls.set.length, 0);
  assert.equal(cloud.status(), "pending");

  backend.failGet = false;
  cloud.changed();
  await timers.fire();
  // the account's stars were merged in rather than overwritten
  assert.deepEqual(store.value.campaign.stars, { 2: 5 });
  assert.deepEqual(backend.remote.u1.data.campaign.stars, { 2: 5 });
  assert.equal(backend.remote.u1.data.highScore, 3);
  assert.equal(cloud.status(), "saved");
});

test("a later start retries after a rejected get", async () => {
  const { backend, cloud } = setup({ local: withProgress({ highScore: 4 }) });
  backend.failGet = true;
  await cloud.start("u1");
  backend.failGet = false;
  await cloud.start("u1");
  assert.equal(backend.remote.u1.data.highScore, 4);
  assert.equal(cloud.status(), "saved");
});

test("a save over 100 KB is not sent and nothing throws", async () => {
  const big = withProgress({ campaign: { ...campaign([1]), pad: "x".repeat(102400) } });
  assert.ok(saveBytes(big) > 102400);
  const { backend, store, timers, cloud } = setup({ local: big });
  await cloud.start("u1");
  assert.equal(backend.calls.set.length, 0);
  cloud.changed();
  await timers.fire();
  assert.equal(backend.calls.set.length, 0);
  assert.equal(store.value, big);
});

test("stop after a pending change: the timer is gone, nothing is pushed, local stays", async () => {
  const { backend, store, timers, cloud } = setup();
  await cloud.start("u1");
  backend.calls.set.length = 0;
  store.value = withProgress({ highScore: 12 });
  cloud.changed();
  cloud.stop();
  assert.equal(timers.pending.size, 0);
  await timers.fire();
  assert.equal(backend.calls.set.length, 0);
  assert.equal(store.value.highScore, 12);
  assert.equal(cloud.status(), "device");
  cloud.changed();
  assert.equal(timers.pending.size, 0);
  await cloud.flush();
  assert.equal(backend.calls.set.length, 0);
});

test("stop during a pull: the late answer is ignored", async () => {
  const { backend, store, cloud } = setup({
    remote: { u1: doc(withProgress({ highScore: 99 })) },
    local: withProgress({ highScore: 1 }),
  });
  const started = cloud.start("u1");
  cloud.stop();
  await started;
  assert.equal(store.writes, 0);
  assert.equal(backend.calls.set.length, 0);
});

test("stop while the account's save is being read: nothing is written to it or to the device", async () => {
  const { backend, store, cloud } = setup({
    remote: { u1: doc(withProgress({ highScore: 99 })) },
    local: withProgress({ highScore: 1, campaign: campaign([1], { 1: 3 }) }), // each side lacks something
  });
  const get = backend.get;
  let answer;
  backend.get = (uid) => new Promise((resolve) => (answer = () => resolve(get(uid))));
  const started = cloud.start("u1");
  await new Promise((r) => setImmediate(r)); // the read is in flight
  cloud.stop();
  answer();
  await started;
  assert.equal(backend.calls.set.length, 0);
  assert.equal(store.writes, 0);
});

test("the Firestore rules limit saves/{uid} to its own account and its three keys", () => {
  const rules = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");
  const block = rules.match(/match \/saves\/\{uid\} \{([\s\S]*?)\n    \}/);
  assert.ok(block, "saves/{uid} block exists");
  const body = block[1];
  assert.match(body, /allow read: if request\.auth != null && request\.auth\.uid == uid;/);
  assert.match(body, /allow create, update: if request\.auth != null && request\.auth\.uid == uid/);
  assert.match(body, /keys\(\)\.hasOnly\(\['v', 'updatedAt', 'data'\]\)/);
  assert.match(body, /keys\(\)\.hasAll\(\['v', 'updatedAt', 'data'\]\)/);
  assert.doesNotMatch(body, /if true/);
  // the catch-all still denies everything else
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

const resetOf = (at, changes = {}) => withProgress({ resetAt: at, ...changes });

test("reset sends the empty progress at once, replacing the account's stars", async () => {
  const old = withProgress({ campaign: campaign([1, 2], { 1: 7 }) });
  const { backend, store, timers, cloud } = setup({ remote: { u1: doc(old) }, local: old });
  await cloud.start("u1");
  store.value = resetOf(5000);
  backend.calls.set.length = 0;
  await cloud.reset();
  assert.equal(timers.pending.size, 0);
  assert.equal(backend.calls.set.length, 1);
  assert.deepEqual(dataOf(backend.calls.set[0][1].data), dataOf(resetOf(5000)));
  assert.equal(backend.calls.set[0][1].data.resetAt, 5000);
  assert.equal(cloud.status(), "saved");
});

test("a failed reset send stays pending and the next change sends it without merging the old save back", async () => {
  const old = withProgress({ campaign: campaign([1, 2], { 1: 7 }) });
  const { backend, store, timers, cloud } = setup({ remote: { u1: doc(old) }, local: old });
  await cloud.start("u1");
  store.value = resetOf(5000);
  backend.failSet = true;
  await assert.doesNotReject(cloud.reset());
  assert.equal(cloud.status(), "pending");
  assert.equal(store.value.resetAt, 5000);
  backend.failSet = false;
  cloud.changed();
  await timers.fire();
  assert.equal(cloud.status(), "saved");
  assert.equal(backend.remote.u1.data.resetAt, 5000);
  assert.deepEqual(backend.remote.u1.data.campaign.stars, {});
  assert.deepEqual(store.value.campaign.stars, {});
});

test("a reset that never pulled the account's save wins when the next push pulls and merges", async () => {
  const old = withProgress({ campaign: campaign([1, 2], { 1: 7 }) });
  const { backend, store, timers, cloud } = setup({ remote: { u1: doc(old) }, local: old });
  backend.failGet = true;
  await cloud.start("u1"); // the pull failed: nothing merged yet
  store.value = resetOf(5000);
  backend.failGet = false;
  backend.failSet = true;
  await cloud.reset();
  assert.equal(cloud.status(), "pending");
  backend.failSet = false;
  cloud.changed();
  await timers.fire();
  assert.equal(backend.remote.u1.data.resetAt, 5000);
  assert.deepEqual(backend.remote.u1.data.campaign.stars, {});
  assert.equal(store.value.resetAt, 5000);
});

test("a second device that synced before the reset takes the account's reset save", async () => {
  const stale = withProgress({ campaign: campaign([1, 2, 3], { 1: 7, 2: 7 }), highScore: 80 });
  const { backend, store, cloud } = setup({ remote: { u1: doc(resetOf(5000)) }, local: stale });
  await cloud.start("u1");
  assert.deepEqual(dataOf(store.value), dataOf(resetOf(5000)));
  assert.deepEqual(dataOf(backend.remote.u1.data), dataOf(resetOf(5000)));
});

// ---- a push merges the account's save first: it never overwrites what another device sent

const switchAt = (on, changedAt) => ({ on, changedAt });

test("a push merges what another device sent since, never overwriting it", async () => {
  const { backend, store, timers, cloud } = setup({ local: withProgress({ highScore: 1 }) });
  await cloud.start("u1");
  // another device sends stars this one doesn't have
  backend.remote.u1 = doc(withProgress({ highScore: 1, campaign: campaign([1, 2], { 2: 6 }) }));
  store.value = withProgress({ highScore: 40 });
  cloud.changed();
  await timers.fire();
  assert.equal(backend.remote.u1.data.highScore, 40);
  assert.deepEqual(backend.remote.u1.data.campaign.stars, { 2: 6 });
  assert.deepEqual(store.value.campaign.stars, { 2: 6 }, "this device gains them too");
  assert.equal(cloud.status(), "saved");
});

test("a device whose session predates a switch-off keeps it off when it pushes, and adopts it", async () => {
  const { backend, store, timers, cloud } = setup({
    local: withProgress({ lastSeen: switchAt(true, 100) }),
  });
  await cloud.start("u1");
  // another device turns it off later
  backend.remote.u1 = doc(withProgress({ lastSeen: switchAt(false, 200) }));
  store.value = { ...store.value, highScore: 30 };
  cloud.changed();
  await cloud.flush();
  assert.deepEqual(backend.remote.u1.data.lastSeen, switchAt(false, 200));
  assert.equal(backend.remote.u1.data.highScore, 30);
  assert.deepEqual(store.value.lastSeen, switchAt(false, 200));
  // a later change on this device does win
  store.value = { ...store.value, lastSeen: switchAt(true, 300) };
  cloud.changed();
  await cloud.flush();
  assert.deepEqual(backend.remote.u1.data.lastSeen, switchAt(true, 300));
});

test("a push whose transaction retries merges the save it retried on", async () => {
  const { backend, store, timers, cloud } = setup();
  await cloud.start("u1");
  store.value = withProgress({ highScore: 8, lastSeen: switchAt(true, 100) });
  backend.contend = () => {
    backend.remote.u1 = doc(withProgress({ lastSeen: switchAt(false, 200), highScore: 2 }));
  };
  cloud.changed();
  await timers.fire();
  assert.deepEqual(backend.remote.u1.data.lastSeen, switchAt(false, 200));
  assert.equal(backend.remote.u1.data.highScore, 8);
  assert.deepEqual(store.value.lastSeen, switchAt(false, 200));
});

test("onMerge runs after each push's merge too, so the profile follows the account's switch", async () => {
  const backend = fakeBackend();
  const store = fakeLocal(withProgress({ lastSeen: switchAt(true, 100) }));
  const merges = [];
  const seen = [];
  const cloud = createCloudSave({
    backend,
    local: store,
    timers: fakeTimers(),
    now: () => 1000,
    onMerge: (uid) => {
      merges.push(uid);
      seen.push(store.value.lastSeen.on);
    },
  });
  await cloud.start("u1");
  backend.remote.u1 = doc(withProgress({ lastSeen: switchAt(false, 200) }));
  cloud.changed();
  await cloud.flush();
  assert.deepEqual(merges, ["u1", "u1"]);
  assert.deepEqual(seen, [true, false], "the second runs after the device took the switch-off");
  // a failed push merges nothing and runs nothing
  backend.failGet = true;
  cloud.changed();
  await cloud.flush();
  assert.deepEqual(merges, ["u1", "u1"]);
});

test("a reset replaces the account's progress but keeps its later switch", async () => {
  const old = withProgress({ campaign: campaign([1, 2], { 1: 7 }), lastSeen: switchAt(true, 100) });
  const { backend, store, cloud } = setup({ remote: { u1: doc(old) }, local: old });
  await cloud.start("u1");
  backend.remote.u1 = doc({ ...old, lastSeen: switchAt(false, 200) }); // another device turned it off
  store.value = resetOf(5000, { lastSeen: switchAt(true, 100) });
  await cloud.reset();
  assert.equal(backend.remote.u1.data.resetAt, 5000);
  assert.deepEqual(backend.remote.u1.data.campaign.stars, {});
  assert.deepEqual(backend.remote.u1.data.lastSeen, switchAt(false, 200));
  assert.deepEqual(store.value.lastSeen, switchAt(false, 200));
  assert.equal(cloud.status(), "saved");
});

test("reset without an account sends nothing", async () => {
  const { backend, cloud } = setup();
  await cloud.reset();
  assert.equal(backend.calls.set.length, 0);
  assert.equal(cloud.status(), "device");
});
