/**
 * How the dino dies. Each way of losing the last heart has its own death:
 *
 *   knockout  an enemy, a boss or the Sand Lizard's tongue: flung up and away,
 *             spinning, and off the bottom of the screen
 *   shot      a seed, sand, mud, glob, spit, pebble or orb: a splat in the
 *             shot's colours, knocked back, and it falls over
 *   spiked    a spike or saw trap, or a pit of spikes: popped up with a red
 *             flash, and it falls over on them
 *   burnt     a missile, its blast or the laser: charred, smoking, falls over
 *   frozen    an icicle or ice shard: frozen still in ice, then it shatters
 *   drown     a water pit: sinks with bubbles, turning blue
 *   melt      an acid pit: sinks and melts flat, steaming
 *   void      a bottomless pit: shrinks away into the dark, spinning
 *
 * Everything here is in ticks (30 a second). Each death plays out in under
 * DEATH_TICKS, before the Game Over panel comes up (1.4 s after the death).
 */
export const DEATH_TICKS = 40;

/** The tick a frozen dino shatters. */
export const SHATTER_TICK = 22;

/**
 * motion: "fall" (gravity and the ground, as in life), "fly" (gravity, through
 * the ground), "sink" (slowly down, through the ground) or "still".
 * frames: "dead" (the falling-over frames), "hurt" (the knocked-back pose) or
 * "hold" (the pose it had when it died).
 * hop / push: the start speed up and away from what killed it (px a tick).
 */
export const DEATHS = {
  knockout: { motion: "fly", frames: "hurt", hop: -13, push: 3 },
  shot: { motion: "fall", frames: "dead", hop: -8, push: 2.5 },
  spiked: { motion: "fall", frames: "dead", hop: -11, push: 0 },
  burnt: { motion: "fall", frames: "dead", hop: -9, push: 1 },
  frozen: { motion: "still", frames: "hold" },
  drown: { motion: "sink", frames: "hurt", sink: 0.7 },
  melt: { motion: "sink", frames: "hurt", sink: 0.45 },
  void: { motion: "sink", frames: "hurt", sink: 1.2 },
};

export const DEATH_KINDS = Object.keys(DEATHS);

/** Every death's sound. */
export const DEATH_SFX = DEATH_KINDS.map((kind) => `death-${kind}`);

/** A kind that isn't known plays as a knockout. */
export const deathStyle = (kind) => DEATHS[kind] || DEATHS.knockout;

/**
 * The sound a death of `kind` plays (app/assets/audio/sfx/death-<kind>.wav,
 * made by scripts/generate-audio.py). A frozen dino also shatters later.
 */
export const deathSound = (kind) => `death-${DEATHS[kind] ? kind : "knockout"}`;

// projectiles that don't just knock the dino over
const PROJECTILE_DEATHS = { icicle: "frozen", shard: "frozen", missile: "burnt" };
// boss attacks on the ground
const HAZARD_DEATHS = { laser: "burnt", blast: "burnt", tongue: "knockout" };

/** The death a projectile of `kind` (seed, icicle, missile...) gives. */
export const projectileDeath = (kind) => PROJECTILE_DEATHS[kind] || "shot";

/** The death a boss hazard of `kind` (laser, blast, tongue) gives. */
export const hazardDeath = (kind) => HAZARD_DEATHS[kind] || "knockout";

// Pit floors, by what is drawn there (app/pcg/generator.js): desert spikes are
// object 15 on the bottom row; factory acid is tiles 16 (top) and 17 (body).
const SPIKE_OBJECT = 15;
const ACID_TILES = [16, 17];

/**
 * The death a pit at column `col` gives: drown in water (or a generated
 * world's liquid), spiked on spikes, melt in acid, or void when bottomless.
 * `area` is { water: [{ x, width }], objects, map, rows, theme, tileSize }.
 */
export function pitDeath(col, { water = [], objects, map, rows, theme, tileSize = 16 }) {
  const left = col * tileSize;
  if (water.some((w) => w.x < left + tileSize && w.x + w.width > left)) return "drown";
  const bottom = objects && objects[rows - 1] && objects[rows - 1][col];
  if (Array.isArray(bottom) && bottom.some((o) => o && o.id === SPIKE_OBJECT)) return "spiked";
  if (theme === "lab" && map) {
    for (let r = Math.max(0, rows - 4); r < rows; r++) {
      if (map[r] && ACID_TILES.includes(map[r][col])) return "melt";
    }
  }
  return "void";
}

export const POSE_PIVOT = 10;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// 1 until `from`, then down to 0 at `to`
const fade = (t, from, to) => clamp01((to - t) / (to - from));

/**
 * How to draw the dino `t` ticks into a death of `kind`, flung toward `dir`
 * (-1 or 1). Turns and scales are about the middle of the dino, POSE_PIVOT px
 * above its feet; offsetX / offsetY move it.
 *   { alpha, rotation, scaleX, scaleY, offsetX, offsetY, tint, tintAmount, hidden }
 */
export function deathPose(kind, t, dir = 1) {
  const pose = {
    alpha: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    tint: null,
    tintAmount: 0,
    hidden: false,
  };
  switch (kind) {
    case "shot":
      pose.alpha = fade(t, 28, DEATH_TICKS);
      break;
    case "spiked":
      // a red flash as it's hit, then it lies there
      if (t < 8 && t % 2 === 0) {
        pose.tint = "#ff3b3b";
        pose.tintAmount = 0.65;
      }
      pose.alpha = fade(t, 28, DEATH_TICKS);
      break;
    case "burnt":
      pose.tint = "#2a1a12";
      pose.tintAmount = Math.min(0.75, t / 8);
      pose.alpha = fade(t, 28, DEATH_TICKS);
      break;
    case "frozen":
      pose.tint = "#bfe8ff";
      pose.tintAmount = Math.min(0.7, t / 4);
      // a shiver before it shatters
      if (t > SHATTER_TICK - 8) pose.offsetX = t % 2 ? 0.75 : -0.75;
      pose.hidden = t >= SHATTER_TICK;
      break;
    case "drown":
      pose.tint = "#2f6fc8";
      pose.tintAmount = Math.min(0.55, t / 18);
      pose.rotation = Math.sin(t / 3) * 0.15;
      pose.alpha = fade(t, 8, 34);
      break;
    case "melt": {
      const left = Math.max(0.15, 1 - t / 26);
      pose.tint = "#7be04a";
      pose.tintAmount = Math.min(0.8, t / 8);
      pose.scaleY = left;
      pose.scaleX = 1 + (1 - left) * 0.6;
      pose.offsetY = POSE_PIVOT * (1 - left); // melts down onto its feet
      pose.alpha = fade(t, 18, 32);
      break;
    }
    case "void": {
      const size = Math.max(0, 1 - t / 30);
      pose.scaleX = pose.scaleY = size;
      pose.rotation = dir * t * 0.3;
      pose.alpha = fade(t, 10, 30);
      break;
    }
    default:
      // knockout: a spin toward where it was flung
      pose.rotation = dir * t * 0.32;
      pose.alpha = fade(t, 30, DEATH_TICKS);
      break;
  }
  if (pose.alpha <= 0) pose.hidden = true;
  return pose;
}
