import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MAX_QUEUE, createAnalytics, appOpenParams } from "../app/analytics";

const memoryStore = () => {
  const data = {};
  return { get: (k) => data[k] ?? null, set: (k, v) => (data[k] = v), data };
};

const makeSink = () => {
  const calls = [];
  return { calls, sink: { log: (name, params) => calls.push([name, params]) } };
};

const make = (overrides = {}) => {
  const { calls, sink } = makeSink();
  const loads = [];
  const analytics = createAnalytics({
    load: async () => {
      loads.push(1);
      return sink;
    },
    enabled: () => true,
    debug: false,
    ...overrides,
  });
  return { analytics, calls, loads };
};

test("queues at most 50 events, dropping the oldest, and sends them in order on start", async () => {
  const { analytics, calls } = make();
  for (let i = 0; i < 60; i++) analytics.track("e", { i });
  assert.equal(analytics.queued(), MAX_QUEUE);
  await analytics.start();
  assert.equal(calls.length, 50);
  assert.deepEqual(
    calls.map(([, p]) => p.i),
    Array.from({ length: 50 }, (_, k) => k + 10),
  );
  assert.equal(analytics.queued(), 0);
});

test("events after start are sent straight away", async () => {
  const { analytics, calls } = make();
  await analytics.start();
  analytics.track("late", { a: 1 });
  assert.deepEqual(calls, [["late", { a: 1 }]]);
});

test("a load that rejects throws nothing, before or after", async () => {
  const { analytics } = make({
    load: async () => {
      throw new Error("blocked");
    },
  });
  assert.doesNotThrow(() => analytics.track("before"));
  await assert.doesNotReject(analytics.start());
  assert.doesNotThrow(() => analytics.track("after"));
  assert.equal(analytics.queued(), 0);
});

test("a sink whose log throws is swallowed", async () => {
  const { analytics } = make({
    load: async () => ({
      log: () => {
        throw new Error("boom");
      },
    }),
  });
  await analytics.start();
  assert.doesNotThrow(() => analytics.track("x"));
});

test("with the setting off, start never loads", async () => {
  const { analytics, loads } = make({ enabled: () => false });
  analytics.track("x");
  await analytics.start();
  assert.equal(loads.length, 0);
  assert.equal(analytics.queued(), 0);
});

test("switching off drops the queue and stops sending", async () => {
  const { analytics, calls, loads } = make();
  for (let i = 0; i < 5; i++) analytics.track("e");
  assert.equal(analytics.queued(), 5);
  analytics.setEnabled(false);
  assert.equal(analytics.queued(), 0);
  analytics.track("more");
  await analytics.start();
  assert.equal(loads.length, 0);
  assert.equal(calls.length, 0);
});

test("switching off after loading stops sending", async () => {
  const { analytics, calls } = make();
  await analytics.start();
  analytics.setEnabled(false);
  analytics.track("x");
  assert.equal(calls.length, 0);
});

test("debug writes to console.debug and never calls the sink", async () => {
  const written = [];
  const original = console.debug;
  console.debug = (...args) => written.push(args);
  try {
    const { analytics, calls, loads } = make({ debug: true });
    await analytics.start();
    analytics.track("level_start", { mode: "story" });
    assert.equal(written.length, 1);
    assert.ok(written[0].includes("level_start"));
    assert.equal(calls.length, 0);
    assert.equal(loads.length, 0);
  } finally {
    console.debug = original;
  }
});

test("params named uid, name or email are removed", async () => {
  const { analytics, calls } = make();
  await analytics.start();
  analytics.track("x", { uid: "u", name: "n", email: "e@x.y", Email: "E", keep: 1 });
  assert.deepEqual(calls[0][1], { keep: 1 });
});

test("start loads once however often it is called", async () => {
  const { analytics, loads } = make();
  await Promise.all([analytics.start(), analytics.start()]);
  await analytics.start();
  assert.equal(loads.length, 1);
});

test("app_open: first time is not returning, a later day is", () => {
  const store = memoryStore();
  assert.deepEqual(appOpenParams(store, new Date(2026, 10, 11, 9)), {
    returning: false,
    days_since_first: 0,
  });
  assert.deepEqual(appOpenParams(store, new Date(2026, 10, 11, 22)), {
    returning: true,
    days_since_first: 0,
  });
  assert.deepEqual(appOpenParams(store, new Date(2026, 10, 14, 8)), {
    returning: true,
    days_since_first: 3,
  });
});

test("app_open survives a store that throws", () => {
  const broken = {
    get: () => {
      throw new Error("no storage");
    },
    set: () => {
      throw new Error("no storage");
    },
  };
  assert.deepEqual(appOpenParams(broken), { returning: false, days_since_first: 0 });
});

const fakeClock = () => {
  const timers = [];
  return {
    timers: {
      setTimeout: (fn, ms) => timers.push({ fn, ms, live: true }) - 1,
      clearTimeout: (id) => timers[id] && (timers[id].live = false),
    },
    fire: () => timers.forEach((t) => t.live && ((t.live = false), t.fn())),
    timers_: timers,
  };
};

test("arm: with no input, analytics starts once when the 3 s timer fires", () => {
  const clock = fakeClock();
  const { analytics, loads } = make({ timers: clock.timers });
  analytics.arm(new EventTarget());
  assert.equal(clock.timers_[0].ms, 3000);
  assert.equal(loads.length, 0);
  clock.fire();
  assert.equal(loads.length, 1);
  clock.fire();
  assert.equal(loads.length, 1);
});

test("arm: a key press at 1 s starts it, and the timer does not start it again", () => {
  const clock = fakeClock();
  const { analytics, loads } = make({ timers: clock.timers });
  const target = new EventTarget();
  analytics.arm(target);
  target.dispatchEvent(new Event("keydown"));
  assert.equal(loads.length, 1);
  clock.fire();
  target.dispatchEvent(new Event("keydown"));
  assert.equal(loads.length, 1);
});

test("PRIVACY.md names Google Analytics, the events and the Settings switch", () => {
  const text = fs.readFileSync("PRIVACY.md", "utf8");
  assert.match(text, /Google Analytics/);
  [
    "app_open",
    "mode_start",
    "level_start",
    "level_complete",
    "level_fail",
    "daily_complete",
    "leaderboard_open",
    "share",
  ].forEach((event) => assert.ok(text.includes(event), event));
  assert.match(text, /Settings/);
  assert.match(text, /Share anonymous usage stats/);
});
