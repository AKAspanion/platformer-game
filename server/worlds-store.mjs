/**
 * The shared world repository on the server: every world anyone creates.
 *
 *   GET  /api/worlds?limit=60    -> { worlds: [...] } newest first
 *   GET  /api/worlds/:id         -> { world }
 *   POST /api/worlds  { world }  -> { world }   Authorization: Bearer <token>
 *   GET  /api/worlds/stream      -> Server-Sent Events, "world" event per new world
 *
 * Worlds are validated with the game's own sanitizeWorld (app/worlds/spec.js),
 * so a world that is stored is a world every phone can build and play. The
 * author is taken from the token, never from the request body.
 *
 * Storage is a JSON file (DATA_FILE) to keep this dependency-free; Firestore
 * replaces it later. Auth is AUTH_MODE=mock for now: tokens are the game's
 * unsigned "mock.<base64url json>". When Firebase Auth lands, verifyToken
 * checks the ID token with firebase-admin instead.
 */
import fs from "node:fs";
import path from "node:path";
import { sanitizeWorld, cleanText } from "../app/worlds/spec.js";

const MAX_WORLDS = 5000;

export function verifyToken(header, { mode = "mock" } = {}) {
  const token = String(header || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (mode === "mock") {
    if (!token.startsWith("mock.")) return null;
    try {
      const payload = JSON.parse(Buffer.from(token.slice(5), "base64url").toString("utf8"));
      const uid = String(payload.uid || "")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 64);
      if (!uid) return null;
      return { uid, name: String(payload.name || "Someone").slice(0, 20) };
    } catch (error) {
      return null;
    }
  }
  // AUTH_MODE=firebase: verify with firebase-admin's auth().verifyIdToken(token)
  // and return { uid: decoded.uid, name: decoded.name }. Not wired up yet.
  return null;
}

export class WorldStore {
  constructor(file) {
    this.file = file;
    this.worlds = [];
    this.clients = new Set();
    if (file && fs.existsSync(file)) {
      try {
        this.worlds = JSON.parse(fs.readFileSync(file, "utf8")).map(sanitizeWorld).filter(Boolean);
      } catch (error) {
        console.error(`could not read ${file}: ${error.message}`);
      }
    }
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.worlds));
    fs.renameSync(tmp, this.file);
  }

  list(limit = 60) {
    return this.worlds.slice(0, Math.max(1, Math.min(100, limit)));
  }

  get(id) {
    return this.worlds.find((w) => w.id === id) || null;
  }

  /** Validated world, authored by `user`. Throws { status, message } when refused. */
  add(raw, user) {
    const world = sanitizeWorld(raw);
    if (!world) throw Object.assign(new Error("that world is not valid"), { status: 400 });
    if (this.get(world.id))
      throw Object.assign(new Error("that world already exists"), { status: 409 });
    world.author = { uid: user.uid, name: cleanText(user.name, 20, "Someone") };
    world.createdAt = Date.now();
    this.worlds.unshift(world);
    this.worlds.length = Math.min(this.worlds.length, MAX_WORLDS);
    this.save();
    this.broadcast(world);
    return world;
  }

  broadcast(world) {
    const message = `event: world\ndata: ${JSON.stringify(world)}\n\n`;
    this.clients.forEach((res) => res.write(message));
  }

  stream(req, res, headers) {
    res.writeHead(200, {
      ...headers,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    this.clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      this.clients.delete(res);
    });
  }
}

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

/**
 * Handle a /api/worlds request; returns false if the URL isn't one of ours.
 * `limiter(key)` returns true when that user published too much lately.
 */
export async function handleWorlds(req, res, { store, cors, authMode, readBody, limiter }) {
  const url = new URL(req.url, "http://local");
  if (!url.pathname.startsWith("/api/worlds")) return false;

  if (req.method === "GET" && url.pathname === "/api/worlds/stream") {
    store.stream(req, res, cors);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/api/worlds") {
    json(res, 200, { worlds: store.list(Number(url.searchParams.get("limit")) || 60) }, cors);
    return true;
  }
  const one = url.pathname.match(/^\/api\/worlds\/([A-Za-z0-9_-]{4,48})$/);
  if (req.method === "GET" && one) {
    const world = store.get(one[1]);
    json(res, world ? 200 : 404, world ? { world } : { error: "no such world" }, cors);
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/worlds") {
    const user = verifyToken(req.headers.authorization, { mode: authMode });
    if (!user) {
      json(res, 401, { error: "sign in to share worlds" }, cors);
      return true;
    }
    if (limiter && limiter(`publish:${user.uid}`)) {
      json(res, 429, { error: "you shared a lot of worlds lately, try again later" }, cors);
      return true;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req, 32 * 1024));
    } catch (error) {
      json(res, 400, { error: "send JSON: { world }" }, cors);
      return true;
    }
    try {
      json(res, 201, { world: store.add(body.world, user) }, cors);
    } catch (error) {
      json(res, error.status || 500, { error: error.message }, cors);
    }
    return true;
  }
  json(res, 404, { error: "not found" }, cors);
  return true;
}
