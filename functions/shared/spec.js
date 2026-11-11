// GENERATED from app/worlds/spec.js by scripts/sync-functions-shared.js. Do not edit.
/**
 * World spec v2: everything the world creator needs to build a whole world.
 *
 * The AI (server/world-api.mjs) or the offline parser below writes a spec;
 * app/gen turns it into art, music, sound and 6 levels (5 + a boss arena) on
 * every device. The spec is small JSON, so sharing a world means sharing the
 * spec and a seed; every player gets the same world.
 *
 * No imports: the server loads this file too, to validate published worlds.
 */

export const SPEC_VERSION = 2;
export const LEVELS_PER_WORLD = 6; // 5 levels + a boss arena

// Keep BOSS_MOVES in sync with app/game/boss.js (a test checks).
export const OPTIONS = {
  surfaces: ["grass", "snow", "sand", "stone", "metal", "crystal", "candy", "moss", "ash"],
  pits: ["liquid", "spikes", "void"],
  skylines: ["hills", "mountains", "dunes", "forest", "city", "spires", "clouds", "cavern"],
  celestials: ["sun", "moon", "twin-moons", "stars", "none"],
  decor: [
    "tree",
    "pine",
    "palm",
    "cactus",
    "rock",
    "crystal",
    "mushroom",
    "bush",
    "flower",
    "tombstone",
    "lamp",
    "pipe",
    "bones",
    "coral",
  ],
  behaviors: ["walker", "flyer", "turret"],
  bodies: ["blob", "round", "box", "tall", "spiky", "bug"],
  features: [
    "horns",
    "ears",
    "antenna",
    "spikes",
    "tail",
    "teeth",
    "one-eye",
    "three-eyes",
    "shell",
  ],
  speeds: ["slow", "medium", "fast"],
  moods: ["happy", "heroic", "mysterious", "spooky", "tense", "chill", "epic"],
  leads: ["square", "pulse", "triangle", "saw"],
  bossMoves: [
    "charge",
    "rocket",
    "stomp",
    "bounce",
    "icicles",
    "vanish",
    "tongue",
    "fan",
    "swoop",
    "rings",
    "swarm",
    "missiles",
    "laser",
    "quake",
    "summon",
  ],
  densities: ["low", "medium", "high"],
  powerups: ["heart", "shield", "triple", "wings"],
};

// moves a flying boss can't do (they need the ground), and the reverse
const GROUND_MOVES = ["charge", "rocket", "stomp", "bounce", "quake"];
const AIR_MOVES = ["swoop"];

const PALETTE_KEYS = ["skyTop", "skyBottom", "ground", "surface", "accent", "liquid"];

