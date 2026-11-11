/**
 * Firestore rules for players/{uid}, against the emulator (pnpm test:rules).
 * "Today" is the UTC day number of the emulator's clock (request.time), which
 * runs on this machine, so Date.now() gives the same day.
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
  updateDoc,
  deleteDoc,
  collection,
  query,
  limit,
  getDocs,
  Timestamp,
  setLogLevel,
} from "firebase/firestore";
import { dayNumber, PROFILE_BATCH } from "../../app/profiles/rules";

const PROJECT = "demo-dino";
let env;

const today = () => dayNumber(Date.now());
const valid = (extra = {}) => ({ skin: "mint", hat: "cap", companion: "none", ...extra });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

async function seed(docPath, data) {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), docPath), data));
}

/**
 * The JS SDK sends whole numbers as integers, so a double-typed seenDay
 * (20768.0) is written through the emulator's REST API with an unsigned token,
 * as a client of that account would send it.
 */
async function restCreate(uid, fields) {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const token = [
    b64({ alg: "none", typ: "JWT" }),
    b64({
      iss: `https://securetoken.google.com/${PROJECT}`,
      aud: PROJECT,
      iat: now,
      exp: now + 3600,
      auth_time: now,
      sub: uid,
      user_id: uid,
      firebase: { sign_in_provider: "custom", identities: {} },
    }),
    "",
  ].join(".");
  const url = `http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/players?documentId=${uid}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return response.status;
}

const restFields = (seenDay) => ({
  skin: { stringValue: "mint" },
  hat: { stringValue: "cap" },
  companion: { stringValue: "none" },
  ...(seenDay === undefined ? {} : { seenDay }),
});

before(async () => {
  // each denied write is expected here, and the SDK warns about every one
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

after(async () => {
  await env.cleanup();
});

// --- who writes

test("u1 sets its own profile with today's seenDay", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "players/u1"), valid({ seenDay: today() })));
});

test("u1 sets its own profile without seenDay", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "players/u1"), valid()));
});

test("u1 overwrites its existing profile, dropping seenDay", async () => {
  await seed("players/u1", valid({ seenDay: today() }));
  await assertSucceeds(setDoc(doc(as("u1"), "players/u1"), valid({ hat: "crown" })));
});

test("u1 cannot write u2's profile, new or existing", async () => {
  await assertFails(setDoc(doc(as("u1"), "players/u2"), valid()));
  await seed("players/u2", valid());
  await assertFails(setDoc(doc(as("u1"), "players/u2"), valid({ hat: "crown" })));
  await assertFails(updateDoc(doc(as("u1"), "players/u2"), { hat: "crown" }));
});

test("no account cannot write a profile", async () => {
  await assertFails(setDoc(doc(nobody(), "players/u1"), valid()));
  await seed("players/u1", valid());
  await assertFails(setDoc(doc(nobody(), "players/u1"), valid({ hat: "crown" })));
});

test("an anonymous account writes its own profile", async () => {
  await assertSucceeds(setDoc(doc(anonymous("a1"), "players/a1"), valid({ seenDay: today() })));
  await assertFails(setDoc(doc(anonymous("a1"), "players/u1"), valid()));
});

// --- the shape

test("an extra field is denied", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), valid({ name: "Rex" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ uid: "u1" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenAt: Timestamp.now() })));
  await seed("players/u1", valid());
  await assertFails(updateDoc(doc(db, "players/u1"), { name: "Rex" }));
});

test("a missing slot is denied", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), { skin: "mint", companion: "none" }));
  await assertFails(setDoc(doc(db, "players/u1"), { hat: "cap", companion: "none" }));
  await assertFails(setDoc(doc(db, "players/u1"), { skin: "mint", hat: "cap" }));
  await assertFails(setDoc(doc(db, "players/u1"), { seenDay: today() }));
});

test("an item ID that doesn't exist is denied, in each slot", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), valid({ skin: "rainbow" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ hat: "CROWN" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ companion: "" })));
  // an ID from another slot is not this slot's
  await assertFails(setDoc(doc(db, "players/u1"), valid({ skin: "cap" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ hat: "hatchling" })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ companion: "gold" })));
});

test("every slot's real IDs are allowed", async () => {
  const db = as("u1");
  await assertSucceeds(
    setDoc(doc(db, "players/u1"), { skin: "gold", hat: "crown", companion: "crystal" }),
  );
  await assertSucceeds(
    setDoc(doc(db, "players/u1"), { skin: "classic", hat: "none", companion: "hatchling" }),
  );
});

test("a non-string item is denied", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), valid({ skin: 3 })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ hat: ["cap"] })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ companion: { id: "none" } })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ skin: null })));
});

test("a 10,000-character skin is denied", async () => {
  await assertFails(setDoc(doc(as("u1"), "players/u1"), valid({ skin: "m".repeat(10000) })));
});

// --- seenDay

test("seenDay of yesterday is allowed (a device clock a day behind)", async () => {
  await assertSucceeds(setDoc(doc(as("u1"), "players/u1"), valid({ seenDay: today() - 1 })));
});

test("seenDay of two days ago or tomorrow is denied", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: today() - 2 })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: today() + 1 })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: 0 })));
});

test("seenDay that isn't an int is denied", async () => {
  const db = as("u1");
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: 20768.5 })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: today() + 0.5 })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: String(today()) })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: null })));
  await assertFails(setDoc(doc(db, "players/u1"), valid({ seenDay: Timestamp.now() })));
});

test("seenDay as a double equal to today is denied (only an int counts)", async () => {
  // the REST path itself works: an integer today is allowed
  assert.equal(await restCreate("u1", restFields({ integerValue: String(today()) })), 200);
  await env.clearFirestore();
  assert.equal(await restCreate("u1", restFields({ doubleValue: today() })), 403);
});

// --- delete and reads

test("a client cannot delete its own profile", async () => {
  await seed("players/u1", valid());
  await assertFails(deleteDoc(doc(as("u1"), "players/u1")));
  await assertFails(deleteDoc(doc(nobody(), "players/u1")));
});

// Firestore hands every reader a document's create and update times, so no
// client reads players/{uid} at all: boards ask the getProfiles function.
const readers = () => [
  ["a stranger", as("u2")],
  ["the owner", as("u1")],
  ["an anonymous account", anonymous("a1")],
  ["no account", nobody()],
];

test("nobody gets a profile directly, the owner included", async () => {
  await seed("players/u1", valid({ seenDay: today() }));
  for (const [who, db] of readers()) {
    await assertFails(getDoc(doc(db, "players/u1")), `${who} got players/u1`);
  }
});

test("nobody lists profiles, at any limit", async () => {
  await seed("players/u1", valid());
  for (const [who, db] of readers()) {
    const players = collection(db, "players");
    await assertFails(getDocs(query(players, limit(PROFILE_BATCH))), `${who} listed 30`);
    await assertFails(getDocs(query(players, limit(1))), `${who} listed 1`);
    await assertFails(getDocs(players), `${who} listed all`);
  }
});

test("nobody reads a profile over REST, so no create or update time leaks", async () => {
  await seed("players/u1", valid({ seenDay: today() }));
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const base = `http://${host}/v1/projects/${PROJECT}/databases/(default)/documents/players`;
  for (const url of [`${base}/u1`, base]) {
    const response = await fetch(url);
    const body = await response.text();
    assert.equal(response.status, 403, `${url} answered ${response.status}`);
    assert.doesNotMatch(body, /createTime|updateTime/);
  }
});

test("the owner still creates and replaces its profile with reads closed", async () => {
  const db = as("u1");
  await assertSucceeds(setDoc(doc(db, "players/u1"), valid({ seenDay: today() })));
  await assertSucceeds(setDoc(doc(db, "players/u1"), valid({ hat: "crown" })));
  await assertSucceeds(updateDoc(doc(db, "players/u1"), { skin: "gold" }));
  await assertFails(deleteDoc(doc(db, "players/u1")));
});

// --- the rest of the rules still hold

test("saves/u1 stays private to u1", async () => {
  await seed("saves/u1", { v: 1, updatedAt: 1, data: {} });
  await assertFails(getDoc(doc(as("u2"), "saves/u1")));
  await assertSucceeds(getDoc(doc(as("u1"), "saves/u1")));
});

test("a write to an unmatched path is denied", async () => {
  await assertFails(setDoc(doc(as("u1"), "foo/bar"), { a: 1 }));
  await assertFails(getDoc(doc(as("u1"), "foo/bar")));
});
