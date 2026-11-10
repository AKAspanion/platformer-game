import { ALL_ENEMIES, POWERUPS } from "../pcg/generator";

/**
 * Prompt-to-world creator (premium).
 *
 * The player describes a world ("a frozen fortress full of bats, really
 * hard"). A language model only turns that into a small, validated WorldSpec;
 * the level generator (app/pcg) builds the actual levels from it. That keeps
 * every level playable and keeps the model call tiny and cheap.
 *
 * With a server configured (server/world-api.mjs, Claude Haiku 5.5) the spec
 * comes from the model; without one, a keyword parser below makes a spec so
 * the feature still works offline.
 */

// Player-facing world names -> area themes (the theme is also the music track).
const THEME_IDS = {
  grasslands: "grasslands",
  iceland: "iceland",
  desert: "desert",
  graveyard: "dungeon",
  factory: "lab",
};

export const SPEC_LIMITS = {
  themes: Object.keys(THEME_IDS),
  enemies: ALL_ENEMIES,
  powerups: POWERUPS,
  levels: [1, 5],
  difficulty: [1, 5],
  densities: ["low", "medium", "high"],
};

const clamp = (n, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)));
const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);
const someOf = (values, list, fallback) => {
  const kept = Array.isArray(values) ? [...new Set(values.filter((v) => list.includes(v)))] : [];
  return kept.length ? kept : fallback;
};

