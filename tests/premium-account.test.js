import "./env";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isPremium, watchAccountPremium } from "../app/util/premium";

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

let auth;
let changes;
const watch = (entitlements) =>
  watchAccountPremium(auth, entitlements, () => changes.push(isPremium()));

beforeEach(async () => {
  // every test starts signed out
  auth = fakeAuth();
  watchAccountPremium(auth, { premium: async () => false });
  await auth.emit(null);
  auth = fakeAuth();
  changes = [];
});

test("an account whose Firestore doc says premium: true has Premium, until sign-out", async () => {
  watch({ premium: async (uid) => uid === "paid" });
  assert.equal(isPremium(), false);
  await auth.emit(player("paid"));
  assert.equal(isPremium(), true);
  await auth.emit(null);
  assert.equal(isPremium(), false);
  assert.deepEqual(changes, [true, false]);
});

test("only the boolean true counts", async () => {
  for (const answer of ["true", 1, {}, null, undefined, false]) {
    auth = fakeAuth();
    watch({ premium: async () => answer });
    await auth.emit(player("u1"));
    assert.equal(isPremium(), false, `answer ${JSON.stringify(answer)}`);
  }
});

test("an account without the doc, or an anonymous player, has no Premium", async () => {
  const asked = [];
  watch({ premium: async (uid) => asked.push(uid) && false });
  await auth.emit(player("free"));
  await auth.emit(player("anon", true));
  assert.equal(isPremium(), false);
  assert.deepEqual(asked, ["free"]); // nobody looks up an anonymous player
  assert.deepEqual(changes, []);
});

test("offline, nothing is remembered: no Premium until Firestore answers", async () => {
  watch({ premium: async () => true });
  await auth.emit(player("paid"));
  assert.equal(isPremium(), true);

  auth = fakeAuth();
  watch({
    premium: async () => {
      throw new Error("offline");
    },
  });
  await auth.emit(player("paid"));
  assert.equal(isPremium(), false);
});

test("switching accounts drops Premium at once, and a late answer for the old one is ignored", async () => {
  let release;
  watch({
    premium: (uid) =>
      uid === "slow" ? new Promise((resolve) => (release = () => resolve(true))) : false,
  });
  const pending = auth.emit(player("slow"));
  await auth.emit(player("free"));
  release();
  await pending;
  assert.equal(isPremium(), false);
});

test("nothing on the device turns Premium on: no URL, switch, build flag or saved value", () => {
  localStorage.setItem("premium", "1");
  localStorage.setItem("premiumAccount", "paid");
  assert.equal(isPremium(), false);
  const src = fs.readFileSync("app/util/premium.js", "utf8");
  assert.doesNotMatch(src, /localStorage\.(getItem|setItem)/);
  assert.doesNotMatch(src, /PREMIUM_DEFAULT|URLSearchParams/);
  const game = fs.readFileSync("app/index.js", "utf8");
  assert.doesNotMatch(game, /setPremium|premiumUnlockBtn|setPremiumDev/);
  assert.doesNotMatch(fs.readFileSync("webpack.config.js", "utf8"), /PREMIUM/);
  // the server reads the same doc, emulators included
  const fn = fs.readFileSync("functions/index.js", "utf8");
  assert.doesNotMatch(fn, /FUNCTIONS_EMULATOR/);
});
