import "./env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  handleRecordPlay,
  handleToggleLike,
  handlePickFeatured,
  renderWorldPage,
  checkThumb,
  parseWorldPath,
  handleWorldPage,
  SEEN_TTL_MS,
} from "../functions/src/community.js";
import { handlePublish, overLimit } from "../functions/src/handlers.js";
import { dayKey, trendAfterPlay, PLAY_LIMIT, LIKE_LIMIT } from "../app/worlds/community";
import { newWorld, specFromPrompt } from "../app/worlds/spec";

const DAY = 86400000;
const T = Date.UTC(2026, 10, 11, 12); // 2026-11-11

/** An in-memory Firestore: paths -> data, with the transaction the handlers use. */
function fakeStore(docs = {}) {
  const data = new Map(Object.entries(docs));
  const stats = {
    transaction: async (fn) => {
      const writes = [];
      const result = await fn({
        get: async (path) => (data.has(path) ? structuredClone(data.get(path)) : null),
        set: (path, value) => writes.push(["set", path, value]),
        delete: (path) => writes.push(["delete", path]),
      });
      for (const [op, path, value] of writes) {
        if (op === "set") data.set(path, structuredClone(value));
        else data.delete(path);
      }
      return result;
    },
  };
  return { data, stats, worlds: { exists: async (id) => data.has(`worlds/${id}`) } };
}

const user = (uid = "u1") => ({ uid, token: {} });
const open = async () => false;
const world = (store, id) => store.data.set(`worlds/${id}`, { id });
const play = (store, uid, worldId, kind, now, limiter = open) =>
  handleRecordPlay(
    { auth: user(uid), data: { worldId, kind } },
    { stats: store.stats, limiter, now: () => now },
  );
const like = (store, uid, worldId, now = T, limiter = open) =>
  handleToggleLike(
    { auth: user(uid), data: { worldId } },
    { stats: store.stats, worlds: store.worlds, limiter, now: () => now },
  );
/** The real sliding-window limiter over an in-memory `limits` collection, frozen at T. */
const realLimiter = () => {
  const docs = {};
  const tx = {
    get: async (uid) => docs[uid] || null,
    set: (uid, patch) => {
      docs[uid] = { ...docs[uid], ...patch };
    },
  };
  return (uid, kind, max) => overLimit(tx, uid, kind, max, T);
};

test("recordWorldPlay: signed in, a real world id and kind, nothing written otherwise", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  await assert.rejects(
    handleRecordPlay(
      { auth: null, data: { worldId: "wabcd", kind: "play" } },
      { stats: s.stats, limiter: open },
    ),
    (e) => e.code === "unauthenticated",
  );
  for (const [worldId, kind] of [
    ["<x>", "play"],
    ["starter-forest", "play"],
    ["starfall-peaks", "finish"],
    ["wabcd", "win"],
    ["wabcd", undefined],
    [{ a: 1 }, "play"],
    ["wabcd/../x", "play"],
  ]) {
    await assert.rejects(play(s, "u1", worldId, kind, T), (e) => e.code === "invalid-argument");
  }
  assert.equal(s.data.size, 1, "only the seeded world exists");
});

test("recordWorldPlay: once per account per world per day, finishes counted apart", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  assert.deepEqual(await play(s, "u1", "wabcd", "play", T), { counted: true });
  assert.deepEqual(await play(s, "u1", "wabcd", "play", T + 1000), { counted: false });
  assert.equal(s.data.get("worldStats/wabcd").plays, 1);
  assert.deepEqual(await play(s, "u2", "wabcd", "play", T), { counted: true }, "another account");
  assert.deepEqual(await play(s, "u1", "wabcd", "finish", T), { counted: true });
  assert.deepEqual(await play(s, "u1", "wabcd", "finish", T), { counted: false });
  assert.deepEqual(await play(s, "u1", "wabcd", "play", T + DAY), { counted: true }, "next day");
  const stats = s.data.get("worldStats/wabcd");
  assert.equal(stats.plays, 3);
  assert.equal(stats.finishes, 1);
  assert.deepEqual(s.data.get(`worldStats/wabcd/days/${dayKey(T)}`), {
    plays: 2,
    finishes: 1,
    likes: 0,
  });
  assert.equal(s.data.get(`worldStats/wabcd/days/${dayKey(T + DAY)}`).plays, 1);
});

