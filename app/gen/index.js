import { toImage, Pix } from "./pixels";
import { buildEnemy, buildBossFrames } from "./creatures";
import { buildTiles, buildBackground, buildObjects, buildLiquid } from "./scenery";
import { composeTrack, creatureSounds, bossSounds, wavUrl } from "./audio";
import { registerEnemyType } from "../game/enemies";
import { registerBoss } from "../game/boss";
import { ENEMY_SFX, forgetSfx } from "../controller/sfx";
import { registerAudio, registerSkin } from "../util/registry";
import { hashString, normalizeWorldSpec, LEVELS_PER_WORLD } from "../worlds/spec";

/**
 * Builds everything a created world needs, on this device, from its spec:
 * enemy and boss sprites, tiles, backdrop, decor, liquid, music (world theme
 * + boss battle) and creature / boss sounds; registers them with the engine,
 * and returns the per-level options for the level generator.
 *
 * Deterministic: the world's id and seed drive every random choice, so a
 * world shared from another phone looks and sounds the same here.
 */

const built = {}; // world key -> result (assets are built once per session)

export const worldKey = (world) => `w${hashString(`${world.id}:${world.seed}`).toString(36)}`;

const DENSITY = { low: 0.6, medium: 1, high: 1.4 };

const frameSet = (list) => list.map(toImage);

/** The boss fight scales with the world's difficulty (tier 1-5, like the story bosses). */
export const bossConfig = (spec, size, types) => {
  const tier = spec.difficulty;
  const walker = types.find((t) => t.kind === "walker");
  const flyer = types.find((t) => t.kind === "flyer");
  return {
    name: spec.boss.name,
    tier,
    hp: 10 + tier * 4,
    width: size.width,
    height: size.height,
    crown: size.crown,
    speed: spec.boss.flyer ? 1.1 : 0.75 + tier * 0.06,
    flyer: spec.boss.flyer,
    moves: spec.boss.moves,
    minion: (walker || types[0]).type,
    flyMinion: (flyer || walker || types[0]).type,
    colors: [spec.boss.accent, spec.boss.color, spec.palette.accent],
    splits: spec.boss.body === "blob",
  };
};

/**
 * `world` is { id, seed, spec }. Options: `audio` (default true) renders the
 * music and sounds; tests turn it off for speed.
 */
