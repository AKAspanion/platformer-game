import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  HINT_TIMEOUT,
  HINT_KEYBOARD,
  HINT_TOUCH,
  createOnboarding,
} from "../app/onboarding/onboarding";

function fakeStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}
const blocked = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};
const fresh = { reached: [1], stars: {} };

test("first open is taken once, and not again after a reload", () => {
  const s = fakeStorage();
  assert.equal(createOnboarding(s).takeFirstOpen(fresh), true);
  assert.equal(createOnboarding(s).takeFirstOpen(fresh), false);
  assert.equal(createOnboarding(s).takeFirstOpen(fresh), false);
});

test("a device with progress never gets the first-open flow", () => {
  for (const c of [
    { reached: [1, 2], stars: {} },
    { reached: [1], stars: { 1: 1 } },
  ]) {
    const o = createOnboarding(fakeStorage());
    assert.equal(o.takeFirstOpen(c), false);
    assert.equal(o.takeFirstOpen(fresh), false);
  }
});

test("empty reached counts as no progress", () => {
  assert.equal(createOnboarding(fakeStorage()).takeFirstOpen({ reached: [], stars: {} }), true);
});

test("hint text by input", () => {
  const o = createOnboarding(fakeStorage());
  assert.equal(o.hintText(false), "← → move · ↑ or Space jump · Enter fire");
  assert.equal(o.hintText(true), "Use the buttons to move, jump and fire");
  assert.equal(HINT_KEYBOARD, o.hintText(false));
  assert.equal(HINT_TOUCH, o.hintText(true));
  assert.equal(HINT_TIMEOUT, 15000);
});

test("hint ends when moved and jumped, or on timeout", () => {
  const o = createOnboarding(fakeStorage());
  const h = o.startHint(0);
  assert.equal(h.tick(1000), null);
  h.moved();
  assert.equal(h.tick(2000), null);
  h.jumped();
  assert.deepEqual(h.tick(4000), { reason: "played", seconds: 4 });

  const t = o.startHint(0);
  t.moved();
  assert.equal(t.tick(14999), null);
  assert.deepEqual(t.tick(15000), { reason: "timeout", seconds: 15 });
});

test("hintDone is remembered and does not throw", () => {
  const s = fakeStorage();
  createOnboarding(s).hintDone();
  assert.equal(JSON.parse(s.getItem("onboarding")).hintDone, true);
  assert.doesNotThrow(() => createOnboarding(blocked).hintDone());
});

test("world 1 offer shows once for level 25 only", () => {
  const s = fakeStorage();
  const o = createOnboarding(s);
  assert.equal(o.takeWorld1Offer(27), false);
  assert.equal(o.takeWorld1Offer(25), true);
  assert.equal(o.takeWorld1Offer(25), false);
  assert.equal(createOnboarding(s).takeWorld1Offer(25), false);
});

test("blocked storage never repeats a one-time flow", () => {
  const o = createOnboarding(blocked);
  assert.equal(o.takeFirstOpen(fresh), false);
  assert.equal(o.takeWorld1Offer(25), false);
});

test("corrupt stored flags never throw and never repeat a flow", () => {
  for (const bad of ["{nope", "null", "[]", '"x"']) {
    const o = createOnboarding(fakeStorage({ onboarding: bad }));
    assert.equal(o.takeFirstOpen(fresh), false);
    assert.equal(o.takeWorld1Offer(25), false);
  }
});

test("a store that reads but cannot write does not report a take", () => {
  const s = {
    getItem: () => null,
    setItem() {
      throw new Error("full");
    },
  };
  const o = createOnboarding(s);
  assert.equal(o.takeFirstOpen(fresh), false);
  assert.equal(o.takeWorld1Offer(25), false);
});