test("recordWorldPlay: one transaction updates the total, the day and the trend", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  await play(s, "u1", "wabcd", "play", T);
  const first = trendAfterPlay(null, T);
  assert.equal(s.data.get("worldStats/wabcd").trend, first);
  await play(s, "u2", "wabcd", "play", T + 5);
  const stats = s.data.get("worldStats/wabcd");
  assert.equal(stats.trend, trendAfterPlay(first, T + 5));
  assert.equal(stats.updatedAt, T + 5);
  assert.equal(stats.plays, 2);
  // a finish counts without moving the trend
  await play(s, "u1", "wabcd", "finish", T + 9);
  assert.equal(s.data.get("worldStats/wabcd").trend, stats.trend);
});

test("recordWorldPlay: a world that does not exist counts nothing", async () => {
  const s = fakeStore();
  assert.deepEqual(await play(s, "u1", "wnone", "play", T), { counted: false });
  assert.equal(s.data.size, 0);
});

test("recordWorldPlay: over the hourly limit is ignored without an error", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  const seen = [];
  const limiter = async (uid, kind, max) => {
    seen.push([uid, kind, max]);
    return true;
  };
  assert.deepEqual(await play(s, "u1", "wabcd", "play", T, limiter), { counted: false });
  assert.deepEqual(seen, [["u1", "play", PLAY_LIMIT]]);
  assert.equal(s.data.has("worldStats/wabcd"), false, "no counter changed");

  // the real sliding window: 120 events pass, the 121st does not
  const real = realLimiter();
  for (let i = 0; i < PLAY_LIMIT; i++) {
    const kind = i % 2 ? "finish" : "play";
    assert.deepEqual(await play(s, "u1", "wabcd", kind, T + i * DAY, real), { counted: true });
  }
  const before = structuredClone([...s.data]);
  assert.deepEqual(await play(s, "u1", "wabcd", "play", T + 999 * DAY, real), { counted: false });
  assert.deepEqual([...s.data], before);
});

test("toggleWorldLike: signed in, valid id, an existing world", async () => {
  const s = fakeStore();
  await assert.rejects(
    handleToggleLike(
      { auth: null, data: { worldId: "wabcd" } },
      { stats: s.stats, worlds: s.worlds, limiter: open },
    ),
    (e) => e.code === "unauthenticated",
  );
  for (const worldId of ["<x>", "starter-forest", "starfall-peaks", 5]) {
    await assert.rejects(like(s, "u1", worldId), (e) => e.code === "invalid-argument");
  }
  await assert.rejects(like(s, "u1", "wnone"), (e) => e.code === "not-found");
  assert.equal(s.data.size, 0);
});

test("toggleWorldLike: like, take it back, accounts apart, day bucket moves too", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  assert.deepEqual(await like(s, "u1", "wabcd"), { liked: true, likes: 1 });
  assert.deepEqual(s.data.get("worldLikes/wabcd_u1"), { worldId: "wabcd", uid: "u1", at: T });
  assert.equal(s.data.get(`worldStats/wabcd/days/${dayKey(T)}`).likes, 1);
  assert.deepEqual(await like(s, "u2", "wabcd"), { liked: true, likes: 2 });
  assert.deepEqual(await like(s, "u1", "wabcd"), { liked: false, likes: 1 });
  assert.equal(s.data.has("worldLikes/wabcd_u1"), false);
  assert.equal(s.data.has("worldLikes/wabcd_u2"), true);
  assert.equal(s.data.get(`worldStats/wabcd/days/${dayKey(T)}`).likes, 1);
  assert.equal(s.data.get("worldStats/wabcd").likes, 1);
  assert.deepEqual(await like(s, "u1", "wabcd", T + 1), { liked: true, likes: 2 });
});

