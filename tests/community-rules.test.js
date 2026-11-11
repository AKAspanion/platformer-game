import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  dayKey,
  trendAfterPlay,
  pickFeatured,
  formatCount,
  weekNote,
  isBuiltIn,
  worldLink,
  linkedWorldId,
} from "../app/worlds/community";
import { sanitizeWorld } from "../app/worlds/spec";

const root = process.cwd();
const DAY = 86400000;

test("dayKey is the UTC day", () => {
  const end = Date.UTC(2026, 10, 11, 23, 59);
  assert.equal(dayKey(end), "20261111");
  assert.equal(dayKey(end + 60000), "20261112");
});

test("trendAfterPlay favours recent plays over older ones", () => {
  const now = Date.UTC(2026, 10, 11);
  let a = null;
  for (let i = 0; i < 10; i++) a = trendAfterPlay(a, now - 9 * DAY);
  let b = null;
  for (let i = 0; i < 4; i++) b = trendAfterPlay(b, now);
  assert.ok(b > a);
});

test("trendAfterPlay: two plays at one moment score exactly 1 above one", () => {
  const now = Date.UTC(2026, 10, 11);
  const one = trendAfterPlay(null, now);
  const two = trendAfterPlay(one, now);
  assert.equal(two - one, 1);
});

test("trendAfterPlay stays finite over ten years of plays", () => {
  let score = null;
  const start = Date.UTC(2026, 0, 1);
  for (let d = 0; d < 3650; d++) score = trendAfterPlay(score, start + d * DAY);
  assert.ok(Number.isFinite(score));
});

const cand = (id, plays14, likes14, createdAt = 1) => ({ id, plays14, likes14, createdAt });

test("pickFeatured: needs 20 plays, then the best likes per play", () => {
  const list = [cand("a", 30, 6), cand("b", 25, 6), cand("c", 19, 10)];
  assert.equal(pickFeatured(list, null), "b");
});

test("pickFeatured: ties go to more plays, then the newer world", () => {
  assert.equal(pickFeatured([cand("a", 30, 6), cand("b", 25, 5)], null), "a");
  assert.equal(pickFeatured([cand("a", 30, 6, 1), cand("b", 30, 6, 2)], null), "b");
});

test("pickFeatured: last week's world is skipped", () => {
  const list = [cand("a", 30, 6), cand("b", 25, 6)];
  assert.equal(pickFeatured(list, "b"), "a");
});

test("pickFeatured: null when nobody has 20 plays", () => {
  assert.equal(pickFeatured([cand("a", 19, 19)], null), null);
  assert.equal(pickFeatured([], null), null);
});

test("formatCount shortens thousands", () => {
  assert.deepEqual([999, 1000, 1240, 12340].map(formatCount), ["999", "1k", "1.2k", "12.3k"]);
});

test("weekNote reads like the spec", () => {
  assert.equal(
    weekNote({ plays: 120, finishes: 37, likes: 15 }),
    "120 plays · 37 beat the boss · 15 ❤ this week",
  );
});

test("isBuiltIn: starters and Starfall Peaks only", () => {
  assert.equal(isBuiltIn("starter-meadow"), true);
  assert.equal(isBuiltIn("starfall-peaks"), true);
  assert.equal(isBuiltIn("wabc123"), false);
});

test("worldLink uses the game's origin", () => {
  assert.equal(worldLink("wabc123"), "https://dino.spanion.in/w/wabc123");
});

test("linkedWorldId reads /w/<id> or ?world=<id>, only valid ids", () => {
  assert.equal(linkedWorldId({ pathname: "/w/wabc123", search: "" }), "wabc123");
  assert.equal(linkedWorldId({ pathname: "/", search: "?world=wabc123" }), "wabc123");
  assert.equal(linkedWorldId({ pathname: "/w/<script>", search: "" }), null);
  assert.equal(linkedWorldId({ pathname: "/w/", search: "" }), null);
  assert.equal(linkedWorldId({ pathname: "/", search: "?world=<x>" }), null);
  assert.equal(linkedWorldId({ pathname: "/", search: "" }), null);
});