/** Looks for a world that names a place; each preset is a full, tasteful default. */
export const PRESETS = {
  meadow: {
    palette: ["#7ec8f0", "#d8f1ff", "#8a5a3a", "#5cc44a", "#ffd84d", "#3a8ee0"],
    surface: "grass",
    pits: "liquid",
    skyline: "hills",
    celestial: "sun",
    decor: ["tree", "bush", "flower", "rock"],
    mood: "happy",
  },
  frost: {
    palette: ["#9fc6ee", "#eef8ff", "#5a7aa8", "#f4fbff", "#7cd6ff", "#5fb4f0"],
    surface: "snow",
    pits: "liquid",
    skyline: "mountains",
    celestial: "sun",
    decor: ["pine", "crystal", "rock"],
    mood: "chill",
  },
  dunes: {
    palette: ["#f0a860", "#ffe2a8", "#b8743a", "#f3d28a", "#e85a3a", "#3aa0b0"],
    surface: "sand",
    pits: "spikes",
    skyline: "dunes",
    celestial: "sun",
    decor: ["cactus", "palm", "rock", "bones"],
    mood: "heroic",
  },
  grave: {
    palette: ["#1e1838", "#4a3a6a", "#3a3448", "#6a7a5a", "#b07cff", "#40305a"],
    surface: "moss",
    pits: "void",
    skyline: "spires",
    celestial: "moon",
    decor: ["tombstone", "bones", "lamp", "mushroom"],
    mood: "spooky",
  },
  factory: {
    palette: ["#2a2f3a", "#5a6270", "#3a3f48", "#9aa4b0", "#ffb43f", "#7cff4a"],
    surface: "metal",
    pits: "liquid",
    skyline: "city",
    celestial: "none",
    decor: ["pipe", "lamp", "rock"],
    mood: "tense",
  },
  volcano: {
    palette: ["#3a1410", "#a0402a", "#3a2a2a", "#5a4a48", "#ff7a2a", "#ff4a1a"],
    surface: "ash",
    pits: "liquid",
    skyline: "mountains",
    celestial: "none",
    decor: ["rock", "crystal", "bones"],
    mood: "epic",
  },
  candy: {
    palette: ["#ffb0d8", "#fff0f8", "#c86a9a", "#fff4fa", "#7ad8ff", "#ff7ab8"],
    surface: "candy",
    pits: "liquid",
    skyline: "clouds",
    celestial: "sun",
    decor: ["mushroom", "flower", "bush", "lamp"],
    mood: "happy",
  },
  crystal: {
    palette: ["#241a4a", "#6a4ab0", "#3a2a6a", "#b48aff", "#5affe0", "#5a8aff"],
    surface: "crystal",
    pits: "void",
    skyline: "cavern",
    celestial: "stars",
    decor: ["crystal", "mushroom", "rock"],
    mood: "mysterious",
  },
  ocean: {
    palette: ["#3ab0d8", "#c8f4ff", "#c8a070", "#f0dca0", "#ff6a7a", "#1a8ad0"],
    surface: "sand",
    pits: "liquid",
    skyline: "clouds",
    celestial: "sun",
    decor: ["coral", "palm", "rock"],
    mood: "chill",
  },
  jungle: {
    palette: ["#5ab08a", "#d0f0c0", "#5a3a22", "#3a9a2a", "#ff9a2a", "#3a7a6a"],
    surface: "grass",
    pits: "liquid",
    skyline: "forest",
    celestial: "sun",
    decor: ["palm", "tree", "bush", "mushroom"],
    mood: "heroic",
  },
  space: {
    palette: ["#05060f", "#1a1a3a", "#4a4a5a", "#9a9aaa", "#7aff6a", "#5a3aff"],
    surface: "stone",
    pits: "void",
    skyline: "spires",
    celestial: "twin-moons",
    decor: ["crystal", "rock", "lamp"],
    mood: "mysterious",
  },
  ruins: {
    palette: ["#e8a070", "#ffe0c0", "#7a6a5a", "#b0a090", "#3a8ae0", "#4aa0c0"],
    surface: "stone",
    pits: "spikes",
    skyline: "spires",
    celestial: "sun",
    decor: ["rock", "bush", "lamp", "bones"],
    mood: "heroic",
  },
};

// ------------------------------------------------------------------- helpers

/** Small string hash (FNV-1a), for seeds and ids. */
export const hashString = (text) => {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const rngFrom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clampInt = (n, lo, hi, fallback) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
};
const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);
const someOf = (values, list, max = list.length) =>
  Array.isArray(values) ? [...new Set(values.filter((v) => list.includes(v)))].slice(0, max) : [];
const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());
const hex = (c, fallback) => (isHex(c) ? c.trim().toLowerCase() : fallback);