test("toggleWorldLike: the 61st toggle in an hour is refused and changes nothing", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  const real = realLimiter();
  for (let i = 0; i < LIKE_LIMIT; i++) await like(s, "u1", "wabcd", T, real);
  const before = structuredClone([...s.data]);
  await assert.rejects(
    like(s, "u1", "wabcd", T, real),
    (e) =>
      e.code === "resource-exhausted" && e.message === "Slow down a little, try again in a minute.",
  );
  assert.deepEqual([...s.data], before);
});

test("toggleWorldLike: the limiter is asked for kind like with LIKE_LIMIT", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  const seen = [];
  await like(s, "u1", "wabcd", T, async (...args) => (seen.push(args), false));
  assert.deepEqual(seen, [["u1", "like", LIKE_LIMIT]]);
});

// ------------------------------------------------------------ world of the week

function featuredFixture(configDoc) {
  const worlds = { wa: 10, wb: 20, wc: 30 }; // createdAt
  const days = {
    wa: { plays: 100, likes: 5 }, // 0.05 likes per play
    wb: { plays: 40, likes: 20 }, // 0.5
    wc: { plays: 10, likes: 9 }, // too few plays
  };
  const config = { doc: configDoc };
  const stats = {
    top: async () => Object.entries(worlds).map(([id, createdAt]) => ({ id, createdAt })),
    daysOf: async (id, sinceDay) => {
      stats.sinceDay = sinceDay;
      return [
        { day: dayKey(T), ...days[id], finishes: 0 },
        { day: "20000101", plays: 999, likes: 999, finishes: 0 }, // outside the window
      ].filter((d) => d.day >= sinceDay);
    },
  };
  const written = [];
  return {
    stats,
    config: {
      get: async () => config.doc,
      set: async (patch) => (written.push(patch), (config.doc = { ...config.doc, ...patch })),
    },
    written,
  };
}

test("handlePickFeatured: most likes per play in the window; lastWeek is the old current", async () => {
  const f = featuredFixture({ worldId: "", current: "wold", lastWeek: "wolder" });
  const picked = await handlePickFeatured({ stats: f.stats, config: f.config, now: () => T });
  assert.equal(picked, "wb");
  assert.deepEqual(f.written, [{ current: "wb", lastWeek: "wold", pickedAt: T }]);
  assert.equal(f.stats.sinceDay, dayKey(T - 13 * DAY), "14 day buckets, today included");
});

test("handlePickFeatured: last week's world is not picked twice in a row", async () => {
  const f = featuredFixture({ current: "wb" });
  assert.equal(await handlePickFeatured({ stats: f.stats, config: f.config, now: () => T }), "wa");
});

test("handlePickFeatured: a world pinned by hand wins until the field is cleared", async () => {
  const f = featuredFixture({ worldId: "wpin", current: "wb" });
  assert.equal(
    await handlePickFeatured({ stats: f.stats, config: f.config, now: () => T }),
    "wpin",
  );
  assert.deepEqual(f.written, [{ current: "wpin", lastWeek: "wb", pickedAt: T }]);
});

test("handlePickFeatured: nothing qualifies, no config yet", async () => {
  const f = featuredFixture(null);
  f.stats.top = async () => [];
  assert.equal(await handlePickFeatured({ stats: f.stats, config: f.config, now: () => T }), null);
  assert.deepEqual(f.written, [{ current: null, lastWeek: null, pickedAt: T }]);
});

// --------------------------------------------------------------------- the page

const aWorld = (extra = {}) => ({
  id: "wabcd1",
  name: 'Bad "<b>',
  tagline: "x</title><script>",
  author: { uid: "u1", name: "Ana & Co" },
  ...extra,
});

