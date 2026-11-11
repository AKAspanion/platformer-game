import { sanitizeWorld, specFromPrompt, newWorld, matchWorlds } from "./spec.js";

/**
 * The shared world repository: every world anyone creates, newest first.
 *
 *   repo.list({ limit })   -> Promise<world[]>
 *   repo.get(id)           -> Promise<world | null>
 *   repo.publish(world)    -> Promise<world>   (the signed-in player's; the server stamps author + time)
 *   repo.search(query)     -> Promise<world[]> (every world, not just the newest; see matchWorlds)
 *   repo.subscribe(cb)     -> unsubscribe()    (cb(world) for each new world, live)
 *   repo.live              -> true when worlds reach other devices
 *
 * Backends:
 *   - FirestoreRepository: the game's. Worlds are read from Firestore and
 *     published through the publishWorld function; onSnapshot makes it live.
 *     It takes a small adapter (app/firebase/worlds.js) so it can be tested
 *     without Firebase.
 *   - LocalRepository: this device only (localStorage, live across tabs via
 *     BroadcastChannel). Used by tests and as a fallback.
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

  async search(query) {
    return matchWorlds(readList(LOCAL_KEY), query, 30);
  }

  async publish(raw) {
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

// ---------------------------------------------------------------- firestore

export class FirestoreRepository {
  /**
   * `worlds` is the adapter: list(n) -> raw[], get(id) -> raw | null,
   * watch(n, onAdded, onError) -> stop(), publish(world) -> raw, search(query) -> raw[].
   */
  constructor(worlds) {
    this.worlds = worlds;
    this.live = true;
    this.listeners = new Set();
    this.stop = null;
    this.seen = new Set();
  }

  async list({ limit = 60 } = {}) {
    try {
      const raw = await this.worlds.list(Math.max(1, Math.min(100, limit)));
      const worlds = raw.map(sanitizeWorld).filter(Boolean).sort(newestFirst);
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
    return sanitizeWorld(await this.worlds.get(id));
  }

  async search(query) {
    const raw = await this.worlds.search(String(query || "").slice(0, 60));
    // the server ranks them; sanitizing keeps that order
    return (Array.isArray(raw) ? raw : []).map(sanitizeWorld).filter(Boolean);
  }

  async publish(raw) {
    const world = sanitizeWorld(raw);
    if (!world) throw new Error("That world can't be shared.");
    const saved = sanitizeWorld(await this.worlds.publish(world)) || world;
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
    if (!this.stop) this.stop = this.worlds.watch(20, (raw) => this.deliver(raw));
    return () => {
      this.listeners.delete(cb);
      if (!this.listeners.size && this.stop) {
        this.stop();
        this.stop = null;
      }
    };
  }
}
