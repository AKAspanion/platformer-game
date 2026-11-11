import { LEVELS } from "../util";

export const SAMPLE_EVERY = 2; // ticks (30 per second): 15 samples a second
export const MAX_SECONDS = 240; // a longer run keeps no ghost
export const GHOST_ALPHA = 0.35;

// Every frameSet name the player can create, in a fixed order: a ghost names
// its animation by index in this list, so only append to it.
export const ANIMS = [
  "idleLeft",
  "idleRight",
  "runLeft",
  "runRight",
  "jumpLeft",
  "jumpRight",
  "deadLeft",
  "deadRight",
  "fireLeft",
  "fireRight",
  "riseLeft",
  "riseRight",
  "fallLeft",
  "fallRight",
  "hurtLeft",
  "hurtRight",
];

const VERSION = "g1";
const BYTES = 6; // x int16, y int16, anim uint8, frame uint8
const KEY = (levelId) => `ghost_${levelId}`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Collects samples during one attempt at a level. */
export function createRecorder() {
  let samples = [];
  return {
    sample(tick, player) {
      if (tick % SAMPLE_EVERY !== 0) return;
      samples.push({ x: player.x, y: player.y, anim: player.anim, frame: player.frame });
    },
    finish(levelId, seconds) {
      if (!samples.length || !(seconds <= MAX_SECONDS)) return null;
      return { levelId, seconds, samples: samples.slice() };
    },
    reset() {
      samples = [];
    },
  };
}

export function encodeGhost(ghost) {
  const bytes = new Uint8Array(ghost.samples.length * BYTES);
  ghost.samples.forEach((s, i) => {
    const x = clamp(Math.round(s.x), -32768, 32767) & 0xffff;
    const y = clamp(Math.round(s.y), -32768, 32767) & 0xffff;
    const anim = Math.max(0, ANIMS.indexOf(s.anim));
    const o = i * BYTES;
    bytes[o] = x & 0xff;
    bytes[o + 1] = x >> 8;
    bytes[o + 2] = y & 0xff;
    bytes[o + 3] = y >> 8;
    bytes[o + 4] = anim;
    bytes[o + 5] = clamp(Math.round(s.frame) || 0, 0, 255);
  });
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return [VERSION, ghost.levelId, ghost.seconds, ghost.samples.length, btoa(binary)].join("|");
}

export function decodeGhost(text) {
  try {
    if (typeof text !== "string") return null;
    const parts = text.split("|");
    if (parts.length !== 5 || parts[0] !== VERSION) return null;
    const levelId = Number(parts[1]);
    const seconds = Number(parts[2]);
    const count = Number(parts[3]);
    if (!Number.isInteger(levelId) || !Number.isInteger(count) || count < 1) return null;
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    const binary = atob(parts[4]);
    if (binary.length !== count * BYTES) return null;
    const samples = [];
    for (let i = 0; i < count; i++) {
      const o = i * BYTES;
      const byte = (n) => binary.charCodeAt(o + n);
      const anim = ANIMS[byte(4)];
      if (!anim) return null;
      samples.push({
        x: ((byte(0) | (byte(1) << 8)) << 16) >> 16,
        y: ((byte(2) | (byte(3) << 8)) << 16) >> 16,
        anim,
        frame: byte(5),
      });
    }
    return { levelId, seconds, samples };
  } catch {
    return null;
  }
}

/** One ghost per campaign level, in localStorage keys "ghost_<levelId>". */
export function createGhostStore(storage = globalThis.localStorage) {
  const get = (levelId) => {
    try {
      return decodeGhost(storage.getItem(KEY(levelId)));
    } catch {
      return null;
    }
  };
  return {
    get,
    offer(ghost) {
      try {
        if (!ghost || !Number.isFinite(ghost.seconds)) return false;
        const kept = get(ghost.levelId);
        if (kept && !(ghost.seconds < kept.seconds)) return false;
        storage.setItem(KEY(ghost.levelId), encodeGhost(ghost));
        return true;
      } catch {
        return false;
      }
    },
    clearAll() {
      LEVELS.forEach(({ id }) => {
        try {
          storage.removeItem(KEY(id));
        } catch {
          // blocked storage: nothing to erase
        }
      });
    },
  };
}

/** Where the ghost is at `tick` of the level's clock, or null once its run has ended. */
export function ghostAt(ghost, tick) {
  const { samples } = ghost;
  if (!samples.length || !(tick >= 0)) return null;
  const at = tick / SAMPLE_EVERY;
  const i = Math.floor(at);
  if (at > samples.length - 1) return null;
  const a = samples[i];
  const b = samples[i + 1];
  if (!b || at === i) return { ...a };
  const t = at - i;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, anim: a.anim, frame: a.frame };
}
