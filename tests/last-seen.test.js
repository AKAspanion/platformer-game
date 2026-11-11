/**
 * "Show when I was last online" belongs to the account: it rides in cloud save
 * (key "last_seen"), the latest change wins by its changedAt stamp, and every
 * device writes its profile from the merged value (spec §4.3).
 */
import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createLastSeen } from "../app/progress/last-seen";
import {
  emptyProgress,
  mergeProgress,
  readLocal,
  writeLocal,
  resetLocal,
  SAVE_VERSION,
} from "../app/progress/save";
import { createCloudSave } from "../app/progress/cloud";
import { createProfiles } from "../app/profiles";
import { createProfileGate } from "../app/profiles/gate";
import { DAY_MS, dayNumber } from "../app/profiles/rules";

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

const withProgress = (changes) => ({ ...emptyProgress(), ...changes });
const switchAt = (on, changedAt) => ({ on, changedAt });

test("the switch is on by default, and a change is stamped with its time", () => {
  const storage = memoryStorage();
  let ms = 1000;
  const lastSeen = createLastSeen(storage, () => ms);
  assert.equal(lastSeen.on(), true);
  assert.equal(lastSeen.set(true), false, "already on: no change");
  ms = 2000;
  assert.equal(lastSeen.set(false), true);
  assert.equal(lastSeen.on(), false);
  assert.deepEqual(readLocal(storage).lastSeen, switchAt(false, 2000));
});

test("the switch is part of the save: it round-trips and junk reads as on", () => {
  assert.deepEqual(emptyProgress().lastSeen, switchAt(true, 0));
  const storage = memoryStorage();
  writeLocal(withProgress({ lastSeen: switchAt(false, 77) }), storage);
  assert.deepEqual(readLocal(storage).lastSeen, switchAt(false, 77));
  assert.equal(createLastSeen(storage).on(), false);
  for (const junk of ['"off"', "[]", "{not json", JSON.stringify({ on: 0, changedAt: -5 })]) {
    storage.data.last_seen = junk;
    assert.deepEqual(readLocal(storage).lastSeen, switchAt(true, 0), junk);
  }
});

test("merge: the later change wins, in either order", () => {
  const off = withProgress({ lastSeen: switchAt(false, 200) });
  const on = withProgress({ lastSeen: switchAt(true, 100) });
  assert.deepEqual(mergeProgress(off, on).lastSeen, switchAt(false, 200));
  assert.deepEqual(mergeProgress(on, off).lastSeen, switchAt(false, 200));
  const laterOn = withProgress({ lastSeen: switchAt(true, 300) });
  assert.deepEqual(mergeProgress(off, laterOn).lastSeen, switchAt(true, 300));
  assert.deepEqual(mergeProgress(laterOn, off).lastSeen, switchAt(true, 300));
});

test("merge: on a tie, off wins; a save from before the switch existed reads as on", () => {
  const a = withProgress({ lastSeen: switchAt(false, 100) });
  const b = withProgress({ lastSeen: switchAt(true, 100) });
  assert.deepEqual(mergeProgress(a, b).lastSeen, switchAt(false, 100));
  assert.deepEqual(mergeProgress(b, a).lastSeen, switchAt(false, 100));
  const old = { ...emptyProgress() };
  delete old.lastSeen;
  assert.deepEqual(mergeProgress(old, emptyProgress()).lastSeen, switchAt(true, 0));
  assert.deepEqual(mergeProgress(a, old).lastSeen, switchAt(false, 100));
});

test("erasing progress keeps the switch, and a reset save doesn't turn it back on", () => {
  const storage = memoryStorage();
  writeLocal(withProgress({ highScore: 9, lastSeen: switchAt(false, 50) }), storage);
  const reset = resetLocal(storage, 5000);
  assert.deepEqual(reset.lastSeen, switchAt(false, 50));
  assert.deepEqual(readLocal(storage).lastSeen, switchAt(false, 50));
  // the later reset wins outright for progress, never for the setting
  const otherDevice = withProgress({ resetAt: 9000, lastSeen: switchAt(true, 0) });
  assert.deepEqual(mergeProgress(otherDevice, reset).lastSeen, switchAt(false, 50));
  assert.deepEqual(mergeProgress(reset, otherDevice).lastSeen, switchAt(false, 50));
  const olderSave = withProgress({ resetAt: 0, lastSeen: switchAt(true, 80) });
  assert.deepEqual(mergeProgress(reset, olderSave).lastSeen, switchAt(true, 80));
});

