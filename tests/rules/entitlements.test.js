/**
 * Firestore rules for entitlements/{uid} = { premium: true }, against the emulator
 * (pnpm test:rules). The developer sets them in the Firebase console; a player can
 * read their own, to unlock Premium in the game, and nobody can write one from the game.
 */
import test, { before, after, beforeEach } from "node:test";
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
  getDocs,
  setLogLevel,
} from "firebase/firestore";

const PROJECT = "demo-dino";
let env;

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = (uid) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

before(async () => {
  // each denied request is expected here, and the SDK warns about every one
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), "entitlements/u1"), { premium: true }),
  );
});

after(async () => {
  await env.cleanup();
});

test("a player reads their own entitlement, even before one exists", async () => {
  await assertSucceeds(getDoc(doc(as("u1"), "entitlements/u1")));
  await assertSucceeds(getDoc(doc(as("u2"), "entitlements/u2")));
  await assertSucceeds(getDoc(doc(anonymous("a1"), "entitlements/a1")));
});

test("nobody reads someone else's entitlement or lists them", async () => {
  await assertFails(getDoc(doc(as("u2"), "entitlements/u1")));
  await assertFails(getDoc(doc(nobody(), "entitlements/u1")));
  await assertFails(getDocs(collection(as("u1"), "entitlements")));
});

test("nobody grants, changes or removes an entitlement from the game", async () => {
  await assertFails(setDoc(doc(as("u2"), "entitlements/u2"), { premium: true }));
  await assertFails(updateDoc(doc(as("u1"), "entitlements/u1"), { premium: false }));
  await assertFails(deleteDoc(doc(as("u1"), "entitlements/u1")));
  await assertFails(setDoc(doc(nobody(), "entitlements/u3"), { premium: true }));
});
