/**
 * Claude writes a world spec (structured output, validated against the
 * schema below and normalized again with the game's normalizeWorldSpec).
 * The game paints the art, composes the music and builds the 6 levels from
 * it on every device, so every level stays playable and the call stays small.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { OPTIONS, normalizeWorldSpec } from "../shared/spec.js";

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
export const WorldSpec = z.object({
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

export const SYSTEM = `You design worlds for "Dino's Adventure", a pixel-art 2D platformer where a dinosaur runs, jumps and spits fireballs.
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

/** A designer bound to an API key: design(prompt) -> { spec, usage } | { refused: true }. */
export function createDesigner({ apiKey, model }) {
  const client = new Anthropic({ apiKey });
  return async function design(prompt) {
    const response = await client.messages.parse({
      model,
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
  };
}

export { Anthropic };