test("renderWorldPage: escapes, previews with the thumb or the icon, redirects", () => {
  const origin = "https://dino.spanion.in";
  const withThumb = renderWorldPage(aWorld(), { hasThumb: true, origin });
  assert.equal(withThumb.status, 200);
  const html = withThumb.html;
  assert.ok(html.includes("<title>Bad &quot;&lt;b&gt; · Dino's Adventure</title>"));
  assert.ok(
    html.includes(
      "x&lt;/title&gt;&lt;script&gt; A world by Ana &amp; Co. Play it free in your browser.",
    ),
  );
  assert.ok(!html.includes("x</title><script>"));
  assert.ok(html.includes(`content="${origin}/w/wabcd1/thumb.png"`));
  assert.ok(html.includes('property="og:title"') && html.includes('name="twitter:card"'));
  assert.ok(html.includes("/?world=wabcd1"));

  const plain = renderWorldPage(aWorld(), { hasThumb: false, origin }).html;
  assert.ok(plain.includes(`content="${origin}/images/icons-512.png"`));
  assert.ok(!plain.includes("thumb.png"));
});

test("renderWorldPage: a missing or built-in world is a 404 that links to the game", () => {
  const origin = "https://dino.spanion.in";
  for (const w of [null, aWorld({ id: "starter-forest" })]) {
    const page = renderWorldPage(w, { hasThumb: false, origin });
    assert.equal(page.status, 404);
    assert.ok(page.html.includes(`href="${origin}/"`));
  }
});

test("parseWorldPath: /w/<id> and /w/<id>/thumb.png only", () => {
  assert.deepEqual(parseWorldPath("/w/wabcd1"), { id: "wabcd1", thumb: false });
  assert.deepEqual(parseWorldPath("/w/wabcd1/"), { id: "wabcd1", thumb: false });
  assert.deepEqual(parseWorldPath("/w/wabcd1/thumb.png"), { id: "wabcd1", thumb: true });
  for (const p of [
    "/w/",
    "/w/a",
    "/w/wab%2Fcd",
    "/w/wabcd1/x",
    "/x/wabcd1",
    "/w/wabcd1/thumb.png/y",
    "/w/starter-forest",
  ]) {
    assert.equal(parseWorldPath(p), null, p);
  }
});

// -------------------------------------------------------------------- thumbnails

const png = (bytes, width = 480, height = 270) => {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
};

test("checkThumb: a small PNG passes, everything else is dropped", () => {
  const ok = png(30 * 1024);
  assert.deepEqual(checkThumb(ok.toString("base64")), ok);
  assert.equal(checkThumb(png(102400).toString("base64")).length, 102400);
  assert.equal(checkThumb(png(102401).toString("base64")), null, "just over the cap");
  assert.equal(checkThumb(png(101 * 1024).toString("base64")), null);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(1)]);
  assert.equal(checkThumb(jpeg.toString("base64")), null);
  assert.equal(checkThumb("not an image"), null);
  assert.equal(checkThumb(""), null);
  for (const bad of [null, undefined, 5, {}, [], true]) assert.equal(checkThumb(bad), null);
  assert.equal(checkThumb(png(200, 99999, 99999).toString("base64")), null, "absurd dimensions");
  assert.equal(checkThumb("A".repeat(10 * 1024 * 1024)), null, "a huge string is refused unread");
});

test("publishWorld: keeps a valid thumbnail beside the world, drops a bad one", async () => {
  const saved = [];
  const store = {
    async create(w, thumb) {
      saved.push({ w, thumb });
    },
  };
  const w = () => newWorld(specFromPrompt("lava caves"), { uid: "x", displayName: "X" });
  const publish = (thumb) =>
    handlePublish({ auth: user(), data: { world: w(), thumb } }, { store, limiter: open });
  const good = png(30 * 1024);
  await publish(good.toString("base64"));
  assert.deepEqual(saved[0].thumb, good);
  const bads = [png(101 * 1024).toString("base64"), "/9j/4AAQSkZJRg==", "hello", 42, undefined];
  for (const bad of bads) {
    const out = await publish(bad);
    assert.ok(out.world.id, "the world is still created");
  }
  assert.deepEqual(
    saved.slice(1).map((s) => s.thumb),
    bads.map(() => null),
  );
});

