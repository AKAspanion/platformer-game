/**
 * Prompt-to-world API for Dino's Adventure.
 *
 *   POST /api/world  { "prompt": "a frozen fortress full of bats, hard" }
 *   -> 200 { "spec": { name, theme, levels, difficulty, enemies, ... } }
 *
 * Claude only writes a small WorldSpec (structured output, validated against
 * the schema below); the game's level generator builds the actual levels from
 * it, so every level stays playable. That makes the cheapest model enough:
 * Claude Haiku 5.5 at low effort, a few hundred tokens per world.
 *
 * The API key stays here, never in the game. Run:
 *   cd server && npm install && ANTHROPIC_API_KEY=... npm start
 * Env: PORT (8787), ALLOWED_ORIGINS (comma list; default the GitHub Pages
 * site and localhost dev), RATE_LIMIT_PER_HOUR (30 per IP).
 */
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const PORT = Number(process.env.PORT || 8787);
const MODEL = "claude-haiku-5-5";
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://akaspanion.github.io,http://localhost:2108"
).split(",");
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 30);

// Keep in sync with app/creator/index.js (normalizeSpec clamps it again there).
const WorldSpec = z.object({
  name: z.string().describe("Short world name, at most 24 characters"),
  tagline: z.string().describe("One playful sentence about the world, at most 80 characters"),
  theme: z.enum(["grasslands", "iceland", "desert", "graveyard", "factory"]),
  levels: z.enum(["1", "2", "3", "4", "5"]).describe("How many levels"),
  difficulty: z.enum(["1", "2", "3", "4", "5"]).describe("1 = very easy, 5 = very hard"),
  enemies: z
    .array(z.enum(["pig", "slime", "chameleon", "beetle", "bat", "spitter"]))
    .describe("Enemy kinds to use"),
  enemyDensity: z.enum(["low", "medium", "high"]),
  hazards: z.enum(["low", "medium", "high"]).describe("How many pits and spike traps"),
  powerups: z.array(z.enum(["heart", "shield", "triple", "wings"])),
});

const SYSTEM = `You design worlds for "Dino's Adventure", a pixel-art 2D platformer where a dinosaur runs, jumps and spits fireballs.
Turn the player's description into a world spec. The game builds the levels from the spec, so you only choose its settings.

Themes: grasslands (green hills, water pits), iceland (snow, ice), desert (sand, spike pits), graveyard (moonlit tombstones, bottomless pits), factory (steel girders, acid pools, saw blades).
Enemies: pig (fast walker), slime (slow walker), chameleon (walker), beetle (armoured walker, takes two fireballs), bat (flies over pits and swoops), spitter (plant that shoots seeds).
Power-ups: heart (+1 heart), shield (blocks one hit), triple (three fireballs per shot), wings (double jump).

Follow what the player asked for (theme, enemies, how hard, how many levels). When they don't say, pick a fun, fair mix: 3 levels, difficulty 2, two or three enemy kinds.
Keep the name and tagline family friendly, whatever the description says.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const hits = new Map(); // ip -> timestamps (ms) in the last hour
const limited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
};

async function designWorld(prompt) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(WorldSpec) },
    system: SYSTEM,
    messages: [{ role: "user", content: `World description: ${prompt}` }],
  });

  if (response.stop_reason === "refusal") return { refused: true };
  if (!response.parsed_output) throw new Error(`no spec (stop_reason: ${response.stop_reason})`);
  const spec = response.parsed_output;
  return {
    spec: { ...spec, levels: Number(spec.levels), difficulty: Number(spec.difficulty) },
    usage: response.usage,
  };
}

const send = (res, status, body, origin) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  res.end(JSON.stringify(body));
};

const readBody = (req, limit = 4096) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) reject(new Error("too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  const origin = ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : null;

  if (req.method === "OPTIONS") {
    res.writeHead(origin ? 204 : 403, {
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            Vary: "Origin",
          }
        : {}),
    });
    return res.end();
  }
  if (req.method !== "POST" || req.url !== "/api/world")
    return send(res, 404, { error: "not found" }, origin);
  if (!origin) return send(res, 403, { error: "origin not allowed" });

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  if (limited(ip)) return send(res, 429, { error: "too many worlds, try again later" }, origin);

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
  console.log(`world API on http://localhost:${PORT}/api/world (${MODEL})`),
);
