import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createReminders } from "../app/reminders/push";

const FAIL = "Couldn't turn on reminders. Try again later.";

/** A fake env that records what happened; each part can be overridden. */
function setup({ ios, web, call, ensurePlayer, stored } = {}) {
  const log = [];
  const data = new Map(stored ? [["reminders", JSON.stringify(stored)]] : []);
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  const env = {
    ios: {
      available: () => false,
      requestPermission: async () => (log.push("ios.request"), "granted"),
      permission: async () => (log.push("ios.permission"), "notDetermined"),
      token: async () => (log.push("ios.token"), "ios-1"),
      ...ios,
    },
    web: {
      supported: async () => true,
      permission: () => "default",
      requestPermission: async () => (log.push("web.request"), "granted"),
      token: async () => (log.push("web.token"), "web-1"),
      ...web,
    },
    call: call || (async (name, body) => (log.push({ name, body }), { on: body.on, devices: 1 })),
    ensurePlayer: ensurePlayer || (async () => (log.push("ensurePlayer"), { uid: "u1" })),
    timeZone: () => "Asia/Kolkata",
    storage,
  };
  const saved = () => JSON.parse(storage.getItem("reminders") || "null");
  return { r: createReminders(env), log, saved, env };
}

const calls = (log) => log.filter((x) => x && x.name);
const iosOn = { available: () => true };

test("iPhone: granted and a token are saved, web push is never touched", async () => {
  const { r, log, saved } = setup({
    ios: iosOn,
    web: {
      requestPermission: async () => assert.fail("web asked"),
      token: async () => assert.fail("web token"),
    },
  });
  assert.equal(await r.turnOn(), "on");
  assert.deepEqual(calls(log), [
    { name: "setReminders", body: { on: true, token: "ios-1", platform: "ios", timeZone: "Asia/Kolkata" } },
  ]);
  assert.equal(saved().on, true);
  assert.equal(await r.state(), "on");
});

test("iPhone: denied is blocked and nothing is called", async () => {
  const { r, log } = setup({ ios: { ...iosOn, requestPermission: async () => "denied" } });
  assert.equal(await r.turnOn(), "blocked");
  assert.equal(calls(log).length, 0);
});

test("iPhone: a denied phone shows blocked without asking", async () => {
  const { r, log } = setup({
    ios: { ...iosOn, permission: async () => "denied", requestPermission: async () => assert.fail("asked") },
  });
  assert.equal(await r.state(), "blocked");
  assert.equal(log.length, 0);
});

test("iPhone: authorized, provisional and ephemeral are not blocked", async () => {
  for (const s of ["authorized", "provisional", "ephemeral", "notDetermined"]) {
    const { r } = setup({ ios: { ...iosOn, permission: async () => s } });
    assert.equal(await r.state(), "off", s);
  }
});

test("iPhone: ERROR GET TOKEN throws and the state stays off", async () => {
  const { r, log, saved } = setup({ ios: { ...iosOn, token: async () => "ERROR GET TOKEN" } });
  await assert.rejects(r.turnOn(), { message: FAIL });
  assert.equal(calls(log).length, 0);
  assert.equal(saved(), null);
  assert.equal(await r.state(), "off");
});

test("iPhone: an empty or huge token is refused", async () => {
  for (const token of ["", "x".repeat(5000), 42]) {
    const { r, log } = setup({ ios: { ...iosOn, token: async () => token } });
    await assert.rejects(r.turnOn(), { message: FAIL });
    assert.equal(calls(log).length, 0);
  }
});

test("iPhone: a bridge that fails to answer throws", async () => {
  const { r } = setup({
    ios: {
      ...iosOn,
      requestPermission: async () => {
        throw new Error("timeout");
      },
    },
  });
  await assert.rejects(r.turnOn(), { message: FAIL });
});

test("web: the browser grants and the Firebase token is saved", async () => {
  const { r, log, saved } = setup();
  assert.equal(await r.turnOn(), "on");
  assert.ok(log.includes("web.request"));
  assert.deepEqual(calls(log)[0].body, {
    on: true,
    token: "web-1",
    platform: "web",
    timeZone: "Asia/Kolkata",
  });
  assert.deepEqual(saved(), { on: true, token: "web-1" });
});