/** Validate and clamp anything (model output or user data) into a WorldSpec. */
export function normalizeSpec(raw = {}) {
  const name = String(raw.name || "My World")
    .replace(/[^A-Za-z0-9\u00C0-\u024F '!-]/g, "")
    .trim()
    .slice(0, 24);
  return {
    name: name || "My World",
    theme: oneOf(raw.theme, SPEC_LIMITS.themes, "grasslands"),
    levels: clamp(raw.levels ?? 3, SPEC_LIMITS.levels),
    difficulty: clamp(raw.difficulty ?? 2, SPEC_LIMITS.difficulty),
    enemies: someOf(raw.enemies, SPEC_LIMITS.enemies, ["pig", "chameleon"]),
    enemyDensity: oneOf(raw.enemyDensity, SPEC_LIMITS.densities, "medium"),
    hazards: oneOf(raw.hazards, SPEC_LIMITS.densities, "medium"),
    powerups: someOf(raw.powerups, SPEC_LIMITS.powerups, POWERUPS),
    tagline: String(raw.tagline || "").slice(0, 80),
  };
}

const DENSITY = { low: 0.6, medium: 1, high: 1.4 };

/** WorldSpec -> per-level options for generateSequence. Difficulty ramps up. */
export function levelsFromSpec(spec) {
  return Array.from({ length: spec.levels }, (_, i) => ({
    theme: THEME_IDS[spec.theme],
    difficulty: Math.min(5, spec.difficulty + Math.floor((i * 2) / Math.max(2, spec.levels))),
    enemyTypes: spec.enemies,
    enemyScale: DENSITY[spec.enemyDensity],
    pitScale: DENSITY[spec.hazards],
    powerups: spec.powerups,
    powerupCount: spec.difficulty >= 4 ? 2 : 1,
  }));
}

// ---------------------------------------------------------------- offline parser

const WORDS = {
  theme: {
    iceland: /\b(ice|icy|snow\w*|frozen|winter|cold|arctic|glacier|frost\w*)\b/i,
    desert: /\b(desert|sand\w*|dune\w*|cactus|hot|pyramid|canyon|dry)\b/i,
    graveyard: /\b(grave\w*|spooky|haunt\w*|ghosts?|skelet\w*|tomb\w*|cemetery|halloween|crypt|zombies?)\b/i,
    factory: /\b(factor\w*|robots?|machine\w*|steel|metal|lab\w*|industr\w*|acid|toxic|mech\w*)\b/i,
    grasslands: /\b(grass\w*|forest|jungle|meadow|green|field\w*|hill\w*|garden)\b/i,
  },
  enemies: {
    pig: /\b(pigs?|boars?|hogs?)\b/i,
    slime: /\b(slimes?|goo|blobs?|ooze)\b/i,
    chameleon: /\b(chameleons?|lizards?|reptiles?)\b/i,
    beetle: /\b(beetles?|bugs?|insects?|armou?r\w*|tanks?)\b/i,
    bat: /\b(bats?|flying|flyers?|cave|night)\b/i,
    spitter: /\b(spitters?|plants?|shoot\w*|turrets?|snipers?)\b/i,
  },
  powerups: {
    heart: /\b(hearts?|health|lives?|heal\w*)\b/i,
    shield: /\b(shields?|armou?r|protect\w*)\b/i,
    triple: /\b(triple|fire\w*|power(ful)?|blast\w*)\b/i,
    wings: /\b(wings?|double jump|fly|flight|air)\b/i,
  },
};

export function specFromPrompt(prompt = "") {
  const text = String(prompt);
  const theme = Object.keys(WORDS.theme).find((key) => WORDS.theme[key].test(text)) || "grasslands";
  const enemies = Object.keys(WORDS.enemies).filter((key) => WORDS.enemies[key].test(text));
  const powerups = Object.keys(WORDS.powerups).filter((key) => WORDS.powerups[key].test(text));

  let difficulty = 2;
  if (/\b(easy|chill|relax\w*|kids?|gentle|beginner)\b/i.test(text)) difficulty = 1;
  if (/\b(hard|tough|difficult|challenging)\b/i.test(text)) difficulty = 4;
  if (/\b(very hard|insane|brutal|impossible|nightmare|extreme)\b/i.test(text)) difficulty = 5;

  const levelsMatch = text.match(/\b([1-5])\s*(levels?|stages?|areas?)\b/i);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const wordMatch = text.match(/\b(one|two|three|four|five)\s*(levels?|stages?|areas?)\b/i);
  const levels = levelsMatch ? +levelsMatch[1] : wordMatch ? words[wordMatch[1].toLowerCase()] : 3;

  const many = /\b(lots|many|swarm\w*|full of|army|horde|crowded)\b/i.test(text);
  const few = /\b(few|quiet|peaceful|empty|calm)\b/i.test(text);
  const pits = /\b(pits?|gaps?|spikes?|traps?|danger\w*|lava|cliffs?)\b/i.test(text);

  const name =
    (text.match(
      /\b(?:called|named)\s+["']?([A-Za-z0-9\u00C0-\u024F '-]{2,24}?)["']?(?=\s+(?:with|and|full|where|that|in)\b|[,.!]|$)/i,
    ) || [])[1] ||
    `${{ iceland: "Frost", desert: "Dune", graveyard: "Ghost", factory: "Iron" }[theme] || "Green"} ${
      ["Trail", "Run", "Quest", "Valley", "Peaks"][text.length % 5]
    }`;

  return normalizeSpec({
    name,
    theme,
    levels,
    difficulty,
    enemies: enemies.length ? enemies : undefined,
    enemyDensity: many ? "high" : few ? "low" : "medium",
    hazards: pits ? "high" : difficulty <= 1 ? "low" : "medium",
    powerups: powerups.length ? powerups : undefined,
    tagline: text.slice(0, 80),
  });
}

/**
 * Ask the world server for a spec. Falls back to the offline parser when no
 * server is set or it fails; `source` says which one produced the spec.
 */
export async function requestSpec(prompt, serverUrl, { timeoutMs = 15000 } = {}) {
  if (!serverUrl) return { spec: specFromPrompt(prompt), source: "offline" };
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller && setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: String(prompt).slice(0, 400) }),
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) throw new Error(`server returned ${response.status}`);
    const body = await response.json();
    return { spec: normalizeSpec(body.spec || body), source: "ai" };
  } catch (error) {
    return {
      spec: specFromPrompt(prompt),
      source: "offline",
      error: String(error.message || error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- saved worlds

const KEY = "my_worlds";
const MAX_WORLDS = 12;

export const worlds = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (error) {
      return [];
    }
  },
  save(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_WORLDS)));
  },
  add(prompt, spec) {
    const world = {
      id: `w${Date.now().toString(36)}`,
      name: spec.name,
      prompt: String(prompt).slice(0, 400),
      spec,
      seed: Math.floor(Math.random() * 1e9),
      created: Date.now(),
    };
    this.save([world, ...this.list()]);
    return world;
  },
  remove(id) {
    this.save(this.list().filter((w) => w.id !== id));
  },
};
