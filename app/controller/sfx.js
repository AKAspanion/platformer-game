import { getData } from "../util";
import { audioSrc } from "../util/registry";

/**
 * Short sound effects from app/assets/audio/sfx (made by
 * scripts/generate-audio.py). Nothing is downloaded up front: each sound is
 * requested the first time it plays (or when loadSfx asks), then cloned per play,
 * so overlapping hits don't cut each other off; a per-sound gap stops the same
 * sound stacking up when several things happen in one tick.
 */
const VOLUME = {
  "boss-defeat": 0.5,
  explosion: 0.45,
  "laser-fire": 0.35,
  "laser-charge": 0.3,
  gate: 0.5,
  "boss-slam": 0.5,
  "icicle-fall": 0.25,
  "boss-charge": 0.35,
};
const GAP_MS = 70;

const cache = {};
const ready = {};
const lastPlayed = {};

const source = (name) => {
  if (!cache[name]) {
    const audio = new Audio(audioSrc(name, "wav", "sfx/"));
    audio.preload = "auto";
    cache[name] = audio;
  }
  return cache[name];
};

/** Forget recent plays (tests run many ticks inside one real millisecond). */
export const resetSfxGap = () => Object.keys(lastPlayed).forEach((k) => delete lastPlayed[k]);

const whenReady = (name) => {
  if (!ready[name]) {
    ready[name] = new Promise((resolve) => {
      try {
        const audio = source(name);
        // a sound that fails to load counts as done: it just stays silent
        audio.addEventListener("canplaythrough", resolve, { once: true });
        audio.addEventListener("error", resolve, { once: true });
      } catch (error) {
        resolve();
      }
    });
  }
  return ready[name];
};

/** Starts downloading these sounds if they aren't already; resolves when they can play. */
export const loadSfx = (names) => Promise.all(names.map(whenReady)).then(() => {});

/** Forget a cached sound (a generated world re-registered it). */
export const forgetSfx = (name) => {
  delete cache[name];
  delete ready[name];
};

export default function sfx(name, volume) {
  if (!name || getData("mute_sounds")) return;
  const now = Date.now();
  if (now - (lastPlayed[name] || 0) < GAP_MS) return;
  lastPlayed[name] = now;
  try {
    // the first play uses the element that is still downloading (it plays when
    // ready); later plays are copies of the downloaded one
    const fresh = !cache[name];
    const base = source(name);
    const audio = !fresh && base.cloneNode ? base.cloneNode() : base;
    audio.volume = volume ?? VOLUME[name] ?? 0.4;
    const playing = audio.play();
    if (playing && playing.catch) playing.catch(() => {});
  } catch (error) {
    // no audio (tests, blocked autoplay): a missed sound is fine
  }
}

/** Sound for each enemy type: an attack cry and a death. */
export const ENEMY_SFX = {
  pig: { attack: "pig-attack", die: "pig-die" },
  slime: { attack: "slime-attack", die: "slime-die" },
  chameleon: { attack: "chameleon-attack", die: "chameleon-die" },
  beetle: { attack: "beetle-attack", die: "beetle-die" },
  bat: { attack: "bat-attack", die: "bat-die" },
  spitter: { attack: "spitter-spit", die: "spitter-die" },
};

/** Boss move -> sound when it starts (the wind-up plays the boss's roar). */
export const BOSS_MOVE_SFX = {
  charge: "boss-charge",
  rocket: "boss-charge",
  stomp: "boss-jump",
  bounce: "boss-jump",
  quake: "boss-jump",
  vanish: "vanish",
  rings: "rings",
  swarm: "summon",
  summon: "summon",
  missiles: "missile-launch",
  laser: "laser-charge",
  fan: "spitter-spit",
  icicles: "icicle-fall",
};

export const ALL_SFX = [
  ...Object.values(ENEMY_SFX).flatMap((s) => [s.attack, s.die]),
  ...new Set(Object.values(BOSS_MOVE_SFX)),
  "beetle-armor",
  "roar-kingPig",
  "roar-frostSlime",
  "roar-sandLizard",
  "roar-batLord",
  "roar-mechBeetle",
  "boss-hit",
  "boss-slam",
  "boss-defeat",
  "icicle-shatter",
  "explosion",
  "laser-fire",
  "tongue",
  "gate",
  "powerup",
  "heart",
  "shield-block",
];
