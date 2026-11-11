import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { isTestHost } from "../app/util/premium";
import { getData, setData } from "../app/util";

const ORIGIN = "https://dino.spanion.in";

/** Runs app/sw.js with a fake worker scope; returns its fetch handler. */
function loadWorker() {
  const listeners = {};
  const puts = [];
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    registration: {},
    clients: {},
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const caches = {
    open: async () => ({ put: async (key, res) => puts.push(key.url || key) }),
    match: async () => undefined,
    keys: async () => [],
  };
  class Req {
    constructor(url, init = {}) {
      this.url = new URL(url, self.location).href;
      this.method = init.method || "GET";
      this.mode = init.mode || "cors";
    }
  }
  const context = {
    self,
    caches,
    URL,
    Request: Req,
    Response: { error: () => ({ type: "error" }) },
    fetch: async () => ({
      status: 200,
      type: "basic",
      clone() {
        return this;
      },
    }),
  };
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), "app", "sw.js"), "utf8"), context);
  const handle = async (url, init) => {
    let responded = null;
    const waits = [];
    listeners.fetch({
      request: new Req(url, init),
      respondWith: (p) => (responded = p),
      waitUntil: (p) => waits.push(p),
    });
    if (responded) await responded;
    await Promise.all(waits);
    return Boolean(responded);
  };
  return { handle, puts };
}

test("service worker: only the game's own GET files are cached", async () => {
  const { handle, puts } = loadWorker();
  assert.equal(await handle(`${ORIGIN}/bundle.js`), true);
  assert.equal(await handle(`${ORIGIN}/sign`, { method: "POST" }), false, "POSTs pass through");
  assert.equal(
    await handle(`${ORIGIN}/__/auth/handler?state=secret`),
    false,
    "sign-in handler never cached",
  );
  assert.equal(
    await handle("https://firestore.googleapis.com/x"),
    false,
    "other origins pass through",
  );
  assert.equal(
    await handle(`${ORIGIN}/w/abcd1234`, { mode: "navigate" }),
    false,
    "world links are not the game page",
  );
  assert.deepEqual(puts, [`${ORIGIN}/bundle.js`]);
});

test("service worker: every game page address is cached as one page", async () => {
  const { handle, puts } = loadWorker();
  await handle(`${ORIGIN}/?from=reminder`, { mode: "navigate" });
  await handle(`${ORIGIN}/?world=abcd1234`, { mode: "navigate" });
  assert.deepEqual(puts, [`${ORIGIN}/`, `${ORIGIN}/`]);
});

test("testing switches only on local and PR preview hosts", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "dinos-adventure--pr13-abc123.web.app"]) {
    assert.equal(isTestHost(host), true, host);
  }
  for (const host of [
    "dino.spanion.in",
    "dinos-adventure.web.app",
    "dinos-adventure.firebaseapp.com",
    "akaspanion.github.io",
    "localhost.evil.com",
  ]) {
    assert.equal(isTestHost(host), false, host);
  }
});

test("getData survives corrupt storage", () => {
  localStorage.setItem("mute_sounds", "{not json");
  assert.equal(getData("mute_sounds"), null);
  setData("mute_sounds", true);
  assert.equal(getData("mute_sounds"), true);
});