/** Family-friendly-ish display text: letters, digits and simple punctuation. */
export const cleanText = (text, max, fallback = "") => {
  const value = String(text == null ? "" : text)
    .replace(/[^A-Za-z0-9À-ɏ '!,.?&-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return value || fallback;
};

// ------------------------------------------------------------------- validate

const DEFAULT_ENEMIES = [
  { name: "Grub", behavior: "walker", body: "round", features: ["ears"], speed: "medium" },
  { name: "Flit", behavior: "flyer", body: "round", features: ["antenna"], speed: "medium" },
  { name: "Snapper", behavior: "turret", body: "spiky", features: ["teeth"], speed: "slow" },
];

const normalizeCreature = (raw = {}, fallback, palette, index) => {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    name: cleanText(r.name, 18, fallback.name),
    behavior: oneOf(r.behavior, OPTIONS.behaviors, fallback.behavior),
    body: oneOf(r.body, OPTIONS.bodies, fallback.body),
    color: hex(r.color, index % 2 ? palette.accent : palette.surface),
    accent: hex(r.accent, index % 2 ? palette.surface : palette.accent),
    features: someOf(r.features, OPTIONS.features, 3),
    speed: oneOf(r.speed, OPTIONS.speeds, fallback.speed),
    armored: !!r.armored,
  };
};

/**
 * Validate and clamp anything (model output, a shared world from another
 * device, an old v1 spec) into a complete v2 spec. Never throws.
 */
export function normalizeWorldSpec(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  if (r.version !== SPEC_VERSION && r.theme && !r.palette) return upgradeV1(r);

  const preset = PRESETS[r.preset] || PRESETS.meadow;
  const p = r.palette && typeof r.palette === "object" ? r.palette : {};
  const palette = {};
  PALETTE_KEYS.forEach((key, i) => (palette[key] = hex(p[key], preset.palette[i])));

  const t = r.terrain || {};
  const b = r.backdrop || {};
  const m = r.music || {};

  let enemies = (Array.isArray(r.enemies) ? r.enemies : [])
    .slice(0, 4)
    .map((e, i) => normalizeCreature(e, DEFAULT_ENEMIES[i % 3], palette, i));
  for (let i = enemies.length; i < 2; i++) {
    enemies.push(normalizeCreature({}, DEFAULT_ENEMIES[i], palette, i));
  }
  // the levels need someone to walk the ground
  if (!enemies.some((e) => e.behavior === "walker")) enemies[0].behavior = "walker";

  const rb = r.boss && typeof r.boss === "object" ? r.boss : {};
  const flyer = !!rb.flyer;
  let moves = Array.isArray(rb.moves) ? rb.moves.filter((x) => OPTIONS.bossMoves.includes(x)) : [];
  moves = moves.filter((x) => !(flyer ? GROUND_MOVES : AIR_MOVES).includes(x)).slice(0, 5);
  const pad = flyer ? ["swoop", "rings", "summon", "fan"] : ["charge", "stomp", "summon", "fan"];
  for (let i = 0; moves.length < 3 && i < pad.length; i++) {
    if (!moves.includes(pad[i])) moves.push(pad[i]);
  }
  const boss = {
    ...normalizeCreature(
      { ...rb, behavior: "walker" },
      { name: "Big Boss", behavior: "walker", body: "box", speed: "medium" },
      palette,
      1,
    ),
    name: cleanText(rb.name, 20, "Big Boss"),
    flyer,
    moves,
  };
  delete boss.behavior;
  delete boss.speed;

  return {
    version: SPEC_VERSION,
    name: cleanText(r.name, 24, "My World"),
    tagline: cleanText(r.tagline, 80, ""),
    palette,
    terrain: {
      surface: oneOf(t.surface, OPTIONS.surfaces, preset.surface),
      pits: oneOf(t.pits, OPTIONS.pits, preset.pits),
      traps: !!t.traps,
    },
    backdrop: {
      skyline: oneOf(b.skyline, OPTIONS.skylines, preset.skyline),
      celestial: oneOf(b.celestial, OPTIONS.celestials, preset.celestial),
    },
    decor: (() => {
      const list = someOf(r.decor, OPTIONS.decor, 4);
      return list.length ? list : preset.decor.slice(0, 4);
    })(),
    enemies,
    boss,
    music: {
      mood: oneOf(m.mood, OPTIONS.moods, preset.mood),
      tempo: clampInt(m.tempo, 70, 180, 120),
      lead: oneOf(m.lead, OPTIONS.leads, "square"),
    },
    difficulty: clampInt(r.difficulty, 1, 5, 2),
    enemyDensity: oneOf(r.enemyDensity, OPTIONS.densities, "medium"),
    hazards: oneOf(r.hazards, OPTIONS.densities, "medium"),
    powerups: (() => {
      const list = someOf(r.powerups, OPTIONS.powerups);
      return list.length ? list : [...OPTIONS.powerups];
    })(),
  };
}

// v1 worlds (theme + base enemies) still open: map them onto a preset.
const V1_PRESET = {
  grasslands: "meadow",
  iceland: "frost",
  desert: "dunes",
  graveyard: "grave",
  factory: "factory",
};
const V1_ENEMY = {
  pig: { name: "Hog", behavior: "walker", body: "box", features: ["ears"], speed: "fast" },
  slime: { name: "Goo", behavior: "walker", body: "blob", features: [], speed: "slow" },
  chameleon: { name: "Lizard", behavior: "walker", body: "tall", features: ["tail"] },
  beetle: { name: "Beetle", behavior: "walker", body: "bug", features: ["shell"], armored: true },
  bat: { name: "Bat", behavior: "flyer", body: "round", features: ["ears", "teeth"] },
  spitter: { name: "Spitter", behavior: "turret", body: "spiky", features: ["teeth"] },
};

function upgradeV1(v1) {
  const presetName = V1_PRESET[v1.theme] || "meadow";
  const preset = PRESETS[presetName];
  return normalizeWorldSpec({
    version: SPEC_VERSION,
    preset: presetName,
    name: v1.name,
    tagline: v1.tagline,
    terrain: { surface: preset.surface, pits: preset.pits, traps: v1.hazards === "high" },
    enemies: (v1.enemies || []).map((e) => V1_ENEMY[e]).filter(Boolean),
    difficulty: v1.difficulty,
    enemyDensity: v1.enemyDensity,
    hazards: v1.hazards,
    powerups: v1.powerups,
  });
}

// -------------------------------------------------------------- offline parser

const PRESET_WORDS = {
  frost: /\b(ice|icy|snow\w*|frozen|winter|cold|arctic|glacier|frost\w*|blizzard|tundra)\b/i,
  volcano: /\b(lava|volcan\w*|magma|fire|fiery|inferno|hell\w*|molten|ember\w*|burn\w*)\b/i,
  dunes: /\b(desert|sand\w*|dune\w*|cactus|pyramid\w*|canyon|dry|egypt\w*|oasis)\b/i,
  grave:
    /\b(grave\w*|spooky|haunt\w*|ghosts?|skelet\w*|tomb\w*|cemetery|halloween|crypt|zombies?|vampire\w*|witch\w*)\b/i,
  factory:
    /\b(factor\w*|robots?|machine\w*|steel|metal|lab\w*|industr\w*|toxic|mech\w*|cyber\w*|neon|city)\b/i,
  candy:
    /\b(candy|sweet\w*|sugar\w*|cake\w*|chocolate|dessert\w*|lollipop\w*|cookie\w*|bubblegum)\b/i,
  crystal: /\b(crystal\w*|cave\w*|cavern\w*|gem\w*|mine\w*|underground|diamond\w*|amethyst)\b/i,
  ocean: /\b(ocean\w*|sea|beach\w*|island\w*|coral|reef|underwater|pirate\w*|tropic\w*)\b/i,
  jungle: /\b(jungle\w*|rainforest|swamp\w*|vine\w*|tribal|safari)\b/i,
  space: /\b(space|moon\w*|alien\w*|planet\w*|galaxy|star\w*|cosmic|asteroid\w*|mars)\b/i,
  ruins: /\b(ruin\w*|temple\w*|ancient|castle\w*|kingdom|knight\w*|fortress)\b/i,
  meadow: /\b(grass\w*|forest|meadow|green|field\w*|hill\w*|garden|farm\w*|spring)\b/i,
};

const NAME_WORDS = {
  meadow: [
    ["Sunny", "Green", "Clover", "Breezy"],
    ["Meadows", "Hills", "Glade", "Fields"],
  ],
  frost: [
    ["Frost", "Glacier", "Snowy", "Icicle"],
    ["Peaks", "Hollow", "Wastes", "Ridge"],
  ],
  dunes: [
    ["Scorch", "Golden", "Dune", "Mirage"],
    ["Sands", "Canyon", "Expanse", "Basin"],
  ],
  grave: [
    ["Gloom", "Moonlit", "Hollow", "Whisper"],
    ["Graves", "Crypts", "Manor", "Moor"],
  ],
  factory: [
    ["Iron", "Gear", "Volt", "Rust"],
    ["Works", "Foundry", "Plant", "Yards"],
  ],
  volcano: [
    ["Magma", "Cinder", "Blaze", "Ember"],
    ["Peak", "Caldera", "Depths", "Forge"],
  ],
  candy: [
    ["Sugar", "Gumdrop", "Candy", "Frosted"],
    ["Kingdom", "Lanes", "Hills", "Land"],
  ],
  crystal: [
    ["Crystal", "Gleam", "Prism", "Echo"],
    ["Caverns", "Mines", "Grotto", "Depths"],
  ],
  ocean: [
    ["Coral", "Tide", "Sunken", "Azure"],
    ["Coast", "Reef", "Shores", "Isles"],
  ],
  jungle: [
    ["Vine", "Wild", "Emerald", "Thunder"],
    ["Jungle", "Thicket", "Wilds", "Falls"],
  ],
  space: [
    ["Star", "Nova", "Lunar", "Cosmo"],
    ["Station", "Moon", "Rift", "Belt"],
  ],
  ruins: [
    ["Ancient", "Lost", "Sunken", "Elder"],
    ["Ruins", "Temple", "Citadel", "Keep"],
  ],
};

const CREATURE_NAMES = {
  first: ["Gloop", "Snarl", "Bumble", "Zap", "Crag", "Fizz", "Murk", "Spike", "Flutter", "Chomp"],
  boss: ["Titan", "Tyrant", "Overlord", "Colossus", "Monarch", "Behemoth", "Warden", "Queen"],
};

// animals and things players ask for -> a creature design
const CREATURE_WORDS = [
  [/\b(bats?|birds?|flying|flyers?|wasps?|bees?|ghosts?|dragons?)\b/i, "flyer", "round"],
  [/\b(plants?|spitters?|turrets?|cannons?|flowers?)\b/i, "turret", "spiky"],
  [/\b(slimes?|goo|blobs?|ooze|jelly)\b/i, "walker", "blob"],
  [/\b(beetles?|bugs?|insects?|crabs?|spiders?|scorpions?)\b/i, "walker", "bug"],
  [/\b(robots?|golems?|boxes|blocks?|mechs?)\b/i, "walker", "box"],
  [/\b(lizards?|chameleons?|reptiles?|zombies?|skeletons?|aliens?)\b/i, "walker", "tall"],
  [/\b(urchins?|hedgehogs?|porcupines?|cactus\w*)\b/i, "walker", "spiky"],
];

/** A full v2 spec from a description, without the AI. Same prompt -> same spec. */
export function specFromPrompt(prompt = "") {
  const text = String(prompt);
  const rng = rngFrom(hashString(text.toLowerCase()));
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const presetName =
    Object.keys(PRESET_WORDS).find((key) => PRESET_WORDS[key].test(text)) ||
    pick(["meadow", "jungle", "ruins", "meadow"]);
  const preset = PRESETS[presetName];

  let difficulty = 2;
  if (/\b(easy|chill|relax\w*|kids?|gentle|beginner|cozy)\b/i.test(text)) difficulty = 1;
  if (/\b(hard|tough|difficult|challenging)\b/i.test(text)) difficulty = 4;
  if (/\b(very hard|insane|brutal|impossible|nightmare|extreme)\b/i.test(text)) difficulty = 5;

  const many = /\b(lots|many|swarm\w*|full of|army|horde|crowded)\b/i.test(text);
  const few = /\b(few|quiet|peaceful|empty|calm)\b/i.test(text);
  const pits = /\b(pits?|gaps?|spikes?|traps?|danger\w*|cliffs?)\b/i.test(text);

  // creatures the player named, then fill up to three
  const designs = CREATURE_WORDS.filter(([re]) => re.test(text)).map(([, behavior, body]) => ({
    behavior,
    body,
  }));
  const fill = [
    { behavior: "walker", body: pick(["round", "box", "blob", "tall"]) },
    { behavior: "flyer", body: "round" },
    { behavior: "walker", body: pick(["bug", "spiky", "tall"]) },
    { behavior: "turret", body: "spiky" },
  ];
  for (let i = 0; designs.length < 3; i++) designs.push(fill[i]);
  const tint = (i) => (i % 2 ? preset.palette[4] : preset.palette[3]);
  const enemies = designs.slice(0, 4).map((d, i) => ({
    name: `${pick(CREATURE_NAMES.first)}${["", "let", "o", "ster"][i % 4]}`,
    behavior: d.behavior,
    body: d.body,
    color: tint(i),
    accent: tint(i + 1),
    features: [pick(OPTIONS.features), pick(OPTIONS.features)],
    speed: pick(OPTIONS.speeds),
    armored: d.body === "bug",
  }));

  const [adjectives, nouns] = NAME_WORDS[presetName];
  const named = (text.match(
    /\b(?:called|named)\s+["']?([A-Za-z0-9À-ɏ '-]{2,24}?)["']?(?=\s+(?:with|and|full|where|that|in)\b|[,.!]|$)/i,
  ) || [])[1];
  const bossFlyer = /\b(flying|dragon|bat|bird|ghost)\b/i.test(text) && rng() < 0.7;

  const bossName = `${pick(adjectives)} ${pick(CREATURE_NAMES.boss)}`;
  // a written tagline: the prompt itself is never shown to other players
  const roam = pick(["roam", "lurk", "prowl", "wander"]);
  const tagline = `${enemies[0].name}s ${roam} here, and the ${bossName} rules them all.`;

  return normalizeWorldSpec({
    version: SPEC_VERSION,
    preset: presetName,
    name: named || `${pick(adjectives)} ${pick(nouns)}`,
    tagline,
    terrain: { surface: preset.surface, pits: preset.pits, traps: pits || difficulty >= 4 },
    enemies,
    boss: {
      name: bossName,
      body: pick(OPTIONS.bodies),
      color: preset.palette[4],
      accent: preset.palette[3],
      features: ["horns", pick(OPTIONS.features)],
      flyer: bossFlyer,
      moves: bossFlyer
        ? ["swoop", "rings", pick(["swarm", "fan", "icicles", "missiles"])]
        : [
            "charge",
            pick(["stomp", "bounce", "quake"]),
            pick(["fan", "summon", "laser", "icicles"]),
          ],
    },
    music: { mood: preset.mood, tempo: 100 + Math.floor(rng() * 50), lead: pick(OPTIONS.leads) },
    difficulty,
    enemyDensity: many ? "high" : few ? "low" : "medium",
    hazards: pits ? "high" : difficulty <= 1 ? "low" : "medium",
  });
}

// ---------------------------------------------------------------- world record

/**
 * A shared world as stored in the repository:
 *   { id, name, tagline, spec, seed, author: { uid, name }, createdAt, version }
 * Validates anything (from the network, another device, an old save) into
 * that shape, or returns null when it can't be played.
 */
export function sanitizeWorld(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[A-Za-z0-9_-]{4,48}$/.test(id)) return null;
  const spec = normalizeWorldSpec(raw.spec || {});
  const author = raw.author && typeof raw.author === "object" ? raw.author : {};
  const created = Number(raw.createdAt || raw.created);
  return {
    id,
    name: cleanText(raw.name || spec.name, 24, spec.name),
    tagline: cleanText(raw.tagline ?? spec.tagline, 80, ""),
    spec,
    seed: clampInt(raw.seed, 0, 2 ** 31 - 1, hashString(id) % 1e9),
    author: {
      uid: String(author.uid || "")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 64),
      name: cleanText(author.name, 20, "Someone"),
    },
    createdAt: Number.isFinite(created) && created > 0 ? created : Date.now(),
    version: SPEC_VERSION,
  };
}

