import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleDesign,
  handlePublish,
  overLimit,
  authorName,
  LIMITS,
} from "../functions/src/handlers.js";
import { newWorld, specFromPrompt } from "../app/worlds/spec";

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
