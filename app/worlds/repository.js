import { sanitizeWorld, specFromPrompt, newWorld } from "./spec.js";

/**
 * The shared world repository: every world anyone creates, newest first.
 *
 *   repo.list({ limit })      -> Promise<world[]>
 *   repo.publish(world, token)-> Promise<world>   (needs a signed-in user's token)
 *   repo.subscribe(cb)        -> unsubscribe()    (cb(world) for each new world, live)
 *   repo.live                 -> true when worlds reach other devices
 *
 * Two backends today, one to come:
 *   - HttpRepository: the world server (server/world-api.mjs), shared by every
 *     install that points at it; live updates over Server-Sent Events.
 *   - LocalRepository: the mock. Kept on this device (localStorage), live
 *     across tabs (BroadcastChannel). Used when no server is configured.
 *   - Firebase (later): a Firestore "worlds" collection with an onSnapshot
 *     listener implements the same three calls.
 * Everything that comes in is validated with sanitizeWorld.
 */

const LOCAL_KEY = "shared_worlds";
const CACHE_KEY = "shared_worlds_cache";
const MAX_LOCAL = 200;

const store = () => {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
};

const readList = (key) => {
  try {
    const raw = store() && store().getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(sanitizeWorld).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const writeList = (key, list) => {
  try {
    if (store()) store().setItem(key, JSON.stringify(list.slice(0, MAX_LOCAL)));
  } catch (error) {
    // storage full: the newest worlds are still in memory
  }
};

const newestFirst = (a, b) => b.createdAt - a.createdAt;

/** Merge `incoming` into `list` by id (incoming wins), newest first. */
export const mergeWorlds = (list, incoming) => {
  const byId = new Map(list.map((w) => [w.id, w]));
  incoming.forEach((w) => byId.set(w.id, w));
  return [...byId.values()].sort(newestFirst);
};

// a few worlds so the mock repository isn't empty on a fresh install
const STARTERS = [
  ["starter-meadow", "A sunny meadow with hopping slimes and buzzing bugs, easy", 101],
  ["starter-frost", "A frozen glacier fortress guarded by bats, hard", 202],
  ["starter-volcano", "A volcano full of lava pits and fire lizards ruled by a magma dragon", 303],
  ["starter-candy", "A candy kingdom of gumdrop blobs and lollipop plants", 404],
];

export const starterWorlds = () =>
  STARTERS.map(([id, prompt, seed], i) =>
    sanitizeWorld({
      ...newWorld(
        specFromPrompt(prompt),
        { uid: "starter", displayName: "Dino Team" },
        {
          now: Date.UTC(2026, 10, 1) - i * 3600000,
          random: () => 0.5,
        },
      ),
      id,
      seed,
    }),
  );

// ------------------------------------------------------------------ local mock

export class LocalRepository {
  constructor({ seedStarters = true } = {}) {
    this.live = false; // this device only
    this.listeners = new Set();
    if (seedStarters && !readList(LOCAL_KEY).length) writeList(LOCAL_KEY, starterWorlds());
    this.channel = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel("dino-worlds");
        this.channel.onmessage = (event) => this.receive(event.data);
        // node (tests) keeps running while a channel is open
        if (this.channel.unref) this.channel.unref();
      }
    } catch (error) {
      this.channel = null;
    }
  }

  receive(raw) {
    const world = sanitizeWorld(raw);
    if (world) this.listeners.forEach((cb) => cb(world));
  }

  async list({ limit = 60 } = {}) {
    return readList(LOCAL_KEY).sort(newestFirst).slice(0, limit);
  }

  async get(id) {
    return readList(LOCAL_KEY).find((w) => w.id === id) || null;
  }

  async publish(raw, token) {
    if (!token) throw new Error("Sign in to share worlds.");
    const world = sanitizeWorld(raw);
    if (!world) throw new Error("That world can't be shared.");
    writeList(LOCAL_KEY, mergeWorlds(readList(LOCAL_KEY), [world]));
    if (this.channel) this.channel.postMessage(world);
    this.listeners.forEach((cb) => cb(world));
    return world;
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

// ------------------------------------------------------------------- server

export class HttpRepository {
  /** `base` is the server origin, e.g. https://worlds.example.com */
  constructor(base, { fetchImpl, EventSourceImpl } = {}) {
    this.base = String(base).replace(/\/+$/, "");
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args));
    this.EventSource = EventSourceImpl || globalThis.EventSource;
    this.live = true;
    this.listeners = new Set();
    this.source = null;
    this.poll = null;
    this.seen = new Set();
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.base}${path}`, options);
    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }
    if (!response.ok) {
      throw new Error((body && body.error) || `server returned ${response.status}`);
    }
    return body || {};
  }

  async fetchList(limit) {
    const body = await this.request(`/api/worlds?limit=${Math.max(1, Math.min(100, limit))}`);
    return (body.worlds || []).map(sanitizeWorld).filter(Boolean).sort(newestFirst);
  }

  async list({ limit = 60 } = {}) {
    try {
      const worlds = await this.fetchList(limit);
      worlds.forEach((w) => this.seen.add(w.id));
      writeList(CACHE_KEY, worlds);
      return worlds;
    } catch (error) {
      // offline: show the last list we saw, and say so
      const cached = readList(CACHE_KEY);
      if (cached.length) {
        cached.stale = true;
        return cached;
      }
      throw error;
    }
  }

  async get(id) {
    const body = await this.request(`/api/worlds/${encodeURIComponent(id)}`);
    return sanitizeWorld(body.world);
  }

  async publish(raw, token) {
    if (!token) throw new Error("Sign in to share worlds.");
    const world = sanitizeWorld(raw);
    if (!world) throw new Error("That world can't be shared.");
    const body = await this.request("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ world }),
    });
    const saved = sanitizeWorld(body.world) || world;
    this.seen.add(saved.id);
    writeList(CACHE_KEY, mergeWorlds(readList(CACHE_KEY), [saved]));
    return saved;
  }

  deliver(raw) {
    const world = sanitizeWorld(raw);
    if (!world || this.seen.has(world.id)) return;
    this.seen.add(world.id);
    this.listeners.forEach((cb) => cb(world));
  }

  subscribe(cb) {
    this.listeners.add(cb);
    if (!this.source && !this.poll && !this.retry) this.connect();
    return () => {
      this.listeners.delete(cb);
      if (!this.listeners.size) this.disconnect();
    };
  }

  /** Worlds published while we weren't listening. */
  catchUp() {
    this.fetchList(20)
      .then((worlds) => worlds.reverse().forEach((w) => this.deliver(w)))
      .catch(() => {});
  }

  connect() {
    this.retry = null;
    if (this.EventSource) {
      try {
        const source = new this.EventSource(`${this.base}/api/worlds/stream`);
        this.source = source;
        source.addEventListener("world", (event) => {
          try {
            this.deliver(JSON.parse(event.data));
          } catch (error) {
            // a bad message: skip it
          }
        });
        source.addEventListener("open", () => {
          if (this.failures) this.catchUp();
          this.failures = 0;
        });
        // the browser would reconnect at once, forever: back off instead
        source.addEventListener("error", () => {
          source.close();
          if (this.source !== source) return;
          this.source = null;
          this.failures = (this.failures || 0) + 1;
          const delay = Math.min(60000, 2000 * 2 ** Math.min(5, this.failures - 1));
          this.retry = setTimeout(() => this.connect(), delay);
        });
        return;
      } catch (error) {
        this.source = null;
      }
    }
    // no SSE: poll for new worlds
    this.poll = setInterval(() => this.catchUp(), 20000);
  }

  disconnect() {
    if (this.source) this.source.close();
    if (this.poll) clearInterval(this.poll);
    if (this.retry) clearTimeout(this.retry);
    this.source = null;
    this.poll = null;
    this.retry = null;
  }
}

/** The world server's origin from the settings URL (".../api/world" or a bare origin). */
export const serverBase = (url) =>
  String(url || "")
    .trim()
    .replace(/\/api\/worlds?\/?$/, "")
    .replace(/\/+$/, "");

export const createRepository = (serverUrl) => {
  const base = serverBase(serverUrl);
  return base ? new HttpRepository(base) : new LocalRepository();
};
