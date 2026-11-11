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
  return {
    profileDoc,
    profileWrites: [],
    saveBackend: {
      async get(uid) {
        return Object.hasOwn(saves, uid) ? saves[uid] : null;
      },
      async set(uid, save) {
        saves[uid] = JSON.parse(JSON.stringify(save));
      },
    },
  };
}

/** One device: its own storage, cloud save, switch and profile writer, on a shared clock. */
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
  let cloud = createCloudSave({ backend: acc.saveBackend, local, timers, now });
  const writeProfile = () =>
    profiles.sync(UID, readLocal(storage).wallet.worn, { showLastSeen: lastSeen.on() });
  return {
    lastSeen,
    /** A new session: the page loads, cloud save starts and merges, then the profile is written. */
    async open() {
      profiles = createProfiles({ backend: profileBackend, storage, now });
      cloud = createCloudSave({ backend: acc.saveBackend, local, timers, now });
      await cloud.start(UID);
      await writeProfile();
    },
    /** The Settings switch, as the game wires it: save it, send the save, write the profile. */
    async flip(on) {
      lastSeen.set(on);
      cloud.changed();
      await cloud.flush();
      await writeProfile();
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
