import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { handleSetReminders, handleSendReminders, LINK } from "../functions/src/reminders.js";
import { overLimit } from "../functions/src/handlers.js";

const user = (uid = "u1") => ({ uid, token: {} });
const open = async () => false;
const T0 = Date.UTC(2026, 10, 11, 12, 30); // 18:00 in Asia/Kolkata, 2026-11-11
const TODAY = 20261111;

/** In-memory pushSubs with the layout index.js stores. */
function fakeSubs(docs = {}) {
  const map = new Map(Object.entries(docs).map(([uid, d]) => [uid, structuredClone(d)]));
  return {
    map,
    async update(uid, change) {
      const current = map.get(uid) || null;
      const next = typeof change === "function" ? change(current) : { ...current, ...change };
      map.set(uid, structuredClone(next));
    },
    async release(token, uid) {
      for (const [other, doc] of map) {
        if (other === uid || !doc.tokens.includes(token)) continue;
        doc.devices = doc.devices.filter((d) => d.token !== token);
        doc.tokens = doc.tokens.filter((t) => t !== token);
      }
    },
    async *all() {
      for (const [uid, doc] of [...map]) yield { uid, ...structuredClone(doc) };
    },
    async claimDay(uid, day) {
      const doc = map.get(uid);
      if (doc.lastSentDay === day) return false;
      doc.lastSentDay = day;
      return true;
    },
  };
}

const dev = (token, addedAt, platform = "web") => ({ token, platform, addedAt });
const sub = (devices, extra = {}) => ({
  devices,
  tokens: devices.map((d) => d.token),
  timeZone: "Asia/Kolkata",
  lastSentDay: null,
  ...extra,
});

const set = (data, deps, auth = user()) => handleSetReminders({ auth, data }, deps);
const on = (token = "t1", extra = {}) => ({
  on: true,
  token,
  platform: "web",
  timeZone: "Asia/Kolkata",
  ...extra,
});

test("setReminders: signed out is unauthenticated", async () => {
  const subs = fakeSubs();
  await assert.rejects(set(on(), { subs, limiter: open }, null), (e) => e.code === "unauthenticated");
  assert.equal(subs.map.size, 0);
});

test("setReminders: bad token, platform or time zone store nothing", async () => {
  const subs = fakeSubs();
  const bad = [
    on(""),
    on("x".repeat(4097)),
    on(42),
    on(null),
    on("t1", { platform: "android" }),
    on("t1", { platform: undefined }),
    on("t1", { timeZone: "Mars/Base" }),
    on("t1", { timeZone: "" }),
    { on: false, token: 7 },
    null,
  ];
  for (const data of bad) {
    await assert.rejects(
      set(data, { subs, limiter: open }),
      (e) => e.code === "invalid-argument",
      JSON.stringify(data),
    );
  }
  assert.equal(subs.map.size, 0);
  const longest = await set(on("x".repeat(4096)), { subs, limiter: open });
  assert.equal(longest.devices, 1);
});

test("setReminders: one device saved once, with its time zone", async () => {
  const subs = fakeSubs();
  const deps = { subs, limiter: open, now: () => 1000 };
  assert.deepEqual(await set(on(), deps), { on: true, devices: 1 });
  assert.deepEqual(await set(on(), deps), { on: true, devices: 1 });
  const doc = subs.map.get("u1");
  assert.deepEqual(doc.devices, [dev("t1", 1000)]);
  assert.deepEqual(doc.tokens, ["t1"]);
  assert.equal(doc.timeZone, "Asia/Kolkata");
});

test("setReminders: a sixth device drops the oldest", async () => {
  const subs = fakeSubs({
    u1: sub([dev("t3", 30), dev("t1", 10), dev("t5", 50), dev("t2", 20), dev("t4", 40)]),
  });
  const out = await set(on("t6"), { subs, limiter: open, now: () => 60 });
  assert.deepEqual(out, { on: true, devices: 5 });
  assert.deepEqual(subs.map.get("u1").tokens, ["t2", "t3", "t4", "t5", "t6"]);
});

test("setReminders: off removes the device, the others stay", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1), dev("t2", 2)], { lastSentDay: TODAY }) });
  const deps = { subs, limiter: open };
  assert.deepEqual(await set({ on: false, token: "t1" }, deps), { on: false, devices: 1 });
  assert.deepEqual(subs.map.get("u1").tokens, ["t2"]);
  assert.deepEqual(await set({ on: false, token: "t2" }, deps), { on: false, devices: 0 });
  assert.deepEqual(subs.map.get("u1").devices, []);
  assert.equal(subs.map.get("u1").lastSentDay, TODAY);
  assert.deepEqual(await set({ on: false, token: "nope" }, deps), { on: false, devices: 0 });
});

test("setReminders: over the limit changes nothing", async () => {
  const subs = fakeSubs();
  await assert.rejects(
    set(on(), { subs, limiter: async () => true }),
    (e) =>
      e.code === "resource-exhausted" && e.message === "Couldn't turn on reminders. Try again later.",
  );
  assert.equal(subs.map.size, 0);
});

test("setReminders: the limiter counts per account with the spec's 30 an hour", async () => {
  const seen = [];
  const limiter = async (uid, kind, max) => {
    seen.push([uid, kind, max]);
    return false;
  };
  await set(on(), { subs: fakeSubs(), limiter });
  assert.deepEqual(seen, [["u1", "reminders", 30]]);
  // and the real sliding window refuses the 31st
  const store = new Map();
  const tx = { get: async (uid) => store.get(uid) || null, set: (uid, p) => store.set(uid, p) };
  let refused = 0;
  for (let i = 0; i < 31; i++) if (await overLimit(tx, "u1", "reminders", 30)) refused++;
  assert.equal(refused, 1);
});