// ---- two devices on one account: cloud save and the profile, end to end

const UID = "u1";
const DAY = 20000;

function account() {
  const saves = {};
  const profileDoc = { value: null };
  const saveBackend = {
    async get(uid) {
      return Object.hasOwn(saves, uid) ? saves[uid] : null;
    },
    async set(uid, save) {
      saves[uid] = JSON.parse(JSON.stringify(save));
    },
    /** As a Firestore transaction: read, then write what the step gives. */
    async update(uid, step) {
      const save = step(await saveBackend.get(uid));
      if (save) await saveBackend.set(uid, save);
      return save;
    },
  };
  return { profileDoc, profileWrites: [], saveBackend };
}

/**
 * One device: its own storage, cloud save, switch and profile writer, on a
 * shared clock, wired as app/index.js wires them: the profile is written by
 * the gate after each merge of the account's save (onMerge), and a change
 * (worn items, the switch, progress) sends the save at once.
 */
function device(acc, clock) {
  const storage = memoryStorage();
  const now = () => clock.ms;
  const local = { read: () => readLocal(storage), write: (p) => writeLocal(p, storage) };
  const timers = { setTimeout: () => 0, clearTimeout() {} };
  const lastSeen = createLastSeen(storage, now);
  const profileBackend = {
    async set(uid, profile) {
      acc.profileWrites.push(profile);
      acc.profileDoc.value = profile;
    },
    async getMany() {
      return [];
    },
  };
  let profiles = createProfiles({ backend: profileBackend, storage, now });
  let profileWrite = Promise.resolve();
  const gate = createProfileGate({
    sync: (uid, worn, options) => profiles.sync(uid, worn, options),
    read: () => ({ worn: readLocal(storage).wallet.worn, showLastSeen: lastSeen.on() }),
  });
  const newCloud = () =>
    createCloudSave({
      backend: acc.saveBackend,
      local,
      timers,
      now,
      onMerge: (uid) => {
        profileWrite = Promise.resolve(gate.merged(uid));
      },
    });
  let cloud = newCloud();
  const sendNow = async () => {
    cloud.changed();
    await cloud.flush();
    await profileWrite;
  };
  return {
    lastSeen,
    /** A new session: the page loads, cloud save starts and merges, and the profile follows. */
    async open() {
      profiles = createProfiles({ backend: profileBackend, storage, now });
      cloud = newCloud();
      gate.start(UID);
      await cloud.start(UID);
      await profileWrite;
    },
    /** The Settings switch. */
    async flip(on) {
      lastSeen.set(on);
      await sendNow();
    },
    /** Plays on in the same session: progress changes and is sent. */
    async play(changes) {
      writeLocal({ ...readLocal(storage), ...changes }, storage);
      await sendNow();
    },
  };
}

test("switching it off on one device stops the other writing seenDay; on again brings it back", async () => {
  const acc = account();
  const clock = { ms: DAY * DAY_MS + 1000 };
  const a = device(acc, clock);
  const b = device(acc, clock);

  // t1: B is on (the default) and writes today's seenDay
  await b.open();
  assert.equal(acc.profileDoc.value.seenDay, DAY);

  // t2: A turns it off
  clock.ms += 1000;
  await a.open();
  const offFrom = acc.profileWrites.length;
  await a.flip(false);
  assert.equal(Object.hasOwn(acc.profileDoc.value, "seenDay"), false);

  // B opens again: its merged switch is off, so it writes no seenDay
  clock.ms += 1000;
  await b.open();
  assert.equal(b.lastSeen.on(), false);
  assert.equal(Object.hasOwn(acc.profileDoc.value, "seenDay"), false);
  assert.ok(acc.profileWrites.slice(offFrom).every((p) => !Object.hasOwn(p, "seenDay")));

  // a later day changes nothing on either device
  clock.ms += DAY_MS;
  await b.open();
  await a.open();
  assert.ok(acc.profileWrites.slice(offFrom).every((p) => !Object.hasOwn(p, "seenDay")));

  // t3: B turns it on; A merges and writes seenDay again
  clock.ms += 1000;
  await b.flip(true);
  const writes = acc.profileWrites.length;
  await a.open();
  assert.equal(a.lastSeen.on(), true);
  assert.ok(acc.profileWrites.length > writes, "A wrote its profile");
  assert.equal(acc.profileDoc.value.seenDay, dayNumber(clock.ms));
});

