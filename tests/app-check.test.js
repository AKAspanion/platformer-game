import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { appCheckPlan, startAppCheck } from "../app/firebase/app-check";

const KEY = "6Lc-site-key";

test("App Check is off without a site key, and against the emulators", () => {
  assert.equal(appCheckPlan({ siteKey: "", hostname: "dino.spanion.in" }).use, false);
  assert.equal(appCheckPlan({ siteKey: KEY, hostname: "localhost", emulators: true }).use, false);
});

test("App Check runs with the site key; a debug token only on local hosts", () => {
  const live = appCheckPlan({ siteKey: KEY, debugToken: "dbg", hostname: "dino.spanion.in" });
  assert.deepEqual(live, { use: true, siteKey: KEY, debugToken: null });
  const local = appCheckPlan({ siteKey: KEY, debugToken: "dbg", hostname: "localhost" });
  assert.deepEqual(local, { use: true, siteKey: KEY, debugToken: "dbg" });
  assert.equal(
    appCheckPlan({ siteKey: KEY, debugToken: "dbg", hostname: "localhost.evil.com" }).debugToken,
    null,
  );
});

test("startAppCheck does nothing when off", async () => {
  assert.equal(await startAppCheck({}, { use: false }), false);
});

test("release builds never carry the App Check debug token", () => {
  // scripts/load-env.js reads .env at require time: give it values through the environment
  const saved = { ...process.env };
  process.env.FIREBASE_APPCHECK_SITE_KEY = KEY;
  process.env.FIREBASE_APPCHECK_DEBUG_TOKEN = "dbg";
  const file = path.join(process.cwd(), "scripts", "load-env.js");
  const module = { exports: {} };
  new Function("module", "exports", "require", "__dirname", fs.readFileSync(file, "utf8"))(
    module,
    module.exports,
    (name) => require(name),
    path.dirname(file),
  );
  const { buildEnv, DEV_ONLY_KEYS } = module.exports;
  process.env = saved;
  assert.deepEqual(DEV_ONLY_KEYS, ["FIREBASE_APPCHECK_DEBUG_TOKEN"]);
  assert.equal(buildEnv("production").FIREBASE_APPCHECK_DEBUG_TOKEN, undefined);
  assert.equal(buildEnv("production").FIREBASE_APPCHECK_SITE_KEY, KEY);
  assert.equal(buildEnv("development").FIREBASE_APPCHECK_DEBUG_TOKEN, "dbg");
});

test("every callable goes through the App Check gate", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "functions", "index.js"), "utf8");
  assert.match(source, /onCall\(\{ enforceAppCheck: APP_CHECK_ENFORCE, \.\.\.options \}/);
  assert.equal(/^export const \w+ = onCall\(/m.test(source), false, "no callable skips the gate");
  const env = fs.readFileSync(path.join(process.cwd(), "functions", ".env"), "utf8");
  assert.match(env, /^APP_CHECK_ENFORCE=(true|false)$/m);
});
