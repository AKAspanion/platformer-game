/**
 * World server for Dino's Adventure: the prompt-to-world designer and the
 * shared world repository.
 *
 *   POST /api/world   { "prompt": "a frozen fortress full of bats, hard" }
 *     -> 200 { "spec": { name, palette, terrain, backdrop, decor, enemies, boss, music, ... } }
 *   /api/worlds ...   shared worlds: list, publish, live stream (see worlds-store.mjs)
 *
 * Claude only writes a world spec (structured output, validated against the
 * schema below and normalized again with the game's normalizeWorldSpec). The
 * game paints the art, composes the music and builds the 6 levels from it on
 * every device, so every level stays playable and the call stays small.
 *
 * The API key stays here, never in the game. Run:
 *   cd server && npm install && ANTHROPIC_API_KEY=... npm start
 * Env: PORT (8787), ALLOWED_ORIGINS (comma list), RATE_LIMIT_PER_HOUR (30 per
 * IP for designs; 20 per user for publishing), WORLD_MODEL (claude-haiku-5-5),
 * DATA_FILE (./data/worlds.json), AUTH_MODE (mock).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OPTIONS, normalizeWorldSpec } from "../app/worlds/spec.js";
import { WorldStore, handleWorlds } from "./worlds-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.WORLD_MODEL || "claude-haiku-5-5";
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://akaspanion.github.io,http://localhost:2108"
).split(",");
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 30);
const AUTH_MODE = process.env.AUTH_MODE || "mock";
const store = new WorldStore(process.env.DATA_FILE || path.join(here, "data", "worlds.json"));

// Mirrors app/worlds/spec.js (OPTIONS); normalizeWorldSpec clamps it again.
const Color = z.string().describe('A hex colour like "#3a9a2a"');
const Creature = z.object({
  name: z.string().describe("Short creature name, at most 18 characters"),
  behavior: z
    .enum(OPTIONS.behaviors)
    .describe("walker patrols the ground, flyer swoops over pits, turret stands still and spits"),
  body: z.enum(OPTIONS.bodies),
  color: Color,
  accent: Color,
  features: z.array(z.enum(OPTIONS.features)).describe("Up to 3"),
  speed: z.enum(OPTIONS.speeds),
  armored: z.boolean().describe("Takes two fireballs; use for at most one creature"),
});
const WorldSpec = z.object({
  name: z.string().describe("World name, at most 24 characters"),
  tagline: z.string().describe("One playful sentence, at most 80 characters"),
  palette: z.object({
    skyTop: Color,
    skyBottom: Color,
    ground: Color.describe("Dirt / rock under the surface"),
    surface: Color.describe("Top layer: grass, snow, sand, frosting..."),
    accent: Color.describe("Bright highlight colour for crystals, lights, details"),
    liquid: Color.describe("Colour of the liquid in pits"),
  }),
  terrain: z.object({
    surface: z.enum(OPTIONS.surfaces),
    pits: z.enum(OPTIONS.pits).describe("liquid pools, spike floors, or bottomless"),
    traps: z.boolean().describe("Spike traps on the ground"),
  }),
  backdrop: z.object({
    skyline: z.enum(OPTIONS.skylines),
    celestial: z.enum(OPTIONS.celestials),
  }),
  decor: z.array(z.enum(OPTIONS.decor)).describe("2 to 4 decorations"),
  enemies: z.array(Creature).describe("2 to 4 creatures, at least one walker"),
  boss: z.object({
    name: z.string().describe("Boss name, at most 20 characters"),
    body: z.enum(OPTIONS.bodies),
    color: Color,
    accent: Color,
    features: z.array(z.enum(OPTIONS.features)),
    flyer: z.boolean(),
    moves: z.array(z.enum(OPTIONS.bossMoves)).describe("3 to 5 attacks"),
  }),
  music: z.object({
    mood: z.enum(OPTIONS.moods),
    tempo: z.number().describe("Beats per minute, 70 to 180"),
    lead: z.enum(OPTIONS.leads).describe("Chiptune lead voice"),
  }),
  difficulty: z.number().describe("1 = very easy, 5 = very hard"),
  enemyDensity: z.enum(OPTIONS.densities),
  hazards: z.enum(OPTIONS.densities).describe("How many pits and traps"),
  powerups: z.array(z.enum(OPTIONS.powerups)),
});

const SYSTEM = `You design worlds for "Dino's Adventure", a pixel-art 2D platformer where a dinosaur runs, jumps and spits fireballs.
A world has 5 levels and a boss fight. The game paints the art, composes chiptune music and builds the levels from your spec, so you only choose its settings.

Look: pick a palette that reads well (sky colours light enough or dark enough for the ground to stand out; surface clearly different from ground), a surface style, a skyline and decorations that fit the place.
Creatures: 2-4 enemies with names, bodies, colours and features that fit the world. Behaviours: walker (patrols and lunges), flyer (swoops at the player from above), turret (stands still, spits seeds). At least one walker.
Boss: a bigger creature with a name and 3-5 moves:
- ground moves (not for flyers): charge (dash across the arena), rocket (faster dash that bounces back), stomp (heavy hop, rolling seeds), bounce (three hops), quake (big jump, shock waves)
- any boss: icicles (things fall on marked spots), vanish (reappears behind the player), tongue (long lash), fan (spray of projectiles), rings (rings of orbs), swarm (calls flying minions), missiles (lobbed bombs), laser (floor beam), summon (calls walking minions)
- flyers only: swoop (dive at the player)
Music: a mood and tempo that fit (spooky and slow for a haunted house, fast and heroic for a sky castle).

Follow what the player asked for (place, creatures, boss, difficulty). When they don't say, pick a fun, fair mix at difficulty 2.
Keep every name and the tagline family friendly, whatever the description says.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const hits = new Map(); // key -> timestamps (ms) in the last hour
const limited = (key, limit = RATE_LIMIT) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
};

async function designWorld(prompt) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(WorldSpec) },
    system: SYSTEM,
    messages: [{ role: "user", content: `World description: ${prompt}` }],
  });

  if (response.stop_reason === "refusal") return { refused: true };
  if (!response.parsed_output) throw new Error(`no spec (stop_reason: ${response.stop_reason})`);
  return {
    spec: normalizeWorldSpec({ ...response.parsed_output, version: 2 }),
    usage: response.usage,
  };
}

const readBody = (req, limit = 4096) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const corsFor = (origin) =>
  origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

const send = (res, status, body, origin) => {
  res.writeHead(status, { "Content-Type": "application/json", ...corsFor(origin) });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const origin = ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : null;

  if (req.method === "OPTIONS") {
    res.writeHead(origin ? 204 : 403, {
      ...(origin
        ? {
            ...corsFor(origin),
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          }
        : {}),
    });
    return res.end();
  }

  // the shared repository (reading needs no origin check: worlds are public)
  if (
    await handleWorlds(req, res, {
      store,
      cors: corsFor(origin),
      authMode: AUTH_MODE,
      readBody,
      limiter: (key) => limited(key, 20),
    })
  ) {
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/world")
    return send(res, 404, { error: "not found" }, origin);
  if (!origin) return send(res, 403, { error: "origin not allowed" });

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  if (limited(`design:${ip}`))
    return send(res, 429, { error: "too many worlds, try again later" }, origin);

  let prompt;
  try {
    prompt = String(JSON.parse(await readBody(req)).prompt || "")
      .trim()
      .slice(0, 400);
  } catch (error) {
    return send(res, 400, { error: "send JSON: { prompt }" }, origin);
  }
  if (prompt.length < 3) return send(res, 400, { error: "describe your world" }, origin);

  try {
    const result = await designWorld(prompt);
    if (result.refused)
      return send(res, 422, { error: "try describing a different world" }, origin);
    console.log(
      `world "${result.spec.name}" in=${result.usage.input_tokens} out=${result.usage.output_tokens}`,
    );
    return send(res, 200, { spec: result.spec }, origin);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return send(res, 503, { error: "busy, try again in a minute" }, origin);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}: ${error.message}`);
      return send(res, 502, { error: "world designer unavailable" }, origin);
    }
    console.error(error);
    return send(res, 500, { error: "something went wrong" }, origin);
  }
});

server.listen(PORT, () =>
  console.log(`world API on http://localhost:${PORT} (${MODEL}, auth: ${AUTH_MODE})`),
);
