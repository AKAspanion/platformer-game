import { normalizeWorldSpec, specFromPrompt, sanitizeWorld } from "../worlds/spec";

/**
 * Prompt-to-world creator (premium, needs sign-in).
 *
 * The player describes a world ("a frozen fortress full of bats, really
 * hard"). The AI (server/world-api.mjs) turns that into a world spec: palette,
 * terrain, backdrop, decor, 2-4 creature designs, a boss with its moves, a
 * music mood. app/gen then paints, composes and builds the whole world (5
 * levels + a boss arena) from the spec on each device. Without a server, the
 * keyword parser in app/worlds/spec.js writes the spec offline.
 */

export { specFromPrompt, normalizeWorldSpec };

/**
 * Ask the world server for a spec. Falls back to the offline parser when no
 * server is set or it fails; `source` says which one produced the spec.
 */
export async function requestSpec(prompt, serverUrl, { timeoutMs = 20000 } = {}) {
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
    return { spec: normalizeWorldSpec(body.spec || body), source: "ai" };
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

// ---------------------------------------------------------------- my worlds

const KEY = "my_worlds";
const MAX_WORLDS = 30;

/**
 * Worlds made on this device (also published to the shared repository).
 * Older saves (v1 specs) are upgraded on read.
 */
export const worlds = {
  list() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY)) || [];
      return list.map(sanitizeWorld).filter(Boolean);
    } catch (error) {
      return [];
    }
  },
  save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_WORLDS)));
    } catch (error) {
      // storage full: the world is still in the shared repository
    }
  },
  add(world) {
    const clean = sanitizeWorld(world);
    if (!clean) return null;
    this.save([clean, ...this.list().filter((w) => w.id !== clean.id)]);
    return clean;
  },
  remove(id) {
    this.save(this.list().filter((w) => w.id !== id));
  },
};
