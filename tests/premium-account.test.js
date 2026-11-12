import "./env";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isPremium, hasAccountPremium, watchAccountPremium } from "../app/util/premium";

// a stand-in for app/auth: the test calls `emit(user)` like a sign-in or sign-out
const fakeAuth = () => {
  let listener = null;
  return {
    onAuthStateChanged(cb) {
      listener = cb;
      return () => (listener = null);
    },
    emit: (user) => listener(user),
  };
};
const player = (uid, isAnonymous = false) => ({ uid, isAnonymous });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let auth;
let changes;
const watch = (entitlements) =>
  watchAccountPremium(auth, entitlements, () => changes.push(isPremium()));

beforeEach(async () => {
  // start every test signed out, with no local Premium switch
  localStorage.removeItem("premium");
  auth = fakeAuth();
  changes = [];
  watchAccountPremium(auth, { premium: async () => false });
  await auth.emit(null);
  changes = [];
  auth = fakeAuth();
});

test("an account with the entitlement has Premium, and loses it on sign-out", async () => {
  watch({ premium: async (uid) => uid === "paid" });
  assert.equal(isPremium(), false);
  await auth.emit(player("paid"));
  assert.equal(isPremium(), true);
  assert.equal(localStorage.getItem("premiumAccount"), "paid");
  await auth.emit(null);
  assert.equal(isPremium(), false);
  assert.equal(localStorage.getItem("premiumAccount"), null);
  assert.deepEqual(changes, [true, false]);
});

test("an account without it, or an anonymous player, has no Premium", async () => {
  const asked = [];
  watch({ premium: async (uid) => asked.push(uid) && false });
  await auth.emit(player("free"));
  await auth.emit(player("anon", true));
  assert.equal(isPremium(), false);
  assert.deepEqual(asked, ["free"]); // nobody looks up an anonymous player
  assert.deepEqual(changes, []);
});

test("offline, the remembered account keeps Premium; another account doesn't get it", async () => {
  watch({ premium: async () => true });
  await auth.emit(player("paid"));
  assert.equal(hasAccountPremium(), true);

  auth = fakeAuth();
  watch({
    premium: async () => {
      throw new Error("offline");
    },
  });
  await auth.emit(player("paid"));
  assert.equal(isPremium(), true);
  await auth.emit(player("someone-else"));
  assert.equal(isPremium(), false);
});

test("a slow answer for an account that already signed out is ignored", async () => {
  let release;
  watch({
    premium: (uid) =>
      uid === "slow" ? new Promise((resolve) => (release = () => resolve(true))) : false,
  });
  const pending = auth.emit(player("slow"));
  await auth.emit(player("free"));
  release();
  await pending;
  await settle();
  assert.equal(isPremium(), false);
});

test("the local test switch still unlocks Premium on its own", () => {
  localStorage.setItem("premium", "1");
  assert.equal(hasAccountPremium(), false);
  assert.equal(isPremium(), true);
  localStorage.removeItem("premium");
});
