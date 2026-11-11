/**
 * Community server logic: counting plays and likes, picking the world of the
 * week, and the pages behind shared world links. Free of Firebase, like
 * handlers.js, so tests/community-functions.test.js runs it on its own;
 * index.js wires it to Firestore.
 *
 *   handleRecordPlay({ auth, data: { worldId, kind } }, { stats, limiter, now })
 *   handleToggleLike({ auth, data: { worldId } }, { stats, worlds, limiter, now })
 *   handlePickFeatured({ stats, config, now })
 *   renderWorldPage(world | null, { hasThumb, origin })  -> { status, html }
 *
 * `stats.transaction(fn)` runs fn(tx) in one Firestore transaction. tx is
 * { get(path) -> data | null, set(path, data), delete(path) }; fn reads
 * everything first, then writes (a transaction's rule).
 *
 * Firestore layout (firestore.rules keeps clients out of all of it):
 *   worldStats/{id}                { plays, finishes, likes, trend, updatedAt }
 *   worldStats/{id}/days/{day}     { plays, finishes, likes }
 *   worldStats/{id}/seen/{uid_day_kind}   dedupe marker { at, uid, expireAt }; a
 *                                  Firestore TTL policy deletes it after expireAt
 *   worldLikes/{worldId}_{uid}     { worldId, uid, at }
 */
import { ApiError, signedIn, realAccount } from "./handlers.js";
import {
  dayKey,
  trendAfterPlay,
  pickFeatured,
  isBuiltIn,
  linkedWorldId,
  MAX_THUMB_BYTES,
  PLAY_LIMIT,
  LIKE_LIMIT,
  FEATURE_WINDOW_DAYS,
} from "../shared/worlds/community.js";

const DAY_MS = 86400000;
/** A play marker only dedupes its own day; kept a little longer, then TTL deletes it. */
export const SEEN_TTL_MS = 3 * DAY_MS;

/** The world id from a request: a valid, shareable (not built-in) id, or invalid-argument. */
function worldIdOf(data) {
  const raw = data && data.worldId;
  const id = typeof raw === "string" ? linkedWorldId({ pathname: `/w/${raw}` }) : null;
  if (!id || isBuiltIn(id)) throw new ApiError("invalid-argument", "That world can't be counted.");
  return id;
}

const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * A play or a finish: counted once per account, world, day and kind.
 * A world with no record, or an account past PLAY_LIMIT an hour, counts
 * nothing and is not an error.
 */
export async function handleRecordPlay({ auth, data }, { stats, limiter, now = Date.now }) {
  const user = signedIn(auth);
  const worldId = worldIdOf(data);
  const kind = data && data.kind;
  if (kind !== "play" && kind !== "finish") {
    throw new ApiError("invalid-argument", "That can't be counted.");
  }
  if (await limiter(user.uid, "play", PLAY_LIMIT)) return { counted: false };

  const at = now();
  const day = dayKey(at);
  const field = kind === "play" ? "plays" : "finishes";
  const base = `worldStats/${worldId}`;
  const seenPath = `${base}/seen/${user.uid}_${day}_${kind}`;
  const dayPath = `${base}/days/${day}`;
  return stats.transaction(async (tx) => {
    const [seen, world, total, bucket] = [
      await tx.get(seenPath),
      await tx.get(`worlds/${worldId}`),
      await tx.get(base),
      await tx.get(dayPath),
    ];
    if (seen || !world) return { counted: false };
    const next = { plays: 0, finishes: 0, likes: 0, trend: null, ...total, updatedAt: at };
    next[field] = num(next[field]) + 1;
    if (kind === "play") next.trend = trendAfterPlay(total ? total.trend : null, at);
    const dayNext = { plays: 0, finishes: 0, likes: 0, ...bucket };
    dayNext[field] = num(dayNext[field]) + 1;
    tx.set(seenPath, { at, uid: user.uid, expireAt: new Date(at + SEEN_TTL_MS) });
    tx.set(dayPath, dayNext);
    tx.set(base, next);
    return { counted: true };
  });
}

/**
 * Like, or take the like back: one per account per world. Likes pick the world
 * of the week, so only real, verified accounts give them: anonymous players
 * (free to make in a loop) can't.
 */
