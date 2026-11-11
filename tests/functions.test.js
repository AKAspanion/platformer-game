import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleDesign,
  handlePublish,
  handleSearch,
  handleDeleteAccount,
  overLimit,
  authorName,
  LIMITS,
  MAX_RESULTS,
} from "../functions/src/handlers.js";
import { newWorld, specFromPrompt, matchWorlds, ANONYMOUS } from "../app/worlds/spec";

// the functions validate worlds with a copy of the game's spec.js
test("functions use the same world validation as the game", () => {
  const root = path.resolve(process.cwd());
  const game = fs.readFileSync(path.join(root, "app/worlds/spec.js"), "utf8");
  const copy = fs.readFileSync(path.join(root, "functions/shared/spec.js"), "utf8");
  assert.ok(copy.endsWith(game), "run node scripts/sync-functions-shared.js");
});

const user = (uid = "u1", name = "Ana") => ({ uid, token: { name, email: "ana@example.com" } });
const open = async () => false;

test("designWorld: signed in, a real prompt, rate limited", async () => {
  const design = async (prompt) => ({ spec: { name: `World of ${prompt}` } });
  await assert.rejects(
    handleDesign({ auth: null, data: { prompt: "caves" } }, { design, limiter: open }),
    (e) => e.code === "unauthenticated",
  );
  await assert.rejects(
    handleDesign({ auth: user(), data: { prompt: " a " } }, { design, limiter: open }),
    (e) => e.code === "invalid-argument",
  );
  const long = "x".repeat(900);
  const out = await handleDesign(
    { auth: user(), data: { prompt: long } },
    { design, limiter: open },
  );
  assert.equal(out.spec.name.length, "World of ".length + 400);

  const kinds = [];
  await assert.rejects(
    handleDesign(
      { auth: user(), data: { prompt: "caves" } },
      {
        design,
        limiter: async (uid, kind, max) => {
          kinds.push([uid, kind, max]);
          return true;
        },
      },
    ),
    (e) => e.code === "resource-exhausted",
  );
  assert.deepEqual(kinds, [["u1", "design", LIMITS.design]]);

  await assert.rejects(
    handleDesign(
      { auth: user(), data: { prompt: "caves" } },
      { design: async () => ({ refused: true }), limiter: open },
    ),
    (e) => e.code === "invalid-argument",
  );
});

test("publishWorld: validates, stamps author and time, refuses duplicates", async () => {
  const saved = [];
  const store = {
    async create(world) {
      if (saved.some((w) => w.id === world.id)) {
        throw Object.assign(new Error("That world is already shared."), { code: "already-exists" });
      }
      saved.push(world);
    },
  };
  const world = newWorld(specFromPrompt("lava caves"), { uid: "someone-else", displayName: "Eve" });
  await assert.rejects(
    handlePublish({ auth: null, data: { world } }, { store, limiter: open }),
    (e) => e.code === "unauthenticated",
  );
  await assert.rejects(
    handlePublish({ auth: user(), data: { world: { id: "!" } } }, { store, limiter: open }),
    (e) => e.code === "invalid-argument",
  );

  const out = await handlePublish(
    { auth: user("u1", "Ana <script>"), data: { world: { ...world, createdAt: 1 } } },
    { store, limiter: open, now: () => 1234567 },
  );
  assert.deepEqual(out.world.author, { uid: "u1", name: "Ana script" });
  assert.equal(out.world.createdAt, 1234567);
  assert.equal(saved.length, 1);
  assert.ok(!JSON.stringify(saved[0]).includes("ana@example.com"), "never the email");

  await assert.rejects(
    handlePublish({ auth: user(), data: { world } }, { store, limiter: open }),
    (e) => e.code === "already-exists",
  );
  assert.equal(authorName({ uid: "x", token: {} }), "Someone");
});

test("publishWorld: passes a valid PNG thumbnail to the store, drops anything else", async () => {
  const created = [];
  const store = { create: async (world, thumb) => created.push(thumb) };
  const png = Buffer.alloc(2048);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(480, 16);
  png.writeUInt32BE(270, 20);
  const world = () => newWorld(specFromPrompt("ice caves"), { uid: "x", displayName: "X" });
  const publish = (thumb) =>
    handlePublish({ auth: user(), data: { world: world(), thumb } }, { store, limiter: open });
  await publish(png.toString("base64"));
  await publish(Buffer.from("just text, not a picture at all").toString("base64"));
  await publish();
  assert.deepEqual(created, [png, null, null]);
});

test("rate limit: a sliding hour per user and kind", async () => {
  const docs = {};
  const tx = {
    get: async (uid) => docs[uid] || null,
    set: (uid, patch) => (docs[uid] = { ...docs[uid], ...patch }),
  };
  const t0 = 10 * 3600000;
  assert.equal(await overLimit(tx, "u1", "publish", 2, t0), false);
  assert.equal(await overLimit(tx, "u1", "publish", 2, t0 + 1), false);
  assert.equal(await overLimit(tx, "u1", "publish", 2, t0 + 2), true);
  assert.equal(await overLimit(tx, "u1", "design", 2, t0 + 2), false, "kinds are separate");
  assert.equal(await overLimit(tx, "u2", "publish", 2, t0 + 2), false, "users are separate");
  assert.equal(await overLimit(tx, "u1", "publish", 2, t0 + 3600001), false, "an hour later");
  assert.equal(docs.u1.publish.length, 1, "expired entries are dropped");
});

