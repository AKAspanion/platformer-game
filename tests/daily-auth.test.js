import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import { createAuth } from "../app/auth/index";
import { mockAuthBackend } from "../app/auth/mock";
import { createLeaderboard } from "../app/daily/leaderboard";
import { generatedName } from "../app/daily/rules";

const fresh = () => {
  localStorage.removeItem("mock_auth");
  const backend = mockAuthBackend();
  let accounts = 0;
  const signInAnonymously = backend.signInAnonymously;
  backend.signInAnonymously = async (...args) => {
    accounts++;
    return signInAnonymously(...args);
  };
  return { auth: createAuth(backend), accounts: () => accounts };
};

test("ensurePlayer signs in anonymously once, with the generated name", async () => {
  const { auth, accounts } = fresh();
  const player = await auth.ensurePlayer();
  assert.equal(player.isAnonymous, true);
  assert.equal(player.name, generatedName(player.uid));
  assert.equal(auth.currentUser.isAnonymous, true);
  assert.equal(accounts(), 1);

  const again = await auth.ensurePlayer();
  assert.equal(again.uid, player.uid);
  assert.equal(accounts(), 1);
});

test("two ensurePlayer calls at once make one account", async () => {
  const { auth, accounts } = fresh();
  const [a, b] = await Promise.all([auth.ensurePlayer(), auth.ensurePlayer()]);
  assert.equal(a.uid, b.uid);
  assert.equal(accounts(), 1);
});

test("ensurePlayer keeps a signed-in player and their name", async () => {
  const { auth, accounts } = fresh();
  await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  const player = await auth.ensurePlayer();
  assert.deepEqual(
    { name: player.name, isAnonymous: player.isAnonymous },
    { name: "Ana", isAnonymous: false },
  );
  assert.equal(accounts(), 0);
});

test("ensurePlayer restores an anonymous session after a restart", async () => {
  const { auth } = fresh();
  const player = await auth.ensurePlayer();
  const restarted = createAuth(mockAuthBackend());
  const again = await restarted.ensurePlayer();
  assert.equal(again.uid, player.uid);
});

test("ensurePlayer fails when anonymous sign-in does, and tries again next time", async () => {
  const { auth } = fresh();
  const backend = mockAuthBackend();
  let fail = true;
  const original = backend.signInAnonymously;
  backend.signInAnonymously = async () => {
    if (fail) throw new Error("No connection.");
    return original();
  };
  auth.use(backend);
  await assert.rejects(auth.ensurePlayer(), /No connection/);
  fail = false;
  assert.equal((await auth.ensurePlayer()).isAnonymous, true);
});

test("the world creator's sign-in gate treats an anonymous player as signed out", async () => {
  const { auth } = fresh();
  assert.equal(auth.signedIn, false);
  await auth.ensurePlayer();
  assert.ok(auth.currentUser);
  assert.equal(auth.signedIn, false);
  await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  assert.equal(auth.signedIn, true);
});

test("creating an email account while anonymous links it: same uid, no longer anonymous", async () => {
  const { auth } = fresh();
  const player = await auth.ensurePlayer();
  const seen = [];
  auth.onAuthStateChanged((user) => seen.push(user && user.isAnonymous));
  const user = await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  assert.equal(user.uid, player.uid);
  assert.equal(user.isAnonymous, false);
  assert.equal(auth.currentUser.isAnonymous, false);
  assert.equal(auth.currentUser.displayName, "Ana");
  assert.deepEqual(seen, [true, false]);
});

test("signing in to an existing email account while anonymous switches to it", async () => {
  const { auth } = fresh();
  const made = await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  await auth.signOut();
  const player = await auth.ensurePlayer();
  assert.notEqual(player.uid, made.uid);
  const user = await auth.signInWithEmail({ email: "ana@example.com", password: "secret1" });
  assert.equal(user.uid, made.uid);
  assert.equal(auth.currentUser.uid, made.uid);
  assert.equal(auth.currentUser.isAnonymous, false);
});

test("a wrong password while anonymous leaves the anonymous player in place", async () => {
  const { auth } = fresh();
  const made = await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  await auth.signOut();
  const player = await auth.ensurePlayer();
  await assert.rejects(
    auth.signInWithEmail({ email: "ana@example.com", password: "nope" }),
    /Wrong email or password/,
  );
  assert.equal(auth.currentUser.uid, player.uid);
  assert.notEqual(player.uid, made.uid);
});

test("creating an account for an email that exists keeps the anonymous player", async () => {
  const { auth } = fresh();
  await auth.signInWithEmail({
    email: "ana@example.com",
    password: "secret1",
    name: "Ana",
    create: true,
  });
  await auth.signOut();
  const player = await auth.ensurePlayer();
  await assert.rejects(
    auth.signInWithEmail({
      email: "ana@example.com",
      password: "secret1",
      name: "Ana",
      create: true,
    }),
    /already has an account/,
  );
  assert.equal(auth.currentUser.uid, player.uid);
  assert.equal(auth.currentUser.isAnonymous, true);
});

test("an anonymous player is never asked to verify an email", async () => {
  const { auth } = fresh();
  await auth.ensurePlayer();
  assert.equal(auth.needsVerification(), false);
});

test("leaderboard.submit sends only seed, score, seconds and the run's ticket", async () => {
  const sent = [];
  const board = createLeaderboard({
    call: async (name, data) => {
      sent.push([name, data]);
      return { rank: 1, total: 1, best: { score: 10, seconds: 40 }, improved: true };
    },
    board: async () => ({ top: [], me: null }),
  });
  const out = await board.submit({
    seed: 20261111,
    score: 10,
    seconds: 40,
    ticket: "t1",
    name: "Hacker",
  });
  assert.deepEqual(sent, [
    ["submitDailyScore", { seed: 20261111, score: 10, seconds: 40, ticket: "t1" }],
  ]);
  assert.equal(out.rank, 1);
});