test("sanitizeWorld keeps a valid remixOf and drops an invalid one", () => {
  const base = { id: "wnew1234", name: "X", spec: {} };
  assert.equal(sanitizeWorld({ ...base, remixOf: "wxyz987" }).remixOf, "wxyz987");
  assert.equal("remixOf" in sanitizeWorld({ ...base, remixOf: "bad id!" }), false);
  assert.equal("remixOf" in sanitizeWorld({ ...base, remixOf: { a: 1 } }), false);
  assert.equal("remixOf" in sanitizeWorld(base), false);
});

test("the sync script covers community.js and the copy loads in Node", async () => {
  const sync = path.join(root, "scripts", "sync-functions-shared.js");
  const run = spawnSync("node", [sync, "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /functions\/shared\/worlds\/community\.js is up to date/);
  const copy = path.join(root, "functions", "shared", "worlds", "community.js");
  const out = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import(${JSON.stringify(copy)}).then(m=>console.log(m.dayKey(0)))`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(out.stdout.trim(), "19700101", out.stderr);
});

// ---------------------------------------------------------------- rules file
const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
/** The text of `match <header> { ... }` (balanced braces). */
function block(header) {
  const start = rules.indexOf(`match ${header} {`);
  assert.ok(start >= 0, `missing match ${header}`);
  let depth = 0;
  for (let i = start + `match ${header} `.length; i < rules.length; i++) {
    if (rules[i] === "{") depth++;
    if (rules[i] === "}" && --depth === 0) return rules.slice(start, i + 1);
  }
  throw new Error("unbalanced");
}

test("rules: server-owned collections deny client writes", () => {
  for (const header of [
    "/worldStats/{worldId}",
    "/days/{day}",
    "/worldLikes/{id}",
    "/thumbs/{worldId}",
    "/config/{doc}",
  ]) {
    const text = block(header);
    assert.match(text, /allow write: if false;/, header);
    assert.doesNotMatch(text, /allow (create|update|delete)[^;]*if (?!false)/, header);
  }
});

test("rules: stats and featured are public to read", () => {
  assert.match(block("/worldStats/{worldId}"), /allow get: if true;/);
  assert.match(block("/days/{day}"), /allow get: if true;/);
  assert.match(block("/config/{doc}"), /allow get: if true;/);
});

test("rules: likes readable only by their owner; thumbs and dedupe markers closed", () => {
  const likes = block("/worldLikes/{id}");
  assert.match(
    likes,
    /allow read: if request\.auth != null && request\.auth\.uid == resource\.data\.uid;/,
  );
  const thumbs = block("/thumbs/{worldId}");
  assert.doesNotMatch(thumbs, /allow (read|get|list)/);
  assert.doesNotMatch(rules, /match \/seen\//); // no match: the catch-all denies it
});

test("rules: the existing matches and the catch-all deny survive, deny last", () => {
  for (const header of ["/worlds/{worldId}", "/daily/{seed}/scores/{uid}", "/saves/{uid}"]) {
    block(header);
  }
  const catchAll = rules.indexOf("match /{document=**}");
  assert.ok(
    catchAll > rules.indexOf("match /thumbs/") && catchAll > rules.indexOf("match /config/"),
  );
});

test("firestore.indexes.json orders worldStats by trend; hosting rewrites /w/**", () => {
  const indexes = fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8");
  const parsed = JSON.parse(indexes);
  const override = parsed.fieldOverrides.find(
    (o) => o.collectionGroup === "worldStats" && o.fieldPath === "trend",
  );
  assert.ok(override.indexes.some((i) => i.order === "DESCENDING"));
  const firebase = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  assert.deepEqual(firebase.hosting.rewrites, [
    { source: "/w/**", function: { functionId: "worldPage", region: "asia-south1" } },
  ]);
});