test("with the switch off, a device's first write each session clears a seenDay another device left", async () => {
  const acc = account();
  const clock = { ms: DAY * DAY_MS + 1000 };
  const a = device(acc, clock);
  await a.open();
  await a.flip(false);
  // another device that hadn't merged the change yet wrote a seenDay meanwhile
  acc.profileDoc.value = { skin: "classic", hat: "none", companion: "none", seenDay: DAY };
  await a.open();
  assert.equal(Object.hasOwn(acc.profileDoc.value, "seenDay"), false);
  // later in the same session it skips repeats again
  const writes = acc.profileWrites.length;
  await a.flip(false);
  assert.equal(acc.profileWrites.length, writes);
});

test("a device whose session predates the switch-off never turns it back on (spec §4.3)", async () => {
  const acc = account();
  const clock = { ms: DAY * DAY_MS + 1000 };
  const a = device(acc, clock);
  const b = device(acc, clock);
  const noSeenDay = (writes) => writes.every((p) => !Object.hasOwn(p, "seenDay"));

  // t1: B's session starts with the switch on and writes today's seenDay
  await b.open();
  assert.equal(acc.profileDoc.value.seenDay, DAY);

  // t2: A turns it off
  clock.ms += 1000;
  const t2 = clock.ms;
  await a.open();
  await a.flip(false);
  const offFrom = acc.profileWrites.length;

  // B, still in its t1 session, plays and pushes its progress
  clock.ms += 1000;
  await b.play({ highScore: 50 });
  const save = await acc.saveBackend.get(UID);
  assert.deepEqual(save.data.lastSeen, switchAt(false, t2), "the account stays off");
  assert.equal(save.data.highScore, 50, "B's progress still reaches the account");
  assert.equal(b.lastSeen.on(), false, "B takes the account's switch");
  assert.equal(Object.hasOwn(acc.profileDoc.value, "seenDay"), false);

  // B's next session, and a fresh device C, write no seenDay
  clock.ms += 1000;
  await b.open();
  const c = device(acc, clock);
  await c.open();
  assert.equal(c.lastSeen.on(), false);
  assert.ok(acc.profileWrites.length > offFrom, "the profile was still written");
  assert.ok(noSeenDay(acc.profileWrites.slice(offFrom)));
  assert.deepEqual((await acc.saveBackend.get(UID)).data.lastSeen, switchAt(false, t2));

  // t3: B turns it on: that newer change wins
  clock.ms += 1000;
  const t3 = clock.ms;
  await b.flip(true);
  assert.deepEqual((await acc.saveBackend.get(UID)).data.lastSeen, switchAt(true, t3));
  assert.equal(acc.profileDoc.value.seenDay, dayNumber(t3));
});

test("a change always outranks the switch it replaced, even from a clock that is behind", () => {
  const storage = memoryStorage();
  writeLocal(withProgress({ lastSeen: switchAt(true, 5000) }), storage);
  const lastSeen = createLastSeen(storage, () => 1000); // this device's clock is behind
  assert.equal(lastSeen.set(false), true);
  assert.deepEqual(readLocal(storage).lastSeen, switchAt(false, 5001));
  assert.deepEqual(
    mergeProgress(readLocal(storage), withProgress({ lastSeen: switchAt(true, 5000) })).lastSeen,
    switchAt(false, 5001),
  );
});

test("the game sends the save on a worn or switch change, and the profile follows its merge", () => {
  const index = fs.readFileSync("app/index.js", "utf8");
  const at = index.indexOf("const syncProfile = ");
  const wiring = index.slice(at, at + 120);
  assert.match(
    wiring,
    /^const syncProfile = \(\) => \{\s*cloud\.changed\(\);\s*cloud\.flush\(\);\s*\};/,
  );
  assert.doesNotMatch(index, /profileGate\.changed\(/);
});

test("the cloud save carries the switch to the account", async () => {
  const acc = account();
  const clock = { ms: DAY * DAY_MS };
  const a = device(acc, clock);
  await a.open();
  await a.flip(false);
  const save = await acc.saveBackend.get(UID);
  assert.equal(save.v, SAVE_VERSION);
  assert.deepEqual(save.data.lastSeen, switchAt(false, clock.ms));
});

test("the game reads the switch from the save, not from device settings", () => {
  const index = fs.readFileSync("app/index.js", "utf8");
  assert.doesNotMatch(index, /settings\.(get|set)\("lastSeen"/);
  assert.match(index, /showLastSeen: lastSeen\.on\(\)/);
  assert.match(index, /setLastSeen\.checked = lastSeen\.on\(\)/);
});