export function buildWorld(world, { audio = true } = {}) {
  const key = worldKey(world);
  if (built[key] && (built[key].audio || !audio)) return built[key];
  const spec = normalizeWorldSpec(world.spec);
  const seed = world.seed >>> 0 || hashString(world.id);

  // ---- art
  const tiles = buildTiles(spec, seed);
  const objects = buildObjects(spec, seed);
  const background = buildBackground(spec, seed);
  const liquid = buildLiquid(spec, seed);
  registerSkin(key, {
    tiles: tiles.map((t) => (t ? toImage(t) : null)),
    objects: objects.map((o) => (o ? toImage(o) : null)),
    background: toImage(background),
    liquid: { surface: frameSet(liquid.surface), body: frameSet(liquid.body) },
  });

  const types = spec.enemies.map((design, i) => {
    const type = `${key}e${i}`;
    const { config, frames } = buildEnemy(design, seed + i * 101);
    registerEnemyType(
      type,
      { ...config, name: design.name },
      {
        left: frameSet(frames.left),
        right: frameSet(frames.right),
        attackLeft: frameSet(frames.attackLeft),
        attackRight: frameSet(frames.attackRight),
        deadLeft: frameSet(frames.deadLeft),
        deadRight: frameSet(frames.deadRight),
      },
    );
    return { type, kind: config.kind, design, preview: frames.right[0] };
  });

  const bossKind = `${key}b`;
  const boss = buildBossFrames(spec.boss, seed + 7);
  const bossSet = {};
  Object.keys(boss.frames).forEach((name) => (bossSet[name] = frameSet(boss.frames[name])));
  const config = bossConfig(spec, boss.size, types);

  // ---- audio
  const themeTrack = `${key}-theme`;
  const sounds = {};
  if (audio) {
    registerAudio(themeTrack, wavUrl(composeTrack(spec.music, seed).samples));
    registerAudio(
      `boss-${bossKind}`,
      wavUrl(composeTrack(spec.music, seed + 1, { boss: true }).samples),
    );
    types.forEach(({ type, design }, i) => {
      const s = creatureSounds(design, seed + i * 31);
      const attack = `${type}-attack`;
      const die = `${type}-die`;
      registerAudio(attack, wavUrl(s.attack));
      registerAudio(die, wavUrl(s.die));
      forgetSfx(attack);
      forgetSfx(die);
      ENEMY_SFX[type] = { attack, die };
    });
    const b = bossSounds(spec.boss, spec.music, seed + 3);
    registerAudio(`roar-${bossKind}`, wavUrl(b.roar));
    registerAudio(`${bossKind}-hit`, wavUrl(b.hit));
    registerAudio(`${bossKind}-defeat`, wavUrl(b.defeat));
    sounds.hit = `${bossKind}-hit`;
    sounds.defeat = `${bossKind}-defeat`;
  } else {
    // no audio: fall back to the shared files
    types.forEach(({ type }) => (ENEMY_SFX[type] = ENEMY_SFX.pig));
  }
  registerBoss(bossKind, { ...config, sounds }, bossSet);

  // ---- levels: five that ramp up, then the boss arena
  const enemyKinds = {};
  types.forEach((t) => (enemyKinds[t.type] = t.kind));
  const common = {
    theme: themeTrack,
    world: 1,
    decorSet: "gen",
    style: { pits: spec.terrain.pits, traps: spec.terrain.traps || spec.hazards === "high" },
    enemyTypes: types.map((t) => t.type),
    enemyKinds,
    enemyScale: DENSITY[spec.enemyDensity],
    pitScale: DENSITY[spec.hazards],
    powerups: spec.powerups,
  };
  const levels = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
    const last = i === LEVELS_PER_WORLD - 1;
    return {
      ...common,
      difficulty: Math.min(5, spec.difficulty + Math.floor((i * 2) / (LEVELS_PER_WORLD - 1))),
      powerupCount: spec.difficulty >= 4 || i >= 3 ? 2 : 1,
      ...(last ? { boss: bossKind } : {}),
    };
  });

  built[key] = {
    key,
    spec,
    seed,
    levels,
    types,
    bossKind,
    audio,
    art: { tiles, objects, background, boss: boss.frames["walk-right"][0] },
  };
  return built[key];
}

/**
 * A small preview picture of a world (backdrop, a strip of ground, its
 * creatures and boss) as a Pix buffer: 168 x 96.
 */
export function previewWorld(world) {
  const spec = normalizeWorldSpec(world.spec);
  const seed = world.seed >>> 0 || hashString(world.id);
  const W = 168;
  const H = 96;
  const pix = new Pix(W, H);
  pix.blit(buildBackground(spec, seed), 0, 0, 0.5);
  const tiles = buildTiles(spec, seed);
  for (let x = 0; x < W; x += 16) {
    pix.blit(tiles[2], x, H - 24);
    pix.blit(tiles[5], x, H - 8);
  }
  const objects = buildObjects(spec, seed);
  pix.blit(objects[1], 4, H - 24 - 32);
  pix.blit(objects[3], 70, H - 24 - 12);

  const ground = H - 24;
  let x = 30;
  spec.enemies.slice(0, 3).forEach((design, i) => {
    const sprite = buildEnemy(design, seed + i * 101).frames.right[0];
    const y = design.behavior === "flyer" ? ground - 44 : ground - sprite.height / 2;
    pix.blit(sprite, x, y, 0.5);
    x += sprite.width / 2 + 8;
  });
  const boss = buildBossFrames(spec.boss, seed + 7).frames["walk-left"][0];
  pix.blit(
    boss,
    W - boss.width / 2 - 6,
    (spec.boss.flyer ? ground - 22 : ground) - boss.height / 2,
    0.5,
  );
  return pix;
}

export const previewImage = (world) => toImage(previewWorld(world));
