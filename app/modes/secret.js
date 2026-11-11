import { createCustomSession } from "./index";
import { newWorld, sanitizeWorld, specFromPrompt } from "../worlds/spec";

/**
 * Starfall Peaks, the secret sixth world. It is built into the game from a
 * fixed world spec (no AI, no network) and plays like a shared world: its own
 * tiles, music, enemies and boss, with its best score kept as a record.
 */
export const STARFALL_ID = "starfall-peaks";

const PROMPT = "Snowy starlit peaks above the clouds, with bats and frost slimes, hard";
const SEED = 7777;
const MADE_AT = Date.UTC(2026, 10, 1);

/** The same record every call: fixed time, fixed "random", fixed seed. */
export function starfallWorld() {
  return sanitizeWorld({
    ...newWorld(
      specFromPrompt(PROMPT),
      { uid: "starfall", displayName: "Dino Team" },
      { now: MADE_AT, random: () => 0.5 },
    ),
    id: STARFALL_ID,
    name: "Starfall Peaks",
    seed: SEED,
  });
}

export function createSecretSession() {
  return { ...createCustomSession(starfallWorld()), kind: "secret" };
}