export async function handleToggleLike({ auth, data }, { stats, worlds, limiter, now = Date.now }) {
  const user = realAccount(signedIn(auth), "like worlds");
  const worldId = worldIdOf(data);
  if (await limiter(user.uid, "like", LIKE_LIMIT)) {
    throw new ApiError("resource-exhausted", "Slow down a little, try again in a minute.");
  }
  if (!(await worlds.exists(worldId))) throw new ApiError("not-found", "That world is gone.");

  const at = now();
  const base = `worldStats/${worldId}`;
  const likePath = `worldLikes/${worldId}_${user.uid}`;
  const dayPath = `${base}/days/${dayKey(at)}`;
  return stats.transaction(async (tx) => {
    const [existing, total, bucket] = [
      await tx.get(likePath),
      await tx.get(base),
      await tx.get(dayPath),
    ];
    const delta = existing ? -1 : 1;
    const likes = Math.max(0, num(total && total.likes) + delta);
    // a day's bucket may dip below zero (liked on one day, unliked on a later one):
    // the 14 day sum stays right
    const dayNext = { plays: 0, finishes: 0, likes: 0, ...bucket };
    dayNext.likes = num(dayNext.likes) + delta;
    tx.set(base, { plays: 0, finishes: 0, trend: null, ...total, likes, updatedAt: at });
    tx.set(dayPath, dayNext);
    if (existing) tx.delete(likePath);
    else tx.set(likePath, { worldId, uid: user.uid, at });
    return { liked: !existing, likes };
  });
}

/**
 * The world of the week (run every Monday 00:00 UTC). `config.get()` ->
 * { worldId, current, lastWeek, pickedAt } | null, `config.set(patch)`;
 * `stats.top(limit)` -> { id, createdAt }[] (the busiest worlds, by trend),
 * `stats.daysOf(id, sinceDay)` -> { day, plays, finishes, likes }[].
 * A world id set by hand in `config.worldId` wins. Returns the new `current`.
 */
export const FEATURE_CANDIDATES = 200;

export async function handlePickFeatured({ stats, config, now = Date.now }) {
  const at = now();
  const previous = (await config.get()) || {};
  const pinned = typeof previous.worldId === "string" ? previous.worldId.trim() : "";
  let current = pinned || null;
  if (!current) {
    const sinceDay = dayKey(at - (FEATURE_WINDOW_DAYS - 1) * DAY_MS);
    const candidates = [];
    for (const { id, createdAt } of await stats.top(FEATURE_CANDIDATES)) {
      if (isBuiltIn(id) || !Number.isFinite(createdAt)) continue;
      let plays14 = 0;
      let likes14 = 0;
      for (const d of await stats.daysOf(id, sinceDay)) {
        plays14 += num(d.plays);
        likes14 += num(d.likes);
      }
      candidates.push({ id, createdAt, plays14, likes14: Math.max(0, likes14) });
    }
    current = pickFeatured(candidates, previous.current || null);
  }
  await config.set({ current, lastWeek: previous.current || null, pickedAt: at });
  return current;
}

// ------------------------------------------------------------------ thumbnails

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_BASE64_LENGTH = Math.ceil(MAX_THUMB_BYTES / 3) * 4;
/** The game draws 480x270; anything much larger is not a world card. */
const MAX_THUMB_SIDE = { width: 960, height: 540 };

/** The PNG in `base64` when it is one of at most MAX_THUMB_BYTES, else null. */
export function checkThumb(base64) {
  if (typeof base64 !== "string" || base64.length < 32 || base64.length > MAX_BASE64_LENGTH) {
    return null; // the length is checked before anything is decoded
  }
  if (!BASE64.test(base64)) return null;
  const png = Buffer.from(base64, "base64");
  if (png.length > MAX_THUMB_BYTES || png.length < 33) return null;
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString("latin1", 12, 16) !== "IHDR") {
    return null;
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (!width || !height || width > MAX_THUMB_SIDE.width || height > MAX_THUMB_SIDE.height) {
    return null;
  }
  return png;
}

// ------------------------------------------------------------------------ page

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** "/w/<id>" -> { id, thumb: false }, "/w/<id>/thumb.png" -> { id, thumb: true }, else null. */
export function parseWorldPath(pathname) {
  const match = /^\/w\/([^/]+?)(\/thumb\.png|\/)?$/.exec(String(pathname || ""));
  if (!match) return null;
  const id = linkedWorldId({ pathname: `/w/${match[1]}` });
  if (!id || isBuiltIn(id)) return null;
  return { id, thumb: match[2] === "/thumb.png" };
}

// the game's look (app/pages/pages.css): ink background, red and gold, Grandstander
const HEAD_STYLE =
  `<link rel="preconnect" href="https://fonts.gstatic.com">` +
  `<link href="https://fonts.googleapis.com/css2?family=Grandstander&display=swap" rel="stylesheet">` +
  `<style>` +
  "*{box-sizing:border-box}" +
  "body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px 16px;" +
  'font:16px/1.4 "Grandstander","Trebuchet MS",sans-serif;color:#fff7e8;text-align:center;' +
  "background:radial-gradient(ellipse at 50% 0%,rgba(239,83,79,.22),transparent 60%),#1d1a24}" +
  ".logo{font-size:32px;line-height:1;text-transform:uppercase;color:#fff;text-decoration:none;text-shadow:0 4px 0 #c63d3a}" +
  ".logo span{display:block;color:#ffd84d;font-size:.7em;letter-spacing:4px}" +
  "main{width:min(400px,100%);padding:24px;border-radius:20px;background:#2a2633;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 50px rgba(0,0,0,.45)}" +
  "h1{margin:0;font-size:26px;font-weight:normal;text-transform:uppercase;color:#fff}" +
  "p{margin:10px 0 0;opacity:.85;overflow-wrap:anywhere}" +
  ".btn{display:inline-block;margin-top:20px;padding:12px 24px;border-radius:14px;color:#fff;text-decoration:none;text-transform:uppercase;letter-spacing:1px;" +
  "background:linear-gradient(#ff6b66,#ef534f);box-shadow:0 5px 0 #c63d3a}" +
  `</style>`;