/** A new world record for `spec`, made by `user` ({ uid, displayName }). */
export function newWorld(spec, user, { now = Date.now(), random = Math.random } = {}) {
  const clean = normalizeWorldSpec(spec);
  return sanitizeWorld({
    id: `w${now.toString(36)}${Math.floor(random() * 36 ** 6)
      .toString(36)
      .padStart(6, "0")}`,
    name: clean.name,
    tagline: clean.tagline,
    spec: clean,
    seed: Math.floor(random() * 1e9),
    author: { uid: user ? user.uid : "", name: user ? user.displayName : "Someone" },
    createdAt: now,
  });
}

// ---------------------------------------------------------------------- search

/** The name a world shows once its creator deleted their account. */
export const ANONYMOUS = "Anonymous";

const fold = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** A search box's words, lowercased and without accents (at most 6). */
export const searchTerms = (query) =>
  fold(String(query || "").slice(0, 60))
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 6);

/**
 * Worlds whose name, creator, tagline or boss contain every word of `query`,
 * names that start with it first, then newest first. The game filters the
 * worlds it has loaded with it, and the searchWorlds function all of them.
 */
export function matchWorlds(list, query, max = Infinity) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  return list
    .map((world) => {
      if (!world || typeof world !== "object") return null;
      const name = fold(world.name);
      const text = [
        name,
        fold(world.author && world.author.name),
        fold(world.tagline),
        fold(world.spec && world.spec.boss && world.spec.boss.name),
      ].join(" ");
      if (!terms.every((term) => text.includes(term))) return null;
      const rank =
        (name.startsWith(terms[0]) ? 2 : 0) + (terms.every((t) => name.includes(t)) ? 1 : 0);
      return { world, rank };
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank || (b.world.createdAt || 0) - (a.world.createdAt || 0))
    .slice(0, max)
    .map((hit) => hit.world);
}