test("setReminders: a device belongs to one account", async () => {
  const subs = fakeSubs({ u2: sub([dev("t1", 1), dev("t9", 2)]) });
  await set(on("t1"), { subs, limiter: open });
  assert.deepEqual(subs.map.get("u2").tokens, ["t9"]);
  assert.deepEqual(subs.map.get("u1").tokens, ["t1"]);
});

// ------------------------------------------------------------- sending

function fakeMessaging({ invalid = [] } = {}) {
  const sent = [];
  return {
    sent,
    async send(tokens, message) {
      sent.push({ tokens, message });
      return { invalidTokens: invalid };
    },
  };
}
const savesOf = (streaks) => ({ streak: async (uid) => (uid in streaks ? streaks[uid] : null) });
const pass = (deps) => handleSendReminders({ now: () => T0, ...deps });

test("sendReminders: a streak at risk gets one message at 18:00 local", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1), dev("t2", 2, "ios")]) });
  const messaging = fakeMessaging();
  const saves = savesOf({ u1: { days: 6, freezes: 0, last: 20261110 } });
  const out = await pass({ subs, saves, messaging });
  assert.deepEqual(out, { sent: 1, skipped: 0, pruned: 0 });
  assert.equal(messaging.sent.length, 1);
  assert.deepEqual(messaging.sent[0].tokens, ["t1", "t2"]);
  assert.equal(
    messaging.sent[0].message.body,
    "Your 6-day streak ends tonight. Play today's challenge to keep it.",
  );
  assert.equal(messaging.sent[0].message.link, LINK);
  assert.equal(subs.map.get("u1").lastSentDay, TODAY);
});

test("sendReminders: never twice a day", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1)]) });
  const messaging = fakeMessaging();
  const saves = savesOf({ u1: { days: 6, freezes: 0, last: 20261110 } });
  await pass({ subs, saves, messaging });
  assert.deepEqual(await pass({ subs, saves, messaging }), { sent: 0, skipped: 0, pruned: 0 });
  // a pass that read the subscription before the first one stamped it still can't send
  const stale = {
    all: async function* () {
      yield { uid: "u1", ...sub([dev("t1", 1)]) };
    },
    claimDay: subs.claimDay,
    update: subs.update,
  };
  assert.deepEqual(await pass({ subs: stale, saves, messaging }), {
    sent: 0,
    skipped: 1,
    pruned: 0,
  });
  assert.equal(messaging.sent.length, 1);
});

test("sendReminders: only 18:00 local, and a played day sends nothing but is stamped", async () => {
  const subs = fakeSubs({
    u1: sub([dev("t1", 1)], { timeZone: "UTC" }), // 12:30 there
    u2: sub([dev("t2", 1)]),
  });
  const messaging = fakeMessaging();
  const saves = savesOf({ u2: { days: 9, freezes: 0, last: TODAY } });
  const out = await pass({ subs, saves, messaging });
  assert.deepEqual(out, { sent: 0, skipped: 1, pruned: 0 });
  assert.equal(messaging.sent.length, 0);
  assert.equal(subs.map.get("u1").lastSentDay, null);
  assert.equal(subs.map.get("u2").lastSentDay, TODAY);
});

test("sendReminders: no cloud save gets the daily reminder", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1)]) });
  const messaging = fakeMessaging();
  await pass({ subs, saves: savesOf({}), messaging });
  assert.equal(messaging.sent[0].message.body, "Today's challenge is up. 5 new levels are waiting.");
});

test("sendReminders: unregistered tokens are removed", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1), dev("t2", 2)]) });
  const messaging = fakeMessaging({ invalid: ["t2", "stranger"] });
  const out = await pass({ subs, saves: savesOf({}), messaging });
  assert.deepEqual(out, { sent: 1, skipped: 0, pruned: 1 });
  assert.deepEqual(subs.map.get("u1").tokens, ["t1"]);
  assert.deepEqual(subs.map.get("u1").devices, [dev("t1", 1)]);
  assert.equal(subs.map.get("u1").lastSentDay, TODAY);
});

test("sendReminders: a failed send gives the day back and the pass goes on", async () => {
  const subs = fakeSubs({
    u1: sub([dev("t1", 1)], { lastSentDay: 20261110 }),
    u2: sub([dev("t2", 1)]),
  });
  const failing = {
    async send(tokens) {
      if (tokens.includes("t1")) throw new Error("fcm down");
      return { invalidTokens: [] };
    },
  };
  const logs = [];
  const out = await pass({ subs, saves: savesOf({}), messaging: failing, log: (m) => logs.push(m) });
  assert.deepEqual(out, { sent: 1, skipped: 0, pruned: 0 });
  assert.equal(subs.map.get("u1").lastSentDay, 20261110);
  assert.equal(subs.map.get("u2").lastSentDay, TODAY);
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes("fcm down"));
});

test("sendReminders: a failed save read skips that account only", async () => {
  const subs = fakeSubs({ u1: sub([dev("t1", 1)]), u2: sub([dev("t2", 1)]) });
  const messaging = fakeMessaging();
  const saves = {
    streak: async (uid) => {
      if (uid === "u1") throw new Error("firestore down");
      return null;
    },
  };
  const out = await pass({ subs, saves, messaging, log: () => {} });
  assert.equal(out.sent, 1);
  assert.equal(subs.map.get("u1").lastSentDay, null);
});

test("sendReminders: an account with no devices is stamped, not messaged", async () => {
  const subs = fakeSubs({ u1: sub([]) });
  const messaging = fakeMessaging();
  await pass({ subs, saves: savesOf({}), messaging });
  assert.equal(messaging.sent.length, 0);
  assert.equal(subs.map.get("u1").lastSentDay, TODAY);
});