test("handleWorldPage: 200 with the thumb, 200 without, 404s, the PNG, and a POST", async () => {
  const origin = "https://dino.spanion.in";
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const world = aWorld();
  const deps = (thumb) => ({
    origin,
    getWorld: async (id) => (id === world.id ? world : null),
    getThumb: async (id) => (id === world.id ? thumb : null),
  });
  const withThumb = await handleWorldPage(`/w/${world.id}`, "GET", deps(png));
  assert.equal(withThumb.status, 200);
  assert.equal(withThumb.type, "html");
  assert.match(withThumb.body, new RegExp(`og:image" content="${origin}/w/${world.id}/thumb.png"`));

  const plain = await handleWorldPage(`/w/${world.id}`, "GET", deps(null));
  assert.equal(plain.status, 200);
  assert.match(
    plain.body,
    /og:image" content="https:\/\/dino\.spanion\.in\/images\/icons-512\.png"/,
  );

  const missing = await handleWorldPage("/w/wnope1", "GET", deps(png));
  assert.equal(missing.status, 404);
  assert.match(missing.body, /href="https:\/\/dino\.spanion\.in\/"/);

  const image = await handleWorldPage(`/w/${world.id}/thumb.png`, "GET", deps(png));
  assert.equal(image.status, 200);
  assert.equal(image.type, "png");
  assert.deepEqual(image.body, png);

  assert.equal((await handleWorldPage(`/w/${world.id}/thumb.png`, "GET", deps(null))).status, 404);
  assert.equal((await handleWorldPage(`/w/${world.id}`, "POST", deps(png))).status, 404);
});

test("handleWorldPage: a failed read throws for the adapter to answer 500", async () => {
  await assert.rejects(
    handleWorldPage("/w/wabcd1", "GET", {
      origin: "https://dino.spanion.in",
      getWorld: async () => {
        throw new Error("down");
      },
      getThumb: async () => null,
    }),
    /down/,
  );
});

test("toggleWorldLike: anonymous and unverified accounts can't like", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  const likeAs = (token) =>
    handleToggleLike(
      { auth: { uid: "x1", token }, data: { worldId: "wabcd" } },
      { stats: s.stats, worlds: s.worlds, limiter: open, now: () => T },
    );
  await assert.rejects(
    likeAs({ firebase: { sign_in_provider: "anonymous" } }),
    (e) => e.code === "unauthenticated" && e.message === "Sign in to like worlds.",
  );
  await assert.rejects(
    likeAs({ firebase: { sign_in_provider: "password" }, email_verified: false }),
    (e) => e.code === "permission-denied" && e.message === "Verify your email to like worlds.",
  );
  assert.equal(s.data.has("worldLikes/wabcd_x1"), false);
  assert.deepEqual(await likeAs({ firebase: { sign_in_provider: "google.com" } }), {
    liked: true,
    likes: 1,
  });
});

test("recordWorldPlay: the dedupe marker names its account and expires", async () => {
  const s = fakeStore();
  world(s, "wabcd");
  await play(s, "u1", "wabcd", "play", T);
  const marker = s.data.get(`worldStats/wabcd/seen/u1_${dayKey(T)}_play`);
  assert.equal(marker.uid, "u1");
  assert.equal(marker.at, T);
  assert.ok(marker.expireAt instanceof Date);
  assert.equal(marker.expireAt.getTime(), T + SEEN_TTL_MS);
  assert.ok(SEEN_TTL_MS > DAY, "outlives the day it dedupes");
});
