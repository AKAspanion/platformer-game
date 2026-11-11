import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { avatarKey, createAvatars, rowLooks, loadProfiles } from "../app/profiles/avatar";
import { cleanProfile, PROFILE_BATCH } from "../app/profiles/rules";
import { createProfiles } from "../app/profiles";
import { CATALOG } from "../app/shop/catalog";

const TODAY = 20000;
const companion = CATALOG.companion.find((item) => item.id !== "none").id;
const classic = avatarKey(null);
const uids = (n) => Array.from({ length: n }, (_, i) => `u${i}`);
const rows = (n) => uids(n).map((uid, i) => ({ uid, rank: i + 1, name: `P${i}`, score: 1 }));

test("avatarKey: null is the classic key, combinations differ", () => {
  assert.equal(avatarKey(null), avatarKey({ skin: "classic", hat: "none", companion: "none" }));
  assert.notEqual(avatarKey({ skin: "gold", hat: "none", companion: "none" }), classic);
  assert.notEqual(
    avatarKey({ skin: "gold", hat: "crown", companion }),
    avatarKey({ skin: "gold", hat: "crown", companion: "none" }),
  );
});

test("avatarKey: unknown or markup values fall to the free item", () => {
  assert.equal(avatarKey({ skin: "rainbow", hat: "none", companion: "none" }), classic);
  assert.equal(
    avatarKey({ skin: "classic", hat: "<img src=x onerror=alert(1)>", companion: "none" }),
    classic,
  );
});

test("rowLooks: gold crown companion seen 3 days ago", () => {
  const map = new Map([
    ["u0", cleanProfile({ skin: "gold", hat: "crown", companion, seenDay: TODAY - 3 })],
  ]);
  const [look] = rowLooks(rows(1), map, TODAY);
  assert.equal(look.avatarKey, avatarKey({ skin: "gold", hat: "crown", companion }));
  assert.equal(look.seen, "3d ago");
});

test("rowLooks: seenDay null shows no status, missing profile shows classic", () => {
  const map = new Map([
    ["u0", cleanProfile({ skin: "mint", hat: "cap", companion: "none", seenDay: null })],
  ]);
  const looks = rowLooks(rows(2), map, TODAY);
  assert.equal(looks[0].seen, "");
  assert.notEqual(looks[0].avatarKey, classic);
  assert.deepEqual(looks[1], { uid: "u1", avatarKey: classic, seen: "", profile: null });
});

test("rowLooks: unknown skin and markup hat draw the free items", () => {
  const map = new Map([
    [
      "u0",
      cleanProfile({ skin: "rainbow", hat: "<img src=x onerror=alert(1)>", companion: "none" }),
    ],
  ]);
  const [look] = rowLooks(rows(1), map, TODAY);
  assert.equal(look.avatarKey, classic);
  assert.equal(look.seen, "");
});

test("loadProfiles: late profiles are dropped when the tab changed", async () => {
  let current = true;
  const result = await loadProfiles(["a"], {
    fetch: async () => {
      current = false;
      return new Map([["a", {}]]);
    },
    isCurrent: () => current,
  });
  assert.equal(result, null);
});

test("loadProfiles: a rejected fetch gives null, not a throw", async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args);
  try {
    const result = await loadProfiles(["a"], {
      fetch: async () => {
        throw new Error("permission-denied");
      },
      isCurrent: () => true,
    });
    assert.equal(result, null);
    assert.equal(warned.length, 1);
  } finally {
    console.warn = warn;
  }
});

test("loadProfiles: one fetch with every uid", async () => {
  const calls = [];
  const map = new Map();
  const result = await loadProfiles(uids(51), {
    fetch: async (list) => (calls.push(list), map),
    isCurrent: () => true,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 51);
  assert.equal(result, map);
});

test("120 uids reach the backend in queries of at most 30", async () => {
  const asked = [];
  const profiles = createProfiles({
    backend: { getMany: async (batch) => (asked.push(batch.length), []), set: async () => {} },
    storage: { getItem: () => null, setItem: () => {} },
  });
  await profiles.fetch(uids(120));
  assert.deepEqual(asked, [30, 30, 30, 30]);
  assert.ok(asked.every((n) => n <= PROFILE_BATCH));
});

test("20 rows sharing a combination draw once; copies are separate canvases", () => {
  let drawn = 0;
  const avatars = createAvatars({
    makeCanvas: () => ({ getContext: () => ({ drawImage() {}, clearRect() {} }) }),
    draw: () => ((drawn += 1), true),
  });
  const look = { skin: "gold", hat: "crown", companion };
  const canvases = Array.from({ length: 20 }, () => avatars.canvas(look));
  assert.equal(drawn, 1);
  assert.equal(new Set(canvases).size, 20);
  avatars.canvas({ skin: "mint", hat: "cap", companion: "none" });
  assert.equal(drawn, 2);
});

test("a sprite that loads late redraws the cached drawing and its copies", () => {
  let ready = false;
  let redraw = null;
  const blits = [];
  const avatars = createAvatars({
    makeCanvas: () => ({
      getContext: () => ({ drawImage: (src) => blits.push(src), clearRect() {} }),
    }),
    draw: (ctx, look, again) => {
      redraw = again;
      return ready;
    },
  });
  avatars.canvas(null);
  const before = blits.length;
  ready = true;
  redraw();
  assert.ok(blits.length > before);
});

test("the board's look painting catches and logs its own errors", () => {
  const index = fs.readFileSync("app/index.js", "utf8");
  assert.match(
    index,
    /paintLooks\(load, shown\)\.catch\(\(error\) =>\s*console\.warn\("Profiles failed:", error && error\.name\)/,
  );
  assert.equal(index.match(/paintLooks\(load, shown\);/g), null, "no fire-and-forget call");
});

test("the profiles backend says how profiles are really read", () => {
  const client = fs.readFileSync("app/firebase/profiles.js", "utf8");
  assert.doesNotMatch(client, /readable by anyone signed in/);
  assert.match(client, /read only through the getProfiles function/);
});