test("email accounts verify their address before designing or sharing", async () => {
  const design = async () => ({ spec: { name: "Caves" } });
  const emailUser = (verified) => ({
    uid: "e1",
    token: { name: "Eve", email_verified: verified, firebase: { sign_in_provider: "password" } },
  });
  await assert.rejects(
    handleDesign({ auth: emailUser(false), data: { prompt: "caves" } }, { design, limiter: open }),
    (e) => e.code === "permission-denied" && /Verify your email/.test(e.message),
  );
  const world = newWorld(specFromPrompt("caves"), { uid: "e1", displayName: "Eve" });
  await assert.rejects(
    handlePublish({ auth: emailUser(false), data: { world } }, { store: {}, limiter: open }),
    (e) => e.code === "permission-denied",
  );
  const out = await handleDesign(
    { auth: emailUser(true), data: { prompt: "caves" } },
    { design, limiter: open },
  );
  assert.equal(out.spec.name, "Caves");
  const google = {
    uid: "g1",
    token: { name: "Gus", email_verified: true, firebase: { sign_in_provider: "google.com" } },
  };
  assert.ok(
    await handleDesign({ auth: google, data: { prompt: "caves" } }, { design, limiter: open }),
  );
});

const shared = (prompt, name, author, createdAt) => ({
  ...newWorld(specFromPrompt(prompt), { uid: author.toLowerCase(), displayName: author }),
  name,
  createdAt,
});

test("searchWorlds: every world, by name, creator or boss, best matches first", async () => {
  const all = [
    shared("frozen fortress of bats", "Ice Keep", "Ana", 3),
    shared("lava caves", "Magma Pits", "Bo", 2),
    shared("frozen lake", "Frozen Lake", "Cy", 1),
  ];
  const allWorlds = async () => all;
  await assert.rejects(
    handleSearch({ auth: null, data: { query: "ice" } }, { allWorlds }),
    (e) => e.code === "unauthenticated",
  );
  await assert.rejects(
    handleSearch({ auth: user(), data: { query: " a " } }, { allWorlds }),
    (e) => e.code === "invalid-argument",
  );
  const byName = await handleSearch({ auth: user(), data: { query: "FROZEN" } }, { allWorlds });
  assert.equal(byName.worlds[0].name, "Frozen Lake", "a name starting with it ranks first");
  const byAuthor = await handleSearch({ auth: user(), data: { query: "bo" } }, { allWorlds });
  assert.ok(byAuthor.worlds.some((w) => w.name === "Magma Pits"));
  const none = await handleSearch({ auth: user(), data: { query: "zzz" } }, { allWorlds });
  assert.deepEqual(none.worlds, []);

  const many = Array.from({ length: 50 }, (_, i) => shared("caves", `Cave ${i}`, "Ana", i + 1));
  const capped = await handleSearch(
    { auth: user(), data: { query: "cave" } },
    { allWorlds: async () => [...many, { id: "!" }] },
  );
  assert.equal(capped.worlds.length, MAX_RESULTS);
  assert.equal(capped.worlds[0].name, "Cave 49", "newest first among equals");
});

test("matchWorlds: every word must match, accents and case don't matter", () => {
  const list = [
    { id: "a", name: "Crème Castle", author: { name: "Zoé" }, createdAt: 1 },
    { id: "b", name: "Castle Rock", author: { name: "Max" }, tagline: "creme pies", createdAt: 2 },
  ];
  assert.deepEqual(
    matchWorlds(list, "creme castle").map((w) => w.id),
    ["a", "b"],
  );
  assert.deepEqual(
    matchWorlds(list, "zoe").map((w) => w.id),
    ["a"],
  );
  assert.deepEqual(matchWorlds(list, "  "), []);
  assert.deepEqual(
    matchWorlds([null, 3, ...list], "rock").map((w) => w.id),
    ["b"],
  );
});

test("deleteAccount: worlds become Anonymous, then data and account go", async () => {
  const calls = [];
  const accounts = {
    anonymizeWorlds: async (uid, author) => {
      calls.push(["anonymize", uid, author]);
      return 3;
    },
    deleteDailyScores: async (uid) => calls.push(["scores", uid]),
    deleteSave: async (uid) => calls.push(["save", uid]),
    deleteData: async (uid) => calls.push(["data", uid]),
    deleteUser: async (uid) => calls.push(["user", uid]),
  };
  await assert.rejects(
    handleDeleteAccount({ auth: null }, { accounts }),
    (e) => e.code === "unauthenticated",
  );
  assert.equal(calls.length, 0);
  const out = await handleDeleteAccount({ auth: user("u9") }, { accounts });
  assert.deepEqual(out, { worlds: 3 });
  assert.deepEqual(calls, [
    ["anonymize", "u9", { uid: "", name: ANONYMOUS }],
    ["scores", "u9"],
    ["save", "u9"],
    ["data", "u9"],
    ["user", "u9"],
  ]);

  // the account isn't deleted when its worlds couldn't be handed over
  calls.length = 0;
  accounts.anonymizeWorlds = async () => {
    throw new Error("firestore down");
  };
  await assert.rejects(handleDeleteAccount({ auth: user("u9") }, { accounts }), /firestore down/);
  assert.deepEqual(calls, []);
});