/** A small page in the game's look: the logo, a heading, a line and a link to play. */
const shell = ({ title, head = "", heading, text, link, origin }) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="theme-color" content="#1d1a24">` +
  `<title>${title}</title>${head}${HEAD_STYLE}` +
  `<link rel="icon" href="${escapeHtml(origin)}/favicon.ico"></head>` +
  `<body><a class="logo" href="${escapeHtml(origin)}/">Dino's <span>Adventure</span></a>` +
  `<main><h1>${heading}</h1><p>${text}</p>` +
  `<a class="btn" href="${link.href}">${link.label}</a></main></body></html>`;

/** What /w/... answers when the server fails: the game's look, never a bare error. */
export const errorPage = (origin) =>
  shell({
    title: "Something went wrong · Dino's Adventure",
    heading: "Something went wrong",
    text: "We couldn't open this world right now. Try again in a moment.",
    link: { href: `${escapeHtml(origin)}/`, label: "Play Dino's Adventure" },
    origin,
  });

/** The page a shared world link opens: previews for chats, then straight into the game. */
export function renderWorldPage(world, { hasThumb, origin }) {
  if (!world || isBuiltIn(world.id)) {
    return {
      status: 404,
      html: shell({
        title: "World not found · Dino's Adventure",
        heading: "That world is gone",
        text: "Its maker may have removed it, or the link is broken.",
        link: { href: `${escapeHtml(origin)}/`, label: "Play Dino's Adventure" },
        origin,
      }),
    };
  }
  const title = escapeHtml(`${world.name} · Dino's Adventure`);
  const description = escapeHtml(
    `${world.tagline} A world by ${world.author.name}. Play it free in your browser.`,
  );
  const url = `${origin}/w/${world.id}`;
  const image = hasThumb ? `${url}/thumb.png` : `${origin}/images/icons-512.png`;
  const target = `/?world=${world.id}`;
  const head =
    `<meta name="description" content="${description}">` +
    `<link rel="canonical" href="${escapeHtml(url)}">` +
    `<meta property="og:type" content="website">` +
    `<meta property="og:site_name" content="Dino's Adventure">` +
    `<meta property="og:title" content="${title}">` +
    `<meta property="og:description" content="${description}">` +
    `<meta property="og:url" content="${escapeHtml(url)}">` +
    `<meta property="og:image" content="${escapeHtml(image)}">` +
    `<meta name="twitter:card" content="${hasThumb ? "summary_large_image" : "summary"}">` +
    `<meta name="twitter:title" content="${title}">` +
    `<meta name="twitter:description" content="${description}">` +
    `<meta name="twitter:image" content="${escapeHtml(image)}">` +
    // players move on at once; link previews read the tags above and never run scripts
    `<script>location.replace(${JSON.stringify(target)})</script>`;
  const html = shell({
    title,
    head,
    heading: escapeHtml(world.name),
    text: description,
    link: { href: target, label: "Play it now" },
    origin,
  });
  return { status: 200, html };
}

/**
 * Answers a request for /w/<id> or /w/<id>/thumb.png.
 * `getWorld(id)` -> the sanitized world or null; `getThumb(id)` -> the PNG as a
 * Buffer or null (a plain read of the thumbs doc: at most MAX_THUMB_BYTES).
 * Returns { status, type, body, cacheControl }; a failed read throws.
 */
export async function handleWorldPage(path, method, { getWorld, getThumb, origin }) {
  const gone = () => {
    const page = renderWorldPage(null, { hasThumb: false, origin });
    return {
      status: page.status,
      type: "html",
      body: page.html,
      cacheControl: "public, max-age=60",
    };
  };
  const route = method === "GET" || method === "HEAD" ? parseWorldPath(path) : null;
  if (!route) return gone();
  if (route.thumb) {
    const png = await getThumb(route.id);
    if (!png || !png.length) return gone();
    return { status: 200, type: "png", body: png, cacheControl: "public, max-age=3600" };
  }
  const [world, thumb] = await Promise.all([getWorld(route.id), getThumb(route.id)]);
  const page = renderWorldPage(world, { hasThumb: Boolean(thumb && thumb.length), origin });
  if (page.status !== 200) return gone();
  return { status: 200, type: "html", body: page.html, cacheControl: "public, max-age=300" };
}
