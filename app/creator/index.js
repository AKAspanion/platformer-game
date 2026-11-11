import { normalizeWorldSpec, specFromPrompt, sanitizeWorld } from "../worlds/spec";

/**
 * Prompt-to-world creator (premium, needs sign-in).
 *
 * The player describes a world ("a frozen fortress full of bats, really
 * hard"). Claude (the designWorld function, functions/index.js) turns that
 * into a world spec: palette, terrain, backdrop, decor, 2-4 creature designs,
 * a boss with its moves, a music mood. app/gen then paints, composes and
 * builds the whole world (5 levels + a boss arena) from the spec on each
 * device. When the designer can't be reached, the keyword parser in
 * app/worlds/spec.js writes the spec offline.
 */

export { specFromPrompt, normalizeWorldSpec };

/**
 * Ask the AI designer for a spec: `design(prompt)` -> raw spec. Falls back to
 * the offline parser without a designer, or when it fails or takes too long;
 * `source` says which one produced the spec.
 */
export async function requestSpec(prompt, design, { timeoutMs = 75000 } = {}) {
  if (!design) return { spec: specFromPrompt(prompt), source: "offline" };
  let timer = null;
  try {
    const raw = await Promise.race([
      design(String(prompt).slice(0, 400)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("the designer took too long")), timeoutMs);
      }),
    ]);
    if (!raw || typeof raw !== "object") throw new Error("the designer sent nothing back");
    return { spec: normalizeWorldSpec(raw.spec || raw), source: "ai" };
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