test("web: a browser that says no is blocked", async () => {
  const { r, log } = setup({ web: { requestPermission: async () => "denied" } });
  assert.equal(await r.turnOn(), "blocked");
  assert.equal(calls(log).length, 0);
});

test("web: permission already denied is blocked without asking", async () => {
  const { r, log } = setup({
    web: { permission: () => "denied", requestPermission: async () => assert.fail("asked") },
  });
  assert.equal(await r.state(), "blocked");
  assert.equal(await r.turnOn(), "blocked");
  assert.equal(log.length, 0);
});

test("web: unsupported (no key or no browser support) asks nothing", async () => {
  const { r, log } = setup({
    web: {
      supported: async () => false,
      requestPermission: async () => assert.fail("asked"),
      token: async () => assert.fail("token"),
    },
  });
  assert.equal(await r.state(), "unsupported");
  assert.equal(await r.turnOn(), "unsupported");
  assert.equal(log.length, 0);
});

test("a rejected setReminders throws, keeps storage off and the state off", async () => {
  const { r, saved } = setup({
    call: async () => {
      throw Object.assign(new Error("offline"), { code: "unavailable" });
    },
  });
  await assert.rejects(r.turnOn(), { message: FAIL });
  assert.equal(saved(), null);
  assert.equal(await r.state(), "off");
});

test("no account: ensurePlayer runs before setReminders", async () => {
  const { r, log } = setup();
  await r.turnOn();
  const order = log.map((x) => (typeof x === "string" ? x : x.name));
  assert.ok(order.indexOf("ensurePlayer") >= 0);
  assert.ok(order.indexOf("ensurePlayer") < order.indexOf("setReminders"));
});

test("an account that can't be made throws and calls nothing", async () => {
  const { r, log } = setup({
    ensurePlayer: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(r.turnOn(), { message: FAIL });
  assert.equal(calls(log).length, 0);
});

test("turnOff removes this device's token", async () => {
  const { r, log, saved } = setup({ stored: { on: true, token: "web-1" } });
  assert.equal(await r.state(), "on");
  assert.equal(await r.turnOff(), "off");
  assert.deepEqual(calls(log), [{ name: "setReminders", body: { on: false, token: "web-1" } }]);
  assert.equal(saved().on, false);
  assert.equal(await r.state(), "off");
});

test("turnOff still turns off locally when the call fails", async () => {
  const { r, saved } = setup({
    stored: { on: true, token: "web-1" },
    call: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await r.turnOff(), "off");
  assert.equal(saved().on, false);
});

test("refresh re-sends the new time zone and token", async () => {
  const { r, log, env, saved } = setup({
    stored: { on: true, token: "old" },
    web: { permission: () => "granted" },
  });
  env.timeZone = () => "Europe/London";
  await r.refresh();
  assert.deepEqual(calls(log)[0].body, {
    on: true,
    token: "web-1",
    platform: "web",
    timeZone: "Europe/London",
  });
  assert.equal(saved().token, "web-1");
});

test("refresh never throws", async () => {
  const { r, saved } = setup({
    stored: { on: true, token: "old" },
    web: { permission: () => "granted" },
    call: async () => {
      throw new Error("offline");
    },
  });
  await r.refresh();
  assert.deepEqual(saved(), { on: true, token: "old" });
});

test("refresh does nothing with reminders off", async () => {
  const { r, log } = setup();
  await r.refresh();
  assert.equal(log.length, 0);
});

test("refresh does not ask for permission", async () => {
  const { r, log } = setup({
    stored: { on: true, token: "old" },
    web: { permission: () => "default", requestPermission: async () => assert.fail("asked") },
  });
  await r.refresh();
  assert.equal(calls(log).length, 0);
});

test("with reminders off, state() loads no token and asks nothing", async () => {
  const { r, log } = setup();
  assert.equal(await r.state(), "off");
  assert.equal(log.length, 0);
});

test("the service worker handles push and clicks, opens /?from=reminder, caches as dino-v25", () => {
  const sw = fs.readFileSync(path.join(process.cwd(), "app", "sw.js"), "utf8");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /\/\?from=reminder/);
  assert.match(sw, /const CACHE_NAME = "dino-v25"/);
});
