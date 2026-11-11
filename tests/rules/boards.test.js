/**
 * Firestore rules for the boards, daily/{seed}/scores/{uid} and endless/{uid},
 * against the emulator (pnpm test:rules). No client reads them, the owner
 * included: Firestore hands every reader a document's create and update times,
 * which would show when each improving run happened. Boards come from the
 * getDailyBoard and getEndlessBoard functions (functions/src/boards.js).
 */
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  orderBy,
  limit,
  getDocs,
  setLogLevel,
} from "firebase/firestore";

const PROJECT = "demo-dino";
const SEED = "20261111";
let env;

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const dailyEntry = (uid) => ({ uid, name: "Ana", score: 900, seconds: 61 });
const endlessEntry = (uid) => ({ ...dailyEntry(uid), level: 9, seed: 5 });

async function seed(docPath, data) {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), docPath), data));
}

before(async () => {
  // each denied read is expected here, and the SDK warns about every one
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(`daily/${SEED}/scores/u1`, dailyEntry("u1"));
  await seed(`daily/${SEED}/scores/a1`, dailyEntry("a1"));
  await seed("endless/u1", endlessEntry("u1"));
  await seed("endless/a1", endlessEntry("a1"));
});

after(async () => {
  await env.cleanup();
});

const readers = () => [
  ["a stranger", as("u2"), "u2"],
  ["the owner", as("u1"), "u1"],
  ["an anonymous owner", anonymous("a1"), "a1"],
  ["no account", nobody(), "u1"],
];

test("nobody gets a daily entry directly, the owner included", async () => {
  for (const [who, db] of readers()) {
    await assertFails(getDoc(doc(db, `daily/${SEED}/scores/u1`)), `${who} got u1's daily entry`);
    await assertFails(getDoc(doc(db, `daily/${SEED}/scores/a1`)), `${who} got a1's daily entry`);
    await assertFails(getDoc(doc(db, `daily/${SEED}/scores/none`)), `${who} got a missing entry`);
  }
});

test("nobody lists a day's scores, at any limit or order", async () => {
  for (const [who, db] of readers()) {
    const scores = collection(db, "daily", SEED, "scores");
    const best = [orderBy("score", "desc"), orderBy("seconds", "asc")];
    await assertFails(getDocs(query(scores, ...best, limit(50))), `${who} listed the top 50`);
    await assertFails(getDocs(query(scores, limit(1))), `${who} listed 1`);
    await assertFails(getDocs(scores), `${who} listed all`);
    await assertFails(getDocs(query(collectionGroup(db, "scores"), limit(1))), `${who} grouped`);
  }
});

test("nobody gets or lists an endless entry directly, the owner included", async () => {
  for (const [who, db] of readers()) {
    await assertFails(getDoc(doc(db, "endless/u1")), `${who} got u1's endless entry`);
    await assertFails(getDoc(doc(db, "endless/a1")), `${who} got a1's endless entry`);
    const board = collection(db, "endless");
    const best = [orderBy("level", "desc"), orderBy("score", "desc"), orderBy("seconds", "asc")];
    await assertFails(getDocs(query(board, ...best, limit(50))), `${who} listed the top 50`);
    await assertFails(getDocs(query(board, limit(1))), `${who} listed 1`);
    await assertFails(getDocs(board), `${who} listed all`);
  }
});

test("nobody reads a board over REST, so no create or update time leaks", async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const base = `http://${host}/v1/projects/${PROJECT}/databases/(default)/documents`;
  for (const url of [
    `${base}/daily/${SEED}/scores/u1`,
    `${base}/daily/${SEED}/scores`,
    `${base}/endless/u1`,
    `${base}/endless`,
  ]) {
    const response = await fetch(url);
    const body = await response.text();
    assert.equal(response.status, 403, url);
    assert.doesNotMatch(body, /createTime|updateTime|Ana/, url);
  }
});

test("no client writes or deletes a board entry, its own included", async () => {
  for (const [who, db, uid] of readers()) {
    await assertFails(setDoc(doc(db, `daily/${SEED}/scores/${uid}`), dailyEntry(uid)), who);
    await assertFails(setDoc(doc(db, `endless/${uid}`), endlessEntry(uid)), who);
    await assertFails(deleteDoc(doc(db, `daily/${SEED}/scores/u1`)), who);
    await assertFails(deleteDoc(doc(db, "endless/u1")), who);
  }
});

// --- nothing else got looser or tighter

test("shared worlds, stats and the featured world are still public, with a list limit", async () => {
  await seed("worlds/w1", { id: "w1", name: "W" });
  await seed("worldStats/w1", { plays: 1 });
  await seed("worldStats/w1/days/20261111", { plays: 1 });
  await seed("config/featured", { id: "w1" });
  const db = nobody();
  await assertSucceeds(getDoc(doc(db, "worlds/w1")));
  await assertSucceeds(getDocs(query(collection(db, "worlds"), limit(100))));
  await assertFails(getDocs(query(collection(db, "worlds"), limit(101))));
  await assertSucceeds(getDoc(doc(db, "worldStats/w1")));
  await assertSucceeds(getDoc(doc(db, "worldStats/w1/days/20261111")));
  await assertSucceeds(getDoc(doc(db, "config/featured")));
  await assertFails(setDoc(doc(as("u1"), "worlds/w2"), { id: "w2" }));
});

test("saves, profiles, tickets and the catch-all stay closed to others", async () => {
  await seed("saves/u1", { v: 1, updatedAt: 1, data: {} });
  await seed("players/u1", { skin: "mint", hat: "cap", companion: "none" });
  await seed("runs/t1", { uid: "u1" });
  await assertSucceeds(getDoc(doc(as("u1"), "saves/u1")));
  await assertFails(getDoc(doc(as("u2"), "saves/u1")));
  await assertFails(getDoc(doc(as("u1"), "players/u1")));
  await assertFails(getDoc(doc(as("u1"), "runs/t1")));
  await assertFails(getDoc(doc(as("u1"), "limits/u1")));
  await assertFails(getDoc(doc(as("u1"), "daily/20261111")));
});
